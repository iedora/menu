import { describe, expect, it, beforeEach } from "bun:test";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { Hono } from "hono";

import { otelHttp, createServiceApp } from "../src/http";
import { SpanKind, SpanStatusCode, trace } from "@iedora/observability";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
trace.setGlobalTracerProvider(provider);

describe("otelHttp", () => {
  beforeEach(() => {
    exporter.reset();
  });

  it("emits a SERVER span with method, path, status, route, and duration", async () => {
    const app = new Hono().use(otelHttp()).get("/ping", (c) => c.json({ ok: true }));
    const res = await app.request("/ping");
    expect(res.status).toBe(200);

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    const [span] = spans;
    expect(span.name).toBe("GET /ping");
    expect(span.kind).toBe(SpanKind.SERVER);
    expect(span.attributes["http.request.method"]).toBe("GET");
    expect(span.attributes["url.path"]).toBe("/ping");
    expect(span.attributes["http.response.status_code"]).toBe(200);
    expect(span.attributes["http.route"]).toBe("/ping");
    expect(typeof span.attributes["http.duration"]).toBe("number");
  });

  it("resolves :id param into the matched route pattern for low-cardinality naming", async () => {
    const app = new Hono()
      .use(otelHttp())
      .get("/users/:id", (c) => c.json({ id: c.req.param("id") }));
    const res = await app.request("/users/42");
    expect(res.status).toBe(200);

    const [span] = exporter.getFinishedSpans();
    expect(span.name).toBe("GET /users/:id");
    expect(span.attributes["http.route"]).toBe("/users/:id");
  });

  it("records the exception and marks ERROR when a handler throws", async () => {
    const app = new Hono()
      .use(otelHttp())
      .onError((_, c) => c.text("fail", 500))
      .get("/fail", () => {
        throw new Error("boom");
      });
    const res = await app.request("/fail");
    expect(res.status).toBe(500);

    const [span] = exporter.getFinishedSpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.events.length).toBe(1);
    expect(span.events[0].name).toBe("exception");
    expect(span.events[0].attributes?.["exception.message"]).toBe("boom");
  });

  it("marks ERROR status on 5xx responses without throwing", async () => {
    const app = new Hono().use(otelHttp()).get("/oops", (c) => c.text("nope", 503));
    const res = await app.request("/oops");
    expect(res.status).toBe(503);

    const [span] = exporter.getFinishedSpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes["http.response.status_code"]).toBe(503);
  });

  it("stamps http.request.header.* for each captureRequestHeaders entry", async () => {
    const app = new Hono()
      .use(otelHttp({ captureRequestHeaders: ["x-request-id", "authorization"] }))
      .get("/test", (c) => c.text("ok"));
    const res = await app.request("/test", {
      headers: { "x-request-id": "req-123", authorization: "Bearer tok" },
    });
    expect(res.status).toBe(200);

    const [span] = exporter.getFinishedSpans();
    expect(span.attributes["http.request.header.x-request-id"]).toBe("req-123");
    expect(span.attributes["http.request.header.authorization"]).toBe("Bearer tok");
  });

  it("stamps http.response.header.* for each captureResponseHeaders entry", async () => {
    const app = new Hono()
      .use(otelHttp({ captureResponseHeaders: ["x-request-id"] }))
      .get("/test", (c) => {
        c.header("x-request-id", "resp-456");
        return c.text("ok");
      });
    const res = await app.request("/test");
    expect(res.status).toBe(200);

    const [span] = exporter.getFinishedSpans();
    expect(span.attributes["http.response.header.x-request-id"]).toBe("resp-456");
  });

  it("sets http.response.body.size from the Content-Length header", async () => {
    const app = new Hono().use(otelHttp()).get("/cl", (c) => {
      c.header("content-length", "42");
      return c.text("x".repeat(42));
    });
    const res = await app.request("/cl");
    expect(res.status).toBe(200);

    const [span] = exporter.getFinishedSpans();
    expect(span.attributes["http.response.body.size"]).toBe(42);
  });

  it("omits http.response.body.size when Content-Length is not set", async () => {
    const app = new Hono().use(otelHttp()).get("/no-cl", (c) => c.text("ok"));
    const res = await app.request("/no-cl");
    expect(res.status).toBe(200);

    const [span] = exporter.getFinishedSpans();
    expect("http.response.body.size" in span.attributes).toBe(false);
  });

  it("reads client.address from cf-connecting-ip", async () => {
    const app = new Hono().use(otelHttp()).get("/cf", (c) => c.text("ok"));
    const res = await app.request("/cf", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    expect(res.status).toBe(200);

    const [span] = exporter.getFinishedSpans();
    expect(span.attributes["client.address"]).toBe("1.2.3.4");
  });

  it("createServiceApp includes otelHttp by default", async () => {
    const app = createServiceApp().get("/up", (c) => c.json({ status: "ok" }));
    const res = await app.request("/up");
    expect(res.status).toBe(200);

    const [span] = exporter.getFinishedSpans();
    expect(span.name).toBe("GET /up");
    expect(span.attributes["http.response.status_code"]).toBe(200);
  });
});
