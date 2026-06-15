/**
 * Workshop schema barrel — re-exports all table definitions, types and relations.
 *
 * Import from this file to access all workshop Drizzle ORM schemas:
 *
 * ```ts
 * import {
 *   vehiculos,
 *   ordenesTrabajo,
 *   ingresos,
 *   trabajosTerceros,
 *   tipoMotorEnum,
 *   estadoOrdenEnum,
 * } from "../schema/index.js";
 * ```
 *
 * @module workshop/schema/index
 */

// ─── Tables ───────────────────────────────────
export { vehiculos, tipoMotorEnum } from "./vehiculos.js";
export type { Vehiculo, NewVehiculo, TipoMotor } from "./vehiculos.js";

export { ordenesTrabajo, estadoOrdenEnum } from "./ordenes-trabajo.js";
export type { OrdenTrabajo, NewOrdenTrabajo, EstadoOrden } from "./ordenes-trabajo.js";

export { ingresos } from "./ingresos.js";
export type { Ingreso, NewIngreso } from "./ingresos.js";

export { trabajosTerceros, estadoTerceroEnum } from "./trabajos-terceros.js";
export type { TrabajoTercero, NewTrabajoTercero, EstadoTercero } from "./trabajos-terceros.js";

export { serviciosCatalogo } from "./servicios-catalogo.js";
export type { ServicioCatalogo, NewServicioCatalogo } from "./servicios-catalogo.js";

export { ordenServicios } from "./orden-servicios.js";
export type { OrdenServicio, NewOrdenServicio } from "./orden-servicios.js";

export { ordenRepuestos } from "./orden-repuestos.js";
export type { OrdenRepuesto, NewOrdenRepuesto } from "./orden-repuestos.js";

// ─── Relations ────────────────────────────────
export {
  vehiculosRelations,
  ordenesTrabajoRelations,
  ingresosRelations,
  trabajosTercerosRelations,
  serviciosCatalogoRelations,
  ordenServiciosRelations,
  ordenRepuestosRelations,
} from "./relations.js";
