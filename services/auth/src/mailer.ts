// Delivery seam for password-reset emails. The auth service generates and
// stores reset tokens (hashed) regardless of transport; THIS interface is the
// one place an email provider plugs in. Until a transport is wired, prod uses
// the noop mailer (the request is still recorded as an audit event), and local
// dev uses the logging mailer so the flow is testable end-to-end.
//
// Security: the raw reset URL/token only ever passes THROUGH here in memory. No
// implementation may persist it (that would defeat hashing the token at rest).
export interface ResetMailer {
  /** Send the reset link (contains the one-time token) to the account email. */
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
  /** Notify the account that its password was changed (never includes secrets). */
  sendPasswordChanged(to: string): Promise<void>;
}

// Delivery deferred (no transport yet). Drops the message; the caller still
// writes the audit event so the request is observable.
export const noopResetMailer: ResetMailer = {
  async sendPasswordReset() {},
  async sendPasswordChanged() {},
};

// Local/dev only: prints the link so developers can complete the flow without a
// mail provider. NEVER selected in production (index.ts gates on isProd()).
export const loggingResetMailer: ResetMailer = {
  async sendPasswordReset(to, resetUrl) {
    console.info(JSON.stringify({ level: "info", msg: "password reset link (dev)", to, resetUrl }));
  },
  async sendPasswordChanged(to) {
    console.info(JSON.stringify({ level: "info", msg: "password changed notice (dev)", to }));
  },
};
