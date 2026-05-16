CREATE TABLE "view_seen" (
	"visitor_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"hour_bucket" text NOT NULL,
	"seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "view_seen_visitor_id_restaurant_id_hour_bucket_pk" PRIMARY KEY("visitor_id","restaurant_id","hour_bucket")
);
--> statement-breakpoint
ALTER TABLE "view_seen" ADD CONSTRAINT "view_seen_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "view_seen_seen_at_idx" ON "view_seen" USING btree ("seen_at");