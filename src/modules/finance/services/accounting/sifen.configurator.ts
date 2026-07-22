/**
 * SifenConfigurator — Integración contable de SIFEN / Facturación Electrónica.
 *
 * Registra mappings por defecto y event handlers para que el motor
 * contable genere asientos automáticos cuando se emiten, anulan o
 * modifican Documentos Tributarios Electrónicos (DTE).
 *
 * Mappings contables (PCG Paraguay — Ley 1034/83):
 *
 *   SIFEN.EMITIDA (factura de venta gravada):
 *     Debe:  1.1.2.01 — Clientes Particulares
 *     Haber: 4.1.1.01 — Ingresos por Mano de Obra
 *     Haber: 1.1.2.50 — IVA Crédito Fiscal (por el IVA)
 *
 *   SIFEN.EMITIDA (factura de venta exenta):
 *     Debe:  1.1.2.01 — Clientes Particulares
 *     Haber: 4.1.1.01 — Ingresos por Mano de Obra
 *
 *   SIFEN.ANULADA:
 *     Reversión del asiento original
 *
 * Ahora propaga centroCostoId y ordenTrabajoId para dimensión analítica.
 *
 * @module finance/services/accounting/sifen.configurator
 */

import {
  emitFromTransaction,
} from "./accounting-bus.service.js";
import {
  ensureDefaultMappings,
  registerModulo,
} from "./mapping.service.js";
import type { AccountingEventResult } from "./accounting-bus.service.js";

// ─── Codes ─────────────────────────────────────

/**
 * Códigos de cuenta del PCG paraguayo para facturación.
 * Deben existir en plan_cuentas para que los mappings funcionen.
 */
const CUENTAS = {
  CLIENTES: "1.1.2.01",           // Clientes Particulares
  CLIENTES_CORP: "1.1.2.02",      // Clientes Corporativos / Flotas
  IVA_CREDITO_FISCAL: "1.1.2.50", // IVA Crédito Fiscal
  INGRESO_MO: "4.1.1.01",         // Ingresos por Mano de Obra
  INGRESO_REPUESTOS: "4.1.2.01",  // Ingresos por Venta de Repuestos
  IVA_DEBITO_FISCAL: "2.1.2.01",  // IVA Débito Fiscal por Pagar
} as const;

// ─── Configurator Class ────────────────────────

class SifenConfigurator {
  private configured = false;

  /** Idempotente — registra mappings y handlers */
  async configure(): Promise<void> {
    if (this.configured) return;

    await registerModulo({
      modulo: "SIFEN",
      nombre: "Facturación Electrónica (SIFEN)",
      descripcion: "DTE, facturas electrónicas, notas de crédito/débito, autofacturas",
      activo: true,
      version: "1.0.0",
    });

    await ensureDefaultMappings([
      {
        modulo: "SIFEN",
        tipoEvento: "EMITIDA",
        subTipo: "GRAVADA",
        codigoDebe: CUENTAS.CLIENTES,
        codigoHaber: CUENTAS.INGRESO_MO,
        descripcion: "Factura gravada — cliente vs ingreso",
      },
      {
        modulo: "SIFEN",
        tipoEvento: "EMITIDA",
        subTipo: "EXENTA",
        codigoDebe: CUENTAS.CLIENTES,
        codigoHaber: CUENTAS.INGRESO_MO,
        descripcion: "Factura exenta — cliente vs ingreso",
      },
      {
        modulo: "SIFEN",
        tipoEvento: "ANULADA",
        codigoDebe: CUENTAS.INGRESO_MO,
        codigoHaber: CUENTAS.CLIENTES,
        descripcion: "Anulación de factura — reversión",
      },
    ]);

    this.configured = true;
  }

  // ─── Event handlers ─────────────────────────

  /**
   * Maneja la emisión exitosa de un DTE.
   * Genera asiento: Debe=Clientes, Haber=Ingresos (+ IVA si aplica).
   */
  async onDTEEmitida(params: {
    tenantSlug: string;
    documentoId: string;
    dteTipo: string;
    serie: string;
    numero: string;
    clienteNombre: string;
    total: number;
    totalIva: number;
    condicionVenta: string;
    /** Centro de Costo (dimensión analítica). */
    centroCostoId?: string;
    /** Orden de Trabajo asociada. */
    ordenTrabajoId?: string | null;
  }): Promise<AccountingEventResult> {
    await this.configure();

    const esGravada = params.totalIva > 0;
    const totalBaseIva = params.total - params.totalIva;

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "VENTA",
      fecha: new Date(),
      referenciaId: params.documentoId,
      referenciaTipo: "documento_fiscal",
      descripcion: `${params.dteTipo} ${params.serie}-${params.numero} — ${params.clienteNombre}`,
      modulo: "SIFEN",
      tipoEvento: "EMITIDA",
      subTipo: esGravada ? "GRAVADA" : "EXENTA",
      monto: totalBaseIva,
      montoIva: esGravada ? params.totalIva : undefined,
      ordenTrabajoId: params.ordenTrabajoId,
      centroCostoId: params.centroCostoId,
    });
  }
}

// ─── Singleton export ──────────────────────────

export const sifenConfigurator = new SifenConfigurator();
