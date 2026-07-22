/**
 * Nota de Crédito SIFEN — Electronic Credit Note service.
 *
 * Genera la Nota de Crédito electrónica para SIFEN V150:
 *   1. Valida que el DTE original exista y esté APROBADO
 *   2. Genera XML específico de NC con referencia al original
 *   3. Firma digitalmente
 *   4. Envía a DNIT
 *   5. Actualiza estado local
 *   6. Genera asiento contable de reversión
 *
 * @module finance/services/sifen/nota-credito.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { eq, and } from "drizzle-orm";
import { fiscalDocumentos } from "../../schema/fiscal-docs.js";
import { buildDTEXml, validateDTEXml } from "./sifen-xml.service.js";
import { signXMLAsync } from "./sifen-crypto.service.js";
import { enviarDTE } from "./sifen-soap.service.js";
import { createFiscalDocumento, updateFiscalDocumentoEstado, createSyncLogEntry } from "./sifen-db.service.js";
import { sifenConfigurator } from "../accounting/sifen.configurator.js";
import { generarNotaCreditoDebito } from "../accounting/credit-debit-note.service.js";
import type { EmitirDTERequest, CondicionVenta, MonedaDTE } from "../../types.js";

export interface NotaCreditoInput {
  /** CDC del DTE original a notar */
  cdcOriginal: string;
  /** Motivo de la NC */
  motivo: string;
  /** Items corregidos (opcional — si no se envía, replica los originales invertidos) */
  items?: EmitirDTERequest["items"];
  /** Tenant slug */
  tenantSlug: string;
  /** ID de la orden de trabajo asociada */
  ordenTrabajoId?: string;
  /** Monto específico a notar (opcional, por defecto replica el total) */
  monto?: number;
}

export interface NotaCreditoResult {
  success: boolean;
  notaDocumentoId?: string;
  cdcNota?: string;
  estado?: string;
  asientoId?: string;
  error?: string;
}

/**
 * Emite una Nota de Crédito Electrónica SIFEN.
 *
 * Flujo completo:
 * 1. Buscar DTE original por CDC
 * 2. Validar que esté APROBADO
 * 3. Generar XML con estructura NOTA_CREDITO
 * 4. Firmar XML
 * 5. Enviar a DNIT
 * 6. Guardar en BD
 * 7. Generar asiento contable
 */
