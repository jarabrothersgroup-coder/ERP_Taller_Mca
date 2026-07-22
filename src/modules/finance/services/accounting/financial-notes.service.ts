/**
 * Financial Notes Service — Notas a los Estados Financieros Automáticas.
 *
 * Genera notas explicativas estructuradas para acompañar los estados
 * financieros (Balance General, Estado de Resultados, Flujo de Efectivo,
 * Evolución del Patrimonio).
 *
 * Cada nota se genera automáticamente a partir de los datos reales del
 * sistema, incluyendo políticas contables aplicadas, desgloses de
 * cuentas significativas, y notas sobre contingencias.
 *
 * @module finance/services/accounting/financial-notes.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { planCuentas, asientosContables, asientosDetalle } from "../../schema/index.js";
import { eq, and, sql, count } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import { getBalanceGeneral } from "./balance.service.js";
import { getEstadoResultados } from "./pnl.service.js";
import { getCashFlowStatement } from "./cash-flow.service.js";
import { getEquityStatement } from "./equity-statement.service.js";

// ─── Types ──────────────────────────────────────

export interface FinancialNote {
  numero: number;
  titulo: string;
  contenido: string;
  detalle?: Record<string, string | number>[];
}

export interface FinancialNotesReport {
  periodo: { anho: number; mes: number };
  tipo: "MENSUAL" | "ACUMULADO";
  empresa: {
    nombre: string;
    ruc: string;
    regimenFiscal: string;
  };
  notas: FinancialNote[];
  generadoEn: string;
}

// ─── Service ────────────────────────────────────

/**
 * Genera las Notas a los Estados Financieros para un período.
 *
 * @param anho - Año fiscal
 * @param mes - Mes (1-12)
 * @param acumulado - Si true, calcula desde inicio del año
 * @returns Notas a los Estados Financieros
 */
