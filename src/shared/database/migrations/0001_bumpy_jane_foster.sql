CREATE TYPE "public"."estado_orden" AS ENUM('Presupuestado', 'Aprobado', 'En_Proceso', 'Control_Calidad', 'Listo');--> statement-breakpoint
CREATE TYPE "public"."estado_tercero" AS ENUM('Pendiente', 'En_Proceso', 'Completado');--> statement-breakpoint
CREATE TYPE "public"."tipo_motor" AS ENUM('Nafta', 'Diésel', 'HEV', 'BEV');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"ruc" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingresos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"orden_trabajo_id" uuid,
	"fecha_ingreso" timestamp with time zone DEFAULT now() NOT NULL,
	"kilometraje" integer,
	"nivel_combustible" text,
	"estado_exterior" text,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordenes_trabajo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "estado_orden" DEFAULT 'Presupuestado' NOT NULL,
	"description" text,
	"diagnosis" text,
	"dtc_codes" text[],
	"hv_alert" boolean DEFAULT false NOT NULL,
	"total_cost" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_trabajo_cost_check" CHECK ("ordenes_trabajo"."total_cost" IS NULL OR "ordenes_trabajo"."total_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trabajos_terceros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_trabajo_id" uuid NOT NULL,
	"proveedor" text NOT NULL,
	"descripcion" text NOT NULL,
	"costo" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fecha_inicio" timestamp with time zone,
	"fecha_fin" timestamp with time zone,
	"estado" "estado_tercero" DEFAULT 'Pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trabajos_terceros_cost_check" CHECK ("trabajos_terceros"."costo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vehiculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"plate" text,
	"vin" text,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"year" smallint,
	"engine_type" "tipo_motor" DEFAULT 'Nafta' NOT NULL,
	"kilometraje" integer,
	"hv_battery_voltage" real,
	"hv_safety_disabled" boolean DEFAULT false NOT NULL,
	"dtc_codes" text[],
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehiculos_hv_voltage_check" CHECK ("vehiculos"."hv_battery_voltage" IS NULL OR "vehiculos"."hv_battery_voltage" > 0)
);
--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_vehicle_id_vehiculos_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehiculos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_vehicle_id_vehiculos_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehiculos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabajos_terceros" ADD CONSTRAINT "trabajos_terceros_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;