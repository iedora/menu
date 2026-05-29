ALTER TABLE "imopush"."integrator_status" ADD COLUMN "tenant_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "imopush"."property" ADD COLUMN "tenant_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "integrator_status_tenant_idx" ON "imopush"."integrator_status" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "property_tenant_idx" ON "imopush"."property" USING btree ("tenant_id");