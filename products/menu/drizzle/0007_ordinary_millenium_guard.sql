CREATE TABLE "monthly_view" (
	"organization_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"year_month" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "monthly_view_restaurant_id_year_month_pk" PRIMARY KEY("restaurant_id","year_month")
);
--> statement-breakpoint
ALTER TABLE "monthly_view" ADD CONSTRAINT "monthly_view_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_view" ADD CONSTRAINT "monthly_view_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monthly_view_org_month_idx" ON "monthly_view" USING btree ("organization_id","year_month");