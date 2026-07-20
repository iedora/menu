// The SMTP transport now comes from @iedora/email (createMailer); the send
// contract, the safe no-transport fallbacks, and the config→mailer rule stay
// here. Keeping prod → noopMailer (DROP, don't log) is deliberate and
// security-relevant: reset-token emails must never be written to stdout in prod,
// so we do NOT fall through to @iedora/email's dev json-transport logger in
// production.
import { createMailer, type EmailMessage } from "@iedora/email";

/** One outbound email — the @iedora/email shape (to/subject/html/text), re-exported
 *  so menu code has a single import surface. */
export type { EmailMessage };

/** The mail contract menu services depend on: a send-only transport. Deliberately
 *  NARROWER than @iedora/email's Mailer (which couples a messaging `handler`): menu
 *  fulfils it with an OutboxMailer (enqueue), an SMTP mailer, or a noop/logging
 *  fallback, so the abstraction can't be the SMTP-specific one. */
export interface Mailer {
  send(msg: EmailMessage): Promise<void>;
}

/** SMTP transport config. `host` empty means "no transport configured". */
export interface SmtpConfig {
  host: string;
  port: number;
  /** Omit (empty) for servers that need no auth, e.g. MailHog. */
  user: string;
  pass: string;
  /** Implicit TLS. @iedora/email derives this from port 465; kept for config
   *  compatibility. */
  secure: boolean;
  /** The From header, e.g. `iedora <no-reply@iedora.com>`. */
  from: string;
}

/** An SMTP {@link Mailer} backed by @iedora/email. */
export function smtpMailer(cfg: SmtpConfig): Mailer {
  const mailer = createMailer({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    pass: cfg.pass,
    from: cfg.from,
  });
  return {
    send: (msg) =>
      mailer.send({ to: msg.to, subject: msg.subject, text: msg.text, html: msg.html ?? "" }),
  };
}

/** Drops every message — the safe fallback when no transport is configured. */
export const noopMailer: Mailer = {
  async send() {},
};

/** Logs the message to stdout instead of sending — local/dev only. */
export const loggingMailer: Mailer = {
  async send(msg) {
    console.info(
      JSON.stringify({ level: "info", msg: "email (dev, not sent)", to: msg.to, subject: msg.subject, text: msg.text }),
    );
  },
};

/** Pick a mailer from config: a real SMTP transport when a host is set, else
 *  logging in dev / noop (DROP) in prod. Prod never logs bodies (PII/tokens). */
export function mailerFromConfig(smtp: SmtpConfig, opts: { prod: boolean }): Mailer {
  if (smtp.host) return smtpMailer(smtp);
  return opts.prod ? noopMailer : loggingMailer;
}
