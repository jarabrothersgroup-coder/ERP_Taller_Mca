/**
 * T-63 — Guard sistémico de rutas sin consumidor (Fase 6, cierre de T-47/T-48).
 *
 * T-47 inventarió la superficie real de la API (app.printRoutes) y halló
 * 255 rutas que nadie invoca; 6 estaban rotas de origen y solo se descubrió
 * porque se sondearon a mano. T-48 las arregló y las blindó. Este guard
 * impide que la deuda vuelva a crecer:
 *
 *  1. Techo de rutas sin consumidor — ni UI (web/mobile/public), ni scripts,
 *     ni backend interno. Es la clase D/E de T-47: superficie muerta.
 *  2. Techo de rutas sin test — ni vitest (tests/) ni Playwright (web/e2e).
 *     Es la causa raíz estructural: "código que compila, tipa y se registra,
 *     pero que nadie ejecuta, así que nadie lo prueba" (T-47).
 *
 * Igual que tests/tenant-filter-audit.test.ts con su CEILING de lookups sin
 * tenant: el número NO debe crecer. Agregar una ruta exige consumirla (UI,
 * script o backend) o ejercitarla en un test; si un número baja, Congelar el
 * nuevo valor aquí y en el gate de .github/workflows/ci.yml.
 *
 * Nota: el matching es por PATH. Si un test ejercita GET /x/:id, el POST
 * hermano sigue contando como sin test — para cobertura por verbo está T-61.
 *
 * @module tests/contract/route-consumer-guard
 */
import { describe, expect, it, beforeAll } from "vitest";
// @ts-expect-error — script .mjs sin declaraciones de tipos
import { scanRouteConsumers, scanCriticalBehavior, BEHAVIOR_COVERAGE_FLOOR } from "../../scripts/route-consumer-scan.mjs";

