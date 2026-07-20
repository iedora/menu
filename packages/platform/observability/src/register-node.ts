import { context, metrics, trace, propagation, diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
// OTLP over http/protobuf for all three signals. Proto is the OTel-spec default
// transport, runs over Bun's mature HTTP client (never node:http2/gRPC, which is
// regression-prone under Bun), and matches the frontend so one serializer covers
// the whole platform. Each exporter is constructed BARE: it reads
// OTEL_EXPORTER_OTLP_ENDPOINT / _HEADERS / _TIMEOUT from the environment itself
// and appends the /v1/{traces,metrics,logs} path — nothing hardcoded here, so
// endpoint + auth are 100% env-driven (declarative). Metric temporality is env-
// driven too: no `temporalityPreference` is passed, so the exporter honors
// OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE and defaults to CUMULATIVE.
// That default is load-bearing for Prometheus: the collector's
// prometheusremotewrite exporter SILENTLY DROPS delta counters/histograms
// ("⚠️ Non-cumulative monotonic, histogram, and summary OTLP metrics are dropped
// by this exporter"). This replaced a hardcoded DELTA preference — a leftover
// from the dead OpenObserve backend — that was dropping every app
// histogram/counter in prod, leaving only gauges.
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
// Standard Node.js runtime metrics (nodejs.eventloop.*, v8js.*) per
// https://opentelemetry.io/docs/specs/semconv/runtime/nodejs-metrics/ — collected
// via perf_hooks/v8, independent of HTTP traffic. This is what actually answers
// "does the metrics pipeline still work" under Bun: these metrics flow on a
// fixed cadence whether or not the service has taken a single request, so a gap
// in them is a real liveness signal — unlike anything derived from request
// volume. Verified empirically to work under Bun (register despite Bun not
// being Node; perf_hooks/v8 compat is close enough here).
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { logs } from "@opentelemetry/api-logs";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";
import { ATTR_HOST_NAME } from "@opentelemetry/semantic-conventions/incubating";

import { TenantContextSpanProcessor } from "./signals/processor";
import { defaultSampler } from "./signals/sampler";

/**
 * Bundle-friendly OTel registration for short-lived Node scripts.
 *
 * Why a separate function from `registerIedoraOtel` (which uses
 * `@vercel/otel`): the @vercel/otel layer doesn't survive `bun build`
 * into a single distroless-node ESM bundle. The bundled output throws
 * `Cannot access 'a2' before initialization` at runtime — a hoisting
 * / TDZ failure in the package's internal module graph that the
 * bundler can't statically reorder.
 *
 * This function wires the same OTel signals (traces, metrics, and logs)
 * but against the underlying SDKs directly:
 *
 *   - `BasicTracerProvider` + `SimpleSpanProcessor` + `OTLPTraceExporter`
 *     (Simple, not Batch: Batch's flush timer is unref'd and never fires
 *     inside a long-lived `Bun.serve`, so spans buffer forever — see the
 *     processor note in the body)
 *   - `MeterProvider` + `PeriodicExportingMetricReader` + `OTLPMetricExporter`
 *   - `LoggerProvider` + `BatchLogRecordProcessor` + `OTLPLogExporter`
 *
 * Same Resource attrs (`service.name`, `service.namespace`,
 * `service.version`, `deployment.environment`, `host.name`), CUMULATIVE
 * metric temporality (Prometheus-native; the collector drops delta — see
 * the import note), same parent-based sampling (so the migrate
 * container honours the orchestrator's sampling decision when
 * `TRACEPARENT` arrives via env). The W3C trace-context propagator is
 * registered as the global propagator so `propagation.extract(...)` /
 * `inject(...)` work with no extra wiring. The AsyncLocalStorage context
 * manager keeps the active span across Bun/Hono async boundaries so child
 * DB spans and outbound traceparent injection attach to the request span.
 *
 * Use for any short-lived Node script (migrations, one-shot CLIs,
 * cron-style jobs) that ships bundled. Pair with `shutdownIedoraOtel()`
 * in a finally — without it the BatchSpanProcessor + metric reader
 * never push to the collector before the process exits.
 *
 * Idempotent — second call in the same process is a no-op via the
 * `globalThis.__iedora_otel_node_registered` flag.
 */
export type RegisterNodeOptions = {
  /** Required. Per-script service name (e.g. `iedora-migrate`). */
  serviceName: string;
  /** Override the metric export interval (ms). Defaults to 60_000. */
  metricExportIntervalMs?: number;
};

const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 60_000;


export function registerIedoraOtelNode(opts: RegisterNodeOptions): void {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.IEDORA_OTEL_DIAG === "1") diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

  const globalKey = "__iedora_otel_node_registered" as const;
  const g = globalThis as { [globalKey]?: boolean };
  if (g[globalKey]) return;
  g[globalKey] = true;

  const environment =
    process.env.DEPLOYMENT_ENV ?? process.env.NODE_ENV ?? "development";

  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // Mirror register.ts: log once at boot so the gap is visible. With
    // no endpoint the OTLP exporters fall through to no-op behaviour,
    // but registering empty providers is still cheap and lets the
    // tracer/meter shims emit spans/metrics that simply don't ship.
    // Useful for unit tests against the helper.
    console.warn(
      `[iedora-observability:node] OTEL_EXPORTER_OTLP_ENDPOINT not set; traces, metrics will not be exported (env=${environment}).`,
    );
  }

  // Resource attrs — exact semconv keys via typed constants. Merge with
  // the SDK's default (process, host, sdk metadata).
  const attrs: Record<string, string> = {
    [ATTR_SERVICE_NAME]: opts.serviceName,
    [ATTR_SERVICE_NAMESPACE]: "iedora",
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
  };
  if (process.env.GIT_SHA) attrs[ATTR_SERVICE_VERSION] = process.env.GIT_SHA;
  if (process.env.HOST_NAME) attrs[ATTR_HOST_NAME] = process.env.HOST_NAME;
  const resource = defaultResource().merge(resourceFromAttributes(attrs));

  // Tracer provider. SimpleSpanProcessor (export each span synchronously on end),
  // NOT BatchSpanProcessor: under production Bun, BatchSpanProcessor's flush is
  // timer-driven and does NOT fire in a long-lived Bun.serve process — spans
  // buffer forever and the live service exports nothing (a referenced
  // setInterval+forceFlush worked under `bun --hot` but not under plain `bun run`).
  // SimpleSpanProcessor has no timer dependency, so spans ship reliably. The cost
  // is one OTLP request per span; if volume ever warrants batching, do it in the
  // OpenTelemetry Collector, not in-process under Bun.
  // Bare exporter: reads OTEL_EXPORTER_OTLP_ENDPOINT (+ _HEADERS, _TIMEOUT) from
  // the env and appends /v1/traces itself. Gated on the endpoint so the service
  // ships dark — no exporter, no localhost:4318 fallback — when OTel is off.
  const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter()
    : undefined;

  const tp = new BasicTracerProvider({
    resource,
    sampler: defaultSampler(environment),
    spanProcessors: [
      // TenantContextSpanProcessor stamps tenant.* attrs from
      // tenantContext.run(...). No-op for migrate scripts that never
      // call into tenantContext, but free + consistent with the Next
      // app's pipeline.
      new TenantContextSpanProcessor(),
      ...(traceExporter ? [new SimpleSpanProcessor(traceExporter)] : []),
    ],
  });
  const providerRegistered = trace.setGlobalTracerProvider(tp);
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  // Propagator — make traceparent/tracestate work both ways. The
  // orchestrator sets TRACEPARENT in the migrate container's env; the
  // first span we open extracts it as the parent so the trace
  // stitches across the docker run boundary.
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  // setGlobalTracerProvider returns false (+ warns "duplicate registration") if a
  // global is already set — then every trace.getTracer() is a no-op proxy and
  // spans are silently dropped. Assert it loudly at boot rather than debug blind.
  console.log(
    JSON.stringify({
      level: providerRegistered ? "info" : "error",
      msg: providerRegistered ? "otel-registered" : "otel-register-FAILED",
      service: opts.serviceName,
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    }),
  );

  // CRITICAL (Bun): BatchSpanProcessor's internal flush timer is unref'd and does
  // NOT fire inside a long-lived Bun.serve process, so spans buffer forever and
  // only ship on shutdown — the live service exports nothing. Drive export with a
  // normal, REFERENCED interval (do NOT unref — that is the bug). forceFlush is
  // cheap (no-op on an empty queue); shutdownOtel() still does the final flush.
  if (traceExporter) {
    // Startup export health check: create + flush one span so the service
    // reports at boot whether its trace pipeline actually reaches the collector.
    // recording=true + ok=true means the whole chain (provider → processor →
    // exporter → collector) works; anything else is a loud, greppable boot error.
    const probe = trace.getTracer("iedora").startSpan("otel.startup");
    const recording = probe.isRecording();
    probe.end();
    void tp
      .forceFlush()
      .then(() => console.log(JSON.stringify({ level: "info", msg: "otel-startup-export", recording, ok: true })))
      .catch((e) => console.log(JSON.stringify({ level: "error", msg: "otel-startup-export", recording, error: String(e) })));
  }

  // Meter provider. CUMULATIVE temporality (the exporter's env-driven default —
  // see the import note): Prometheus is cumulative-native and the collector drops
  // delta counters/histograms outright.
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const mp = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
          exportIntervalMillis:
            opts.metricExportIntervalMs ?? DEFAULT_METRIC_EXPORT_INTERVAL_MS,
        }),
      ],
    });
    metrics.setGlobalMeterProvider(mp);

    // Standard Node.js runtime metrics — see the import comment above. Started
    // only once a MeterProvider is actually registered, since it collects
    // against the global meter.
    registerInstrumentations({
      instrumentations: [new RuntimeNodeInstrumentation()],
    });

    // Logger provider → Loki. Register globally so the package's `logger` export
    // (a ProxyLogger that re-resolves this provider at emit time) ships records
    // over OTLP, with trace_id/span_id auto-stamped from the active span by the
    // Logs SDK. Bun-safe by construction: this is the Logs SDK/API directly, NOT
    // @opentelemetry/instrumentation-pino (module-patching, which doesn't fire
    // under Bun). BatchLogRecordProcessor batches the write path off the request.
    const lp = new LoggerProvider({
      resource,
      processors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
    });
    logs.setGlobalLoggerProvider(lp);
  }
}
