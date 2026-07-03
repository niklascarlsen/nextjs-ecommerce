DROP INDEX "products_brand_trgm_idx";--> statement-breakpoint
ALTER TABLE "products" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "products"."name"), 'A') || setweight(to_tsvector('english', "products"."color"), 'B') || setweight(to_tsvector('english', "products"."category"), 'C') || setweight(to_tsvector('english', "products"."gender"), 'D')) STORED;--> statement-breakpoint
CREATE INDEX "products_color_trgm_idx" ON "products" USING gin ("color" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_search_vector_idx" ON "products" USING gin ("search_vector");