// ─── Techos vigentes (baseline T-63 + triaje 2026-09-28; Sprint 112 2026-10-08;
// Sprint 113 (T-47 "Conectar a UI") 2026-10-09) ─────────────────────────────
// Sin consumidor 113 = 522 rutas − las citadas por web/mobile/public/scripts/backend
// − las 41 excluidas del triaje (externas/internas por diseño). Las exclusiones
// viven en EXCLUDED del escáner.
// Sin test 235 = la misma superficie menos lo que ejercita tests/ y web/e2e/;
// las exclusiones NO bajan esta pata (un webhook externo necesita test igual).
// Primer baseline (293/383) usaba un matcher que nunca convertía `:param`:
// toda ruta parametrizada contaba como huérfana. Corregido el matcher, el
// número REAL bajó. Sprint 107 cerró los 8 pares T-61 (293 → 286); Sprint 108
// eliminó 7 rutas legado (286 → 279); Sprint 109 sumó 15 tests de clase D
// (279 → 266); Sprint 110 sumó 16 tests tanda 2 liviana (266 → 258);
// Sprint 111 sumó 25 tests de contabilidad (258 → 238; los 19 paths huérfanos
// + asientos/:id que el matcher paramétrico caza desde /asientos/automatico);
// Sprint 112 excluyó las 3 externas sifen (152 → 149) y ejercitó los 3 paths
// de treasury/conciliación con tests/fase7-s112-treasury (238 → 235).
// Sprint 113 conectó a UI el balde T-47 (~30 ops: tesorería transfer/edit,
// sucursales, presupuestos items+refresh, DVI item-status, inventory
// adjustments+initial-load, contabilidad cierre ~14 ops + tipos-cambio
// actual/:fecha) → 149 → 113.
// Sprint 114 ejercitó con tests de comportamiento las 14 ops de escritura
// del balde cableado en 113 (fase7-s114-write-coverage: treasury cuentas/
// movimientos/facturas-proveedor(+pagar), presupuestos create+aprobar,
// contabilidad asientos/grupos/miembros/centros-costo, dvi photos):
// sin test 235 → 221, escritura sin test 90 → 76. Además corrigió 3 bugs
// (facturas-proveedor fechas ISO→Date, DELETE grupo ya inactivo devolvía
// 204 en vez de 404, DELETE foto DVI perdía la extensión del archivo).
// Sprint 115 ejercitó 16 ops de escritura del siguiente lote (fase7-s115:
// mobile push-token, notifications read/read-all, api-keys create/revoke,
// data-retention upsert/cleanup, label-printing config/preview/reimpresiones,
// analytics report, fleet billing, 2fa verify, finance payments link):
// sin test 221 → 208, escritura sin test 76 → 63. Además corrigió 3 bugs
// (markAsRead sin filtro de tenant — aislamiento cross-tenant,
// reimpresiones 500 por bytes NUL en payload ESC/POS, tabla
// data_retention_policy singular).
// Sprint 116 ejercitó 14 ops de escritura (fase7-s116: 5 calculadoras
// fiscales form120/ire/idu/isc/inr + CRM stages create/seed/patch/delete
// y deals create/patch/move/close/delete): sin test 208 → 200,
// escritura sin test 63 → 55. Sin bugs de producción (solo aserciones
// de test ajustadas a los shapes reales impuestoIdu/impuestoIsc/impuestoInr).
// Sprint 117 ejercitó 15 ops de escritura (fase7-s117: WhatsApp templates
// create/preview/seed/delete + followups schedule/cancel/process, marketing
// sequences PATCH/DELETE/run, CRM sync/:ordenId + retry, thinkcar link +
// assign, white-label upsert): sin test 200 → 186, escritura sin test
// 55 → 41. Sin bugs de producción (UUIDs mal formados en fixtures corregidos).
// Sprint 118 ejercitó 14 ops de escritura (fase7-s118: intelligence dtc
// parse/parse-file/diagnose + safety/protocol + decode-safety + ocr plate/
// cedula, thinkcar mobile-dtc, whatsapp followups/auto, migration export/
// import, portal magic/feedback/appointments): sin test 186 → 172,
// escritura sin test 41 → 27. Sin bugs de producción (solo ajustes de test:
// CSRF double-submit en portal, shape riskAssessment, status OCR race).
// Sprint 119 (balde legado/duplicado) eliminó las 2 rutas legacy
// /inventory/herramientas/prestar y /control/:id/devolver (duplicados de
// tool-loans, ya consumidos por la UI canónica) y repuntó sus tests a
// /inventory/tool-loans/lend | /:id/return: sin consumidor 113 → 111.
// Sprint 119 (lote 6 de escritura, fase7-s119, 22 rutas): whatsapp instance/
// disconnect/queue/send, sso discover/authorize/logout/validate-domain,
// portal invoices pay + magic 401/400, api-keys create/revoke/reset-scope,
// config upload-logo, migration import/file, email send/send-reminder/
// send-invoice/send-estimate + billing 4 ops, intelligence manuals/ingest,
// thinkcar ingest/usb: sin test 172 → 150, escritura sin test 27 → 5 (solo
// quedan las 5 sifen externas). CORRIGIÓ 1 bug de producción: el parser
// multipart se registraba DESPUÉS del plugin de config, por lo que
// /api/config/upload-logo devolvía 415 al recibir un multipart real
// (snapshot de content-type parsers por scope encapsulado: se movió la
// registración de @fastify/multipart antes del módulo config).
// Sprint 119 (reportes GET de contabilidad, fase7-s119-reportes, 23 tests):
// balde de cierre T-47 — cuadratura, rentabilidad ot/cliente/mecanico/
// dashboard, libro-diario/mayor/inventario, libro-compras-iva/ventas-iva
// (JSON + CSV), mappings, audit-log/:entidad/:entidadId: sin test 150 → 138.
// CORRIGIÓ 1 bug de producción: el dashboard de rentabilidad encadenaba un
// fragmento sql`…` con parámetros Date y postgres-js disparaba
// ERR_INVALID_ARG_TYPE → siempre 500; se pasó a gte()/lte() column operations
// (el binding de JS Date como parámetro de sql fragment está roto en drizzle).
// Nota: los 12 GET siguen en "sin consumidor" — los tests de backend no
// agregan consumidores de UI; el cierre del balde los saca solo de "sin test".
// Sprint 120 (lote 7 de lectura, fase7-s120-read-finance, 39 tests): las 31
// rutas GET de /finance/** que quedaban sin test (estados financieros
// balance-general/estado-resultados/flujo-efectivo/evolucion-patrimonio/
// notas-financieras, centros-costo/arbol, integración resumen+check,
// consolidado balance+pnl, depreciación activos/:id, tipos-cambio/actual,
// reserva-legal/saldo, RG 90 ventas/compras/retenciones, fiscal form120/ire/
// idu/isc/inr, treasury cxc-pendientes/flujo-caja/saldo-historico,
// presupuestos comparativa+alertas, sifen consultar/documentos/sync-log/
// contingencia-status): sin test 138 → 107 (0 GET de finance restantes).
// CORRIGIÓ 1 bug de producción: flujo-efectivo devolvía SIEMPRE 500 —
// calcularAjustesNoEfectivo agrupaba por código/nombre de cuenta sin
// .groupBy() (42803 must appear in the GROUP BY) en las consultas de
// depreciación 6.2.% y provisiones 6.3.% (la consulta hermana de activos
// fijos sí lo tenía).
// Sprint 121 (lote 8 de lectura, fase7-s121-read-taller-inventario,
// 34 tests): las 43 rutas GET de /workshop/** (24) e /inventory/** (19) que
// quedaban sin test — analytics producto top-servicios/top-clientes/
// productividad/scorecard, historiales clientes/vehiculos, flat-rate
// technician/bay, hub board + stream (SSE por payloadAsStream), ingreso QR,
// ordenes historial/pdf/stock-preview, predictions (+ml×3), pricing matrix/
// suggest, reference×3, tecnicos; inventory analytics turnover/dead-stock/
// reorder, auto-po, herramientas/control, initial-load batches, reports PDF×3,
// tecdoc×3, tool-instances×2, tool-loans×2, calibration, book-value:
// sin test 107 → 64 (0 GET de workshop/inventory restantes).
// CORRIGIÓ 3 bugs de producción en batch-inventory.service.ts: turnover,
// dead-stock y reorder consultaban la tabla fantasma `orden_items` +
// `ordenes_trabajo.fecha_ingreso` (no existen → 500 con o sin datos) y
// leían `(execute()).rows` (postgres-js devuelve el array directo) ⇒ ventas
// siempre 0 y todo marcado dead-stock con 999 días. Reescritas sobre
// `orden_repuestos` + `created_at`, iterando el array.
// Sprint 122 (lote 9 de lectura, fase7-s122-read-remaining, 51 tests): las 57
// rutas GET + 2 POST SIFEN que quedaban sin test fuera de EXCLUDED — api,
// analytics, audit, thinkcar, portal, docs, whatsapp, billing, config, crm,
// ws (SSE + websocket), reports, dvi, marketing, mobile, email, label, sync,
// scheduling, fleet, 2fa, sifen reenviar/nota-credito: sin test 64 → 5 (las 5
// restantes están en EXCLUDED del triaje → 0 no-excluidas sin test).
// CORRIGIÓ 1 bug de producción: GET /api/v1/locale/:lang estaba fuera de
// PUBLIC_PATHS y fuera de todo scope con resolveTenant → authGate devolvía
// 401 SIEMPRE (i18n.js y el SW fetchan sin Authorization) y las traducciones
// ES/GU del SPA legacy nunca cargaban → "/api/v1/locale/" en PUBLIC_PATHS.
// Sprint 123 (consumidores UI — lotes A-D, sin tests nuevos): la UI pasó a
// consumir 31 rutas GET/POST ya testeadas — locale, notifications poll,
// export options, audit log/export/verify/stats, perfil tenant, KPIs
// analytics, two-factor, label generate/payload, CRM stats + close, Thinkcar
// import detail, purchase-orders ×4 (lista/detalle/receive/cancel),
// herramientas/control (+filtro de estado y fix de aislamiento tenant),
// tool-loans/overdue, book-value y tool-instances/:id/calibrate → 111 → 80.
// Sprint 124 (consumidores UI — lotes workshop/marketing/DVI): la UI pasó a
// consumir 20 rutas — taller historial/stock-preview/estado/orden-estado,
// batch status+delete, tecnicos, trabajos-terceros PATCH, predictions,
// service-brand-map GET+PUT, marketing sequences (lista/crear/enroll/
// enrollments), reviews respond POST+DELETE, loyalty movements/points/redeem
// ×2, y DVI items/calculate-score/share → 80 → 60.
// Sprint 125 (consumidores UI — lotes SIFEN/nómina/diagnóstico/RG90): la UI
// pasó a consumir 24 rutas — SIFEN documentos/:id + sync-log + anular +
// contingencia/guardar, invoices/void, payroll summary GET+PATCH+DELETE,
// contabilidad cuadratura + mappings + validar + audit-log/:entidad/:entidadId
// + asientos/automatico + devengamiento/ajustes + depreciacion/activos/:id,
// rentabilidad dashboard/ot/cliente/mecanico, libro-compras-iva +
// libro-ventas-iva, y RG90 exportar + ventas + compras + retenciones
// → 60 → 36.
// Bajar con cada fix; jamás subir.
const CEILING_WITHOUT_CONSUMER = 0;
const CEILING_WITHOUT_TEST = 0;
const CEILING_WRITE_WITHOUT_TEST = 0;
/** Clase D de T-47: escritura ∧ sin consumidor ∧ sin test. El hallazgo
 *  estructural: "un POST sin consumidor solo se nota cuando corrompe datos".
 *  Materializado el triaje (92 → 61 → 48 → 40 → 30). Sprint 110 cerró 8 paths
 *  livianos → 22. Sprint 111 cerró los 19 de contabilidad
 *  (fase7-s111-contabilidad) → 3 restantes: las externas sifen/emitir,
 *  firmar y consultar-lote (llaman al DNIT — no ejercitar en tests).
 *  Sprint 112 las excluyó del triaje con justificación → 0. */
