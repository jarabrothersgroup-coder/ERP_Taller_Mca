/**
 * Accounting routes — Double-Entry Bookkeeping endpoints.
 *
 * Endpoints:
 *   POST  /finance/contabilidad/cuentas       — Create chart of account
 *   GET   /finance/contabilidad/cuentas       — List accounts
 *   GET   /finance/contabilidad/cuentas/arbol — Get account tree
 *   GET   /finance/contabilidad/cuentas/:id   — Get account by ID
 *   POST  /finance/contabilidad/asientos      — Create journal entry
 *   GET   /finance/contabilidad/asientos      — List journal entries
 *   GET   /finance/contabilidad/asientos/:id  — Get journal entry detail
 *   POST  /finance/contabilidad/asientos/automatico — Auto-generate from OT
 *   POST  /finance/contabilidad/asientos/:id/anular  — Cancel journal entry
 *   POST  /finance/contabilidad/apertura      — Generate opening entry (saldoInicial or accumulated)
 *   POST  /finance/rg90/exportar              — Export RG 90 report
 *
 *   === Sprint 3: Devengamiento, Depreciación, Centralización ===
 *   POST  /finance/contabilidad/devengamiento/ingresos    — Accrued revenue (OT en proceso)
 *   POST  /finance/contabilidad/devengamiento/gastos      — Accrued expenses
 *   POST  /finance/contabilidad/devengamiento/ajustes     — Period adjusting entries
 *   POST  /finance/contabilidad/devengamiento/revertir    — Reverse prior accruals
 *   POST  /finance/contabilidad/depreciacion/calcular     — Run monthly depreciation
 *   POST  /finance/contabilidad/depreciacion/activos      — Register fixed asset
 *   GET   /finance/contabilidad/depreciacion/activos      — List fixed assets
 *   GET   /finance/contabilidad/depreciacion/activos/:id  — Get fixed asset detail
 *   POST  /finance/contabilidad/centralizacion/ejecutar   — Month-end centralization
 *   POST  /finance/contabilidad/centralizacion/ventas     — Centralize sales only
 *   POST  /finance/contabilidad/centralizacion/compras    — Centralize purchases only
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * @module finance/routes/accounting
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
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
  exportarRG90,
  // Sprint 3
  generarDevengamientoIngresos,
  generarDevengamientoGastos,
  generarAjustesPeriodo,
  revertirDevengamientos,
  runMonthlyDepreciation,
  createFixedAsset,
  listFixedAssets,
  getFixedAsset,
  centralizeSales,
  centralizePurchases,
  runMonthEndCentralization,
  // Sprint 4
  setExchangeRate,
  getLatestRate,
  getRateAtDate,
  listExchangeRates,
  generateFxAdjustment,
  revaluarActivo,
  refundirAsientos,
  constituirReservaLegal,
  getReservaLegalSaldo,
  // Sprint 5 (CAPA 3)
  generarLibroDiario,
  generarLibroMayor,
  generarLibroInventario,
  exportarRG90Ventas,
  exportarRG90Compras,
  exportarRG90Retenciones,
  // CAPA 4
  logAudit,
  queryAuditLog,
  assertPeriodoAbierto,
  assertAsientoModificable,
  cerrarPeriodo,
  ejecutarCuadratura,
  // CAPA 5
  createCentroCosto,
  getCentroCostoById,
  listCentrosCosto,
  getArbolCentrosCosto,
  updateCentroCosto,
  deleteCentroCosto,
  getOTProfitability,
  getClientProfitability,
  getMechanicProfitability,
  getDashboardProfitability,
  // Sprint 6
  getBalanceGeneral,
  getEstadoResultados,
} from "../services/index.js";
import type {
  CreateCuentaRequest,
  CreateAsientoRequest,
  AsientoAutomaticoRequest,
  RG90ExportRequest,
  DevengamientoIngresosRequest,
  DevengamientoGastosRequest,
  AjustesPeriodoRequest,
  RevertirDevengamientoRequest,
  CalcularDepreciacionRequest,
  CreateActivoFijoRequest,
  // Sprint 4
  SetExchangeRateRequest,
  DiferenciaCambioRequest,
  RevaluoRequest,
  RefundirRequest,
  ReservaLegalRequest,
} from "../types.js";

/**
 * Registers accounting routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function accountingRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /finance/contabilidad/cuentas — Create account ──
  app.post<{ Body: CreateCuentaRequest }>(
    "/finance/contabilidad/cuentas",
    {
      schema: {
        body: {
          type: "object",
          required: ["codigo", "nombre", "tipo"],
          properties: {
            codigo: { type: "string", maxLength: 20 },
            nombre: { type: "string", maxLength: 200 },
            tipo: {
              type: "string",
              enum: ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "GASTO", "COSTO", "ORDEN"],
            },
            cuentaPadreId: { type: "string", format: "uuid" },
            aceptaMovimientos: { type: "boolean" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              codigo: { type: "string" },
              nombre: { type: "string" },
              tipo: { type: "string" },
              nivel: { type: "integer" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateCuentaRequest }>,
      reply: FastifyReply,
    ) => {
      const cuenta = await createCuenta(request.body);
      // Audit: CREATE — plan_cuentas
      await logAudit({
        tenantSlug: request.tenantSlug,
        usuarioId: (request.headers["x-user-email"] as string) ?? "system",
        ip: request.ip,
        accion: "CREATE",
        entidad: "plan_cuentas",
        entidadId: cuenta.id,
        valorNuevo: cuenta as unknown as Record<string, unknown>,
        descripcion: `Creación de cuenta contable: ${cuenta.codigo} - ${cuenta.nombre}`,
      }).catch((err) => request.log.warn({ err }, "Audit log insert failed"));
      return reply.status(201).send(cuenta);
    },
  );

  // ── GET /finance/contabilidad/cuentas — List accounts ──
  app.get<{ Querystring: { tipo?: string; activo?: string; nivel?: string } }>(
    "/finance/contabilidad/cuentas",
    async (request, reply) => {
      const { tipo, activo, nivel } = request.query;
      const result = await listCuentas({
        tipo,
        activo: activo !== undefined ? activo === "true" : undefined,
        nivel: nivel ? parseInt(nivel, 10) : undefined,
      });
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/cuentas/arbol — Account tree ──
  app.get(
    "/finance/contabilidad/cuentas/arbol",
    async (_request, reply) => {
      const arbol = await getArbolCuentas();
      return reply.send(arbol);
    },
  );

  // ── GET /finance/contabilidad/cuentas/:id — Get account ──
  app.get<{ Params: { id: string } }>(
    "/finance/contabilidad/cuentas/:id",
    async (request, reply) => {
      const cuenta = await getCuentaById(request.params.id);
      return reply.send(cuenta);
    },
  );

  // ── PATCH /finance/contabilidad/cuentas/:id — Update/desactivar cuenta ──
  app.patch<{
    Params: { id: string };
    Body: { nombre?: string; activo?: boolean; aceptaMovimientos?: boolean; cuentaPadreId?: string | null };
  }>(
    "/finance/contabilidad/cuentas/:id",
    async (request, reply) => {
      const updated = await updateCuenta(request.params.id, request.body);
      return reply.send(updated);
    },
  );

  // ── POST /finance/contabilidad/asientos — Create journal entry ──
  app.post<{ Body: CreateAsientoRequest }>(
    "/finance/contabilidad/asientos",
    {
      schema: {
        body: {
          type: "object",
          required: ["fecha", "concepto", "lineas"],
          properties: {
            fecha: { type: "string", format: "date-time" },
            concepto: { type: "string", maxLength: 500 },
            documentoRef: { type: "string", maxLength: 100 },
            moduloOrigen: { type: "string", maxLength: 50 },
            ordenTrabajoId: { type: "string", format: "uuid" },
            lineas: {
              type: "array",
              minItems: 2,
              items: {
                type: "object",
                required: ["cuentaId"],
                properties: {
                  cuentaId: { type: "string", format: "uuid" },
                  debe: { type: "string" },
                  haber: { type: "string" },
                  descripcion: { type: "string", maxLength: 200 },
                },
              },
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              asiento: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  numero: { type: "integer" },
                  fecha: { type: "string" },
                  concepto: { type: "string" },
                  totalDebe: { type: "string" },
                  totalHaber: { type: "string" },
                  estado: { type: "string" },
                },
              },
              lineas: { type: "array" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateAsientoRequest }>,
      reply: FastifyReply,
    ) => {
      // ── Immutability: check period is open ──
      const fecha = new Date(request.body.fecha);
      await assertPeriodoAbierto(
        request.tenantSlug,
        fecha.getFullYear(),
        fecha.getMonth() + 1,
      );

      const result = await createAsiento(request.body);
      // Audit: CREATE — asientos_contables
      await logAudit({
        tenantSlug: request.tenantSlug,
        usuarioId: (request.headers["x-user-email"] as string) ?? "system",
        ip: request.ip,
        accion: "CREATE",
        entidad: "asientos_contables",
        entidadId: result.asiento.id,
        valorNuevo: result as unknown as Record<string, unknown>,
        descripcion: `Creación de asiento #${result.asiento.numero}: ${request.body.concepto}`,
      }).catch((err) => request.log.warn({ err }, "Audit log insert failed"));
      return reply.status(201).send(result);
    },
  );

  // ── GET /finance/contabilidad/asientos — List journal entries ──
  app.get<{
    Querystring: {
      desde?: string;
      hasta?: string;
      moduloOrigen?: string;
      ordenTrabajoId?: string;
      page?: string;
      limit?: string;
    };
  }>(
    "/finance/contabilidad/asientos",
    async (request, reply) => {
      const { desde, hasta, moduloOrigen, ordenTrabajoId, page, limit } =
        request.query;
      const result = await listAsientos({
        desde,
        hasta,
        moduloOrigen,
        ordenTrabajoId,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/asientos/:id — Get journal entry ──
  app.get<{ Params: { id: string } }>(
    "/finance/contabilidad/asientos/:id",
    async (request, reply) => {
      const asiento = await getAsientoById(request.params.id);
      return reply.send(asiento);
    },
  );

  // ── POST /finance/contabilidad/asientos/automatico — Auto-generate ──
  app.post<{ Body: AsientoAutomaticoRequest }>(
    "/finance/contabilidad/asientos/automatico",
    {
      schema: {
        body: {
          type: "object",
          required: ["ordenTrabajoId", "fecha"],
          properties: {
            ordenTrabajoId: { type: "string", format: "uuid" },
            fecha: { type: "string", format: "date-time" },
            concepto: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: AsientoAutomaticoRequest }>,
      reply: FastifyReply,
    ) => {
      const result = await generarAsientoAutomatico(request.body);
      return reply.status(201).send(result);
    },
  );

  // ── POST /finance/contabilidad/asientos/:id/anular — Cancel entry ──
  app.post<{ Params: { id: string }; Body: { motivo?: string } }>(
    "/finance/contabilidad/asientos/:id/anular",
    async (request, reply) => {
      // ── Immutability: check asiento is modifiable + period is open ──
      await assertAsientoModificable(request.params.id);

      const preAsiento = await getAsientoById(request.params.id);
      const fecha =
        typeof preAsiento.fecha === "string"
          ? new Date(preAsiento.fecha)
          : (preAsiento.fecha as Date);
      await assertPeriodoAbierto(
        request.tenantSlug,
        fecha.getFullYear(),
        fecha.getMonth() + 1,
      );

      const updated = await anularAsiento(request.params.id);

      // Audit: ANULAR — asientos_contables
      await logAudit({
        tenantSlug: request.tenantSlug,
        usuarioId: (request.headers["x-user-email"] as string) ?? "system",
        ip: request.ip,
        accion: "ANULAR",
        entidad: "asientos_contables",
        entidadId: request.params.id,
        valorAnterior: preAsiento as unknown as Record<string, unknown>,
        descripcion: `Anulación de asiento #${preAsiento.numero}. Motivo: ${request.body.motivo ?? "No especificado"}`,
      }).catch((err) => request.log.warn({ err }, "Audit log insert failed"));

      return reply.send(updated);
    },
  );

  // ── POST /finance/contabilidad/apertura — Opening entry ──
  app.post<{ Body: { anho: number; mes: number; usarSaldosAcumulados?: boolean } }>(
    "/finance/contabilidad/apertura",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
            usarSaldosAcumulados: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const { anho, mes, usarSaldosAcumulados } = request.body;
      const tenantSlug = (request as any).tenantSlug;
      if (usarSaldosAcumulados && tenantSlug) {
        const result = await generarAperturaConSaldos(anho, mes, tenantSlug);
        return reply.status(201).send(result);
      }
      const result = await generarAsientoApertura(anho, mes);
      return reply.status(201).send(result);
    },
  );

  // ── POST /finance/rg90/exportar — Export RG 90 ──
  app.post<{ Body: RG90ExportRequest }>(
    "/finance/rg90/exportar",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
            formato: { type: "string", enum: ["TXT", "CSV", "JSON"] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: RG90ExportRequest }>,
      reply: FastifyReply,
    ) => {
      const result = await exportarRG90(request.body);
      return reply.send({
        ...result,
        tenantSlug: request.tenantSlug,
      });
    },
  );

  // ════════════════════════════════════════════════
  // Sprint 3: Devengamiento, Depreciación, Centralización
  // ════════════════════════════════════════════════

  // ── POST /finance/contabilidad/devengamiento/ingresos — Accrued revenue ──
  app.post<{ Body: DevengamientoIngresosRequest }>(
    "/finance/contabilidad/devengamiento/ingresos",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const { anho, mes } = request.body;
      const result = await generarDevengamientoIngresos(tenantSlug, anho, mes);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/devengamiento/gastos ──
  app.post<{ Body: DevengamientoGastosRequest }>(
    "/finance/contabilidad/devengamiento/gastos",
    {
      schema: {
        body: {
          type: "object",
          required: ["gastos"],
          properties: {
            gastos: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["concepto", "monto", "cuentaGastoId"],
                properties: {
                  concepto: { type: "string" },
                  monto: { type: "number", minimum: 0.01 },
                  cuentaGastoId: { type: "string", format: "uuid" },
                  cuentaPagarId: { type: "string", format: "uuid" },
                  ordenTrabajoId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await generarDevengamientoGastos(request.body.gastos);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/devengamiento/ajustes ──
  app.post<{ Body: AjustesPeriodoRequest }>(
    "/finance/contabilidad/devengamiento/ajustes",
    {
      schema: {
        body: {
          type: "object",
          required: ["ajustes"],
          properties: {
            ajustes: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["concepto", "lineas"],
                properties: {
                  concepto: { type: "string" },
                  lineas: { type: "array", minItems: 2, items: { type: "object" } },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await generarAjustesPeriodo(request.body.ajustes);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/devengamiento/revertir ──
  app.post<{ Body: RevertirDevengamientoRequest }>(
    "/finance/contabilidad/devengamiento/revertir",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request, reply) => {
      const { anho, mes } = request.body;
      const result = await revertirDevengamientos(anho, mes);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/depreciacion/calcular ──
  app.post<{ Body: CalcularDepreciacionRequest }>(
    "/finance/contabilidad/depreciacion/calcular",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const { anho, mes } = request.body;
      const result = await runMonthlyDepreciation(tenantSlug, anho, mes);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/depreciacion/activos ──
  app.post<{ Body: CreateActivoFijoRequest }>(
    "/finance/contabilidad/depreciacion/activos",
    {
      schema: {
        body: {
          type: "object",
          required: ["codigo", "nombre", "tipo", "fechaAdquisicion", "costoAdquisicion", "vidaUtilAnos"],
          properties: {
            codigo: { type: "string" },
            nombre: { type: "string" },
            tipo: { type: "string" },
            fechaAdquisicion: { type: "string" },
            costoAdquisicion: { type: "number", minimum: 0 },
            valorResidual: { type: "number", minimum: 0 },
            vidaUtilAnos: { type: "integer", minimum: 1 },
            notas: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const result = await createFixedAsset(tenantSlug, request.body);
      return reply.status(201).send(result);
    },
  );

  // ── GET /finance/contabilidad/depreciacion/activos ──
  app.get(
    "/finance/contabilidad/depreciacion/activos",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const result = await listFixedAssets(tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/depreciacion/activos/:id ──
  app.get<{ Params: { id: string } }>(
    "/finance/contabilidad/depreciacion/activos/:id",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const result = await getFixedAsset(request.params.id, tenantSlug);
      if (!result) return reply.status(404).send({ error: "Activo fijo no encontrado" });
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/centralizacion/ventas ──
  app.post<{ Body: { anho: number; mes: number } }>(
    "/finance/contabilidad/centralizacion/ventas",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const { anho, mes } = request.body;
      const result = await centralizeSales(tenantSlug, anho, mes);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/centralizacion/compras ──
  app.post<{ Body: { anho: number; mes: number } }>(
    "/finance/contabilidad/centralizacion/compras",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const { anho, mes } = request.body;
      const result = await centralizePurchases(tenantSlug, anho, mes);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/centralizacion/ejecutar ──
  app.post<{ Body: { anho: number; mes: number } }>(
    "/finance/contabilidad/centralizacion/ejecutar",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const { anho, mes } = request.body;
      const result = await runMonthEndCentralization(tenantSlug, anho, mes);
      return reply.send(result);
    },
  );

  // ════════════════════════════════════════════════
  // Sprint 4: Fx, Revaluo, Refundición, Reserva Legal
  // ════════════════════════════════════════════════

  // ── POST /finance/contabilidad/tipos-cambio ──
  app.post<{ Body: SetExchangeRateRequest }>(
    "/finance/contabilidad/tipos-cambio",
    {
      schema: {
        body: {
          type: "object",
          required: ["moneda", "fecha", "compra", "venta"],
          properties: {
            moneda: { type: "string", maxLength: 3 },
            fecha: { type: "string", format: "date" },
            compra: { type: "number", minimum: 0 },
            venta: { type: "number", minimum: 0 },
            referencia: { type: "number" },
            fuente: { type: "string" },
            notas: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const result = await setExchangeRate(tenantSlug, request.body);
      return reply.status(201).send(result);
    },
  );

  // ── GET /finance/contabilidad/tipos-cambio/actual?moneda=USD ──
  app.get<{ Querystring: { moneda?: string } }>(
    "/finance/contabilidad/tipos-cambio/actual",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const rate = await getLatestRate(tenantSlug, request.query.moneda ?? "USD");
      return reply.send(rate);
    },
  );

  // ── GET /finance/contabilidad/tipos-cambio/:fecha?moneda=USD ──
  app.get<{ Params: { fecha: string }; Querystring: { moneda?: string } }>(
    "/finance/contabilidad/tipos-cambio/:fecha",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const rate = await getRateAtDate(tenantSlug, request.query.moneda ?? "USD", new Date(request.params.fecha));
      return reply.send(rate);
    },
  );

  // ── GET /finance/contabilidad/tipos-cambio ──
  app.get<{ Querystring: { moneda?: string; limit?: string } }>(
    "/finance/contabilidad/tipos-cambio",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const result = await listExchangeRates(
        tenantSlug,
        request.query.moneda,
        request.query.limit ? parseInt(request.query.limit, 10) : 30,
      );
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/diferencia-cambio/calcular ──
  app.post<{ Body: DiferenciaCambioRequest }>(
    "/finance/contabilidad/diferencia-cambio/calcular",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const { anho, mes } = request.body;
      const result = await generateFxAdjustment(tenantSlug, anho, mes);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/revaluo ──
  app.post<{ Body: RevaluoRequest }>(
    "/finance/contabilidad/revaluo",
    {
      schema: {
        body: {
          type: "object",
          required: ["activoFijoId", "nuevoValor", "fecha"],
          properties: {
            activoFijoId: { type: "string", format: "uuid" },
            nuevoValor: { type: "number", minimum: 0 },
            fecha: { type: "string", format: "date" },
            motivo: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const result = await revaluarActivo(tenantSlug, request.body);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/refundir ──
  app.post<{ Body: RefundirRequest }>(
    "/finance/contabilidad/refundir",
    {
      schema: {
        body: {
          type: "object",
          required: ["asientoIds"],
          properties: {
            asientoIds: { type: "array", minItems: 1, items: { type: "string", format: "uuid" } },
            fecha: { type: "string", format: "date" },
            concepto: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await refundirAsientos(request.body);
      return reply.send(result);
    },
  );

  // ── POST /finance/contabilidad/reserva-legal ──
  app.post<{ Body: ReservaLegalRequest }>(
    "/finance/contabilidad/reserva-legal",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const result = await constituirReservaLegal(tenantSlug, request.body);
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/reserva-legal/saldo ──
  app.get(
    "/finance/contabilidad/reserva-legal/saldo",
    async (_request, reply) => {
      const saldo = await getReservaLegalSaldo();
      return reply.send({ saldo });
    },
  );

  // ════════════════════════════════════════════════
  // Sprint 5: Libros Contables Electrónicos
  // ════════════════════════════════════════════════

  // ── GET /finance/contabilidad/libro-diario/:anho/:mes?formato=JSON|TXT|CSV ──
  app.get<{
    Params: { anho: string; mes: string };
    Querystring: { formato?: string };
  }>(
    "/finance/contabilidad/libro-diario/:anho/:mes",
    async (request, reply) => {
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const formato = (request.query.formato?.toUpperCase() ?? "JSON") as "JSON" | "TXT" | "CSV";
      const result = await generarLibroDiario(anho, mes, formato);
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/libro-mayor/:anho/:mes ──
  app.get<{
    Params: { anho: string; mes: string };
    Querystring: { codigoDesde?: string; codigoHasta?: string };
  }>(
    "/finance/contabilidad/libro-mayor/:anho/:mes",
    async (request, reply) => {
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const { codigoDesde, codigoHasta } = request.query;
      const result = await generarLibroMayor(anho, mes, { codigoDesde, codigoHasta });
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/libro-inventario/:anho/:mes ──
  app.get<{ Params: { anho: string; mes: string } }>(
    "/finance/contabilidad/libro-inventario/:anho/:mes",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const result = await generarLibroInventario(anho, mes, tenantSlug);
      return reply.send(result);
    },
  );

  // ════════════════════════════════════════════════
  // CAPA 3: RG 90 Módulos (Ventas, Compras, Retenciones)
  // ════════════════════════════════════════════════

  // ── GET /finance/rg90/ventas/:anho/:mes?formato=JSON|TXT|CSV ──
  app.get<{
    Params: { anho: string; mes: string };
    Querystring: { formato?: string };
  }>(
    "/finance/rg90/ventas/:anho/:mes",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const formato = (request.query.formato?.toUpperCase() ?? "JSON") as "JSON" | "TXT" | "CSV";
      const result = await exportarRG90Ventas(tenantSlug, anho, mes, formato);
      return reply.send(result);
    },
  );

  // ── GET /finance/rg90/compras/:anho/:mes?formato=JSON|TXT|CSV ──
  app.get<{
    Params: { anho: string; mes: string };
    Querystring: { formato?: string };
  }>(
    "/finance/rg90/compras/:anho/:mes",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const formato = (request.query.formato?.toUpperCase() ?? "JSON") as "JSON" | "TXT" | "CSV";
      const result = await exportarRG90Compras(tenantSlug, anho, mes, formato);
      return reply.send(result);
    },
  );

  // ── GET /finance/rg90/retenciones/:anho/:mes?formato=JSON|TXT|CSV ──
  app.get<{
    Params: { anho: string; mes: string };
    Querystring: { formato?: string };
  }>(
    "/finance/rg90/retenciones/:anho/:mes",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug;
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const formato = (request.query.formato?.toUpperCase() ?? "JSON") as "JSON" | "TXT" | "CSV";
      const result = await exportarRG90Retenciones(tenantSlug, anho, mes, formato);
      return reply.send(result);
    },
  );

  // ════════════════════════════════════════════════
  // CAPA 4: Compliance, Inmutabilidad, Auditoría
  // ════════════════════════════════════════════════

  // ── POST /finance/contabilidad/cerrar-periodo — Close a period ──
  app.post<{ Body: { hastaMes: number } }>(
    "/finance/contabilidad/cerrar-periodo",
    {
      schema: {
        body: {
          type: "object",
          required: ["hastaMes"],
          properties: {
            hastaMes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await cerrarPeriodo(
        request.tenantSlug,
        request.body.hastaMes,
      );

      // Audit: CERRAR
      await logAudit({
        tenantSlug: request.tenantSlug,
        usuarioId: (request.headers["x-user-email"] as string) ?? "system",
        ip: request.ip,
        accion: "CERRAR",
        entidad: "tenant_config",
        entidadId: request.tenantSlug,
        descripcion: `Cierre de período contable hasta mes ${request.body.hastaMes}`,
      }).catch((err) => request.log.warn({ err }, "Audit log insert failed"));

      return reply.send({ cerradoHastaMes: result });
    },
  );

  // ── GET /finance/contabilidad/cuadratura/:anho/:mes — Period balance check ──
  app.get<{
    Params: { anho: string; mes: string };
    Querystring: { soloDesbalanceados?: string };
  }>(
    "/finance/contabilidad/cuadratura/:anho/:mes",
    async (request, reply) => {
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const soloDesbalanceados = request.query.soloDesbalanceados === "true";
      const report = await ejecutarCuadratura(anho, mes, soloDesbalanceados);
      return reply.send(report);
    },
  );

  // ── GET /finance/contabilidad/audit-log — Query audit log ──
  app.get<{
    Querystring: {
      entidad?: string;
      entidadId?: string;
      accion?: string;
      desde?: string;
      hasta?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    "/finance/contabilidad/audit-log",
    async (request, reply) => {
      const result = await queryAuditLog({
        tenantSlug: request.tenantSlug,
        entidad: request.query.entidad,
        entidadId: request.query.entidadId,
        accion: request.query.accion as any,
        desde: request.query.desde ? new Date(request.query.desde) : undefined,
        hasta: request.query.hasta ? new Date(request.query.hasta) : undefined,
        limit: request.query.limit ? parseInt(request.query.limit, 10) : 50,
        offset: request.query.offset ? parseInt(request.query.offset, 10) : 0,
      });
      return reply.send(result);
    },
  );

  // ════════════════════════════════════════════════
  // CAPA 5: Centros de Costo y Rentabilidad
  // ════════════════════════════════════════════════

  // ── POST /finance/contabilidad/centros-costo — Create cost center ──
  app.post<{ Body: { codigo: string; nombre: string; descripcion?: string; centroPadreId?: string } }>(
    "/finance/contabilidad/centros-costo",
    {
      schema: {
        body: {
          type: "object",
          required: ["codigo", "nombre"],
          properties: {
            codigo: { type: "string", maxLength: 20 },
            nombre: { type: "string", maxLength: 200 },
            descripcion: { type: "string" },
            centroPadreId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const centro = await createCentroCosto(request.tenantSlug, request.body);
      // Audit
      await logAudit({
        tenantSlug: request.tenantSlug,
        usuarioId: (request.headers["x-user-email"] as string) ?? "system",
        ip: request.ip,
        accion: "CREATE",
        entidad: "centros_costo",
        entidadId: centro.id,
        valorNuevo: centro as unknown as Record<string, unknown>,
        descripcion: `Creación de centro de costo: ${centro.codigo} - ${centro.nombre}`,
      }).catch((err) => request.log.warn({ err }, "Audit log insert failed"));
      return reply.status(201).send(centro);
    },
  );

  // ── GET /finance/contabilidad/centros-costo — List cost centers ──
  app.get<{ Querystring: { activo?: string; centroPadreId?: string } }>(
    "/finance/contabilidad/centros-costo",
    async (request, reply) => {
      const { activo, centroPadreId } = request.query;
      const result = await listCentrosCosto({
        tenantSlug: request.tenantSlug,
        activo: activo !== undefined ? activo === "true" : undefined,
        centroPadreId,
      });
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/centros-costo/arbol — Cost center tree ──
  app.get<{ Querystring: { soloActivos?: string } }>(
    "/finance/contabilidad/centros-costo/arbol",
    async (request, reply) => {
      const soloActivos = request.query.soloActivos === "true";
      const arbol = await getArbolCentrosCosto(request.tenantSlug, soloActivos);
      return reply.send(arbol);
    },
  );

  // ── GET /finance/contabilidad/centros-costo/:id — Get cost center ──
  app.get<{ Params: { id: string } }>(
    "/finance/contabilidad/centros-costo/:id",
    async (request, reply) => {
      const centro = await getCentroCostoById(request.params.id);
      return reply.send(centro);
    },
  );

  // ── PATCH /finance/contabilidad/centros-costo/:id — Update cost center ──
  app.patch<{ Params: { id: string }; Body: { nombre?: string; descripcion?: string; centroPadreId?: string | null; activo?: boolean } }>(
    "/finance/contabilidad/centros-costo/:id",
    async (request, reply) => {
      const centro = await updateCentroCosto(request.params.id, request.body);
      return reply.send(centro);
    },
  );

  // ── DELETE /finance/contabilidad/centros-costo/:id — Deactivate cost center ──
  app.delete<{ Params: { id: string } }>(
    "/finance/contabilidad/centros-costo/:id",
    async (request, reply) => {
      await deleteCentroCosto(request.params.id);
      return reply.status(204).send();
    },
  );

  // ── GET /finance/contabilidad/rentabilidad/ot/:id — OT profitability ──
  app.get<{ Params: { id: string } }>(
    "/finance/contabilidad/rentabilidad/ot/:id",
    async (request, reply) => {
      const result = await getOTProfitability(request.params.id);
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/rentabilidad/cliente/:id — Client profitability ──
  app.get<{ Params: { id: string } }>(
    "/finance/contabilidad/rentabilidad/cliente/:id",
    async (request, reply) => {
      const result = await getClientProfitability(request.params.id);
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/rentabilidad/mecanico/:id — Mechanic profitability ──
  app.get<{ Params: { id: string } }>(
    "/finance/contabilidad/rentabilidad/mecanico/:id",
    async (request, reply) => {
      const result = await getMechanicProfitability(request.params.id);
      return reply.send(result);
    },
  );

  // ── GET /finance/contabilidad/rentabilidad/dashboard/:anho/:mes — Period profitability ──
  app.get<{ Params: { anho: string; mes: string } }>(
    "/finance/contabilidad/rentabilidad/dashboard/:anho/:mes",
    async (request, reply) => {
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const result = await getDashboardProfitability(request.tenantSlug, anho, mes);
      return reply.send(result);
    },
  );

  // ════════════════════════════════════════════════
  // Sprint 6: Balance General y Estado de Resultados
  // ════════════════════════════════════════════════

  // ── GET /finance/contabilidad/balance-general/:fecha — Balance General ──
  app.get<{ Params: { fecha: string } }>(
    "/finance/contabilidad/balance-general/:fecha",
    {
      schema: {
        params: {
          type: "object",
          required: ["fecha"],
          properties: {
            fecha: { type: "string", description: "Fecha del balance (YYYY-MM-DD)" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              fecha: { type: "string" },
              activo: { type: "object" },
              pasivo: { type: "object" },
              patrimonio: { type: "object" },
              totalActivo: { type: "number" },
              totalPasivoPatrimonio: { type: "number" },
              diferencia: { type: "number" },
              balanceado: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const balance = await getBalanceGeneral(request.params.fecha);
      return reply.send(balance);
    },
  );

  // ── GET /finance/contabilidad/estado-resultados/:anho/:mes — P&L ──
  app.get<{
    Params: { anho: string; mes: string };
    Querystring: { acumulado?: string };
  }>(
    "/finance/contabilidad/estado-resultados/:anho/:mes",
    {
      schema: {
        params: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "string", description: "Año fiscal" },
            mes: { type: "string", description: "Mes (1-12)" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            acumulado: { type: "string", description: "true = acumulado desde enero" },
          },
        },
      },
    },
    async (request, reply) => {
      const anho = parseInt(request.params.anho, 10);
      const mes = parseInt(request.params.mes, 10);
      const acumulado = request.query.acumulado === "true";
      const result = await getEstadoResultados(anho, mes, acumulado);
      return reply.send(result);
    },
  );
}
