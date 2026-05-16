CREATE TABLE "rate_limit_event" (
	"key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_event_key_time_idx" ON "rate_limit_event" USING btree ("key","occurred_at");