const CEILING_CLASS_D = 0;
/** Piso de exclusiones del triaje (38 al materializarlo: ~25 externas + ~11
 *  internas + variantes; 41 tras Sprint 112 con las 3 sifen del DNIT). Si baja,
 *  una ruta excluida fue borrada o dejó de existir — revisar que la exclusión
 *  siga justificada en Docs/T47. */
const FLOOR_EXCLUDED = 43;

interface RouteEntry {
  path: string;
  methods: string[];
}

interface ScanResult {
  total: number;
  withoutConsumer: RouteEntry[];
  withoutTest: RouteEntry[];
  excluded: RouteEntry[];
}

interface BehaviorResult {
  total: number;
  covered: number;
  ratio: number;
  gaps: Array<{ path: string; method: string }>;
}

describe("T-63 · guard de rutas sin consumidor", () => {
  let scan: ScanResult;
  let behavior: BehaviorResult;

  beforeAll(async () => {
    // Arranca la app real en un proceso hijo (scripts/dump-routes.ts): es la
    // única fuente fiable de rutas por los prefix anidados de Fastify.
    scan = (await scanRouteConsumers()) as ScanResult;
    // Mismo árbol de rutas (memoizado en el módulo) + pares método+URL de tests/.
    behavior = (await scanCriticalBehavior()) as BehaviorResult;
  }, 180_000);

  it("inventario real cargado", () => {
    expect(scan.total).toBeGreaterThan(400);
  });

  it("el número de rutas sin consumidor no crece", () => {
    const detail = scan.withoutConsumer
      .slice(0, 25)
      .map((r) => `    ${r.methods.join(",")} ${r.path}`)
      .join("\n");
    expect(
      scan.withoutConsumer.length,
      `hay ${scan.withoutConsumer.length} rutas sin consumidor (techo ${CEILING_WITHOUT_CONSUMER}). Consumir o ejercitar; ver Docs/T47_INVENTARIO_RUTAS_SIN_CONSUMIDOR.md:\n${detail}`,
    ).toBeLessThanOrEqual(CEILING_WITHOUT_CONSUMER);
  });

  it("el número de rutas sin test no crece", () => {
    const detail = scan.withoutTest
      .slice(0, 25)
      .map((r) => `    ${r.methods.join(",")} ${r.path}`)
      .join("\n");
    expect(
      scan.withoutTest.length,
      `hay ${scan.withoutTest.length} rutas sin test (techo ${CEILING_WITHOUT_TEST}). Toda ruta nueva debe traer un test que la ejercite:\n${detail}`,
    ).toBeLessThanOrEqual(CEILING_WITHOUT_TEST);
  });

  it("el número de rutas de ESCRITURA sin test no crece (backlog T-61)", () => {
    const write = scan.withoutTest.filter((r) =>
      r.methods.some((m) => ["POST", "PATCH", "PUT", "DELETE"].includes(m)),
    );
    const detail = write
      .slice(0, 25)
      .map((r) => `    ${r.methods.join(",")} ${r.path}`)
      .join("\n");
    expect(
      write.length,
      `hay ${write.length} rutas de escritura sin test (techo ${CEILING_WRITE_WITHOUT_TEST}):\n${detail}`,
    ).toBeLessThanOrEqual(CEILING_WRITE_WITHOUT_TEST);
  });

  it("las exclusiones del triaje no se pudren", () => {
    const detail = scan.excluded
      .slice(0, 40)
      .map((r) => `    ${r.methods.join(",")} ${r.path}`)
      .join("\n");
    expect(
      scan.excluded.length,
      `solo quedan ${scan.excluded.length} rutas excluidas (piso ${FLOOR_EXCLUDED}). Una ruta del triaje fue borrada o cambió de path — actualizar EXCLUDED y la tabla de Docs/T47_INVENTARIO_RUTAS_SIN_CONSUMIDOR.md:\n${detail}`,
    ).toBeGreaterThanOrEqual(FLOOR_EXCLUDED);
  });

  it("la clase D de T-47 (escritura sin consumidor NI test) no crece", () => {
    const orphanKeys = new Set(
      scan.withoutConsumer.map((r) => `${r.methods.filter((m) => m !== "GET").join(",")} ${r.path}`),
    );
    const classD = scan.withoutTest.filter((r) =>
      r.methods.some((m) => ["POST", "PATCH", "PUT", "DELETE"].includes(m)) &&
      orphanKeys.has(`${r.methods.filter((m) => m !== "GET").join(",")} ${r.path}`),
    );
    const detail = classD
      .slice(0, 25)
      .map((r) => `    ${r.methods.join(",")} ${r.path}`)
      .join("\n");
    expect(
      classD.length,
      `hay ${classD.length} rutas de clase D (techo ${CEILING_CLASS_D}). Triaje en Docs/T47_INVENTARIO_RUTAS_SIN_CONSUMIDOR.md:\n${detail}`,
    ).toBeLessThanOrEqual(CEILING_CLASS_D);
  });

  // ── T-61 ──────────────────────────────────────────────────────────────
  // Universo: pares (método, URL) de escritura de /workshop, /inventory y
  // /billing — el dominio transaccional del taller. El matching por path de
  // los techos de arriba no distingue verbos; este piso sí: un POST sin
  // ejercitar es comportamiento no probado, no solo "superficie".

  it("≥80% de los pares método+URL críticos tienen test de comportamiento (T-61)", () => {
    const pct = behavior.ratio * 100;
    const detail = behavior.gaps
      .slice(0, 40)
      .map((g) => `    ${g.method.padEnd(7)} ${g.path}`)
      .join("\n");
    expect(
      pct,
      `cobertura T-61 = ${pct.toFixed(1)}% (${behavior.covered}/${behavior.total} pares, piso ${
        BEHAVIOR_COVERAGE_FLOOR * 100
      }%). Faltan ${behavior.gaps.length} pares método+URL con app.inject:\n${detail}`,
    ).toBeGreaterThanOrEqual(BEHAVIOR_COVERAGE_FLOOR * 100);
  });
});
