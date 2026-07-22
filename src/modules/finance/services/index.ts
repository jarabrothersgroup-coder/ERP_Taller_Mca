export { buildDTEXml, parseSifenSoapResponse, validateDTEXml } from "./sifen/sifen-xml.service.js";
export { signXMLAsync, signXMLInWorker, verifySignature, clearCertCache } from "./sifen/sifen-crypto.service.js";
export { enviarDTE, consultarDTE, anularDTE, testSifenConnection } from "./sifen/sifen-soap.service.js";

export {
  createCuenta,
  updateCuenta,
  getCuentaById,
  listCuentas,
  getArbolCuentas,
  createAsiento,
  getAsientoById,
  listAsientos,
  generarAsientoAutomatico,
  generarAsientoApertura,
  generarAperturaConSaldos,
  anularAsiento,
} from "./accounting/ledger.service.js";
export {
  exportarRG90,
  enrichWithTenantData,
} from "./accounting/rg90-export.service.js";

export {
  calculateMonthlyCommissions,
  checkWorkshopEquilibrium,
  getBreakevenProgress,
} from "./FinancialOrchestratorService.js";

// ─── Sprint 3: Accrual, Depreciation, Centralization ──
export {
  generarDevengamientoIngresos,
  generarDevengamientoGastos,
  generarAjustesPeriodo,
  revertirDevengamientos,
} from "./accounting/accrual.service.js";

export {
  runMonthlyDepreciation,
  createFixedAsset,
  listFixedAssets,
  getFixedAsset,
  generateToolDepreciation,
  generateFixedAssetDepreciation,
  createDepreciationAsiento,
} from "./accounting/depreciation.service.js";

export {
  centralizeSales,
  centralizePurchases,
  centralizeInventory,
  centralizePayroll,
  runMonthEndCentralization,
} from "./accounting/centralization.service.js";

// ─── Sprint 4: FX, Revaluation, Refundición, Legal Reserve ──
export {
  setExchangeRate,
  getLatestRate,
  getRateAtDate,
  listExchangeRates,
  generateFxAdjustment,
} from "./accounting/exchange-rate.service.js";

export {
  revaluarActivo,
} from "./accounting/revaluation.service.js";

export {
  refundirAsientos,
} from "./accounting/journal-consolidation.service.js";

export {
  constituirReservaLegal,
  getReservaLegalSaldo,
} from "./accounting/legal-reserve.service.js";

// ─── Sprint 7/8: Mapping Service + Configuradores ──
export {
  resolveMapping,
  createMapping,
  updateMapping,
  deleteMapping,
  listMappings,
  ensureDefaultMappings,
  registerModulo,
  listModulosActivos,
  listModulosActivosDetalle,
} from "./accounting/mapping.service.js";
export type {
  ResolveMappingInput,
  DefaultMappingDef,
} from "./accounting/mapping.service.js";

export {
  comprasConfigurator,
} from "./accounting/compras.configurator.js";

export {
  sifenConfigurator,
} from "./accounting/sifen.configurator.js";

export {
  tesoreriaConfigurator,
} from "./accounting/tesoreria.configurator.js";

export {
  nominaConfigurator,
} from "./accounting/nomina.configurator.js";

export {
  inventarioConfigurator,
} from "./accounting/inventario.configurator.js";

export {
  workshopConfigurator,
} from "./accounting/workshop.configurator.js";

export {
  autoReversal,
  hasReversal,
  getAsientosByReferencia,
} from "./accounting/auto-reversal.service.js";

// ─── Sprint 5: Libros Contables Electrónicos ──
export {
  generarLibroDiario,
} from "./accounting/libro-diario.service.js";

export {
  generarLibroComprasIVA,
} from "./accounting/libro-compras-iva.service.js";

export {
  generarLibroVentasIVA,
} from "./accounting/libro-ventas-iva.service.js";

export {
  validarPreTransaccion,
} from "./accounting/pre-transaction-validator.service.js";

export {
  generarNotaCreditoDebito,
} from "./accounting/credit-debit-note.service.js";

export {
  generarLibroMayor,
} from "./accounting/libro-mayor.service.js";

export {
  generarLibroInventario,
} from "./accounting/libro-inventario.service.js";

export {
  exportarRG90Ventas,
} from "./accounting/rg90-ventas.service.js";

