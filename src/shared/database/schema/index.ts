export { tenants, type Tenant, type NewTenant } from "./tenants.js";
export {
  profiles,
  profilesRelations,
  VALID_ROLES,
  type Profile,
  type NewProfile,
  type ProfileRole,
} from "./profiles.js";
export {
  clients,
  clientsRelations,
  type Client,
  type NewClient,
} from "./clients.js";

export {
  vehiculos,
  ordenesTrabajo,
  ingresos,
  trabajosTerceros,
  tipoMotorEnum,
  estadoOrdenEnum,
  estadoTerceroEnum,
  vehiculosRelations,
  ordenesTrabajoRelations,
  ingresosRelations,
  trabajosTercerosRelations,
} from "../../../modules/workshop/schema/index.js";
export type {
   Vehiculo,
   NewVehiculo,
   TipoMotor,
   OrdenTrabajo,
   NewOrdenTrabajo,
   EstadoOrden,
   Ingreso,
   NewIngreso,
   TrabajoTercero,
   NewTrabajoTercero,
   EstadoTercero,
 } from "../../../modules/workshop/schema/index.js";

 export {
   herramientas,
   repuestos,
   controlHerramientas,
   estadoControlHerramientaEnum,
   herramientasRelations,
   controlHerramientasRelations,
 } from "../../../modules/inventory/schema/index.js";
 export type {
   Herramienta,
   NewHerramienta,
   Repuesto,
   NewRepuesto,
   ControlHerramienta,
   NewControlHerramienta,
   EstadoControlHerramienta,
  } from "../../../modules/inventory/schema/index.js";

export {
  fiscalDocumentos,
  fiscalDocumentoDetalles,
  sifenSyncLog,
  dteTipoEnum,
  fiscalDocStatusEnum,
  tipoOperacionEnum,
  planCuentas,
  asientosContables,
  asientosDetalle,
  tipoCuentaEnum,
  estadoAsientoEnum,
  fiscalDocumentosRelations,
  fiscalDocumentoDetallesRelations,
  sifenSyncLogRelations,
  planCuentasRelations,
  asientosContablesRelations,
  asientosDetalleRelations,
  fixedExpenses,
  gastoFijoCategoriaEnum,
  mechanicProfiles,
  mecanicoCategoriaEnum,
  staffProfiles,
  personalCargoEnum,
  commissionRecords,
  comisionEstadoEnum,
  payrollSummary,
  mechanicProfilesRelations,
  staffProfilesRelations,
  commissionRecordsRelations,
} from "../../../modules/finance/schema/index.js";

export {
  vehicleManualChunks,
} from "../../../modules/intelligence/rag/rag-schema.js";

export {
  thinkcarImports,
} from "../../../modules/thinkcar/schema/index.js";
export type {
  ThinkcarImport,
  NewThinkcarImport,
} from "../../../modules/thinkcar/schema/index.js";

export {
  notificaciones,
} from "./notifications.js";
export type {
  Notificacion,
  NewNotificacion,
} from "./notifications.js";

export type {
  FiscalDocumento,
  NewFiscalDocumento,
  FiscalDocumentoDetalle,
  NewFiscalDocumentoDetalle,
  SifenSyncLogEntry,
  NewSifenSyncLogEntry,
  DTETipo,
  FiscalDocStatus,
  TipoOperacion,
  PlanCuenta,
  NewPlanCuenta,
  AsientoContable,
  NewAsientoContable,
  AsientoDetalle,
  NewAsientoDetalle,
  TipoCuenta,
  EstadoAsiento,
  FixedExpense,
  NewFixedExpense,
  MechanicProfile,
  NewMechanicProfile,
  StaffProfile,
  NewStaffProfile,
  CommissionRecord,
  NewCommissionRecord,
  PayrollSummary,
  NewPayrollSummary,
} from "../../../modules/finance/schema/index.js";

export {
  facturas,
  tipoFacturacionEnum,
  sifenStatusEnum,
} from "../../../modules/finance/schema/index.js";
export type {
  Factura,
  NewFactura,
  TipoFacturacion,
  SifenStatus,
} from "../../../modules/finance/schema/index.js";

export {
  tenantConfig,
  librosObligatorios,
} from "../../../modules/tenants/schema/index.js";
export type {
  TenantConfig,
  NewTenantConfig,
  LibroObligatorio,
  NewLibroObligatorio,
} from "../../../modules/tenants/schema/index.js";

export {
  activosFijos,
  depreciacionActivos,
  tipoActivoFijoEnum,
  metodoDepreciacionEnum,
  estadoActivoEnum,
} from "../../../modules/finance/schema/index.js";
export type {
  ActivoFijo,
  NewActivoFijo,
  DepreciacionActivo,
  NewDepreciacionActivo,
  TipoActivoFijo,
  MetodoDepreciacionAF,
  EstadoActivoFijo,
} from "../../../modules/finance/schema/index.js";

export {
  cuentasBancarias,
  movimientosTes,
  conciliacionBancaria,
  facturasProveedor,
  tipoCuentaBancariaEnum,
  tipoMovimientoTesEnum,
  medioPagoEnum,
  estadoPagoEnum,
} from "../../../modules/finance/schema/index.js";
export type {
  CuentaBancaria,
  NewCuentaBancaria,
  MovimientoTes,
  NewMovimientoTes,
  ConciliacionBancaria,
  NewConciliacionBancaria,
  FacturaProveedor,
  NewFacturaProveedor,
  TipoCuentaBancaria,
  TipoMovimientoTes,
  MedioPago,
  EstadoPago,
} from "../../../modules/finance/schema/index.js";
