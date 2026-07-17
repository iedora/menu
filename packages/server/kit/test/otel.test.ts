import { describe, expect, test } from "bun:test";

import { emitLog, IEDORA_RESTAURANT_ID, IEDORA_TENANT_ID, tenantContext, traceIds } from "../src/otel";

// The OpenTelemetry SDK wiring now comes from @iedora/observability (NodeSDK) and
// the HTTP span from @hono/otel — both tested upstream. What's menu-specific here
// is the tenant AsyncLocalStorage + its stamping, and the log/trace helpers.

describe("tenantContext (tenant AsyncLocalStorage)", () => {
  test("run sets tenant inside the callback, restores after", () => {
    expect(tenantContext.get()).toBeUndefined();
    tenantContext.run({ restaurantId: "r1", tenantId: "t1" }, () => {
      const t = tenantContext.get();
      expect(t?.restaurantId).toBe("r1");
      expect(t?.tenantId).toBe("t1");
    });
    expect(tenantContext.get()).toBeUndefined();
  });

  test("nested run shadows then restores", () => {
    tenantContext.run({ restaurantId: "outer" }, () => {
      tenantContext.run({ restaurantId: "inner" }, () => {
        expect(tenantContext.get()?.restaurantId).toBe("inner");
      });
      expect(tenantContext.get()?.restaurantId).toBe("outer");
    });
  });

  test("enterWith persists on the async chain (returns the previous)", () => {
    tenantContext.run({ restaurantId: "base" }, () => {
      const prev = tenantContext.enterWith({ restaurantId: "r2", tenantId: "t2" });
      expect(prev?.restaurantId).toBe("base");
      expect(tenantContext.get()?.restaurantId).toBe("r2");
    });
  });
});

describe("tenant attribute keys", () => {
  test("are the pinned menu domain keys", () => {
    expect(IEDORA_RESTAURANT_ID).toBe("tenant.restaurant_id");
    expect(IEDORA_TENANT_ID).toBe("tenant.id");
  });
});

describe("helpers (safe when OTel is off)", () => {
  test("traceIds is undefined with no active span", () => {
    expect(traceIds()).toBeUndefined();
  });
  test("emitLog does not throw", () => {
    expect(() => emitLog("info", "hello", { k: "v" })).not.toThrow();
  });
});
