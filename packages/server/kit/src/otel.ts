// Telemetry adapter — the ONE place menu's server-kit touches OpenTelemetry, now
// backed by the published @iedora/observability (standard NodeSDK) + @hono/otel.
// Menu's tenant attribution (an AsyncLocalStorage store stamped onto spans) is
// preserved via a span processor handed to register()'s extraSpanProcessors —
// so nothing downstream changes.
import { AsyncLocalStorage } from "node:async_hooks";

import { httpInstrumentationMiddleware } from "@hono/otel";
import {
  context,
  logger as pubLogger,
  propagation,
  register,
  SeverityNumber,
  shutdown,
  SpanKind,
  SpanStatusCode,
  trace,
  tracer as pubTracer,
} from "@iedora/observability";
import type { Context, Span } from "@opentelemetry/api";
import type { ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { Env } from "hono";
import type { LogEvent } from "kysely";

export { context, propagation, SpanKind, SpanStatusCode, trace };

// Tenant attribution keys — menu domain (the generic package carries none).
export const IEDORA_RESTAURANT_ID = "tenant.restaurant_id" as const;
export const IEDORA_TENANT_ID = "tenant.id" as const;

export type TenantAttrs = { restaurantId: string; tenantId?: string };

// Tenant carried on an AsyncLocalStorage store: set once at the request boundary,
// every span created inside inherits the attribution via the processor below.
const tenantStorage = new AsyncLocalStorage<TenantAttrs>();
export const tenantContext = {
  run<T>(attrs: TenantAttrs, fn: () => T): T {
    return tenantStorage.run(attrs, fn);
  },
  enterWith(attrs: TenantAttrs): TenantAttrs | undefined {
    const prev = tenantStorage.getStore();
    tenantStorage.enterWith(attrs);
    return prev;
  },
  get(): TenantAttrs | undefined {
    return tenantStorage.getStore();
  },
};

/** Stamps tenant.* onto every span started inside a tenantContext scope. */
class TenantContextSpanProcessor implements SpanProcessor {
  onStart(span: Span, _parent: Context): void {
    const t = tenantContext.get();
    if (!t) return;
    span.setAttribute(IEDORA_RESTAURANT_ID, t.restaurantId);
    if (t.tenantId) span.setAttribute(IEDORA_TENANT_ID, t.tenantId);
  }
  onEnd(_span: ReadableSpan): void {}
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

/** Shared pre-configured tracer/logger for menu spans/logs. */
export const tracer = pubTracer("iedora");
export const logger = pubLogger("iedora");

/** Wire OpenTelemetry for this service (no-ops without OTEL_EXPORTER_OTLP_ENDPOINT). */
export function initOtel(serviceName: string): void {
  register({ serviceName, extraSpanProcessors: [new TenantContextSpanProcessor()] });
}

/** Flush + shut down before exit (safe when OTel was never registered). */
export function shutdownOtel(): Promise<void> {
  return shutdown();
}

/** Trace + span ids of the active span, for correlating a log line to its trace. */
export function traceIds(): { trace_id: string; span_id: string } | undefined {
  const sc = trace.getActiveSpan()?.spanContext();
  return sc ? { trace_id: sc.traceId, span_id: sc.spanId } : undefined;
}

const SEVERITY = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
} as const;

/** Structured log → stdout JSON (always) AND OTLP (once OTel is registered). */
export function emitLog(
  level: "debug" | "info" | "warn" | "error",
  msg: string,
  attrs: Record<string, string | number | boolean> = {},
): void {
  console.log(JSON.stringify({ level, msg, ...attrs }));
  logger.emit({ severityNumber: SEVERITY[level], severityText: level, body: msg, attributes: attrs });
}

/** One SERVER span per request via @hono/otel (idiomatic for Hono/Bun). */
// biome-ignore lint/suspicious/noExplicitAny: matches the previous Env-generic signature
export function otelHttp<E extends Env = any>(_opts?: {
  captureRequestHeaders?: string[];
  captureResponseHeaders?: string[];
}) {
  return httpInstrumentationMiddleware();
}

/** CLIENT span per query from Kysely's log event (only under an active span). */
export function recordQuerySpan(event: LogEvent): void {
  if (!trace.getActiveSpan()?.isRecording()) return;
  const text = event.query.sql;
  const op = text.trimStart().split(/\s/, 1)[0]?.toUpperCase();
  const table = text.match(/\b(?:from|into|update|join)\s+"?([a-z_][a-z0-9_]*)"?/i)?.[1];
  const span = tracer.startSpan(table ? `db ${op} ${table}` : `db ${op ?? "query"}`, {
    kind: SpanKind.CLIENT,
    startTime: Date.now() - event.queryDurationMillis,
  });
  span.setAttribute("db.system", "postgresql");
  if (op) span.setAttribute("db.operation.name", op);
  if (table) span.setAttribute("db.collection.name", table);
  span.setAttribute("db.query.text", text.length > 1000 ? `${text.slice(0, 1000)}…` : text);
  if (event.level === "error") {
    span.recordException(event.error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(event.error) });
  }
  span.end();
}

/** Inject W3C `traceparent` (+ baggage) so a service call continues the trace. */
export function withTrace(headers: Record<string, string>): Record<string, string> {
  propagation.inject(context.active(), headers, {
    set: (carrier, key, value) => {
      carrier[key] = value;
    },
  });
  return headers;
}