export {
  exportarRG90Compras,
} from "./accounting/rg90-compras.service.js";

export {
  exportarRG90Retenciones,
} from "./accounting/rg90-retenciones.service.js";

// ─── CAPA 4: Compliance, Immutability, Audit, Cuadratura ──
export {
  logAudit,
  queryAuditLog,
} from "./accounting/audit-log.service.js";

// ─── Sprint 6: Accounting Bus + Financial Statements ──
export {
  emit,
  emitFromTransaction,
  resolveAccount,
} from "./accounting/accounting-bus.service.js";
export type {
  AccountingEvent,
  AccountingEventType,
  BusAccountingLine,
  AccountingEventResult,
  TransactionEvent,
} from "./accounting/accounting-bus.service.js";

export {
  getBalanceGeneral,
} from "./accounting/balance.service.js";
export type {
  BalanceGeneral,
  BalanceSeccion,
  BalanceGrupo,
  BalanceCuenta,
} from "./accounting/balance.service.js";

export {
  getEstadoResultados,
} from "./accounting/pnl.service.js";
export type {
  PnLResultado,
  PnLCuenta,
  PnLGrupo,
} from "./accounting/pnl.service.js";

export {
  getCashFlowStatement,
} from "./accounting/cash-flow.service.js";
export type {
  CashFlowStatement,
  CashFlowSection,
  CashFlowLine,
} from "./accounting/cash-flow.service.js";

export {
  getEquityStatement,
} from "./accounting/equity-statement.service.js";
export type {
  EquityStatement,
  EquityAccountGroup,
  EquityLine,
} from "./accounting/equity-statement.service.js";

export type {
  LogAuditParams,
  AuditLogFilter,
  AuditLogQueryResult,
} from "./accounting/audit-log.service.js";

export {
  checkPeriodoAbierto,
  assertPeriodoAbierto,
  checkAsientoModificable,
  assertAsientoModificable,
  checkCuentaModificable,
  cerrarPeriodo,
} from "./accounting/immutability-guard.service.js";
export type {
  PeriodCheckResult,
  AsientoStateCheck,
} from "./accounting/immutability-guard.service.js";

export {
  ejecutarCuadratura,
  isPeriodoBalanceado,
} from "./accounting/cuadratura.service.js";
export type {
  AsientoBalance,
  CuadraturaReport,
} from "./accounting/cuadratura.service.js";

// ─── CAPA 5: Cost Centers & Profitability ──
export {
  createCentroCosto,
  getCentroCostoById,
  listCentrosCosto,
  getArbolCentrosCosto,
  updateCentroCosto,
  deleteCentroCosto,
} from "./accounting/cost-center.service.js";
export type {
  CreateCentroCostoRequest,
  UpdateCentroCostoRequest,
  CostCenterTreeNode,
} from "./accounting/cost-center.service.js";

export {
  getOTProfitability,
  getClientProfitability,
  getMechanicProfitability,
  getDashboardProfitability,
} from "./accounting/profitability.service.js";
export type {
  OTProfitability,
  ClientProfitability,
  MechanicProfitability,
  PeriodoProfitability,
} from "./accounting/profitability.service.js";

// ─── Sprint 7: Treasury (Tesorería, CxC, CxP, Flujo de Caja) ──
export {
  createCuentaBancaria,
  getCuentaBancaria,
  listCuentasBancarias,
  updateCuentaBancaria,
  registrarMovimiento,
  registrarTransferencia,
  listMovimientos,
  getSaldoHistorico,
  iniciarConciliacion,
  cerrarConciliacion,
  listConciliaciones,
  createFacturaProveedor,
  listFacturasProveedor,
  listCxcPendientes,
  proyectarFlujoCaja,
  pagarFacturaProveedor,
} from "./treasury/treasury.service.js";
export type {
  ProyeccionFlujoCaja,
  PagarProveedorInput,
} from "./treasury/treasury.service.js";

export { registerPayment } from "./treasury/payment.service.js";
export type { RegisterPaymentInput, RegisterPaymentResult } from "./treasury/payment.service.js";

// ─── Monthly Closure ──
export { AccountingClosureService } from "./accounting-closure.service.js";
export type { ClosureResult } from "./accounting-closure.service.js";

// ─── Auto-Configure (Tenant Onboarding) ──
export { autoConfigureAccounting } from "./accounting/auto-configure.service.js";