export async function emitirNotaCredito(
  input: NotaCreditoInput,
): Promise<NotaCreditoResult> {
  try {
    const { cdcOriginal, motivo, tenantSlug, ordenTrabajoId } = input;

    // ── 1. Buscar DTE original ──
    const [docOriginal] = await db()
      .select()
      .from(fiscalDocumentos)
      .where(eq(fiscalDocumentos.cdc, cdcOriginal))
      .limit(1);

    if (!docOriginal) {
      return { success: false, error: `DTE original con CDC ${cdcOriginal} no encontrado` };
    }

    if (docOriginal.estado !== "APROBADO") {
      return {
        success: false,
        error: `El DTE original está en estado "${docOriginal.estado}". Solo se pueden notar DTE APROBADOS.`,
      };
    }

    // ── 2. Determinar items de la NC ──
    // Si no se especifican items, usamos los originales con valores negativos
    const itemsNC = input.items ?? [
      {
        cantidad: 1,
        unidadMedida: "Unidad",
        descripcion: `NC: ${motivo}`,
        precioUnitario: docOriginal.totalDocumento ?? "0",
        iva: 10,
        subtotal: docOriginal.totalDocumento ?? "0",
        ivaMonto: docOriginal.totalIva ?? "0",
      },
    ];

    // ── 3. Construir el payload para el XML ──
    const serieNC = docOriginal.serie;
    // Generar número secuencial para NC (siguiente disponible)
    const [ultimoDoc] = await db()
      .select({ numero: fiscalDocumentos.numero })
      .from(fiscalDocumentos)
      .where(and(
        eq(fiscalDocumentos.dteTipo, "NOTA_CREDITO"),
        eq(fiscalDocumentos.serie, serieNC),
      ))
      .orderBy(fiscalDocumentos.numero)
      .limit(1);

    const numeroNC = ultimoDoc?.numero
      ? String(parseInt(ultimoDoc.numero, 10) + 1).padStart(7, "0")
      : "0000001";

    const payload: EmitirDTERequest & {
      emisorRuc: string;
      emisorRazonSocial: string;
      receptorRuc: string;
      receptorRazonSocial: string;
      receptorDireccion?: string;
      cdcOriginal: string;
      motivoAnulacion: string;
    } = {
      ordenTrabajoId: ordenTrabajoId ?? docOriginal.ordenTrabajoId ?? "",
      clienteId: docOriginal.clienteId ?? "",
      dteTipo: "NOTA_CREDITO",
      serie: serieNC,
      numero: numeroNC,
      condicionVenta: (docOriginal.condicionVenta ?? "CONTADO") as CondicionVenta,
      moneda: (docOriginal.moneda ?? "PYG") as MonedaDTE,
      regimenIVA: "GENERAL",
      items: itemsNC.map((item) => ({
        cantidad: item.cantidad,
        unidadMedida: item.unidadMedida,
        descripcion: item.descripcion,
        precioUnitario: item.precioUnitario,
        iva: item.iva,
        subtotal: item.subtotal ?? "0",
        ivaMonto: item.ivaMonto ?? "0",
      })),
      emisorRuc: docOriginal.emisorRuc,
      emisorRazonSocial: docOriginal.emisorRazonSocial,
      receptorRuc: docOriginal.receptorRuc,
      receptorRazonSocial: docOriginal.receptorRazonSocial,
      receptorDireccion: docOriginal.receptorDireccion ?? undefined,
      // Campo especial para NC: referencia al DTE original
      cdcOriginal,
      motivoAnulacion: motivo,
    };

    // ── 4. Generar XML ──
    const xmlOriginal = buildDTEXml(payload as any);

    // ── 5. Validar XML ──
    const validation = validateDTEXml(xmlOriginal);
    if (!validation.isValid) {
      return {
        success: false,
        error: `XML inválido: ${validation.errors.join(", ")}`,
      };
    }

    // ── 6. Firmar XML ──
    let xmlFirmado: string;
    try {
      xmlFirmado = await signXMLAsync(xmlOriginal);
    } catch (err: any) {
      return {
        success: false,
        error: `Error al firmar XML: ${err.message}`,
      };
    }

    // ── 7. Guardar como documento fiscal ──
    const documento = await createFiscalDocumento({
      emisorRuc: docOriginal.emisorRuc,
      emisorRazonSocial: docOriginal.emisorRazonSocial,
      clienteId: docOriginal.clienteId ?? undefined,
      receptorRuc: docOriginal.receptorRuc,
      receptorRazonSocial: docOriginal.receptorRazonSocial,
      receptorDireccion: docOriginal.receptorDireccion,
      ordenTrabajoId: ordenTrabajoId ?? docOriginal.ordenTrabajoId ?? undefined,
      dteTipo: "NOTA_CREDITO",
      serie: serieNC,
      numero: numeroNC,
      moneda: docOriginal.moneda ?? "PYG",
      totalExento: "0",
      totalIva5: "0",
      totalIva10: docOriginal.totalIva10 ?? "0",
      totalLiquido: docOriginal.totalLiquido ?? "0",
      totalIva: docOriginal.totalIva ?? "0",
      totalDocumento: docOriginal.totalDocumento ?? "0",
      condicionVenta: docOriginal.condicionVenta ?? "CONTADO",
      xmlOriginal,
    });

    // ── 8. Enviar a DNIT ──
    let resultadoSifen: any;
    try {
      resultadoSifen = await enviarDTE(xmlFirmado, documento.id);

      if (resultadoSifen.cdc) {
        await updateFiscalDocumentoEstado(
          documento.id,
          "APROBADO",
          xmlFirmado,
          resultadoSifen.cdc,
          resultadoSifen.numeroTransaccion,
        );
      } else {
        await updateFiscalDocumentoEstado(documento.id, "RECHAZADO", xmlFirmado);
      }

      await createSyncLogEntry({
        documentoId: documento.id,
        operacion: "ENVIO_NC",
        codigoResultado: resultadoSifen.codigoResultado ?? "",
        cdc: resultadoSifen.cdc,
        xmlEnviado: xmlFirmado,
        exitoso: !!resultadoSifen.cdc,
        mensajeError: resultadoSifen.mensajeError ?? undefined,
      });
    } catch (err: any) {
      await updateFiscalDocumentoEstado(documento.id, "FIRMADO", xmlFirmado);
      await createSyncLogEntry({
        documentoId: documento.id,
        operacion: "ENVIO_NC",
        codigoResultado: "ERROR",
        exitoso: false,
        mensajeError: err.message,
      });
      return {
        success: false,
        error: `Error al enviar NC a DNIT: ${err.message}`,
        notaDocumentoId: documento.id,
      };
    }

    // ── 9. Generar asiento contable ──
    let asientoId: string | undefined;
    try {
      const ncContable = await generarNotaCreditoDebito({
        tenantSlug,
        facturaOriginalId: docOriginal.id,
        tipo: "CREDITO",
        motivo,
        monto: input.monto ?? Number(docOriginal.totalDocumento ?? 0),
      });
      if (ncContable.success && ncContable.notaAsientoId) {
        asientoId = ncContable.notaAsientoId;
      }
    } catch (err) {
      console.warn("[nota-credito] Error contable (no blocking):", err);
    }

    // ── 10. Configurador SIFEN ──
    sifenConfigurator.onDTEEmitida({
      tenantSlug,
      documentoId: documento.id,
      dteTipo: "NOTA_CREDITO",
      serie: serieNC,
      numero: numeroNC,
      clienteNombre: docOriginal.receptorRazonSocial,
      total: Number(docOriginal.totalDocumento ?? 0),
      totalIva: Number(docOriginal.totalIva ?? 0),
      condicionVenta: docOriginal.condicionVenta ?? "CONTADO",
    }).catch(() => {});

    return {
      success: true,
      notaDocumentoId: documento.id,
      cdcNota: resultadoSifen?.cdc ?? undefined,
      estado: resultadoSifen?.cdc ? "APROBADO" : "FIRMADO",
      asientoId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error inesperado: ${err.message}`,
    };
  }
}
