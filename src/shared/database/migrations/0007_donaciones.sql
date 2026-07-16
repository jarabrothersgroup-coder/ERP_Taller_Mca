CREATE TABLE "donaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficiario" text NOT NULL,
	"descripcion" text,
	"monto" numeric(14,2) DEFAULT '0' NOT NULL,
	"comprobante" text,
	"deducible" boolean DEFAULT true NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "donaciones_tenant_idx" ON "donaciones" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "donaciones_fecha_idx" ON "donaciones" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "donaciones_deducible_idx" ON "donaciones" USING btree ("deducible");