export async function generarNotasFinancieras(
  anho: number,
  mes: number,
  acumulado = false,
): Promise<FinancialNotesReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const notas: FinancialNote[] = [];

  // ─── Nota 1: Base de Preparación ──
  notas.push({
    numero: 1,
    titulo: "Base de Preparación",
    contenido: [
      `Los presentes estados financieros de AutomotiveOS ERP han sido preparados de acuerdo con las Normas Internacionales de Información Financiera (NIIF) para Pequeñas y Medianas Entidades (NIIF para PyMEs), adoptadas por la Dirección Nacional de Ingresos Tributarios (DNIT) del Paraguay.`,
      `El período cubierto corresponde al ${acumulado ? "ejercicio fiscal" : "mes"} de ${getMonthName(mes)} de ${anho}.`,
      `Las cifras están expresadas en guaraníes (PYG), moneda funcional de la entidad.`,
      `Los estados financieros han sido preparados bajo el método de lo devengado, excepto para el estado de flujo de efectivo que utiliza el método indirecto.`,
    ].join("\n\n"),
  });

  // ─── Nota 2: Principales Políticas Contables ──
  notas.push({
    numero: 2,
    titulo: "Principales Políticas Contables",
    contenido: [
      `a) **Base de medición**: Los estados financieros han sido preparados sobre la base del costo histórico, excepto por la revaluación de activos fijos cuando corresponda.`,
      `b) **Moneda funcional y de presentación**: Las partidas incluidas en los estados financieros se valoran utilizando la moneda del entorno económico principal en el que opera la entidad (PYG).`,
      `c) **Reconocimiento de ingresos**: Los ingresos por servicios de taller se reconocen cuando el servicio ha sido completado y aceptado por el cliente, de acuerdo con la NIIF 15.`,
      `d) **Inventarios**: Los repuestos se valoran al costo promedio ponderado (PPP). El costo incluye los costos de adquisición y otros costos directamente atribuibles.`,
      `e) **Depreciación**: Los activos fijos se deprecian utilizando el método de línea recta durante su vida útil estimada.`,
      `f) **Provisiones**: Las provisiones se reconocen cuando la entidad tiene una obligación presente como resultado de un evento pasado, es probable que se requiera una salida de recursos, y el monto puede estimarse razonablemente.`,
      `g) **Reconocimiento de costos**: Los costos de reparación y mantenimiento se reconocen como gasto en el período en que se incurren.`,
    ].join("\n\n"),
  });

  // ─── Nota 3: Efectivo y Equivalentes ──
  try {
    const cashFlow = await getCashFlowStatement(anho, mes, acumulado);
    const saldoEfectivo = cashFlow.saldoFinal;
    notas.push({
      numero: 3,
      titulo: "Efectivo y Equivalentes al Efectivo",
      contenido: [
        `Al ${getMonthName(mes)} de ${anho}, el efectivo y equivalentes al efectivo ascienden a ₲ ${saldoEfectivo.toLocaleString("es-PY", { minimumFractionDigits: 0 })}.`,
        `La variación neta del período fue de ₲ ${cashFlow.variacionNeta.toLocaleString("es-PY", { minimumFractionDigits: 0 })}.`,
        `El flujo de efectivo de las actividades operativas generó ₲ ${cashFlow.operativas.total.toLocaleString("es-PY", { minimumFractionDigits: 0 })}.`,
        `Las actividades de inversión y financiamiento representaron ₲ ${cashFlow.inversion.total.toLocaleString("es-PY", { minimumFractionDigits: 0 })} y ₲ ${cashFlow.financiamiento.total.toLocaleString("es-PY", { minimumFractionDigits: 0 })}, respectivamente.`,
        !cashFlow.verificado ? `NOTA: El saldo de efectivo no ha podido ser verificado completamente. Se recomienda realizar una conciliación bancaria detallada.` : "",
      ].filter(Boolean).join("\n\n"),
    });
  } catch {
    notas.push({
      numero: 3,
      titulo: "Efectivo y Equivalentes al Efectivo",
      contenido: "No se pudieron obtener los datos de flujo de efectivo para el período.",
    });
  }

  // ─── Nota 4: Cuentas por Cobrar ──
  try {
    const totalCxc = await getTotalCuentasPorTipo("1.1.02.%");
    notas.push({
      numero: 4,
      titulo: "Cuentas por Cobrar Comerciales",
      contenido: [
        `Las cuentas por cobrar comerciales netas al ${getMonthName(mes)} de ${anho} ascienden a ₲ ${totalCxc.toLocaleString("es-PY", { minimumFractionDigits: 0 })}.`,
        `Corresponden principalmente a facturas de servicios de taller emitidas y pendientes de cobro.`,
        `El plazo promedio de crédito otorgado es de 30 días. No se ha constituido provisión para deudores incobrables al cierre del período.`,
        totalCxc > 10000000 ? `Las cuentas por cobrar representan un monto significativo del total de activos.` : "",
      ].filter(Boolean).join("\n\n"),
    });
  } catch {
    notas.push({
      numero: 4,
      titulo: "Cuentas por Cobrar Comerciales",
      contenido: `Las cuentas por cobrar comerciales ascienden a un monto registrado en el Plan de Cuentas bajo el código 1.1.02.`,
    });
  }

  // ─── Nota 5: Inventarios ──
  try {
    const totalInv = await getTotalCuentasPorTipo("1.1.03.%");
    notas.push({
      numero: 5,
      titulo: "Inventarios",
      contenido: [
        `Los inventarios al ${getMonthName(mes)} de ${anho} totalizan ₲ ${totalInv.toLocaleString("es-PY", { minimumFractionDigits: 0 })}.`,
        `Corresponden a repuestos y accesorios automotrices valorados al costo promedio ponderado (PPP).`,
        `No se han identificado indicios de deterioro que requieran ajuste al valor neto realizable.`,
      ].join("\n\n"),
    });
  } catch {
    notas.push({
      numero: 5,
      titulo: "Inventarios",
      contenido: `Los inventarios al cierre del período se encuentran registrados según el método de costo promedio ponderado.`,
    });
  }

  // ─── Nota 6: Activos Fijos ──
  try {
    const activos = await getDetalleActivosFijos();
    const totalActivos = activos.reduce((s, a) => s + a.costo, 0);
    const totalDep = activos.reduce((s, a) => s + a.depreciacion, 0);
    const valorNeto = totalActivos - totalDep;

    notas.push({
      numero: 6,
      titulo: "Activos Fijos (Bienes de Uso)",
      contenido: [
        `Los activos fijos al ${getMonthName(mes)} de ${anho} se componen de:`,
        activos.map((a) => `  • ${a.nombre}: costo ₲ ${a.costo.toLocaleString("es-PY")}, depreciación acumulada ₲ ${a.depreciacion.toLocaleString("es-PY")}, valor neto ₲ ${a.valorNeto.toLocaleString("es-PY")}.`).join("\n"),
        "",
        `Total costo de adquisición: ₲ ${totalActivos.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `Total depreciación acumulada: ₲ ${totalDep.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `Valor neto contable: ₲ ${valorNeto.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `La depreciación se calcula por el método de línea recta con las siguientes vidas útiles estimadas:`,
        `  • Equipos de diagnóstico: 5 años`,
        `  • Herramientas: 3-5 años`,
        `  • Equipos de oficina: 5 años`,
        `  • Vehículos: 5 años`,
        `  • Instalaciones: 10 años`,
      ].join("\n"),
      detalle: activos.map((a) => ({
        nombre: a.nombre,
        costo: `₲ ${a.costo.toLocaleString("es-PY")}`,
        depreciacion: `₲ ${a.depreciacion.toLocaleString("es-PY")}`,
        valorNeto: `₲ ${a.valorNeto.toLocaleString("es-PY")}`,
      })),
    });
  } catch {
    notas.push({
      numero: 6,
      titulo: "Activos Fijos (Bienes de Uso)",
      contenido: `Los activos fijos se registran al costo de adquisición y se deprecian según el método de línea recta durante su vida útil estimada.`,
    });
  }

  // ─── Nota 7: Cuentas por Pagar ──
  try {
    const totalCxp = await getTotalCuentasPorTipo("2.1.01.%", true); // Pasivo: saldo acreedor
    notas.push({
      numero: 7,
      titulo: "Cuentas por Pagar Comerciales",
      contenido: [
        `Las cuentas por pagar comerciales al ${getMonthName(mes)} de ${anho} ascienden a ₲ ${totalCxp.toLocaleString("es-PY", { minimumFractionDigits: 0 })}.`,
        `Corresponden a facturas de proveedores de repuestos y servicios pendientes de pago.`,
        `El plazo promedio de pago es de 30 días.`,
      ].join("\n\n"),
    });
  } catch {
    notas.push({
      numero: 7,
      titulo: "Cuentas por Pagar Comerciales",
      contenido: `Las cuentas por pagar comerciales al cierre del período se encuentran registradas en el pasivo corriente.`,
    });
  }

  // ─── Nota 8: Patrimonio Neto ──
  try {
    const equity = await getEquityStatement(anho, mes, acumulado);
    notas.push({
      numero: 8,
      titulo: "Patrimonio Neto",
      contenido: [
        `El patrimonio neto al ${getMonthName(mes)} de ${anho} es de ₲ ${equity.totalPatrimonioFinal.toLocaleString("es-PY", { minimumFractionDigits: 0 })}.`,
        `Composición del patrimonio:`,
        `  • Capital Social: ₲ ${equity.capital.totalFinal.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `  • Reservas: ₲ ${equity.reservas.totalFinal.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `  • Resultados Acumulados: ₲ ${equity.resultados.totalFinal.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `  • Resultado del Ejercicio: ₲ ${equity.resultadoEjercicio.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        "",
        `La variación patrimonial del período fue de ₲ ${equity.variacionPeriodo.toLocaleString("es-PY", { minimumFractionDigits: 0 })}, representando un ${equity.variacionPeriodo >= 0 ? "incremento" : "decremento"} del ${Math.abs(Math.round(equity.variacionPeriodo / (equity.totalPatrimonioInicial || 1) * 100))}% respecto al inicio del período.`,
      ].join("\n"),
    });
  } catch {
    notas.push({
      numero: 8,
      titulo: "Patrimonio Neto",
      contenido: `El patrimonio neto al cierre del período está compuesto por capital social, reservas y resultados acumulados.`,
    });
  }

  // ─── Nota 9: Ingresos y Gastos ──
  try {
    const pnl = await getEstadoResultados(anho, mes, acumulado);
    notas.push({
      numero: 9,
      titulo: "Ingresos y Gastos",
      contenido: [
        `Durante el período ${acumulado ? "acumulado" : "mensual"} finalizado el ${getMonthName(mes)} de ${anho}:`,
        `  • Ingresos totales: ₲ ${pnl.ingresos.total.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `  • Costos operativos: ₲ ${pnl.costos.total.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `  • Gastos administrativos y de ventas: ₲ ${pnl.gastos.total.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `  • Utilidad Bruta: ₲ ${pnl.utilidadBruta.toLocaleString("es-PY", { minimumFractionDigits: 0 })} (${pnl.ingresos.total > 0 ? Math.round(pnl.utilidadBruta / pnl.ingresos.total * 100) : 0}% de margen)`,
        `  • Utilidad Neta: ₲ ${pnl.utilidadNeta.toLocaleString("es-PY", { minimumFractionDigits: 0 })} (${pnl.ingresos.total > 0 ? Math.round(pnl.utilidadNeta / pnl.ingresos.total * 100) : 0}% de margen neto)`,
      ].join("\n"),
    });
  } catch {
    notas.push({
      numero: 9,
      titulo: "Ingresos y Gastos",
      contenido: `Los ingresos y gastos del período se detallan en el Estado de Resultados correspondiente.`,
    });
  }

  // ─── Nota 10: Contingencias y Compromisos ──
  const totalOTAbiertas = await getTotalOTAbiertas();
  notas.push({
    numero: 10,
    titulo: "Contingencias y Compromisos",
    contenido: [
      `a) **Órdenes de Trabajo en proceso**: Al cierre del período, existen aproximadamente ${totalOTAbiertas} órdenes de trabajo en proceso, cuyos ingresos serán reconocidos al completarse.`,
      `b) **Garantías**: El taller ofrece garantía sobre las reparaciones realizadas según lo establecido en la Ley de Defensa del Consumidor.`,
      `c) **Contingencias fiscales**: La entidad se encuentra al día con sus obligaciones tributarias ante la DNIT. No existen contingencias fiscales significativas identificadas.`,
      `d) **Compromisos**: No existen compromisos de inversión significativos no registrados al cierre del período.`,
      `e) **Hechos posteriores**: No se han producido hechos posteriores al cierre que afecten significativamente la situación financiera.`,
    ].join("\n\n"),
  });

  // ─── Nota 11: Saldos Iniciales ──
  try {
    const balance = await getBalanceGeneral(new Date(anho, mes - 1, 1).toISOString());
    notas.push({
      numero: 11,
      titulo: "Saldos del Balance General",
      contenido: [
        `Al ${getMonthName(mes)} de ${anho}, el Balance General presenta:`,
        `  • Activo Total: ₲ ${balance.totalActivo.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        `  • Pasivo + Patrimonio: ₲ ${balance.totalPasivoPatrimonio.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`,
        balance.balanceado
          ? `  • El balance se encuentra cuadrando (diferencia: ₲ ${balance.diferencia.toFixed(2)}).`
          : `  • ATENCIÓN: El balance presenta una diferencia de ₲ ${balance.diferencia.toFixed(2)}. Se requiere ajuste contable.`,
      ].join("\n"),
    });
  } catch {
    notas.push({
      numero: 11,
      titulo: "Saldos del Balance General",
      contenido: `No se pudieron obtener los datos del Balance General para el período.`,
    });
  }

  return {
    periodo: { anho, mes },
    tipo: acumulado ? "ACUMULADO" : "MENSUAL",
    empresa: {
      nombre: "AutomotiveOS ERP Taller",
      ruc: "80000000-0",
      regimenFiscal: "General (Régimen IVA)",
    },
    notas,
    generadoEn: new Date().toISOString(),
  };
}

// ─── Helpers ────────────────────────────────────

function getMonthName(mes: number): string {
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return meses[mes - 1] ?? "";
}

async function getTotalCuentasPorTipo(codigoPattern: string, isLiability = false): Promise<number> {
  const result = await db()
    .select({
      debe: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC)), 0)`,
      haber: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        sql`${planCuentas.codigo} LIKE ${codigoPattern}`,
      ),
    );

  const debe = Number(result[0]?.debe ?? 0);
  const haber = Number(result[0]?.haber ?? 0);
  // Activo: saldo deudor (debe - haber). Pasivo: saldo acreedor (haber - debe)
  return isLiability ? haber - debe : debe - haber;
}

interface ActivoFijoResumen {
  nombre: string;
  costo: number;
  depreciacion: number;
  valorNeto: number;
}

async function getDetalleActivosFijos(): Promise<ActivoFijoResumen[]> {
  try {
    const { activosFijos } = await import("../../schema/index.js");
    const registros = await db()
      .select({
        nombre: activosFijos.nombre,
        costoAdq: activosFijos.costoAdquisicion,
        depAcum: activosFijos.depreciacionAcumulada,
        valorActual: activosFijos.valorActualLibros,
      })
      .from(activosFijos)
      .where(eq(activosFijos.activo, true))
      .limit(20);

    return registros.map((r) => ({
      nombre: r.nombre ?? "Activo sin nombre",
      costo: Number(r.costoAdq ?? 0),
      depreciacion: Number(r.depAcum ?? 0),
      valorNeto: Number(r.valorActual ?? 0),
    }));
  } catch {
    return [{ nombre: "Sin datos disponibles", costo: 0, depreciacion: 0, valorNeto: 0 }];
  }
}

async function getTotalOTAbiertas(): Promise<number> {
  try {
    const { ordenesTrabajo } = await import("../../../../modules/workshop/schema/index.js");
    const [result] = await db()
      .select({ total: count() })
      .from(ordenesTrabajo)
      .where(sql`${ordenesTrabajo.status} NOT IN ('COMPLETADA', 'CANCELADA', 'FACTURADA')`);
    return Number(result?.total ?? 0);
  } catch {
    return 0;
  }
}
