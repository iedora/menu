CREATE TABLE "daily_view" (
	"organization_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"day" text NOT NULL,
	"language" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_view_restaurant_id_day_language_pk" PRIMARY KEY("restaurant_id","day","language")
);
--> statement-breakpoint
ALTER TABLE "daily_view" ADD CONSTRAINT "daily_view_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_view" ADD CONSTRAINT "daily_view_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_view_org_day_idx" ON "daily_view" USING btree ("organization_id","day");