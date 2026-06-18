import { expect, test } from "bun:test";

import { type AuthConfig, grantedRole } from "../src/config";

const cfg = {
  roleGrants: [
    { role: "admin", match: ["eduardoferdcarvalho@gmail.com", "@iedora.com"] },
    { role: "support", match: ["help@partner.com"] },
  ],
} as AuthConfig;

test("exact email match wins its role (case-insensitive, trimmed)", () => {
  expect(grantedRole(cfg, "eduardoferdcarvalho@gmail.com")).toBe("admin");
  expect(grantedRole(cfg, "  EduardoFerdCarvalho@Gmail.com ")).toBe("admin");
  expect(grantedRole(cfg, "help@partner.com")).toBe("support");
});

test("@domain entries match every address at that domain", () => {
  expect(grantedRole(cfg, "anyone@iedora.com")).toBe("admin");
  expect(grantedRole(cfg, "OPS@IEDORA.COM")).toBe("admin");
});

test("no matching grant yields undefined", () => {
  expect(grantedRole(cfg, "stranger@elsewhere.com")).toBeUndefined();
  expect(grantedRole(cfg, "help@otherpartner.com")).toBeUndefined();
  expect(grantedRole(cfg, "")).toBeUndefined();
});

test("first matching grant wins (rules ordered most- to least-privileged)", () => {
  const ordered = {
    roleGrants: [
      { role: "admin", match: ["@iedora.com"] },
      { role: "support", match: ["help@iedora.com"] },
    ],
  } as AuthConfig;
  expect(grantedRole(ordered, "help@iedora.com")).toBe("admin");
});

test("an empty grant list assigns nobody", () => {
  expect(grantedRole({ roleGrants: [] } as unknown as AuthConfig, "eduardoferdcarvalho@gmail.com")).toBeUndefined();
});
