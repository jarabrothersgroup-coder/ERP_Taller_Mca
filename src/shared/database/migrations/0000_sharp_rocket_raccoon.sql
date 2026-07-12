CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "public"."comision_estado" AS ENUM('EN_ESPERA_DE_UMBRAL', 'LIBERADO');--> statement-breakpoint
CREATE TYPE "public"."dte_tipo" AS ENUM('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'AUTOFACTURA', 'COMPROBANTE_RETENCION');--> statement-breakpoint
CREATE TYPE "public"."estado_activo_fijo" AS ENUM('ACTIVO', 'EN_REPARACION', 'RETIRADO', 'VENDIDO', 'DADO_DE_BAJA');--> statement-breakpoint
CREATE TYPE "public"."estado_asiento" AS ENUM('BORRADOR', 'CONTABILIZADO', 'ANULADO');--> statement-breakpoint
CREATE TYPE "public"."estado_control_herramienta" AS ENUM('Asignado', 'Devuelto_Bueno', 'Devuelto_Desgastado', 'Devuelto_Danado', 'Perdido');--> statement-breakpoint
CREATE TYPE "public"."estado_orden" AS ENUM('Presupuestado', 'Aprobado', 'En_Proceso', 'Control_Calidad', 'Listo');--> statement-breakpoint
CREATE TYPE "public"."estado_pago" AS ENUM('PENDIENTE', 'PARCIAL', 'PAGA', 'ANULADA');--> statement-breakpoint
CREATE TYPE "public"."estado_tercero" AS ENUM('Pendiente', 'En_Proceso', 'Completado');--> statement-breakpoint
CREATE TYPE "public"."fiscal_doc_status" AS ENUM('BORRADOR', 'FIRMADO', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'ANULADO');--> statement-breakpoint
CREATE TYPE "public"."gasto_fijo_categoria" AS ENUM('ALQUILER', 'ANDES', 'COPACO', 'LICENCIAS', 'CONTADOR', 'SALARIO_BASE', 'OTROS');--> statement-breakpoint
CREATE TYPE "public"."mecanico_categoria" AS ENUM('AYUDANTE', 'MEDIO_OFICIAL', 'OFICIAL', 'OFICIAL_CERTIFICADO');--> statement-breakpoint
CREATE TYPE "public"."medio_pago" AS ENUM('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA_DEBITO', 'TARJETA_CREDITO');--> statement-breakpoint
CREATE TYPE "public"."metodo_depreciacion_af" AS ENUM('LINEA_RECTA', 'DIGITO_CRECIENTE', 'DIGITO_DECRECIENTE');--> statement-breakpoint
CREATE TYPE "public"."personal_cargo" AS ENUM('GERENTE_GENERAL', 'GERENTE_OPERATIVO', 'JEFE_DE_TALLER');--> statement-breakpoint
CREATE TYPE "public"."sifen_status" AS ENUM('OFFLINE_PENDING', 'MANUAL_CONVERT_QUEUE', 'APROBADO_DNIT', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_activo_fijo" AS ENUM('EQUIPO_DIAGNOSTICO', 'HERRAMIENTA_ESPECIAL', 'VEHICULO_SERVICIO', 'MAQUINARIA_TALLER', 'MUEBLE_ENSAYRE', 'INFORMATICA', 'INMUEBLE', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_cuenta_bancaria" AS ENUM('CAJA_FISICA', 'CTA_CTE', 'CAJA_AHORRO', 'BILLETERA_DIGITAL');--> statement-breakpoint
CREATE TYPE "public"."tipo_cuenta_contable" AS ENUM('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO', 'ORDEN');--> statement-breakpoint
CREATE TYPE "public"."tipo_facturacion" AS ENUM('MANUAL', 'ELECTRONICA');--> statement-breakpoint
CREATE TYPE "public"."tipo_motor" AS ENUM('Nafta', 'Diésel', 'HEV', 'BEV');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento_tes" AS ENUM('INGRESO', 'EGRESO', 'TRANSFERENCIA', 'AJUSTE');--> statement-breakpoint
CREATE TYPE "public"."tipo_operacion" AS ENUM('VENTA', 'SERVICIO', 'VENTA_SERVICIO', 'EXPORTACION', 'IMPORTACION');--> statement-breakpoint
CREATE TYPE "public"."fuente_tipo_cambio" AS ENUM('BCP', 'REFERENCIA', 'COMPRA', 'VENTA', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."moneda_extranjera" AS ENUM('USD', 'EUR', 'BRL', 'ARS', 'CLP', 'GBP');--> statement-breakpoint
CREATE TYPE "public"."formulario_tipo" AS ENUM('FORM_120_IVA', 'FORM_500_IRE', 'FORM_501_IRE_SIMPLE', 'FORM_502_IRE_RESIMPLE', 'FORM_520_IDU', 'FORM_130_ISC', 'FORM_515_INR');--> statement-breakpoint
CREATE TYPE "public"."liquidacion_estado" AS ENUM('BORRADOR', 'PRESENTADO', 'PAGADO', 'RECTIFICADO');--> statement-breakpoint
CREATE TYPE "public"."backup_destination" AS ENUM('LOCAL', 'S3', 'GDRIVE', 'FTP');--> statement-breakpoint
CREATE TYPE "public"."backup_frequency" AS ENUM('DIARIA', 'SEMANAL', 'MENSUAL');--> statement-breakpoint
CREATE TYPE "public"."backup_type" AS ENUM('COMPLETO', 'Solo_DB', 'Solo_FILES');--> statement-breakpoint
CREATE TYPE "public"."crm_sync_operation" AS ENUM('upsert_contact', 'add_note', 'update_vehicle', 'create_contact', 'update_contact');--> statement-breakpoint
CREATE TYPE "public"."crm_sync_status" AS ENUM('pending', 'success', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."label_type" AS ENUM('REPUESTO', 'HERRAMIENTA', 'PERSONALIZADA');--> statement-breakpoint
CREATE TYPE "public"."printer_protocol" AS ENUM('ESCPOS', 'ZPL', 'TSPL', 'RAW_TEXT');--> statement-breakpoint
CREATE TYPE "public"."agendamiento_estado" AS ENUM('RESERVADO', 'CONFIRMADO', 'PROCESADO_EN_ERP', 'AUSENTE', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."agendamiento_servicio" AS ENUM('RAPIDO', 'PESADO');--> statement-breakpoint
CREATE TYPE "public"."error_operation" AS ENUM('send_message', 'send_document', 'create_instance', 'get_qr', 'get_status', 'disconnect', 'crm_sync', 'crm_upsert', 'crm_create_contact', 'crm_add_note');--> statement-breakpoint
CREATE TYPE "public"."error_source" AS ENUM('whatsapp', 'twenty_crm', 'evolution_api');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_msg_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_template" AS ENUM('RECEPCIONADO', 'PRESUPUESTADO', 'EN_REPARACION', 'LISTO_ENTREGA', 'FINALIZADO_RETIRADO', 'CUSTOM');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"ruc" text,
	"address" text,
	"notes" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activos_fijos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_activo_fijo" NOT NULL,
	"marca" text,
	"modelo" text,
	"numero_serie" text,
	"fecha_adquisicion" timestamp with time zone NOT NULL,
	"costo_adquisicion" numeric(14, 2) DEFAULT '0' NOT NULL,
	"valor_residual" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vida_util_anos" integer DEFAULT 5 NOT NULL,
	"metodo_depreciacion" "metodo_depreciacion_af" DEFAULT 'LINEA_RECTA' NOT NULL,
	"valor_actual_libros" numeric(14, 2) DEFAULT '0' NOT NULL,
	"depreciacion_acumulada" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ultima_depreciacion" timestamp with time zone,
	"estado" "estado_activo_fijo" DEFAULT 'ACTIVO' NOT NULL,
	"cuenta_gasto_depreciacion_id" uuid,
	"cuenta_depreciacion_acumulada_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activos_fijos_codigo_unique" UNIQUE("codigo","tenant_slug")
);
--> statement-breakpoint
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
	"centro_costo_id" uuid,
	"orden_trabajo_id_linea" uuid,
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
CREATE TABLE "conciliacion_bancaria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"periodo" text NOT NULL,
	"saldo_libros" numeric NOT NULL,
	"saldo_banco" numeric NOT NULL,
	"diferencia" numeric NOT NULL,
	"conciliado" boolean DEFAULT false NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_herramientas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"herramienta_id" uuid NOT NULL,
	"tool_instance_id" uuid NOT NULL,
	"orden_trabajo_id" uuid NOT NULL,
	"mecanico_id" uuid NOT NULL,
	"mecanico_nombre" text NOT NULL,
	"fecha_asignacion" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_esperada_devolucion" timestamp with time zone,
	"fecha_devolucion" timestamp with time zone,
	"condicion_salida" text,
	"condicion_retorno" text,
	"requiere_reparacion" boolean DEFAULT false NOT NULL,
	"costo_reparacion" numeric(12, 2),
	"asiento_danio_id" uuid,
	"observaciones" text,
	"estado" "estado_control_herramienta" DEFAULT 'Asignado' NOT NULL,
	"tenant_slug" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuentas_bancarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"moneda" text DEFAULT 'PYG' NOT NULL,
	"saldo_inicial" numeric DEFAULT '0' NOT NULL,
	"saldo_actual" numeric DEFAULT '0' NOT NULL,
	"numero_cuenta" text,
	"banco" text,
	"activo" boolean DEFAULT true NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depreciacion_activos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activo_fijo_id" uuid NOT NULL,
	"asiento_id" uuid,
	"periodo" text NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"valor_inicial" numeric(14, 2) NOT NULL,
	"monto_depreciacion" numeric(14, 2) NOT NULL,
	"valor_final" numeric(14, 2) NOT NULL,
	"depreciacion_acumulada" numeric(14, 2) NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dep_activos_periodo_unique" UNIQUE("activo_fijo_id","periodo")
);
--> statement-breakpoint
CREATE TABLE "factura_detalles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"tipo_linea" text NOT NULL,
	"descripcion" text NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"precio_unitario" numeric(14, 2) NOT NULL,
	"iva" integer DEFAULT 10 NOT NULL,
	"iva_monto" numeric(14, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"orden_servicio_id" uuid,
	"orden_repuesto_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"asiento_id" uuid,
	"total" numeric(14, 2) NOT NULL,
	"estado_pago" text DEFAULT 'PENDIENTE',
	"saldo_pendiente" numeric(14, 2),
	"fecha_vencimiento" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facturas_proveedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proveedor_id" uuid,
	"nro_factura" text NOT NULL,
	"tipo_doc" text DEFAULT 'FACTURA' NOT NULL,
	"total" numeric NOT NULL,
	"saldo_pendiente" numeric,
	"iva_monto" numeric,
	"base_imponible" numeric,
	"fecha_emision" timestamp with time zone NOT NULL,
	"fecha_vencimiento" timestamp with time zone NOT NULL,
	"estado_pago" text DEFAULT 'PENDIENTE' NOT NULL,
	"concepto" text,
	"cuenta_contable_id" uuid,
	"orden_trabajo_id" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"requiere_calibracion" boolean DEFAULT false NOT NULL,
	"tiene_serial_individual" boolean DEFAULT true NOT NULL,
	"vida_util_anos" integer,
	"metodo_depreciacion" text DEFAULT 'LINEA_RECTA' NOT NULL,
	"costo_reposicion" numeric(12, 2),
	"categoria_contable_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"imagen_url" text,
	"estado_calibracion" text DEFAULT 'NO_APLICA' NOT NULL,
	"tenant_slug" text DEFAULT 'demo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "herramientas_codigo_unique" UNIQUE("codigo")
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
CREATE TABLE "libros_obligatorios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"libro" text NOT NULL,
	"obligatorio" boolean DEFAULT true NOT NULL,
	"rubricado" boolean DEFAULT false NOT NULL,
	"fecha_rubrica" timestamp with time zone,
	"numero_rubrica" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "libros_obligatorios_tenant_libro_unique" UNIQUE("tenant_slug","libro")
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
CREATE TABLE "movimientos_tesoreria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"medio_pago" text NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"cuenta_contable_id" uuid,
	"monto" numeric NOT NULL,
	"moneda" text DEFAULT 'PYG' NOT NULL,
	"tipo_cambio" numeric DEFAULT '1' NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"fecha_valor" timestamp with time zone,
	"concepto" text NOT NULL,
	"referencia_tipo" text,
	"referencia_id" text,
	"conciliado" boolean DEFAULT false NOT NULL,
	"fecha_conciliacion" timestamp with time zone,
	"asiento_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"mensaje" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"leido" boolean DEFAULT false NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orden_repuestos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_trabajo_id" uuid NOT NULL,
	"repuesto_id" uuid,
	"repuesto_nombre" text NOT NULL,
	"codigo" text,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orden_servicios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_trabajo_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	"servicio_nombre" text NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"duracion_estimada" integer,
	"duracion_real" integer,
	"hora_inicio_real" timestamp with time zone,
	"hora_fin_real" timestamp with time zone,
	"tecnico_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"hv_lockout_signed" boolean DEFAULT false NOT NULL,
	"hv_lockout_signed_at" timestamp with time zone,
	"hv_lockout_signed_by" text,
	"total_cost" numeric(10, 2) DEFAULT '0',
	"sucursal_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_trabajo_cost_check" CHECK ("ordenes_trabajo"."total_cost" IS NULL OR "ordenes_trabajo"."total_cost" >= 0)
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
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"password_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_role_check" CHECK ("profiles"."role" IN ('admin', 'manager', 'mechanic', 'user'))
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
	"costo_promedio" numeric(12, 2),
	"precio_venta" numeric(12, 2),
	"stock_actual" integer DEFAULT 0 NOT NULL,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"stock_maximo" integer,
	"punto_reorden" integer,
	"proveedor_preferido_id" uuid,
	"lote_economico" integer,
	"ubicacion" text,
	"unidad_medida" text DEFAULT 'unidad' NOT NULL,
	"proveedor" text,
	"compatible_con" text,
	"activo" boolean DEFAULT true NOT NULL,
	"imagen_url" text,
	"precio_compra" numeric(12, 2),
	"tenant_slug" text DEFAULT 'demo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repuestos_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "repuestos_codigo_barras_unique" UNIQUE("codigo_barras")
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
CREATE TABLE "tenant_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"ruc" text DEFAULT '' NOT NULL,
	"dv" text DEFAULT '' NOT NULL,
	"razon_social" text DEFAULT '' NOT NULL,
	"clasificacion_mic" text DEFAULT 'PEQUENIA' NOT NULL,
	"forma_juridica" text DEFAULT 'UNIPERSONAL' NOT NULL,
	"regimen_ire" text DEFAULT 'IRE_SIMPLE' NOT NULL,
	"ingresos_anuales" numeric(16, 2) DEFAULT '0' NOT NULL,
	"cantidad_personal" integer DEFAULT 0 NOT NULL,
	"capital_integrado" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ejercicio_actual" integer DEFAULT 2026 NOT NULL,
	"periodo_abierto_mes" integer DEFAULT 1 NOT NULL,
	"cerrado_hasta_mes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_config_slug_unique" UNIQUE("tenant_slug")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"schema_name" text NOT NULL,
	"ruc" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_schema_name_unique" UNIQUE("schema_name")
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
	"health_score" integer,
	"pending_assignment" boolean DEFAULT false NOT NULL,
	"raw_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehiculos_hv_voltage_check" CHECK ("vehiculos"."hv_battery_voltage" IS NULL OR "vehiculos"."hv_battery_voltage" > 0)
);
--> statement-breakpoint
CREATE TABLE "fuel_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	CONSTRAINT "fuel_types_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "mileage_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"km_desde" integer NOT NULL,
	"km_hasta" integer,
	"nombre" text NOT NULL,
	"orden" smallint NOT NULL,
	CONSTRAINT "mileage_intervals_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "rh_service_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"servicio_id" uuid NOT NULL,
	"vehicle_type_id" uuid NOT NULL,
	"complejidad" text DEFAULT 'NORMAL' NOT NULL,
	"horas_estimadas" numeric(5, 2) NOT NULL,
	"horas_minimas" numeric(5, 2),
	"horas_maximas" numeric(5, 2),
	"requiere_especialista" boolean DEFAULT false NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_brand_map" (
	"servicio_id" uuid NOT NULL,
	"marca" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"icono" text,
	"color" text,
	"orden" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "service_categories_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "service_pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"servicio_id" uuid NOT NULL,
	"vehicle_type_id" uuid NOT NULL,
	"fuel_type_id" uuid,
	"mileage_interval_id" uuid,
	"precio_venta_pyg" numeric(15, 2) NOT NULL,
	"precio_costo_pyg" numeric(15, 2) DEFAULT '0' NOT NULL,
	"impuesto_iva_pct" numeric(5, 2) DEFAULT '10' NOT NULL,
	"tiempo_estimado_min" integer NOT NULL,
	"complejidad" text DEFAULT 'NORMAL' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servicios_catalogo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"descripcion_tecnica" text,
	"categoria" text,
	"categoria_id" uuid,
	"codigo" text,
	"thinkcar_modulo" text,
	"precio_estimado" numeric(10, 2),
	"duracion_estimada" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "vehicle_types_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "vehiculos_marca" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"pais_origen" text,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "vehiculos_marca_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "vehiculos_modelo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marca_id" uuid NOT NULL,
	"vehicle_type_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"motor_cc" text,
	"combustible_default" text
);
--> statement-breakpoint
CREATE TABLE "notification_priorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" varchar(100) NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"priority" varchar(20) DEFAULT 'NORMAL' NOT NULL,
	"titulo" text NOT NULL,
	"mensaje" text NOT NULL,
	"entity_type" varchar(50),
	"entity_id" varchar(36),
	"target_user" varchar(200),
	"delivered" boolean DEFAULT false NOT NULL,
	"leido" boolean DEFAULT false NOT NULL,
	"action_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "initial_inventory_loads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"batch_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"item_descripcion" text NOT NULL,
	"cantidad" integer NOT NULL,
	"valor_unitario" numeric(12, 2) NOT NULL,
	"valor_total" numeric(12, 2) NOT NULL,
	"cuenta_activo_id" uuid NOT NULL,
	"asiento_id" uuid,
	"cuenta_patrimonio_id" uuid NOT NULL,
	"observaciones" text,
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
CREATE TABLE "tool_depreciation_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_instance_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"periodo" text NOT NULL,
	"valor_inicial" numeric(12, 2) NOT NULL,
	"valor_final" numeric(12, 2) NOT NULL,
	"monto_depreciacion" numeric(12, 2) NOT NULL,
	"asiento_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"herramienta_id" uuid NOT NULL,
	"numero_serie" text NOT NULL,
	"tag_rfid" text,
	"codigo_barras" text,
	"codigo_inventario" text,
	"costo_adquisicion" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fecha_adquisicion" date NOT NULL,
	"valor_actual_libros" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ultima_depreciacion" date,
	"estado_actual" text DEFAULT 'DISPONIBLE' NOT NULL,
	"ubicacion_actual" text,
	"requiere_calibracion" boolean DEFAULT false NOT NULL,
	"ultima_calibracion" date,
	"proxima_calibracion" date,
	"dias_intervalo_calibracion" numeric,
	"activa" boolean DEFAULT true NOT NULL,
	"fecha_baja" date,
	"motivo_baja" text,
	"asiento_baja_id" uuid,
	"tecnico_actual_id" uuid,
	"orden_trabajo_actual_id" uuid,
	"categoria_contable_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_instances_herramienta_serie_unique" UNIQUE("herramienta_id","numero_serie"),
	CONSTRAINT "tool_instances_rfid_unique" UNIQUE("tag_rfid"),
	CONSTRAINT "tool_instances_barcode_unique" UNIQUE("codigo_barras"),
	CONSTRAINT "tool_instances_inventario_unique" UNIQUE("codigo_inventario")
);
--> statement-breakpoint
CREATE TABLE "tool_maintenance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_instance_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'PROGRAMADO' NOT NULL,
	"fecha_inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_fin" timestamp with time zone,
	"proveedor" text,
	"numero_orden_externa" text,
	"costo" numeric(12, 2),
	"asiento_costo_id" uuid,
	"resultado" text,
	"certificado_url" text,
	"observaciones" text,
	"realizada_por_id" uuid,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"usuario_id" text NOT NULL,
	"ip" text,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text NOT NULL,
	"valor_anterior" jsonb,
	"valor_nuevo" jsonb,
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presupuestos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo" text NOT NULL,
	"descripcion" text,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presupuestos_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"centro_costo_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"monto_presupuestado" numeric(14, 2) DEFAULT '0' NOT NULL,
	"monto_real" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notas" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "centros_costo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"centro_padre_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_cambio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moneda" "moneda_extranjera" NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"compra" numeric(14, 2) NOT NULL,
	"venta" numeric(14, 2) NOT NULL,
	"referencia" numeric(14, 2),
	"fuente" "fuente_tipo_cambio" DEFAULT 'BCP' NOT NULL,
	"tenant_slug" text NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_cambio_unique" UNIQUE("moneda","fecha","fuente","tenant_slug")
);
--> statement-breakpoint
CREATE TABLE "liquidaciones_idu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_fiscal_id" uuid NOT NULL,
	"liquidacion_ire_id" uuid,
	"tipo_beneficiario" text DEFAULT 'RESIDENTE' NOT NULL,
	"tasa_aplicada" numeric(5, 4) DEFAULT '0.0800' NOT NULL,
	"renta_neta_base" numeric(14, 2) DEFAULT '0' NOT NULL,
	"impuesto_ire_pagado" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reserva_legal_base" numeric(14, 2) DEFAULT '0' NOT NULL,
	"utilidad_distribuible" numeric(14, 2) DEFAULT '0' NOT NULL,
	"porcentaje_distribuido" numeric(5, 4) DEFAULT '1.0000' NOT NULL,
	"utilidad_efectiva" numeric(14, 2) DEFAULT '0' NOT NULL,
	"impuesto_idu" numeric(14, 2) DEFAULT '0' NOT NULL,
	"retenciones_idu" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saldo_pagar_idu" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saldo_favor_idu" numeric(14, 2) DEFAULT '0' NOT NULL,
	"alertas" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidaciones_inr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_fiscal_id" uuid NOT NULL,
	"tipo_renta" text NOT NULL,
	"beneficiario_nombre" text DEFAULT '' NOT NULL,
	"beneficiario_pais" text DEFAULT '' NOT NULL,
	"monto_bruto" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tasa_retencion" numeric(5, 2) DEFAULT '0' NOT NULL,
	"impuesto_inr" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saldo_pagar_inr" numeric(14, 2) DEFAULT '0' NOT NULL,
	"alertas" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidaciones_ire" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_fiscal_id" uuid NOT NULL,
	"ingresos_servicios" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ingresos_bienes" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ingresos_no_operacionales" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ingresos_brutos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"costo_repuestos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"costo_mano_obra" numeric(14, 2) DEFAULT '0' NOT NULL,
	"costos_indirectos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_costos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gastos_administrativos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gastos_ventas" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_gastos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"donaciones" numeric(14, 2) DEFAULT '0' NOT NULL,
	"otras_deducciones" numeric(14, 2) DEFAULT '0' NOT NULL,
	"renta_neta" numeric(14, 2) DEFAULT '0' NOT NULL,
	"impuesto_ire" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reserva_legal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"retenciones" numeric(14, 2) DEFAULT '0' NOT NULL,
	"anticipos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saldo_pagar" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saldo_favor_ire" numeric(14, 2) DEFAULT '0' NOT NULL,
	"alertas" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidaciones_isc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_fiscal_id" uuid NOT NULL,
	"rubro" text NOT NULL,
	"cantidad" numeric(14, 2) DEFAULT '0' NOT NULL,
	"unidad_medida" text DEFAULT 'UNIDAD' NOT NULL,
	"base_imponible" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tasa_aplicada" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tipo_tasa" text DEFAULT 'PORCENTUAL' NOT NULL,
	"impuesto_isc" numeric(14, 2) DEFAULT '0' NOT NULL,
	"creditos_isc" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saldo_pagar_isc" numeric(14, 2) DEFAULT '0' NOT NULL,
	"alertas" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidaciones_iva" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_fiscal_id" uuid NOT NULL,
	"ventas_gravada_10" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ventas_iva_10" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ventas_gravada_5" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ventas_iva_5" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ventas_exenta" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ventas_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"compras_gravada_10" numeric(14, 2) DEFAULT '0' NOT NULL,
	"compras_iva_10" numeric(14, 2) DEFAULT '0' NOT NULL,
	"compras_gravada_5" numeric(14, 2) DEFAULT '0' NOT NULL,
	"compras_iva_5" numeric(14, 2) DEFAULT '0' NOT NULL,
	"compras_otras" numeric(14, 2) DEFAULT '0' NOT NULL,
	"compras_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"iva_debito" numeric(14, 2) DEFAULT '0' NOT NULL,
	"iva_credito" numeric(14, 2) DEFAULT '0' NOT NULL,
	"iva_a_pagar" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saldo_favor" numeric(14, 2) DEFAULT '0' NOT NULL,
	"prorrateo_indice" numeric(5, 4),
	"saldo_arrastre" numeric(14, 2) DEFAULT '0' NOT NULL,
	"alertas" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periodos_fiscales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formulario" "formulario_tipo" NOT NULL,
	"anho" integer NOT NULL,
	"mes" integer DEFAULT 0 NOT NULL,
	"estado" "liquidacion_estado" DEFAULT 'BORRADOR' NOT NULL,
	"tenant_slug" text NOT NULL,
	"fecha_presentacion" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periodo_fiscal_unique" UNIQUE("formulario","anho","mes","tenant_slug")
);
--> statement-breakpoint
CREATE TABLE "revaluaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activo_fijo_id" uuid NOT NULL,
	"tenant_slug" text NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"valor_anterior" numeric(14, 2) NOT NULL,
	"valor_nuevo" numeric(14, 2) NOT NULL,
	"diferencia" numeric(14, 2) NOT NULL,
	"depreciacion_acumulada_anterior" numeric(14, 2),
	"asiento_id" uuid,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid,
	"estado" text DEFAULT 'PENDIENTE' NOT NULL,
	"file_path" text,
	"file_size" integer,
	"checksum" text,
	"metodo_encriptacion" text,
	"duracion_ms" integer,
	"error" text,
	"progreso" integer DEFAULT 0,
	"log" jsonb DEFAULT '[]'::jsonb,
	"trigger" text DEFAULT 'CRON' NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "backup_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"frecuencia" "backup_frequency" DEFAULT 'DIARIA' NOT NULL,
	"hora_ejecucion" integer DEFAULT 23 NOT NULL,
	"minuto_ejecucion" integer DEFAULT 30 NOT NULL,
	"dia_semana" integer,
	"dia_mes" integer,
	"tipo_backup" "backup_type" DEFAULT 'COMPLETO' NOT NULL,
	"destino" "backup_destination" DEFAULT 'LOCAL' NOT NULL,
	"destino_config" jsonb DEFAULT '{"path":"/var/backups/erp"}'::jsonb NOT NULL,
	"password_encriptacion" text,
	"retencion_dias" integer DEFAULT 30 NOT NULL,
	"max_backups" integer DEFAULT 10 NOT NULL,
	"comprimir" boolean DEFAULT true NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restore_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backup_job_id" uuid,
	"estado" text DEFAULT 'PENDIENTE' NOT NULL,
	"initiated_by" text NOT NULL,
	"two_factor_verified" boolean DEFAULT false NOT NULL,
	"progreso" integer DEFAULT 0,
	"log" jsonb DEFAULT '[]'::jsonb,
	"error" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sucursales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"codigo" text NOT NULL,
	"direccion" text,
	"ciudad" text,
	"departamento" text,
	"telefono" text,
	"email" text,
	"gerente" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sucursales_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "crm_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" "crm_sync_operation" NOT NULL,
	"direction" text DEFAULT 'erp_to_crm' NOT NULL,
	"orden_id" uuid,
	"client_id" uuid,
	"client_name" text,
	"twenty_contact_id" text,
	"twenty_object_name" text,
	"twenty_record_id" text,
	"status" "crm_sync_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dvi_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_trabajo_id" uuid NOT NULL,
	"health_score" integer DEFAULT 0 NOT NULL,
	"condicion_general" text DEFAULT 'REGULAR' NOT NULL,
	"observaciones" text,
	"inspector" text,
	"compartido_whatsapp" boolean DEFAULT false NOT NULL,
	"compartido_at" timestamp with time zone,
	"health_score_url" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dvi_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dvi_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"descripcion" text NOT NULL,
	"estado" text DEFAULT 'OK' NOT NULL,
	"peso" integer DEFAULT 5 NOT NULL,
	"notas" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dvi_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dvi_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"url" text NOT NULL,
	"nombre_archivo" text,
	"markup" json,
	"caption" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"orden_trabajo_id" uuid,
	"scanner_brand" text,
	"scan_report" jsonb,
	"diagnosis_result" jsonb,
	"hv_protocol" jsonb,
	"odometer" integer,
	"dtc_count" integer DEFAULT 0 NOT NULL,
	"critical_count" integer DEFAULT 0 NOT NULL,
	"hv_protocol_generated" text DEFAULT 'no',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "label_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "label_type" DEFAULT 'REPUESTO' NOT NULL,
	"protocolo" "printer_protocol" DEFAULT 'ESCPOS' NOT NULL,
	"ancho_mm" integer DEFAULT 50 NOT NULL,
	"alto_mm" integer DEFAULT 30 NOT NULL,
	"dpi" integer DEFAULT 203 NOT NULL,
	"impresora_default" text,
	"copias_default" integer DEFAULT 1 NOT NULL,
	"layout" jsonb DEFAULT '{"fields":[],"cutPaper":true}'::jsonb NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"copias" integer DEFAULT 1 NOT NULL,
	"impresora" text NOT NULL,
	"protocolo" "printer_protocol" NOT NULL,
	"payload" text NOT NULL,
	"estado" text DEFAULT 'PENDIENTE' NOT NULL,
	"error" text,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agendamientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_nombre" varchar(255) NOT NULL,
	"cliente_phone" varchar(20) NOT NULL,
	"cliente_email" varchar(255),
	"cliente_documento" varchar(50),
	"vehiculo_chapa" varchar(20) NOT NULL,
	"vehiculo_marca" varchar(100) NOT NULL,
	"vehiculo_modelo" varchar(100) NOT NULL,
	"vehiculo_vin" varchar(50),
	"fecha_turno" varchar(10) NOT NULL,
	"hora_turno" varchar(5) NOT NULL,
	"tipo_servicio" "agendamiento_servicio" NOT NULL,
	"duracion_horas" integer DEFAULT 1 NOT NULL,
	"estado" "agendamiento_estado" DEFAULT 'RESERVADO' NOT NULL,
	"estado_anterior" "agendamiento_estado",
	"confirmacion_enviada" boolean DEFAULT false NOT NULL,
	"recordatorio_enviado" boolean DEFAULT false NOT NULL,
	"recordatorio_enviado_at" timestamp with time zone,
	"cliente_respuesta" varchar(10),
	"cliente_respuesta_at" timestamp with time zone,
	"orden_trabajo_id" uuid,
	"erp_client_id" uuid,
	"erp_vehicle_id" uuid,
	"twenty_contact_id" varchar(100),
	"twenty_event_id" varchar(100),
	"diagnostico_pre" text,
	"observaciones" text,
	"sucursal_id" uuid,
	"tenant_slug" varchar(100) NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"marked_absent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hardware_fingerprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"motherboard_uuid" text NOT NULL,
	"cpu_serial" text NOT NULL,
	"disk_serial" text NOT NULL,
	"hostname" text NOT NULL,
	"platform" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "security_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"descripcion" text NOT NULL,
	"usb_serial" text,
	"fingerprint_id" uuid,
	"ip_address" text,
	"user_agent" text,
	"metadata" text,
	"severidad" text DEFAULT 'INFO' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usb_security_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"usb_serial" text NOT NULL,
	"usb_vendor_id" text,
	"usb_product_id" text,
	"usb_model" text,
	"token_hash" text NOT NULL,
	"fingerprint_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usb_security_tokens_usb_serial_unique" UNIQUE("usb_serial")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_errors_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "error_source" NOT NULL,
	"operation" "error_operation" NOT NULL,
	"orden_id" uuid,
	"client_name" varchar(255),
	"phone_number" varchar(20),
	"error_code" varchar(50),
	"error_message" text NOT NULL,
	"error_stack" text,
	"request_url" varchar(500),
	"request_method" varchar(10),
	"response_status" integer,
	"response_body" text,
	"tenant_slug" varchar(100) NOT NULL,
	"triggered_by" varchar(255),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(255),
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" varchar(100) NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"orden_id" varchar(36),
	"phone" varchar(20) NOT NULL,
	"filled_body" text NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"message_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_id" uuid NOT NULL,
	"cliente_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"template" "whatsapp_template" NOT NULL,
	"message_text" text NOT NULL,
	"has_attachment" boolean DEFAULT false NOT NULL,
	"attachment_filename" text,
	"status" "whatsapp_msg_status" DEFAULT 'PENDING' NOT NULL,
	"external_key" text,
	"error_message" text,
	"sent_by" text NOT NULL,
	"tenant_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" varchar(100) NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(50) DEFAULT 'general' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trigger_event" varchar(50),
	"trigger_delay_hours" varchar(10) DEFAULT '0' NOT NULL,
	"max_retries" varchar(5) DEFAULT '2' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asientos_detalle" ADD CONSTRAINT "asientos_detalle_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_detalle" ADD CONSTRAINT "asientos_detalle_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_mechanic_profile_id_mechanic_profiles_id_fk" FOREIGN KEY ("mechanic_profile_id") REFERENCES "public"."mechanic_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conciliacion_bancaria" ADD CONSTRAINT "conciliacion_bancaria_cuenta_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_herramientas" ADD CONSTRAINT "control_herramientas_herramienta_id_herramientas_id_fk" FOREIGN KEY ("herramienta_id") REFERENCES "public"."herramientas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_herramientas" ADD CONSTRAINT "control_herramientas_tool_instance_id_tool_instances_id_fk" FOREIGN KEY ("tool_instance_id") REFERENCES "public"."tool_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_herramientas" ADD CONSTRAINT "control_herramientas_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_herramientas" ADD CONSTRAINT "control_herramientas_mecanico_id_profiles_id_fk" FOREIGN KEY ("mecanico_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_herramientas" ADD CONSTRAINT "control_herramientas_asiento_danio_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_danio_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciacion_activos" ADD CONSTRAINT "depreciacion_activos_activo_fijo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_fijo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura_detalles" ADD CONSTRAINT "factura_detalles_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas_proveedor" ADD CONSTRAINT "facturas_proveedor_cuenta_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documento_detalles" ADD CONSTRAINT "fiscal_documento_detalles_documento_id_fiscal_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."fiscal_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_vehicle_id_vehiculos_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehiculos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanic_profiles" ADD CONSTRAINT "mechanic_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_cuenta_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_cuenta_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_repuestos" ADD CONSTRAINT "orden_repuestos_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_servicios" ADD CONSTRAINT "orden_servicios_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_servicios" ADD CONSTRAINT "orden_servicios_servicio_id_servicios_catalogo_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios_catalogo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_vehicle_id_vehiculos_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehiculos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_summary" ADD CONSTRAINT "payroll_summary_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sifen_sync_log" ADD CONSTRAINT "sifen_sync_log_documento_id_fiscal_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."fiscal_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thinkcar_imports" ADD CONSTRAINT "thinkcar_imports_vehicle_id_vehiculos_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehiculos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thinkcar_imports" ADD CONSTRAINT "thinkcar_imports_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thinkcar_imports" ADD CONSTRAINT "thinkcar_imports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabajos_terceros" ADD CONSTRAINT "trabajos_terceros_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rh_service_hours" ADD CONSTRAINT "rh_service_hours_servicio_id_servicios_catalogo_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios_catalogo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rh_service_hours" ADD CONSTRAINT "rh_service_hours_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_brand_map" ADD CONSTRAINT "service_brand_map_servicio_id_servicios_catalogo_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios_catalogo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_pricing_rules" ADD CONSTRAINT "service_pricing_rules_servicio_id_servicios_catalogo_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios_catalogo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_pricing_rules" ADD CONSTRAINT "service_pricing_rules_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_pricing_rules" ADD CONSTRAINT "service_pricing_rules_fuel_type_id_fuel_types_id_fk" FOREIGN KEY ("fuel_type_id") REFERENCES "public"."fuel_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_pricing_rules" ADD CONSTRAINT "service_pricing_rules_mileage_interval_id_mileage_intervals_id_fk" FOREIGN KEY ("mileage_interval_id") REFERENCES "public"."mileage_intervals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos_modelo" ADD CONSTRAINT "vehiculos_modelo_marca_id_vehiculos_marca_id_fk" FOREIGN KEY ("marca_id") REFERENCES "public"."vehiculos_marca"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos_modelo" ADD CONSTRAINT "vehiculos_modelo_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_history" ADD CONSTRAINT "cost_history_repuesto_id_repuestos_id_fk" FOREIGN KEY ("repuesto_id") REFERENCES "public"."repuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_history" ADD CONSTRAINT "cost_history_movimiento_id_stock_movements_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initial_inventory_loads" ADD CONSTRAINT "initial_inventory_loads_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "tool_depreciation_entries" ADD CONSTRAINT "tool_depreciation_entries_tool_instance_id_tool_instances_id_fk" FOREIGN KEY ("tool_instance_id") REFERENCES "public"."tool_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_depreciation_entries" ADD CONSTRAINT "tool_depreciation_entries_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instances" ADD CONSTRAINT "tool_instances_herramienta_id_herramientas_id_fk" FOREIGN KEY ("herramienta_id") REFERENCES "public"."herramientas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instances" ADD CONSTRAINT "tool_instances_asiento_baja_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_baja_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instances" ADD CONSTRAINT "tool_instances_tecnico_actual_id_profiles_id_fk" FOREIGN KEY ("tecnico_actual_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instances" ADD CONSTRAINT "tool_instances_categoria_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("categoria_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_maintenance_events" ADD CONSTRAINT "tool_maintenance_events_tool_instance_id_tool_instances_id_fk" FOREIGN KEY ("tool_instance_id") REFERENCES "public"."tool_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_maintenance_events" ADD CONSTRAINT "tool_maintenance_events_asiento_costo_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_costo_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_maintenance_events" ADD CONSTRAINT "tool_maintenance_events_realizada_por_id_profiles_id_fk" FOREIGN KEY ("realizada_por_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos_items" ADD CONSTRAINT "presupuestos_items_presupuesto_id_presupuestos_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos_items" ADD CONSTRAINT "presupuestos_items_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones_idu" ADD CONSTRAINT "liquidaciones_idu_periodo_fiscal_id_periodos_fiscales_id_fk" FOREIGN KEY ("periodo_fiscal_id") REFERENCES "public"."periodos_fiscales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones_idu" ADD CONSTRAINT "liquidaciones_idu_liquidacion_ire_id_liquidaciones_ire_id_fk" FOREIGN KEY ("liquidacion_ire_id") REFERENCES "public"."liquidaciones_ire"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones_inr" ADD CONSTRAINT "liquidaciones_inr_periodo_fiscal_id_periodos_fiscales_id_fk" FOREIGN KEY ("periodo_fiscal_id") REFERENCES "public"."periodos_fiscales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones_ire" ADD CONSTRAINT "liquidaciones_ire_periodo_fiscal_id_periodos_fiscales_id_fk" FOREIGN KEY ("periodo_fiscal_id") REFERENCES "public"."periodos_fiscales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones_isc" ADD CONSTRAINT "liquidaciones_isc_periodo_fiscal_id_periodos_fiscales_id_fk" FOREIGN KEY ("periodo_fiscal_id") REFERENCES "public"."periodos_fiscales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidaciones_iva" ADD CONSTRAINT "liquidaciones_iva_periodo_fiscal_id_periodos_fiscales_id_fk" FOREIGN KEY ("periodo_fiscal_id") REFERENCES "public"."periodos_fiscales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revaluaciones" ADD CONSTRAINT "revaluaciones_activo_fijo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_fijo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_policy_id_backup_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."backup_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restore_sessions" ADD CONSTRAINT "restore_sessions_backup_job_id_backup_jobs_id_fk" FOREIGN KEY ("backup_job_id") REFERENCES "public"."backup_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dvi_inspections" ADD CONSTRAINT "dvi_inspections_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dvi_items" ADD CONSTRAINT "dvi_items_dvi_id_dvi_inspections_id_fk" FOREIGN KEY ("dvi_id") REFERENCES "public"."dvi_inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dvi_photos" ADD CONSTRAINT "dvi_photos_dvi_id_dvi_inspections_id_fk" FOREIGN KEY ("dvi_id") REFERENCES "public"."dvi_inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_vehicle_id_vehiculos_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehiculos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_orden_trabajo_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_trabajo_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_template_id_label_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."label_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usb_security_tokens" ADD CONSTRAINT "usb_security_tokens_fingerprint_id_hardware_fingerprints_id_fk" FOREIGN KEY ("fingerprint_id") REFERENCES "public"."hardware_fingerprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_tenant_slug_idx" ON "clients" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "activos_fijos_tenant_idx" ON "activos_fijos" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "activos_fijos_tipo_idx" ON "activos_fijos" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "activos_fijos_estado_idx" ON "activos_fijos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "asientos_fecha_idx" ON "asientos_contables" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "asientos_modulo_idx" ON "asientos_contables" USING btree ("modulo_origen");--> statement-breakpoint
CREATE INDEX "asientos_ot_idx" ON "asientos_contables" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "asientos_estado_idx" ON "asientos_contables" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "asientos_detalle_asiento_idx" ON "asientos_detalle" USING btree ("asiento_id");--> statement-breakpoint
CREATE INDEX "asientos_detalle_cuenta_idx" ON "asientos_detalle" USING btree ("cuenta_id");--> statement-breakpoint
CREATE INDEX "conc_banc_tenant_idx" ON "conciliacion_bancaria" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "conc_banc_cuenta_periodo_idx" ON "conciliacion_bancaria" USING btree ("cuenta_id","periodo");--> statement-breakpoint
CREATE INDEX "conc_banc_conciliado_idx" ON "conciliacion_bancaria" USING btree ("conciliado");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_herramienta_id_idx" ON "control_herramientas" USING btree ("herramienta_id");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_tool_instance_idx" ON "control_herramientas" USING btree ("tool_instance_id");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_orden_trabajo_id_idx" ON "control_herramientas" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_mecanico_id_idx" ON "control_herramientas" USING btree ("mecanico_id");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_estado_idx" ON "control_herramientas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_mecanico_estado_idx" ON "control_herramientas" USING btree ("mecanico_id","estado");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_active_loan_idx" ON "control_herramientas" USING btree ("fecha_devolucion","tool_instance_id");--> statement-breakpoint
CREATE INDEX "ctrl_herramientas_tenant_idx" ON "control_herramientas" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "cuentas_bancarias_tenant_idx" ON "cuentas_bancarias" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "cuentas_bancarias_activo_idx" ON "cuentas_bancarias" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "cuentas_bancarias_codigo_tenant_idx" ON "cuentas_bancarias" USING btree ("codigo","tenant_slug");--> statement-breakpoint
CREATE INDEX "dep_activos_activo_idx" ON "depreciacion_activos" USING btree ("activo_fijo_id");--> statement-breakpoint
CREATE INDEX "dep_activos_tenant_idx" ON "depreciacion_activos" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "factura_detalles_factura_id_idx" ON "factura_detalles" USING btree ("factura_id");--> statement-breakpoint
CREATE INDEX "factura_detalles_tenant_slug_idx" ON "factura_detalles" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "facturas_tenant_slug_idx" ON "facturas" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "facturas_orden_id_idx" ON "facturas" USING btree ("orden_id");--> statement-breakpoint
CREATE INDEX "facturas_sifen_cdc_idx" ON "facturas" USING btree ("sifen_cdc");--> statement-breakpoint
CREATE INDEX "facturas_estado_pago_idx" ON "facturas" USING btree ("estado_pago");--> statement-breakpoint
CREATE INDEX "facturas_vencimiento_idx" ON "facturas" USING btree ("fecha_vencimiento");--> statement-breakpoint
CREATE INDEX "fact_prov_tenant_idx" ON "facturas_proveedor" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "fact_prov_estado_idx" ON "facturas_proveedor" USING btree ("estado_pago");--> statement-breakpoint
CREATE INDEX "fact_prov_vencimiento_idx" ON "facturas_proveedor" USING btree ("fecha_vencimiento");--> statement-breakpoint
CREATE INDEX "fact_prov_proveedor_idx" ON "facturas_proveedor" USING btree ("proveedor_id");--> statement-breakpoint
CREATE INDEX "fiscal_detalle_documento_idx" ON "fiscal_documento_detalles" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "fiscal_doc_serie_numero_idx" ON "fiscal_documentos" USING btree ("serie","numero");--> statement-breakpoint
CREATE INDEX "fiscal_doc_cdc_idx" ON "fiscal_documentos" USING btree ("cdc");--> statement-breakpoint
CREATE INDEX "fiscal_doc_estado_idx" ON "fiscal_documentos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "fiscal_doc_cliente_idx" ON "fiscal_documentos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "fiscal_doc_ot_idx" ON "fiscal_documentos" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "fiscal_doc_fecha_emision_idx" ON "fiscal_documentos" USING btree ("fecha_emision");--> statement-breakpoint
CREATE INDEX "herramientas_codigo_idx" ON "herramientas" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "herramientas_categoria_idx" ON "herramientas" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "herramientas_activo_idx" ON "herramientas" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "ingresos_vehicle_id_idx" ON "ingresos" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "ingresos_orden_trabajo_id_idx" ON "ingresos" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "ingresos_fecha_ingreso_idx" ON "ingresos" USING btree ("fecha_ingreso");--> statement-breakpoint
CREATE INDEX "libros_obligatorios_tenant_idx" ON "libros_obligatorios" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "mov_tes_tenant_idx" ON "movimientos_tesoreria" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "mov_tes_cuenta_idx" ON "movimientos_tesoreria" USING btree ("cuenta_id");--> statement-breakpoint
CREATE INDEX "mov_tes_fecha_idx" ON "movimientos_tesoreria" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "mov_tes_tipo_idx" ON "movimientos_tesoreria" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "mov_tes_conciliado_idx" ON "movimientos_tesoreria" USING btree ("conciliado");--> statement-breakpoint
CREATE INDEX "mov_tes_referencia_idx" ON "movimientos_tesoreria" USING btree ("referencia_tipo","referencia_id");--> statement-breakpoint
CREATE INDEX "notif_tenant_idx" ON "notificaciones" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "notif_leido_idx" ON "notificaciones" USING btree ("leido");--> statement-breakpoint
CREATE INDEX "notif_tipo_idx" ON "notificaciones" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "notif_tenant_leido_idx" ON "notificaciones" USING btree ("tenant_slug","leido");--> statement-breakpoint
CREATE INDEX "orden_repuestos_orden_trabajo_id_idx" ON "orden_repuestos" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "orden_repuestos_tenant_slug_idx" ON "orden_repuestos" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "orden_servicios_orden_trabajo_id_idx" ON "orden_servicios" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "orden_servicios_servicio_id_idx" ON "orden_servicios" USING btree ("servicio_id");--> statement-breakpoint
CREATE INDEX "orden_servicios_tenant_slug_idx" ON "orden_servicios" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_vehicle_id_idx" ON "ordenes_trabajo" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_client_id_idx" ON "ordenes_trabajo" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_status_idx" ON "ordenes_trabajo" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_tenant_slug_idx" ON "ordenes_trabajo" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "plan_cuentas_tipo_idx" ON "plan_cuentas" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "plan_cuentas_padre_idx" ON "plan_cuentas" USING btree ("cuenta_padre_id");--> statement-breakpoint
CREATE INDEX "plan_cuentas_nivel_idx" ON "plan_cuentas" USING btree ("nivel");--> statement-breakpoint
CREATE INDEX "plan_cuentas_activo_idx" ON "plan_cuentas" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "repuestos_codigo_barras_idx" ON "repuestos" USING btree ("codigo_barras");--> statement-breakpoint
CREATE INDEX "repuestos_codigo_idx" ON "repuestos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "repuestos_categoria_idx" ON "repuestos" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "repuestos_stock_alert_idx" ON "repuestos" USING btree ("stock_actual","stock_minimo");--> statement-breakpoint
CREATE INDEX "repuestos_activo_idx" ON "repuestos" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "sifen_log_documento_idx" ON "sifen_sync_log" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "sifen_log_operacion_idx" ON "sifen_sync_log" USING btree ("operacion");--> statement-breakpoint
CREATE INDEX "tenant_config_slug_idx" ON "tenant_config" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "thinkcar_imports_vin_idx" ON "thinkcar_imports" USING btree ("vin");--> statement-breakpoint
CREATE UNIQUE INDEX "thinkcar_imports_file_hash_idx" ON "thinkcar_imports" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "thinkcar_imports_status_idx" ON "thinkcar_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "thinkcar_imports_vehicle_id_idx" ON "thinkcar_imports" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "thinkcar_imports_created_at_idx" ON "thinkcar_imports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trabajos_terceros_orden_trabajo_id_idx" ON "trabajos_terceros" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "trabajos_terceros_proveedor_idx" ON "trabajos_terceros" USING btree ("proveedor");--> statement-breakpoint
CREATE INDEX "vmc_hnsw_idx" ON "vehicle_manual_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "vmc_vehicle_id_idx" ON "vehicle_manual_chunks" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehiculos_client_id_idx" ON "vehiculos" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "vehiculos_plate_idx" ON "vehiculos" USING btree ("plate");--> statement-breakpoint
CREATE INDEX "vehiculos_vin_idx" ON "vehiculos" USING btree ("vin");--> statement-breakpoint
CREATE INDEX "vehiculos_tenant_slug_idx" ON "vehiculos" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "mileage_intervals_orden_idx" ON "mileage_intervals" USING btree ("orden");--> statement-breakpoint
CREATE INDEX "rh_service_hours_tenant_idx" ON "rh_service_hours" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "rh_service_hours_servicio_idx" ON "rh_service_hours" USING btree ("servicio_id");--> statement-breakpoint
CREATE INDEX "service_brand_map_servicio_idx" ON "service_brand_map" USING btree ("servicio_id");--> statement-breakpoint
CREATE INDEX "service_pricing_rules_tenant_idx" ON "service_pricing_rules" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "service_pricing_rules_servicio_idx" ON "service_pricing_rules" USING btree ("servicio_id");--> statement-breakpoint
CREATE INDEX "servicios_catalogo_tenant_slug_idx" ON "servicios_catalogo" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "servicios_catalogo_categoria_idx" ON "servicios_catalogo" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "servicios_catalogo_activo_idx" ON "servicios_catalogo" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "vehiculos_modelo_marca_idx" ON "vehiculos_modelo" USING btree ("marca_id");--> statement-breakpoint
CREATE INDEX "np_tenant_idx" ON "notification_priorities" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "np_target_idx" ON "notification_priorities" USING btree ("target_user");--> statement-breakpoint
CREATE INDEX "np_delivered_idx" ON "notification_priorities" USING btree ("delivered");--> statement-breakpoint
CREATE INDEX "np_priority_idx" ON "notification_priorities" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "cost_hist_repuesto_idx" ON "cost_history" USING btree ("repuesto_id");--> statement-breakpoint
CREATE INDEX "cost_hist_fecha_idx" ON "cost_history" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "cost_hist_tenant_idx" ON "cost_history" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "init_load_batch_idx" ON "initial_inventory_loads" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "init_load_tipo_idx" ON "initial_inventory_loads" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "init_load_item_idx" ON "initial_inventory_loads" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "init_load_asiento_idx" ON "initial_inventory_loads" USING btree ("asiento_id");--> statement-breakpoint
CREATE INDEX "init_load_tenant_idx" ON "initial_inventory_loads" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "init_load_created_idx" ON "initial_inventory_loads" USING btree ("created_at");--> statement-breakpoint
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
CREATE INDEX "tool_depr_instance_idx" ON "tool_depreciation_entries" USING btree ("tool_instance_id");--> statement-breakpoint
CREATE INDEX "tool_depr_periodo_idx" ON "tool_depreciation_entries" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "tool_depr_fecha_idx" ON "tool_depreciation_entries" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "tool_depr_tenant_idx" ON "tool_depreciation_entries" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "tool_instances_estado_idx" ON "tool_instances" USING btree ("estado_actual");--> statement-breakpoint
CREATE INDEX "tool_instances_tenant_estado_idx" ON "tool_instances" USING btree ("tenant_slug","estado_actual");--> statement-breakpoint
CREATE INDEX "tool_instances_herramienta_idx" ON "tool_instances" USING btree ("herramienta_id");--> statement-breakpoint
CREATE INDEX "tool_instances_tecnico_idx" ON "tool_instances" USING btree ("tecnico_actual_id");--> statement-breakpoint
CREATE INDEX "tool_instances_prox_cal_idx" ON "tool_instances" USING btree ("proxima_calibracion");--> statement-breakpoint
CREATE INDEX "tool_instances_activa_idx" ON "tool_instances" USING btree ("activa");--> statement-breakpoint
CREATE INDEX "tool_maint_instance_idx" ON "tool_maintenance_events" USING btree ("tool_instance_id");--> statement-breakpoint
CREATE INDEX "tool_maint_tipo_idx" ON "tool_maintenance_events" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "tool_maint_estado_idx" ON "tool_maintenance_events" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "tool_maint_fecha_idx" ON "tool_maintenance_events" USING btree ("fecha_inicio");--> statement-breakpoint
CREATE INDEX "tool_maint_tenant_idx" ON "tool_maintenance_events" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_idx" ON "audit_log" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "audit_log_entidad_idx" ON "audit_log" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "audit_log_accion_idx" ON "audit_log" USING btree ("accion");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_usuario_idx" ON "audit_log" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "presupuestos_periodo_idx" ON "presupuestos" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "presupuestos_estado_idx" ON "presupuestos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "presupuestos_tenant_slug_idx" ON "presupuestos" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "presupuestos_items_presupuesto_idx" ON "presupuestos_items" USING btree ("presupuesto_id");--> statement-breakpoint
CREATE INDEX "presupuestos_items_centro_costo_idx" ON "presupuestos_items" USING btree ("centro_costo_id");--> statement-breakpoint
CREATE INDEX "presupuestos_items_categoria_idx" ON "presupuestos_items" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "presupuestos_items_tenant_slug_idx" ON "presupuestos_items" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "centros_costo_codigo_tenant_idx" ON "centros_costo" USING btree ("codigo","tenant_slug");--> statement-breakpoint
CREATE INDEX "centros_costo_padre_idx" ON "centros_costo" USING btree ("centro_padre_id");--> statement-breakpoint
CREATE INDEX "centros_costo_tenant_slug_idx" ON "centros_costo" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "centros_costo_activo_idx" ON "centros_costo" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "tipos_cambio_moneda_fecha_idx" ON "tipos_cambio" USING btree ("moneda","fecha");--> statement-breakpoint
CREATE INDEX "tipos_cambio_tenant_idx" ON "tipos_cambio" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "liq_idu_periodo_idx" ON "liquidaciones_idu" USING btree ("periodo_fiscal_id");--> statement-breakpoint
CREATE INDEX "liq_idu_tenant_idx" ON "liquidaciones_idu" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "liq_inr_periodo_idx" ON "liquidaciones_inr" USING btree ("periodo_fiscal_id");--> statement-breakpoint
CREATE INDEX "liq_inr_tenant_idx" ON "liquidaciones_inr" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "liq_inr_renta_idx" ON "liquidaciones_inr" USING btree ("tipo_renta");--> statement-breakpoint
CREATE INDEX "liq_ire_periodo_idx" ON "liquidaciones_ire" USING btree ("periodo_fiscal_id");--> statement-breakpoint
CREATE INDEX "liq_ire_tenant_idx" ON "liquidaciones_ire" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "liq_isc_periodo_idx" ON "liquidaciones_isc" USING btree ("periodo_fiscal_id");--> statement-breakpoint
CREATE INDEX "liq_isc_tenant_idx" ON "liquidaciones_isc" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "liq_isc_rubro_idx" ON "liquidaciones_isc" USING btree ("rubro");--> statement-breakpoint
CREATE INDEX "liq_iva_periodo_idx" ON "liquidaciones_iva" USING btree ("periodo_fiscal_id");--> statement-breakpoint
CREATE INDEX "liq_iva_tenant_idx" ON "liquidaciones_iva" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "periodos_fiscales_tenant_idx" ON "periodos_fiscales" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "periodos_fiscales_form_idx" ON "periodos_fiscales" USING btree ("formulario");--> statement-breakpoint
CREATE INDEX "revaluaciones_activo_idx" ON "revaluaciones" USING btree ("activo_fijo_id");--> statement-breakpoint
CREATE INDEX "revaluaciones_tenant_idx" ON "revaluaciones" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "sucursales_codigo_idx" ON "sucursales" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "sucursales_tenant_idx" ON "sucursales" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "crm_sync_status_idx" ON "crm_sync_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_sync_tenant_idx" ON "crm_sync_log" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "crm_sync_orden_idx" ON "crm_sync_log" USING btree ("orden_id");--> statement-breakpoint
CREATE INDEX "crm_sync_contact_idx" ON "crm_sync_log" USING btree ("twenty_contact_id");--> statement-breakpoint
CREATE INDEX "dvi_orden_idx" ON "dvi_inspections" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "dvi_tenant_idx" ON "dvi_inspections" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "dvi_item_dvi_idx" ON "dvi_items" USING btree ("dvi_id");--> statement-breakpoint
CREATE INDEX "dvi_item_tenant_idx" ON "dvi_items" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "dvi_photo_dvi_idx" ON "dvi_photos" USING btree ("dvi_id");--> statement-breakpoint
CREATE INDEX "dvi_photo_tenant_idx" ON "dvi_photos" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "agendamientos_fecha_idx" ON "agendamientos" USING btree ("fecha_turno","hora_turno");--> statement-breakpoint
CREATE INDEX "agendamientos_estado_idx" ON "agendamientos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "agendamientos_tenant_idx" ON "agendamientos" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "agendamientos_phone_idx" ON "agendamientos" USING btree ("cliente_phone");--> statement-breakpoint
CREATE INDEX "agendamientos_reminder_idx" ON "agendamientos" USING btree ("recordatorio_enviado","estado");--> statement-breakpoint
CREATE INDEX "agendamientos_chapa_idx" ON "agendamientos" USING btree ("vehiculo_chapa");--> statement-breakpoint
CREATE INDEX "whatsapp_errors_source_idx" ON "whatsapp_errors_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX "whatsapp_errors_operation_idx" ON "whatsapp_errors_log" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "whatsapp_errors_tenant_idx" ON "whatsapp_errors_log" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "whatsapp_errors_unresolved_idx" ON "whatsapp_errors_log" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "whatsapp_errors_created_idx" ON "whatsapp_errors_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_msg_orden_idx" ON "whatsapp_messages" USING btree ("orden_id");--> statement-breakpoint
CREATE INDEX "whatsapp_msg_status_idx" ON "whatsapp_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "whatsapp_msg_tenant_slug_idx" ON "whatsapp_messages" USING btree ("tenant_slug");