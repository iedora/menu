-- Manual payment ledger — admin-recorded offline payments (MBWay,
-- cash). Lives parallel to `invoice` (Stripe-shape, future). Discount
-- is derived from `amountCents` vs the plan's list price in code, so
-- only the raw amount lives in the DB.
CREATE TABLE "core"."manual_payment" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "product" text NOT NULL,
  "plan_code" text NOT NULL,
  "paid_at" timestamp with time zone DEFAULT now() NOT NULL,
  "valid_months" smallint NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "method" text NOT NULL,
  "campaign_tag" text,
  "notes" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "manual_payment_tenant_paid_idx" ON "core"."manual_payment" USING btree ("tenant_id","paid_at");
--> statement-breakpoint
CREATE INDEX "manual_payment_method_idx" ON "core"."manual_payment" USING btree ("method");
--> statement-breakpoint
CREATE INDEX "manual_payment_campaign_idx" ON "core"."manual_payment" USING btree ("campaign_tag");
