import type { AdminUser, AdminUserSession } from "@iedora/contracts";

import type { AdminSessionFields } from "./data/sessions";
import { isLive } from "./data/sessions";
import type { AdminUserFields } from "./data/users";

// Single source of truth for auth row → wire-DTO mapping. Shared by the admin
// Users CRM routes and the owner self-service routes so the two can't drift.

const EPOCH = new Date(0).toISOString();

/** A DB timestamp (Date or string) → RFC3339, or null. */
export function iso(v: Date | string | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

/** Same as {@link iso} but never null — for NOT NULL columns. */
function isoReq(v: Date | string | null): string {
  return iso(v) ?? EPOCH;
}

export function toAdminUser(u: AdminUserFields, tenantCount: number): AdminUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    banned: u.banned,
    banReason: u.ban_reason,
    banExpiresAt: iso(u.ban_expires_at),
    emailVerifiedAt: iso(u.email_verified_at),
    createdAt: isoReq(u.created_at),
    passwordChangedAt: isoReq(u.password_changed_at),
    mustChangePassword: u.must_change_password,
    tenantCount,
  };
}

export function toAdminSession(s: AdminSessionFields, now: Date): AdminUserSession {
  return {
    id: s.id,
    familyId: s.family_id,
    tenantId: s.tenant_id,
    ip: s.ip,
    userAgent: s.user_agent,
    issuedAt: isoReq(s.issued_at),
    expiresAt: isoReq(s.expires_at),
    absoluteExpiresAt: isoReq(s.absolute_expires_at),
    revokedAt: iso(s.revoked_at),
    current: isLive(s, now),
  };
}
