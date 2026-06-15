/**
 * Treasury routes — Tesorería, CxC, CxP, Flujo de Caja.
 *
 * Endpoints:
 *   POST    /finance/treasury/cuentas            — Create bank account
 *   GET     /finance/treasury/cuentas            — List bank accounts
 *   GET     /finance/treasury/cuentas/:id        — Get bank account by ID
 *   PATCH   /finance/treasury/cuentas/:id        — Update bank account
 *
 *   POST    /finance/treasury/movimientos        — Register movement
 *   POST    /finance/treasury/transferencias     — Transfer between accounts
 *   GET     /finance/treasury/movimientos        — List movements
 *   GET     /finance/treasury/movimientos/saldo-historico/:cuentaId  — Historical balance
 *
 *   POST    /finance/treasury/conciliacion           — Start conciliation
 *   POST    /finance/treasury/conciliacion/:id/cerrar — Close conciliation
 *   GET     /finance/treasury/conciliacion/:cuentaId — List conciliations
 *
 *   POST    /finance/treasury/facturas-proveedor     — Register supplier invoice
 *   GET     /finance/treasury/facturas-proveedor     — List supplier invoices
 *
 *   GET     /finance/treasury/cxc-pendientes         — List pending AR invoices
 *   GET     /finance/treasury/flujo-caja             — Cash flow projection
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * @module finance/routes/treasury
 */

import type { FastifyInstance } from "fastify";
import {
  createCuentaBancaria,
  listCuentasBancarias,
  getCuentaBancaria,
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
} from "../services/treasury/treasury.service.js";

