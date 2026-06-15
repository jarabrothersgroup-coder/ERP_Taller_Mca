CREATE TYPE "public"."comision_estado" AS ENUM('EN_ESPERA_DE_UMBRAL', 'LIBERADO');--> statement-breakpoint
CREATE TYPE "public"."dte_tipo" AS ENUM('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'AUTOFACTURA', 'COMPROBANTE_RETENCION');--> statement-breakpoint
CREATE TYPE "public"."estado_asiento" AS ENUM('BORRADOR', 'CONTABILIZADO', 'ANULADO');--> statement-breakpoint
CREATE TYPE "public"."fiscal_doc_status" AS ENUM('BORRADOR', 'FIRMADO', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'ANULADO');--> statement-breakpoint
CREATE TYPE "public"."gasto_fijo_categoria" AS ENUM('ALQUILER', 'ANDES', 'COPACO', 'LICENCIAS', 'CONTADOR', 'SALARIO_BASE', 'OTROS');--> statement-breakpoint
CREATE TYPE "public"."mecanico_categoria" AS ENUM('AYUDANTE', 'MEDIO_OFICIAL', 'OFICIAL', 'OFICIAL_CERTIFICADO');--> statement-breakpoint
CREATE TYPE "public"."personal_cargo" AS ENUM('GERENTE_GENERAL', 'GERENTE_OPERATIVO', 'JEFE_DE_TALLER');--> statement-breakpoint
CREATE TYPE "public"."sifen_status" AS ENUM('OFFLINE_PENDING', 'MANUAL_CONVERT_QUEUE', 'APROBADO_DNIT', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_cuenta_contable" AS ENUM('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO', 'ORDEN');--> statement-breakpoint
CREATE TYPE "public"."tipo_facturacion" AS ENUM('MANUAL', 'ELECTRONICA');--> statement-breakpoint
CREATE TYPE "public"."tipo_operacion" AS ENUM('VENTA', 'SERVICIO', 'VENTA_SERVICIO', 'EXPORTACION', 'IMPORTACION');--> statement-breakpoint
CREATE TABLE "asientos_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"concepto" text NOT NULL,
	"estado" "estado_asiento" DEFAULT 'BORRADOR' NOT NULL,
	"total_debe" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_haber" numeric(14, 2) DEFAULT '0' NOT NULL,
	"diferencia" numeric(14, 2) DEFAULT '0' NOT NULL,
	"documento_ref" text,
	"modulo_origen" text,
	"orden_trabajo_id" uuid,
	"documento_fiscal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asientos_detalle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asiento_id" uuid NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"numero_linea" integer DEFAULT 1 NOT NULL,
	"debe" numeric(14, 2),
	"haber" numeric(14, 2),
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid,
	"mechanic_profile_id" uuid NOT NULL,
	"labor_amount" integer NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" integer NOT NULL,
	"status" "comision_estado" DEFAULT 'EN_ESPERA_DE_UMBRAL' NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"orden_id" uuid NOT NULL,
	"tipo" "tipo_facturacion" NOT NULL,
	"numero_factura_manual" text,
	"sifen_cdc" text,
	"sifen_status" "sifen_status" DEFAULT 'OFFLINE_PENDING' NOT NULL,
	"xml_raw" text,
	"xml_signed" text,
	"total" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_documento_detalles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"unidad_medida" text DEFAULT 'UNIDAD' NOT NULL,
	"descripcion" text NOT NULL,
	"precio_unitario" numeric(14, 2) NOT NULL,
	"iva" integer DEFAULT 10 NOT NULL,
	"iva_monto" numeric(14, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"repuesto_id" uuid,
	"servicio_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emisor_ruc" text NOT NULL,
	"emisor_razon_social" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"receptor_ruc" text NOT NULL,
	"receptor_razon_social" text NOT NULL,
	"receptor_direccion" text,
	"orden_trabajo_id" uuid,
	"dte_tipo" "dte_tipo" DEFAULT 'FACTURA' NOT NULL,
	"tipo_operacion" "tipo_operacion" DEFAULT 'VENTA_SERVICIO' NOT NULL,
	"serie" text NOT NULL,
	"numero" text NOT NULL,
	"fecha_emision" timestamp with time zone DEFAULT now() NOT NULL,
	"moneda" text DEFAULT 'PYG' NOT NULL,
	"tipo_cambio" numeric(12, 6),
	"total_exento" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_iva_5" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_iva_10" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_liquido" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_iva" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_documento" numeric(14, 2) DEFAULT '0' NOT NULL,
	"descuento_global" numeric(14, 2) DEFAULT '0',
	"condicion_venta" text DEFAULT 'CONTADO' NOT NULL,
	"cdc" text,
	"numero_transaccion" text,
	"xml_firmado" text,
	"xml_original" text,
	"kude_pdf_url" text,
	"estado" "fiscal_doc_status" DEFAULT 'BORRADOR' NOT NULL,
	"mensaje_error" text,
	"respuesta_sifen_xml" text,
	"fecha_envio" timestamp with time zone,
	"fecha_aprobacion" timestamp with time zone,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"category" "gasto_fijo_categoria" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mechanic_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"category" "mecanico_categoria" NOT NULL,
	"base_salary" integer NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mechanic_profiles_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"fixed_expenses_total" integer NOT NULL,
	"payroll_base_total" integer NOT NULL,
	"net_labor_revenue" integer NOT NULL,
	"breakeven_threshold" integer NOT NULL,
	"breakeven_hit" boolean NOT NULL,
	"breakeven_percentage" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_cuentas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_cuenta_contable" NOT NULL,
	"cuenta_padre_id" uuid,
	"nivel" integer DEFAULT 1 NOT NULL,
	"acepta_movimientos" boolean DEFAULT true NOT NULL,
	"saldo_inicial" numeric(14, 2) DEFAULT '0' NOT NULL,
	"moneda" text DEFAULT 'PYG' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_cuentas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "sifen_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"operacion" text NOT NULL,
	"codigo_resultado" text,
	"cdc" text,
	"xml_enviado" text,
	"xml_recibido" text,
	"http_status" integer,
	"mensaje_error" text,
	"duracion_ms" integer,
	"exitoso" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"position" "personal_cargo" NOT NULL,
	"base_salary" integer NOT NULL,
	"profit_sharing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE "thinkcar_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_hash" text NOT NULL,
	"file_size" integer,
	"source_channel" text DEFAULT 'usb' NOT NULL,
	"source_path" text,
	"vin" text,
	"brand" text,
	"model" text,
	"report_type" text,
	"scan_date" timestamp with time zone,
	"dtc_codes" text[],
	"dtc_descriptions" jsonb,
	"vehicle_id" uuid,
	"orden_trabajo_id" uuid,
	"client_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"raw_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_manual_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid,
	"content" text NOT NULL,
	"page_number" integer NOT NULL,
	"section" text,
	"metadata" text,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "cost_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repuesto_id" uuid NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" text NOT NULL,
	"cantidad_anterior" integer NOT NULL,
	"cantidad_nueva" integer NOT NULL,
	"cantidad_final" integer NOT NULL,
	"pp_anterior" numeric(12, 2) NOT NULL,
	"costo_unitario_nuevo" numeric(12, 2),
	"pp_final" numeric(12, 2) NOT NULL,
	"movimiento_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_accounts_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria" text NOT NULL,
	"cuenta_inventario_id" uuid NOT NULL,
	"cuenta_gasto_id" uuid NOT NULL,
	"cuenta_proveedor_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_compra_id" uuid NOT NULL,
	"repuesto_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"cantidad_recibida" integer DEFAULT 0 NOT NULL,
	"costo_unitario" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"tenant_slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" text NOT NULL,
	"proveedor" text NOT NULL,
	"estado" text DEFAULT 'BORRADOR' NOT NULL,
	"fecha_emision" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_esperada" timestamp with time zone,
	"fecha_recepcion" timestamp with time zone,
	"total_oc" numeric(12, 2) DEFAULT '0',
	"notas" text,
	"usuario_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reorder_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repuesto_id" uuid NOT NULL,
	"stock_actual" integer NOT NULL,
	"punto_reorden" integer NOT NULL,
	"estado" text DEFAULT 'PENDIENTE' NOT NULL,
	"oc_generada_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resuelto_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repuesto_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"stock_anterior" integer NOT NULL,
	"stock_posterior" integer NOT NULL,
	"costo_unitario" numeric(12, 2),
	"costo_total" numeric(12, 2),
	"orden_trabajo_id" uuid,
	"purchase_order_id" uuid,
	"asiento_id" uuid,
	"motivo" text NOT NULL,
	"observaciones" text,
	"usuario_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "tenant_slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "hv_lockout_signed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "hv_lockout_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "hv_lockout_signed_by" text;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "tenant_slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "repuestos" ADD COLUMN "costo_promedio" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "repuestos" ADD COLUMN "punto_reorden" integer;--> statement-breakpoint
ALTER TABLE "repuestos" ADD COLUMN "proveedor_preferido_id" uuid;--> statement-breakpoint
ALTER TABLE "repuestos" ADD COLUMN "lote_economico" integer;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD COLUMN "tenant_slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "asientos_detalle" ADD CONSTRAINT "asientos_detalle_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_detalle" ADD CONSTRAINT "asientos_detalle_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_mechanic_profile_id_mechanic_profiles_id_fk" FOREIGN KEY ("mechanic_profile_id") REFERENCES "public"."mechanic_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documento_detalles" ADD CONSTRAINT "fiscal_documento_detalles_documento_id_fiscal_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."fiscal_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanic_profiles" ADD CONSTRAINT "mechanic_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_summary" ADD CONSTRAINT "payroll_summary_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sifen_sync_log" ADD CONSTRAINT "sifen_sync_log_documento_id_fiscal_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."fiscal_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thinkcar_imports" ADD CONSTRAINT "thinkcar_imports_vehicle_id_vehiculos_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehiculos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thinkcar_imports" ADD CONSTRAINT "thinkcar_imports_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thinkcar_imports" ADD CONSTRAINT "thinkcar_imports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_history" ADD CONSTRAINT "cost_history_repuesto_id_repuestos_id_fk" FOREIGN KEY ("repuesto_id") REFERENCES "public"."repuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_history" ADD CONSTRAINT "cost_history_movimiento_id_stock_movements_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_accounts_map" ADD CONSTRAINT "inventory_accounts_map_cuenta_inventario_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_inventario_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_accounts_map" ADD CONSTRAINT "inventory_accounts_map_cuenta_gasto_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_gasto_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_accounts_map" ADD CONSTRAINT "inventory_accounts_map_cuenta_proveedor_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_proveedor_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_orden_compra_id_purchase_orders_id_fk" FOREIGN KEY ("orden_compra_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_repuesto_id_repuestos_id_fk" FOREIGN KEY ("repuesto_id") REFERENCES "public"."repuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_usuario_id_profiles_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_alerts" ADD CONSTRAINT "reorder_alerts_repuesto_id_repuestos_id_fk" FOREIGN KEY ("repuesto_id") REFERENCES "public"."repuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_alerts" ADD CONSTRAINT "reorder_alerts_oc_generada_id_purchase_orders_id_fk" FOREIGN KEY ("oc_generada_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_repuesto_id_repuestos_id_fk" FOREIGN KEY ("repuesto_id") REFERENCES "public"."repuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_usuario_id_profiles_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asientos_fecha_idx" ON "asientos_contables" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "asientos_modulo_idx" ON "asientos_contables" USING btree ("modulo_origen");--> statement-breakpoint
CREATE INDEX "asientos_ot_idx" ON "asientos_contables" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "asientos_estado_idx" ON "asientos_contables" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "asientos_detalle_asiento_idx" ON "asientos_detalle" USING btree ("asiento_id");--> statement-breakpoint
CREATE INDEX "asientos_detalle_cuenta_idx" ON "asientos_detalle" USING btree ("cuenta_id");--> statement-breakpoint
CREATE INDEX "facturas_tenant_slug_idx" ON "facturas" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "facturas_orden_id_idx" ON "facturas" USING btree ("orden_id");--> statement-breakpoint
CREATE INDEX "facturas_sifen_cdc_idx" ON "facturas" USING btree ("sifen_cdc");--> statement-breakpoint
CREATE INDEX "fiscal_detalle_documento_idx" ON "fiscal_documento_detalles" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "fiscal_doc_serie_numero_idx" ON "fiscal_documentos" USING btree ("serie","numero");--> statement-breakpoint
CREATE INDEX "fiscal_doc_cdc_idx" ON "fiscal_documentos" USING btree ("cdc");--> statement-breakpoint
CREATE INDEX "fiscal_doc_estado_idx" ON "fiscal_documentos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "fiscal_doc_cliente_idx" ON "fiscal_documentos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "fiscal_doc_ot_idx" ON "fiscal_documentos" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "fiscal_doc_fecha_emision_idx" ON "fiscal_documentos" USING btree ("fecha_emision");--> statement-breakpoint
CREATE INDEX "plan_cuentas_tipo_idx" ON "plan_cuentas" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "plan_cuentas_padre_idx" ON "plan_cuentas" USING btree ("cuenta_padre_id");--> statement-breakpoint
CREATE INDEX "plan_cuentas_nivel_idx" ON "plan_cuentas" USING btree ("nivel");--> statement-breakpoint
CREATE INDEX "plan_cuentas_activo_idx" ON "plan_cuentas" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "sifen_log_documento_idx" ON "sifen_sync_log" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "sifen_log_operacion_idx" ON "sifen_sync_log" USING btree ("operacion");--> statement-breakpoint
CREATE INDEX "thinkcar_imports_vin_idx" ON "thinkcar_imports" USING btree ("vin");--> statement-breakpoint
CREATE UNIQUE INDEX "thinkcar_imports_file_hash_idx" ON "thinkcar_imports" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "thinkcar_imports_status_idx" ON "thinkcar_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "thinkcar_imports_vehicle_id_idx" ON "thinkcar_imports" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "thinkcar_imports_created_at_idx" ON "thinkcar_imports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "vmc_hnsw_idx" ON "vehicle_manual_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "vmc_vehicle_id_idx" ON "vehicle_manual_chunks" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "cost_hist_repuesto_idx" ON "cost_history" USING btree ("repuesto_id");--> statement-breakpoint
CREATE INDEX "cost_hist_fecha_idx" ON "cost_history" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "cost_hist_tenant_idx" ON "cost_history" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "inv_acct_map_cat_tenant_idx" ON "inventory_accounts_map" USING btree ("categoria","tenant_slug");--> statement-breakpoint
CREATE INDEX "inv_acct_map_tenant_idx" ON "inventory_accounts_map" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "poi_orden_idx" ON "purchase_order_items" USING btree ("orden_compra_id");--> statement-breakpoint
CREATE INDEX "poi_repuesto_idx" ON "purchase_order_items" USING btree ("repuesto_id");--> statement-breakpoint
CREATE INDEX "poi_tenant_idx" ON "purchase_order_items" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "po_numero_idx" ON "purchase_orders" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "po_proveedor_idx" ON "purchase_orders" USING btree ("proveedor");--> statement-breakpoint
CREATE INDEX "po_estado_idx" ON "purchase_orders" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "po_tenant_idx" ON "purchase_orders" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "reorder_repuesto_idx" ON "reorder_alerts" USING btree ("repuesto_id");--> statement-breakpoint
CREATE INDEX "reorder_estado_idx" ON "reorder_alerts" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "reorder_tenant_idx" ON "reorder_alerts" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "stock_mov_repuesto_idx" ON "stock_movements" USING btree ("repuesto_id");--> statement-breakpoint
CREATE INDEX "stock_mov_tipo_idx" ON "stock_movements" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "stock_mov_ot_idx" ON "stock_movements" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "stock_mov_tenant_idx" ON "stock_movements" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "stock_mov_created_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "clients_tenant_slug_idx" ON "clients" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_tenant_slug_idx" ON "ordenes_trabajo" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "vehiculos_tenant_slug_idx" ON "vehiculos" USING btree ("tenant_slug");