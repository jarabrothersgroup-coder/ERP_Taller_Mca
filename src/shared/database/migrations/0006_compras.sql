CREATE TYPE "public"."estado_pago_compra" AS ENUM('PENDIENTE', 'PARCIAL', 'PAGADO', 'ANULADA');--> statement-breakpoint

CREATE TABLE "compras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero_factura" text NOT NULL,
	"proveedor_id" uuid,
	"proveedor_nombre" text NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_vencimiento" timestamp with time zone,
	"total" numeric(14,2) DEFAULT '0' NOT NULL,
	"estado_pago" "public"."estado_pago_compra" DEFAULT 'PENDIENTE' NOT NULL,
	"notas" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "compra_detalles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compra_id" uuid NOT NULL,
	"descripcion" text NOT NULL,
	"cantidad" numeric(12,2) DEFAULT '1' NOT NULL,
	"precio_unitario" numeric(14,2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(14,2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "compras_tenant_idx" ON "compras" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "compras_estado_idx" ON "compras" USING btree ("estado_pago");--> statement-breakpoint
CREATE INDEX "compras_proveedor_idx" ON "compras" USING btree ("proveedor_id");--> statement-breakpoint
CREATE INDEX "compras_fecha_idx" ON "compras" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "compra_detalles_compra_idx" ON "compra_detalles" USING btree ("compra_id");--> statement-breakpoint

ALTER TABLE "compra_detalles" ADD CONSTRAINT "compra_detalles_compra_id_compras_id_fk"
	FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE;
