CREATE TABLE "cash_movements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"register_id" varchar NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text,
	"sale_id" varchar,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cash_registers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'CLOSED' NOT NULL,
	"user_id" varchar,
	"opened_at" timestamp,
	"closed_at" timestamp,
	"opening_balance" numeric(10, 2) DEFAULT '0',
	"current_balance" numeric(10, 2) DEFAULT '0',
	"expected_balance" numeric(10, 2) DEFAULT '0',
	"closing_balance" numeric(10, 2),
	"difference" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "cash_registers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "product_price_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"old_cost_price" numeric(10, 2) NOT NULL,
	"new_cost_price" numeric(10, 2) NOT NULL,
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_suppliers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"supplier_id" varchar NOT NULL,
	"supplier_code" text,
	"last_price" numeric(10, 2),
	"last_purchased_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "finance" ADD COLUMN IF NOT EXISTS "code" varchar;--> statement-breakpoint
ALTER TABLE "finance" ADD COLUMN IF NOT EXISTS "discount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "finance" ADD COLUMN IF NOT EXISTS "discount_type" text DEFAULT 'FIXED_VALUE';--> statement-breakpoint
ALTER TABLE "finance" ADD COLUMN IF NOT EXISTS "surcharge" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "finance" ADD COLUMN IF NOT EXISTS "project_id" varchar;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ncm" text;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_register_id_cash_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."cash_registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance" ADD CONSTRAINT "finance_code_unique" UNIQUE("code");