export async function treasuryRoutes(app: FastifyInstance): Promise<void> {
  // ─── Cuentas Bancarias ─────────────────────

  app.post("/finance/treasury/cuentas", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const data = request.body as Record<string, unknown>;
    const cuenta = await createCuentaBancaria({
      ...data,
      tenantSlug,
      saldoInicial: String(data.saldoInicial ?? "0"),
      saldoActual: String(data.saldoInicial ?? "0"),
    } as any);

    return reply.status(201).send(cuenta);
  });

  app.get("/finance/treasury/cuentas", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { soloActivas } = request.query as { soloActivas?: string };
    const cuentas = await listCuentasBancarias(
      tenantSlug,
      soloActivas !== "false",
    );
    return reply.send(cuentas);
  });

  app.get("/finance/treasury/cuentas/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const cuenta = await getCuentaBancaria(id);
    return reply.send(cuenta);
  });

  app.patch("/finance/treasury/cuentas/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Record<string, unknown>;
    const cuenta = await updateCuentaBancaria(id, data as any);
    return reply.send(cuenta);
  });

  // ─── Movimientos ───────────────────────────

  app.post("/finance/treasury/movimientos", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const data = request.body as Record<string, unknown>;
    const movimiento = await registrarMovimiento({
      ...data,
      tenantSlug,
      fecha: data.fecha ? new Date(data.fecha as string) : new Date(),
    } as any);

    return reply.status(201).send(movimiento);
  });

  app.post("/finance/treasury/transferencias", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const body = request.body as {
      cuentaOrigenId: string;
      cuentaDestinoId: string;
      monto: string;
      concepto: string;
      moneda?: string;
    };

    const result = await registrarTransferencia({
      ...body,
      moneda: body.moneda ?? "PYG",
      tenantSlug,
    });

    return reply.status(201).send(result);
  });

  app.get("/finance/treasury/movimientos", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const query = request.query as {
      cuentaId?: string;
      tipo?: string;
      desde?: string;
      hasta?: string;
      conciliado?: string;
      limit?: string;
      offset?: string;
    };

    const movimientos = await listMovimientos({
      tenantSlug,
      cuentaId: query.cuentaId,
      tipo: query.tipo,
      desde: query.desde ? new Date(query.desde) : undefined,
      hasta: query.hasta ? new Date(query.hasta) : undefined,
      conciliado: query.conciliado !== undefined ? query.conciliado === "true" : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    });

    return reply.send(movimientos);
  });

  app.get(
    "/finance/treasury/movimientos/saldo-historico/:cuentaId",
    async (request, reply) => {
      const { cuentaId } = request.params as { cuentaId: string };
      const { fecha } = request.query as { fecha?: string };
      const saldo = await getSaldoHistorico(
        cuentaId,
        fecha ? new Date(fecha) : new Date(),
      );
      return reply.send({ cuentaId, saldo, fecha: fecha ?? new Date().toISOString() });
    },
  );

  // ─── Conciliación ──────────────────────────

  app.post("/finance/treasury/conciliacion", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const body = request.body as {
      cuentaId: string;
      periodo: string;
      saldoBanco: string;
    };

    const conciliacion = await iniciarConciliacion({
      ...body,
      tenantSlug,
    });

    return reply.status(201).send(conciliacion);
  });

  app.post(
    "/finance/treasury/conciliacion/:id/cerrar",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { movimientoIds: string[] };
      const result = await cerrarConciliacion(id, body.movimientoIds);
      return reply.send(result);
    },
  );

  app.get(
    "/finance/treasury/conciliacion/:cuentaId",
    async (request, reply) => {
      const { cuentaId } = request.params as { cuentaId: string };
      const conciliaciones = await listConciliaciones(cuentaId);
      return reply.send(conciliaciones);
    },
  );

  // ─── Facturas Proveedor (CxP) ──────────────

  app.post("/finance/treasury/facturas-proveedor", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const body = request.body as Record<string, unknown>;
    const factura = await createFacturaProveedor({
      ...body,
      tenantSlug,
    } as any);

    return reply.status(201).send(factura);
  });

  app.get("/finance/treasury/facturas-proveedor", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const query = request.query as {
      estado?: string;
      proveedorId?: string;
      vencimientoDesde?: string;
      vencimientoHasta?: string;
    };

    const facturas = await listFacturasProveedor({
      tenantSlug,
      estado: query.estado,
      proveedorId: query.proveedorId,
      vencimientoDesde: query.vencimientoDesde
        ? new Date(query.vencimientoDesde)
        : undefined,
      vencimientoHasta: query.vencimientoHasta
        ? new Date(query.vencimientoHasta)
        : undefined,
    });

    return reply.send(facturas);
  });

  // ─── Cuentas por Cobrar (CxC) ──────────────

  app.get("/finance/treasury/cxc-pendientes", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { days } = request.query as { days?: string };
    const facturas = await listCxcPendientes(
      tenantSlug,
      days ? parseInt(days) : 30,
    );
    return reply.send(facturas);
  });

  // ─── Flujo de Caja ─────────────────────────

  app.get("/finance/treasury/flujo-caja", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const query = request.query as {
      cuentaId?: string;
      dias?: string;
    };

    const proyeccion = await proyectarFlujoCaja(
      tenantSlug,
      query.cuentaId,
      query.dias ? parseInt(query.dias) : 30,
    );

    return reply.send(proyeccion);
  });

  // ─── Pago a Proveedores ─────────────────────

  /**
   * POST /finance/treasury/facturas-proveedor/:id/pagar
   *
   * Registra el pago de una factura de proveedor.
   * Crea un movimiento EGRESO en tesorería y actualiza el saldo de la factura.
   */
  app.post("/finance/treasury/facturas-proveedor/:id/pagar", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { id } = request.params as { id: string };
    const body = request.body as {
      monto: number;
      medioPago: string;
      cuentaId: string;
      concepto?: string;
    };

    if (!body.monto || !body.medioPago || !body.cuentaId) {
      return reply.status(400).send({ error: "monto, medioPago y cuentaId son requeridos" });
    }

    try {
      const result = await pagarFacturaProveedor({
        facturaProvId: id,
        monto: body.monto,
        medioPago: body.medioPago,
        cuentaId: body.cuentaId,
        concepto: body.concepto,
        tenantSlug,
      });
      return reply.send(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      return reply.status(400).send({ success: false, error: message });
    }
  });
}
