CREATE TYPE "public"."estado_control_herramienta" AS ENUM('Asignado', 'Devuelto', 'Perdido', 'Dañado');--> statement-breakpoint
CREATE TABLE "control_herramientas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"herramienta_id" uuid NOT NULL,
	"orden_trabajo_id" uuid NOT NULL,
	"mecanico_id" uuid NOT NULL,
	"mecanico_nombre" text NOT NULL,
	"fecha_asignacion" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_devolucion" timestamp with time zone,
	"observaciones" text,
	"estado" "estado_control_herramienta" DEFAULT 'Asignado' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herramientas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"categoria" text,
	"marca" text,
	"modelo" text,
	"numero_serie" text,
	"ubicacion" text,
	"stock_total" integer DEFAULT 1 NOT NULL,
	"stock_disponible" integer DEFAULT 1 NOT NULL,
	"requiere_calibracion" boolean DEFAULT false NOT NULL,
	"ultima_calibracion" timestamp with time zone,
	"proxima_calibracion" timestamp with time zone,
	"activo" boolean DEFAULT true NOT NULL,
	"imagen_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "herramientas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "repuestos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"codigo_barras" text,
	"descripcion" text NOT NULL,
	"marca" text,
	"modelo" text,
	"categoria" text,
	"precio_costo" numeric(12, 2),
	"precio_venta" numeric(12, 2),
	"stock_actual" integer DEFAULT 0 NOT NULL,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"stock_maximo" integer,
	"ubicacion" text,
	"unidad_medida" text DEFAULT 'unidad' NOT NULL,
	"proveedor" text,
	"compatible_con" text,
	"activo" boolean DEFAULT true NOT NULL,
	"imagen_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repuestos_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "repuestos_codigo_barras_unique" UNIQUE("codigo_barras")
);
--> statement-breakpoint
ALTER TABLE "control_herramientas" ADD CONSTRAINT "control_herramientas_herramienta_id_herramientas_id_fk" FOREIGN KEY ("herramienta_id") REFERENCES "public"."herramientas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_herramientas" ADD CONSTRAINT "control_herramientas_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_herramientas" ADD CONSTRAINT "control_herramientas_mecanico_id_profiles_id_fk" FOREIGN KEY ("mecanico_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_herramienta_id_idx" ON "control_herramientas" USING btree ("herramienta_id");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_orden_trabajo_id_idx" ON "control_herramientas" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_mecanico_id_idx" ON "control_herramientas" USING btree ("mecanico_id");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_estado_idx" ON "control_herramientas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_mecanico_estado_idx" ON "control_herramientas" USING btree ("mecanico_id","estado");--> statement-breakpoint
CREATE INDEX "herramientas_codigo_idx" ON "herramientas" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "herramientas_categoria_idx" ON "herramientas" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "herramientas_activo_idx" ON "herramientas" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "repuestos_codigo_barras_idx" ON "repuestos" USING btree ("codigo_barras");--> statement-breakpoint
CREATE INDEX "repuestos_codigo_idx" ON "repuestos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "repuestos_categoria_idx" ON "repuestos" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "repuestos_stock_alert_idx" ON "repuestos" USING btree ("stock_actual","stock_minimo");--> statement-breakpoint
CREATE INDEX "repuestos_activo_idx" ON "repuestos" USING btree ("activo");