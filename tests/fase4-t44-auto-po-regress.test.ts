/**
 * T-44 regresión · numeración correlativa de OC en el generador automático.
 *
 * Contexto: `generatePONumber` está duplicada en `auto-po.service.ts` y en
 * `purchase-order.service.ts`. Ambas usaban el fragmento SQL
 *
 *     sql`${purchaseOrders.numero} LIKE ${prefix}%`
 *
 * que Drizzle/Postgres.js renderiza como `LIKE $1%` — el `%` queda FUERA del
 * placeholder y produce `syntax error at or near "and"` en cada ejecución.
 * En `auto-po` eso dejaba el cron de reorder (`reorder-check.cron.ts`) y
 * `POST /inventory/auto-po/generate` rotos al 100 %: ninguna OC automática
 * llegaba a crearse. Se corrigió usando `like()` de Drizzle.
 *
 * Este archivo fija el comportamiento esperado para que la regresión no vuelva,
 * en particular el requisito de "un solo espacio de numeración" compartido entre
 * el CRUD manual y el generador automático.
 *
 * @module tests/fase4-t44-auto-po-regress
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/shared/database/drizzle.js";
import { getDb } from "../src/shared/database/connection.js";
import { generateAutoPOs } from "../src/modules/inventory/services/auto-po.service.js";
import { createPurchaseOrder } from "../src/modules/inventory/services/purchase-order.service.js";
import {
  repuestos,
  reorderAlerts,
  purchaseOrders,
  purchaseOrderItems,
} from "../src/modules/inventory/schema/index.js";
import { eq, and, inArray } from "drizzle-orm";

const TENANT = "e2e-t44-autopo";
const OTRO_TENANT = "e2e-t44-autopo-otro";
const AÑO = new Date().getFullYear();
const PREFIX = `OC-${AÑO}-`;

let repId: string;
let repIdOtro: string;
let alertaId: string;

describe("T-44 · regresión numeración correlativa de OC", () => {
  beforeAll(async () => {
    const sql = getDb() as any;
    for (const slug of [TENANT, OTRO_TENANT]) {
      await sql`INSERT INTO tenants (name, slug, schema_name, is_active)
        VALUES (${slug}, ${slug}, ${slug}, true) ON CONFLICT (slug) DO NOTHING`;
    }

    const [rep] = await db()
      .insert(repuestos)
      .values({
        codigo: `AUTOPO-${Date.now()}`,
        descripcion: "Filtro regresión auto-po",
        stockActual: 0,
        puntoReorden: 5,
        loteEconomico: 3,
        costoPromedio: "1000",
        proveedor: "PROVEEDOR-REGRESION",
        tenantSlug: TENANT,
      })
      .returning();
    repId = rep.id;

    const [alerta] = await db()
      .insert(reorderAlerts)
      .values({
        repuestoId: repId,
        stockActual: 0,
        puntoReorden: 5,
        estado: "PENDIENTE",
        tenantSlug: TENANT,
      })
      .returning();
    alertaId = alerta.id;

    // Mismo catálogo en el segundo tenant: `createPurchaseOrder` valida los
    // items contra el catálogo del tenant y 404ea los ajenos (aislamiento).
    const [repOtro] = await db()
      .insert(repuestos)
      .values({
        codigo: `AUTOPO-OTRO-${Date.now()}`,
        descripcion: "Filtro regresión auto-po (tenant 2)",
        stockActual: 0,
        puntoReorden: 5,
        loteEconomico: 3,
        costoPromedio: "1000",
        proveedor: "PROVEEDOR-REGRESION",
        tenantSlug: OTRO_TENANT,
      })
      .returning();
    repIdOtro = repOtro.id;
  });

  afterAll(async () => {
    const sql = getDb() as any;
    await db().delete(reorderAlerts).where(eq(reorderAlerts.id, alertaId));
    const ocs = await db()
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(inArray(purchaseOrders.tenantSlug, [TENANT, OTRO_TENANT]));
    if (ocs.length) {
      await db()
        .delete(purchaseOrderItems)
        .where(
          inArray(
            purchaseOrderItems.ordenCompraId,
            ocs.map((o) => o.id),
          ),
        );
      await db()
        .delete(purchaseOrders)
        .where(
          inArray(
            purchaseOrders.id,
            ocs.map((o) => o.id),
          ),
        );
    }
    await db()
      .delete(repuestos)
      .where(inArray(repuestos.id, [repId, repIdOtro]));
    await sql`DELETE FROM tenants WHERE slug = ANY(${[TENANT, OTRO_TENANT]})`;
  });

  it("el generador automático crea la OC con el prefijo del año (no explota el LIKE)", async () => {
    const results = await generateAutoPOs(TENANT);

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.created).toBe(true);
    expect(r.items).toBe(1);
    expect(r.poNumero).toMatch(new RegExp(`^${PREFIX}\\d{4}$`));

    // La alerta queda enlazada a la OC generada
    const [alerta] = await db()
      .select()
      .from(reorderAlerts)
      .where(eq(reorderAlerts.id, alertaId));
    expect(alerta.estado).toBe("EN_OC");
    expect(alerta.ocGeneradaId).toBe(r.poId);
  });

  it("el CRUD manual continúa la numeración del generador (espacio compartido)", async () => {
    const auto = await db()
      .select({ numero: purchaseOrders.numero })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.tenantSlug, TENANT),
          eq(purchaseOrders.proveedor, "PROVEEDOR-REGRESION"),
        ),
      )
      .limit(1);
    expect(auto).toHaveLength(1);

    const manual = await createPurchaseOrder(
      {
        proveedor: "PROVEEDOR-REGRESION",
        items: [{ repuestoId: repId, cantidad: 1, costoUnitario: 1000 }],
      },
      TENANT,
    );

    const nAuto = Number(auto[0].numero.split("-")[2]);
    const nManual = Number(manual.numero.split("-")[2]);
    expect(nManual).toBe(nAuto + 1);
  });

  it("la numeración es independiente por tenant", async () => {
    const otro = await createPurchaseOrder(
      {
        proveedor: "PROVEEDOR-REGRESION",
        items: [{ repuestoId: repIdOtro, cantidad: 1, costoUnitario: 1000 }],
      },
      OTRO_TENANT,
    );
    // El tenant nuevo arranca en 0001 aunque el otro ya tenga OCs.
    expect(otro.numero).toBe(`${PREFIX}0001`);
  });
});
