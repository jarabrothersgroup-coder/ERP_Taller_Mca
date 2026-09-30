/**
 * T-61 — Lote 4: comportamiento del inventario de herramientas.
 *
 * Cierra 12 pares (método, URL) del universo crítico `/inventory` que no
 * tenían ningún test de comportamiento:
 *
 *   1. PATCH /inventory/herramientas/:id — unicidad de `codigo` (409),
 *      404 sobre un id inexistente y persistencia real de los campos
 *      multi-palabra (`numeroSerie`, `imagenUrl`, `requiereCalibracion`).
 *   2. POST/PATCH /inventory/tool-instances — creación del activo (201),
 *      serial repetido (422), body incompleto (400) y la máquina de estados:
 *      calibrate (DISPONIBLE → EN_CALIBRACION), complete-calibration
 *      (→ DISPONIBLE con `proximaCalibracion` persistida), complete-repair
 *      (EN_REPARACION → DISPONIBLE) y decommission (→ DADO_DE_BAJA con
 *      `activa=false`, `valorActualLibros=0` y el custodio limpiado), cada
 *      uno con su transición inválida → 422.
 *   3. POST /inventory/herramientas/prestar — resuelve la primera unidad
 *      DISPONIBLE del SKU, deja la instancia en PRESTADA y crea el control
 *      de préstamo **en el tenant del taller**; POST
 *      /inventory/herramientas/control/:id/devolver — cierra el préstamo
 *      (Devuelto_Bueno) y devuelve la instancia a DISPONIBLE.
 *   4. POST/PATCH /inventory/tool-service-events — 400 por `tipo` fuera del
 *      enum o por `toolInstanceId` ausente, 404 por instancia/evento
 *      inexistente y transición a COMPLETADO.
 *   5. POST /inventory/tools/depreciation/calculate — genera un asiento por
 *      activo elegible del tenant y 400 si `periodo` no es `YYYY-MM`.
 *   6. PATCH /inventory/repuestos/:id — el par ya figuraba como cubierto solo
 *      por un 404 cross-tenant; aquí se prueba el happy path: los campos
 *      multi-palabra (`precioVenta`, `precioCosto`, `codigoBarras`,
 *      `stockMinimo`, `imagenUrl`) llegan a la fila (lectura en crudo).
 *
 * Bugs corregidos en `src/` para no enshrinar comportamiento roto (todos con
 * comentario `FIX (T-61)` en su sitio):
 *
 *   - `prestarHerramienta`/`devolverHerramienta` no le pasaban el tenant a
 *     `lendTool`/`returnTool`, que filtran por `tenant_slug = ''`: TODO
 *     préstamo/devolución devolvía 404 en un taller real.
 *   - Los `response` schema de esas rutas declaraban `control` mientras los
 *     servicios devuelven `{ loan }` → la respuesta serializada era `{}`.
 *   - **drizzle descarta en silencio las claves snake_case de `.set()`**
 *     (recorre solo las columnas por su nombre JS): `updateHerramienta` y
 *     `updateRepuesto` ignoraban todo campo multi-palabra con un 200
 *     aparente, `transitionState` no limpiaba al custodio al dar de baja o
 *     extraviar el activo, y un SET quedaba vacío (`update … set  where …`)
 *     → 500.
 *   - `decommissionTool` pasaba un `Date` a la columna `date` `fecha_baja`
 *     (drizzle en modo string no convierte) → 500; ahora `'YYYY-MM-DD'`.
 *   - `updateServiceEvent` escribía `fecha_fin`/`certificado_url` y
 *     `herramientas`/`stock` `updated_at` con claves snake_case → ignoradas.
 *   - Los enums de condición `"Dañado"` estaban en NFD y el cliente estándar
 *     envía NFC → 400; ahora se aceptan ambas formas y el servicio normaliza.
 *
 * Convenciones T-48/T-61: schema inválido → 400, ValidationError → 422,
 * NotFoundError → 404, ConflictError → 409, POST → 201, escritura OK → 200.
 *
 * @module tests/fase6-t61-inventario
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

const T = "e2e-t61-inventario";
const T_ID = "00000000-0000-0000-0000-0000f4630001";
const ADMIN = "00000000-0000-0000-0000-0000f4630010";
const MECH = "00000000-0000-0000-0000-0000f4630011";
const CLIENTE = "00000000-0000-0000-0000-0000f4630997";
const VEHICULO = "00000000-0000-0000-0000-0000f4630998";
const OT = "00000000-0000-0000-0000-0000f4630996";
const EMAIL = "admin@e2e-t61-inventario.test";
const MISSING = "00000000-0000-0000-0000-0000f463dead";

const SKU_INST = "T61-INV-INST";
const SKU_PREST = "T61-INV-PREST";

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;
let skuInst: string;
let skuPrest: string;
let instCal: string;
let instRep: string;
let instBaja: string;
let instPrest: string;
let controlId: string;
let eventoId: string;

describe("T-61 · inventario de herramientas (SKU, activos, préstamos, eventos, depreciación)", () => {
  beforeAll(async () => {
    const sql = getDb() as any;
    await sql`INSERT INTO tenants (id, name, slug, schema_name, is_active)
      VALUES (${T_ID}, ${T}, ${T}, ${T}, true) ON CONFLICT (slug) DO NOTHING`;
    // Idempotencia: `codigo` de repuesto es único global (no por tenant) y una
    // corrida anterior puede haber dejado la fila — sin esto, re-ejecutar el
    // fichero daría 409 en el POST del test 6.
    await sql`DELETE FROM repuestos WHERE tenant_slug = ${T}`;
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${ADMIN}, ${T_ID}, ${EMAIL}, 'Admin T61 Inv', 'admin', true),
             (${MECH}, ${T_ID}, 'mecanico@e2e-t61-inventario.test', 'Mecánico T61 Inv', 'mechanic', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET is_active = true`;
    // El préstamo exige una OT viva (lendTool la busca por id).
    await sql`INSERT INTO clients (id, name, tenant_slug)
      VALUES (${CLIENTE}, ${"Cliente T61 Inv"}, ${T}) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO vehiculos (id, client_id, brand, model, engine_type, tenant_slug)
      VALUES (${VEHICULO}, ${CLIENTE}, ${"Toyota"}, ${"Hilux"}, ${"Nafta"}, ${T})
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug)
      VALUES (${OT}, ${VEHICULO}, ${CLIENTE}, ${"En_Proceso"}, ${T})
      ON CONFLICT (id) DO UPDATE SET status = 'En_Proceso'`;

    app = await buildApp();
    await app.ready();
    token = generateToken({
      id: ADMIN,
      email: EMAIL,
      role: "admin",
      tenantId: T_ID,
      tenantSlug: T,
    });

    // Dos SKUs: uno para los activos del ciclo de vida y otro dedicado al
    // préstamo (prestarHerramienta resuelve "la primera unidad DISPONIBLE"
    // del SKU, así que se aísla para no interferir con los demás tests).
    const a = await app.inject({
      method: "POST",
      url: "/inventory/herramientas",
      headers: auth(),
      body: { codigo: SKU_INST, nombre: "T61 Multímetro digital", categoria: "Medición" },
    });
    expect(a.statusCode).toBe(201);
    skuInst = a.json().id;

    const b = await app.inject({
      method: "POST",
      url: "/inventory/herramientas",
      headers: auth(),
      body: { codigo: SKU_PREST, nombre: "T61 Llave dinamométrica", categoria: "Manuales" },
    });
    expect(b.statusCode).toBe(201);
    skuPrest = b.json().id;

    // La depreciación es un cálculo sobre el catálogo (`vida_util_anos`), que
    // la ruta no acepta en el body → se siembra por SQL.
    await sql`UPDATE herramientas
      SET vida_util_anos = 5, metodo_depreciacion = 'LINEA_RECTA'
      WHERE id = ${skuInst}`;

    const base = {
      costoAdquisicion: 1200000,
      fechaAdquisicion: "2026-01-15",
      ubicacionActual: "Banco de trabajo",
    };
    instRep = await crearActivo(skuInst, "T61-SERIE-REP", base);
    instBaja = await crearActivo(skuInst, "T61-SERIE-BAJA", base);
    instPrest = await crearActivo(skuPrest, "T61-SERIE-PREST", base);
    // Fixture: el repair solo es válido desde EN_REPARACION (la transición
    // DISPONIBLE → DISPONIBLE está prohibida por la máquina de estados).
    await sql`UPDATE tool_instances SET estado_actual = 'EN_REPARACION' WHERE id = ${instRep}`;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    const sql = getDb() as any;
    const limpiar = [
      `DELETE FROM tool_depreciation_entries WHERE tenant_slug = '${T}'`,
      `DELETE FROM tool_maintenance_events WHERE tenant_slug = '${T}'`,
      `DELETE FROM control_herramientas WHERE tenant_slug = '${T}'`,
      `DELETE FROM tool_instances WHERE tenant_slug = '${T}'`,
      `DELETE FROM herramientas WHERE tenant_slug = '${T}'`,
      `DELETE FROM repuestos WHERE tenant_slug = '${T}'`,
      `DELETE FROM orden_estado_historial WHERE orden_trabajo_id IN (SELECT id FROM ordenes_trabajo WHERE tenant_slug = '${T}')`,
      `DELETE FROM ordenes_trabajo WHERE tenant_slug = '${T}'`,
      `DELETE FROM vehiculos WHERE id = '${VEHICULO}'`,
      `DELETE FROM clients WHERE id = '${CLIENTE}'`,
      `DELETE FROM audit_log WHERE tenant_slug = '${T}'`,
      `DELETE FROM profiles WHERE tenant_id = '${T_ID}'`,
      `DELETE FROM tenants WHERE id = '${T_ID}'`,
    ];
    for (const stmt of limpiar) {
      try {
        await sql.unsafe(stmt);
      } catch (err) {
        console.error("[t61-inventario] cleanup falló:", stmt, err);
      }
    }
  }, 120_000);

  const auth = () => ({ authorization: `Bearer ${token}`, "x-tenant-slug": T });
  // createServiceEvent persiste `realizada_por_id` → exige un profile real.
  const authUser = () => ({ ...auth(), "x-user-id": ADMIN });

  async function crearActivo(
    herramientaId: string,
    numeroSerie: string,
    extra: Record<string, unknown>,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/tool-instances",
      headers: auth(),
      body: { herramientaId, numeroSerie, ...extra },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id;
  }

  async function columna<T = Record<string, unknown>>(
    stmt: (sql: any) => Promise<T[]>,
  ): Promise<T[]> {
    const sql = getDb() as any;
    return stmt(sql);
  }

  // ── 1. PATCH /inventory/herramientas/:id ────────────────────────────────
  it("PATCH actualiza el SKU; código repetido → 409 e id inexistente → 404", async () => {
    const ok = await app.inject({
      method: "PATCH",
      url: `/inventory/herramientas/${skuInst}`,
      headers: auth(),
      body: {
        marca: "Fluke",
        modelo: "87V",
        ubicacion: "Banco 2",
        // FIX (T-61): multi-palabra. El servicio las pasaba a snake_case y
        // drizzle descarta la clave que no es el nombre JS de la columna →
        // respondía 200 con la fila intacta.
        numeroSerie: "T61-INV-SERIE-01",
        imagenUrl: "/storage/t61-inv.png",
        requiereCalibracion: true,
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      id: skuInst,
      marca: "Fluke",
      modelo: "87V",
      ubicacion: "Banco 2",
      numeroSerie: "T61-INV-SERIE-01",
      imagenUrl: "/storage/t61-inv.png",
      requiereCalibracion: true,
      tenantSlug: T,
    });

    const persistido = await columna((sql) =>
      sql`SELECT numero_serie, imagen_url, requiere_calibracion
          FROM herramientas WHERE id = ${skuInst}`,
    );
    expect(persistido[0]).toMatchObject({
      numero_serie: "T61-INV-SERIE-01",
      imagen_url: "/storage/t61-inv.png",
      requiere_calibracion: true,
    });

    const dup = await app.inject({
      method: "PATCH",
      url: `/inventory/herramientas/${skuInst}`,
      headers: auth(),
      body: { codigo: SKU_PREST },
    });
    expect(dup.statusCode).toBe(409);

    const missing = await app.inject({
      method: "PATCH",
      url: `/inventory/herramientas/${MISSING}`,
      headers: auth(),
      body: { marca: "Nunca" },
    });
    expect(missing.statusCode).toBe(404);
  });

  // ── 2a. POST /inventory/tool-instances ──────────────────────────────────
  it("POST crea el activo (201) y valida serial repetido (422) o body incompleto (400)", async () => {
    const sinCampos = await app.inject({
      method: "POST",
      url: "/inventory/tool-instances",
      headers: auth(),
      body: { herramientaId: skuInst },
    });
    expect(sinCampos.statusCode).toBe(400);

    const ok = await app.inject({
      method: "POST",
      url: "/inventory/tool-instances",
      headers: auth(),
      body: {
        herramientaId: skuInst,
        numeroSerie: "T61-SERIE-CAL",
        costoAdquisicion: 1200000,
        fechaAdquisicion: "2026-01-15",
        requiereCalibracion: true,
        diasIntervaloCalibracion: 180,
        ubicacionActual: "Banco de trabajo",
      },
    });
    expect(ok.statusCode).toBe(201);
    instCal = ok.json().id;
    expect(ok.json()).toMatchObject({
      herramientaId: skuInst,
      numeroSerie: "T61-SERIE-CAL",
      estadoActual: "DISPONIBLE",
      activa: true,
      tenantSlug: T,
    });

    const dup = await app.inject({
      method: "POST",
      url: "/inventory/tool-instances",
      headers: auth(),
      body: {
        herramientaId: skuInst,
        numeroSerie: "T61-SERIE-CAL",
        costoAdquisicion: 1000,
        fechaAdquisicion: "2026-02-01",
      },
    });
    expect(dup.statusCode).toBe(422);
  });

  // ── 2b. PATCH /inventory/tool-instances/:id ─────────────────────────────
  it("PATCH actualiza el activo persistiendo el cambio (404 si no existe)", async () => {
    const ok = await app.inject({
      method: "PATCH",
      url: `/inventory/tool-instances/${instCal}`,
      headers: auth(),
      body: { ubicacionActual: "Banco 3", tagRfid: "RFID-T61-1" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      id: instCal,
      ubicacionActual: "Banco 3",
      tagRfid: "RFID-T61-1",
    });

    const filas = await columna((sql) =>
      sql`SELECT ubicacion_actual FROM tool_instances WHERE id = ${instCal}`,
    );
    expect(filas[0].ubicacion_actual).toBe("Banco 3");

    const missing = await app.inject({
      method: "PATCH",
      url: `/inventory/tool-instances/${MISSING}`,
      headers: auth(),
      body: { ubicacionActual: "Nunca" },
    });
    expect(missing.statusCode).toBe(404);
  });

  // ── 2c. POST .../calibrate ──────────────────────────────────────────────
  it("calibrate mueve el activo a EN_CALIBRACION y prohíbe repetir la transición", async () => {
    const ok = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instCal}/calibrate`,
      headers: auth(),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ id: instCal, estadoActual: "EN_CALIBRACION" });

    const repetir = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instCal}/calibrate`,
      headers: auth(),
    });
    expect(repetir.statusCode).toBe(422);

    const missing = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${MISSING}/calibrate`,
      headers: auth(),
    });
    expect(missing.statusCode).toBe(404);
  });

  // ── 2d. POST .../complete-calibration ───────────────────────────────────
  it("complete-calibration devuelve DISPONIBLE y persiste la próxima calibración", async () => {
    const ok = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instCal}/complete-calibration`,
      headers: auth(),
      body: { proximaCalibracion: "2027-06-01", resultado: "Conforme" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ id: instCal, estadoActual: "DISPONIBLE" });
    expect(String(ok.json().proximaCalibracion)).toContain("2027-06-01");

    const filas = await columna((sql) =>
      sql`SELECT estado_actual, proxima_calibracion FROM tool_instances WHERE id = ${instCal}`,
    );
    expect(filas[0].estado_actual).toBe("DISPONIBLE");
    expect(String(filas[0].proxima_calibracion)).toContain("2027-06-01");

    // DISPONIBLE → DISPONIBLE no es una transición permitida.
    const repetir = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instCal}/complete-calibration`,
      headers: auth(),
      body: { proximaCalibracion: "2027-12-01" },
    });
    expect(repetir.statusCode).toBe(422);
  });

  // ── 2e. POST .../complete-repair ────────────────────────────────────────
  it("complete-repair solo actúa sobre un activo EN_REPARACION", async () => {
    const sobreDisp = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instCal}/complete-repair`,
      headers: auth(),
    });
    expect(sobreDisp.statusCode).toBe(422);

    const ok = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instRep}/complete-repair`,
      headers: auth(),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ id: instRep, estadoActual: "DISPONIBLE" });
  });

  // ── 3a. POST /inventory/herramientas/prestar ────────────────────────────
  it("prestar resuelve la unidad DISPONIBLE del SKU y crea el control en el tenant", async () => {
    const sinCampos = await app.inject({
      method: "POST",
      url: "/inventory/herramientas/prestar",
      headers: auth(),
      body: { herramientaId: skuPrest },
    });
    expect(sinCampos.statusCode).toBe(400);

    const sinOt = await app.inject({
      method: "POST",
      url: "/inventory/herramientas/prestar",
      headers: auth(),
      body: { herramientaId: skuPrest, ordenTrabajoId: MISSING, mecanicoId: MECH },
    });
    expect(sinOt.statusCode).toBe(404);

    const sinMecanico = await app.inject({
      method: "POST",
      url: "/inventory/herramientas/prestar",
      headers: auth(),
      body: { herramientaId: skuPrest, ordenTrabajoId: OT, mecanicoId: MISSING },
    });
    expect(sinMecanico.statusCode).toBe(404);

    const ok = await app.inject({
      method: "POST",
      url: "/inventory/herramientas/prestar",
      headers: auth(),
      body: {
        herramientaId: skuPrest,
        ordenTrabajoId: OT,
        mecanicoId: MECH,
        observaciones: "T-61 préstamo",
      },
    });
    expect(ok.statusCode).toBe(201);
    const loan = ok.json().loan;
    expect(loan).toMatchObject({
      ordenTrabajoId: OT,
      mecanicoId: MECH,
      toolInstanceId: instPrest,
      estado: "Asignado",
      mecanicoNombre: "Mecánico T61 Inv",
    });
    controlId = loan.id;
    expect(controlId).toBeTruthy();

    // Regresión del fix: el control se escribe en el tenant del taller.
    const controles = await columna((sql) =>
      sql`SELECT tenant_slug, estado FROM control_herramientas WHERE id = ${controlId}`,
    );
    expect(controles[0].tenant_slug).toBe(T);
    expect(controles[0].estado).toBe("Asignado");

    const activos = await columna((sql) =>
      sql`SELECT estado_actual, tecnico_actual_id, orden_trabajo_actual_id
          FROM tool_instances WHERE id = ${instPrest}`,
    );
    expect(activos[0].estado_actual).toBe("PRESTADA");
    expect(activos[0].tecnico_actual_id).toBe(MECH);
    expect(activos[0].orden_trabajo_actual_id).toBe(OT);

    // Sin unidades DISPONIBLES del SKU → 422 (no duplica el préstamo).
    const sinUnidades = await app.inject({
      method: "POST",
      url: "/inventory/herramientas/prestar",
      headers: auth(),
      body: { herramientaId: skuPrest, ordenTrabajoId: OT, mecanicoId: MECH },
    });
    expect(sinUnidades.statusCode).toBe(422);
  });

  // ── 3b. POST .../decommission ──────────────────────────────────────────
  it("decommission da de baja el activo, lo limpia de su custodio; repetida o prestada → 422", async () => {
    // FIX (T-61): la limpieza del custodio iba con claves snake_case
    // (drizzle las descarta) — el activo dado de baja conservaba técnico y OT.
    await columna((sql) =>
      sql`UPDATE tool_instances
          SET tecnico_actual_id = ${MECH}, orden_trabajo_actual_id = ${OT}
          WHERE id = ${instBaja}`,
    );

    const ok = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instBaja}/decommission`,
      headers: auth(),
      body: { motivoBaja: "Fin de vida útil", fechaBaja: "2026-09-30" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      id: instBaja,
      estadoActual: "DADO_DE_BAJA",
      activa: false,
      motivoBaja: "Fin de vida útil",
      valorActualLibros: "0.00",
    });

    const baja = await columna((sql) =>
      sql`SELECT tecnico_actual_id, orden_trabajo_actual_id,
                 to_char(fecha_baja, 'YYYY-MM-DD') AS fecha_baja_iso
          FROM tool_instances WHERE id = ${instBaja}`,
    );
    expect(baja[0].tecnico_actual_id).toBeNull();
    expect(baja[0].orden_trabajo_actual_id).toBeNull();
    expect(baja[0].fecha_baja_iso).toBe("2026-09-30");

    const repetir = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instBaja}/decommission`,
      headers: auth(),
      body: { motivoBaja: "Otra vez" },
    });
    expect(repetir.statusCode).toBe(422);

    // Regla de negocio: no se da de baja una herramienta prestada.
    const prestada = await app.inject({
      method: "POST",
      url: `/inventory/tool-instances/${instPrest}/decommission`,
      headers: auth(),
      body: { motivoBaja: "Robo reportado" },
    });
    expect(prestada.statusCode).toBe(422);
  });

  // ── 3c. POST /inventory/herramientas/control/:id/devolver ───────────────
  it("devolver cierra el préstamo y devuelve la instancia a DISPONIBLE", async () => {
    const missing = await app.inject({
      method: "POST",
      url: `/inventory/herramientas/control/${MISSING}/devolver`,
      headers: auth(),
      body: { estado: "Devuelto" },
    });
    expect(missing.statusCode).toBe(404);

    // El endpoint no acepta `costoReparacion` → "Dañado" nunca pasa la
    // validación de returnTool (422): documentado para no enshrinuarlo.
    const danado = await app.inject({
      method: "POST",
      url: `/inventory/herramientas/control/${controlId}/devolver`,
      headers: auth(),
      body: { estado: "Dañado" },
    });
    expect(danado.statusCode).toBe(422);

    const ok = await app.inject({
      method: "POST",
      url: `/inventory/herramientas/control/${controlId}/devolver`,
      headers: auth(),
      body: { estado: "Devuelto", observaciones: "Sin novedad" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().loan).toMatchObject({
      id: controlId,
      estado: "Devuelto_Bueno",
      condicionRetorno: "BUENO",
      ordenTrabajoId: OT,
    });
    expect(ok.json().loan.fechaDevolucion).toBeTruthy();

    const controles = await columna((sql) =>
      sql`SELECT estado, tenant_slug FROM control_herramientas WHERE id = ${controlId}`,
    );
    expect(controles[0].estado).toBe("Devuelto_Bueno");
    expect(controles[0].tenant_slug).toBe(T);

    const activos = await columna((sql) =>
      sql`SELECT estado_actual, tecnico_actual_id FROM tool_instances WHERE id = ${instPrest}`,
    );
    expect(activos[0].estado_actual).toBe("DISPONIBLE");
    expect(activos[0].tecnico_actual_id).toBeNull();

    const repetir = await app.inject({
      method: "POST",
      url: `/inventory/herramientas/control/${controlId}/devolver`,
      headers: auth(),
      body: { estado: "Devuelto" },
    });
    expect(repetir.statusCode).toBe(422);
  });

  // ── 4a. POST /inventory/tool-service-events ─────────────────────────────
  it("POST crea el evento de servicio (201) y valida enum/instancia", async () => {
    const sinInstancia = await app.inject({
      method: "POST",
      url: "/inventory/tool-service-events",
      headers: authUser(),
      body: { tipo: "INSPECCION" },
    });
    expect(sinInstancia.statusCode).toBe(400);

    const tipoInvalido = await app.inject({
      method: "POST",
      url: "/inventory/tool-service-events",
      headers: authUser(),
      body: { toolInstanceId: instCal, tipo: "INVENTARIO_ANUAL" },
    });
    expect(tipoInvalido.statusCode).toBe(400);

    const inexistente = await app.inject({
      method: "POST",
      url: "/inventory/tool-service-events",
      headers: authUser(),
      body: { toolInstanceId: MISSING, tipo: "INSPECCION" },
    });
    expect(inexistente.statusCode).toBe(404);

    const ok = await app.inject({
      method: "POST",
      url: "/inventory/tool-service-events",
      headers: authUser(),
      body: {
        toolInstanceId: instCal,
        tipo: "MANTENIMIENTO_PREVENTIVO",
        observaciones: "T-61 preventivo",
        costo: 50000,
      },
    });
    expect(ok.statusCode).toBe(201);
    eventoId = ok.json().id;
    expect(ok.json()).toMatchObject({
      toolInstanceId: instCal,
      tipo: "MANTENIMIENTO_PREVENTIVO",
      estado: "EN_PROCESO",
      tenantSlug: T,
      costo: "50000.00",
    });
    expect(ok.json().realizadaPorId).toBe(ADMIN);
  });

  // ── 4b. PATCH /inventory/tool-service-events/:id ────────────────────────
  it("PATCH completa el evento (COMPLETADO) y 404 sobre uno inexistente", async () => {
    const ok = await app.inject({
      method: "PATCH",
      url: `/inventory/tool-service-events/${eventoId}`,
      headers: authUser(),
      body: {
        estado: "COMPLETADO",
        fechaFin: "2026-09-30",
        resultado: "Sin observaciones",
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      id: eventoId,
      estado: "COMPLETADO",
      resultado: "Sin observaciones",
    });
    expect(ok.json().fechaFin).toBeTruthy();

    // Un preventivo no mueve la máquina de estados del activo.
    const filas = await columna((sql) =>
      sql`SELECT estado_actual FROM tool_instances WHERE id = ${instCal}`,
    );
    expect(filas[0].estado_actual).toBe("DISPONIBLE");

    const missing = await app.inject({
      method: "PATCH",
      url: `/inventory/tool-service-events/${MISSING}`,
      headers: authUser(),
      body: { estado: "COMPLETADO" },
    });
    expect(missing.statusCode).toBe(404);
  });

  // ── 5. POST /inventory/tools/depreciation/calculate ─────────────────────
  it("depreciación genera un asiento por activo elegible y valida el periodo", async () => {
    const invalido = await app.inject({
      method: "POST",
      url: "/inventory/tools/depreciation/calculate",
      headers: auth(),
      body: { periodo: "2026-09-30" },
    });
    expect(invalido.statusCode).toBe(400);

    const ok = await app.inject({
      method: "POST",
      url: "/inventory/tools/depreciation/calculate",
      headers: auth(),
      body: { periodo: "2026-09" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().periodo).toBe("2026-09");
    // instCal + instRep (el activo dado de baja queda excluido y el SKU de
    // préstamo no tiene vida útil definida).
    expect(ok.json().entriesCreated).toBeGreaterThanOrEqual(2);
    expect(Number(ok.json().totalDepreciation)).toBeGreaterThan(0);

    const filas = await columna((sql) =>
      sql`SELECT count(*)::int AS n FROM tool_depreciation_entries
          WHERE tenant_slug = ${T} AND periodo = '2026-09'`,
    );
    expect(filas[0].n).toBeGreaterThanOrEqual(2);

    const historial = await app.inject({
      method: "GET",
      url: `/inventory/tools/depreciation/${instCal}`,
      headers: auth(),
    });
    expect(historial.statusCode).toBe(200);
    expect(historial.json().length).toBeGreaterThanOrEqual(1);
  });

  // ── 6. PATCH /inventory/repuestos/:id ───────────────────────────────────
  it("PATCH del repuesto persiste los campos multi-palabra (antes se ignoraban)", async () => {
    const creado = await app.inject({
      method: "POST",
      url: "/inventory/repuestos",
      headers: auth(),
      body: {
        codigo: "T61-REP-1",
        descripcion: "Filtro de aceite T61",
        precioCosto: 10000,
        precioVenta: 15000,
        stockActual: 5,
        stockMinimo: 2,
      },
    });
    expect(creado.statusCode, creado.body).toBe(201);
    const repId = creado.json().id;

    const ok = await app.inject({
      method: "PATCH",
      url: `/inventory/repuestos/${repId}`,
      headers: auth(),
      body: {
        precioVenta: 17500,
        precioCosto: 11000,
        codigoBarras: "7840000000001",
        stockMinimo: 4,
        imagenUrl: "/storage/t61-rep.png",
      },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(Number(ok.json().precioVenta)).toBe(17500);
    expect(ok.json().codigoBarras).toBe("7840000000001");

    // Verificación en crudo: el 200 no basta, el SET debe haber llegado a la fila.
    const filas = await columna((sql) =>
      sql`SELECT precio_venta, precio_costo, codigo_barras, stock_minimo, imagen_url
          FROM repuestos WHERE id = ${repId}`,
    );
    expect(Number(filas[0].precio_venta)).toBe(17500);
    expect(Number(filas[0].precio_costo)).toBe(11000);
    expect(filas[0].codigo_barras).toBe("7840000000001");
    expect(Number(filas[0].stock_minimo)).toBe(4);
    expect(filas[0].imagen_url).toBe("/storage/t61-rep.png");
  });
});
