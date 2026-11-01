# Plan — Hub de Operaciones y Recepción de Vehículo (aprobación por fases)

> **Estado:** propuesta para aprobación. No se modifica código hasta aprobar la Fase 1.
> **Objetivo:** separar correctamente en la recepción/OT los dominios que hoy están
> mezclados en `web/src/app/(dashboard)/dashboard/taller/[id]/page.tsx` (~1000 líneas)
> y en `recepcion/page.tsx`: Orden de Trabajo, consumo de repuestos, facturación y
> DVI (Digital Vehicle Inspection), y verificar que todo funcione.
> **Nota:** "DVID" = DVI (inspección digital del vehículo, `dviInspections`).

## Diagnóstico actual

- `taller/[id]/page.tsx` concentra en un solo componente: estado, mutaciones, fetch
  paralelo (ot/servicios/repuestos/terceros/ingresos/historial/firmas), stock preview,
  factura, WhatsApp, DVI y entrega. ~1000 líneas, ~40 hooks.
- Las pestañas ya existen (`resumen`, `servicios`, `repuestos`, `terceros`,
  `checklist`, `dvi`, `entrega`), pero el cuerpo de cada una vive inline en el
  mismo archivo, compartiendo estado y mutaciones → cambios en una pestaña
  re-renderizan todo y dificultan pruebas.
- Facturación (`issueInvoiceMut`) y stock preview están acoplados al detalle de OT.
- Recepción (`recepcion/page.tsx`) crea el ingreso + OT y salta a checklist;
  el DVI se consulta por OT pero no se crea desde la recepción.

## Fases propuestas

### Fase 0 — Baseline verde (sin cambios de código)
- Ejecutar `npm run typecheck`, `npm run lint`, `npm test` (web) y `npm run test:e2e`
  sobre el estado actual para fijar la línea base y detectar regresiones preexistentes.
- **Entregable:** reporte de baseline (errores/warnings/tests) antes de tocar nada.
- **Verificación:** todos los gates en verde o lista explícita de fallos preexistentes.

### Fase 1 — Extracción de componentes de pestaña (refactor sin cambio de comportamiento)
- Extraer de `taller/[id]/page.tsx` un componente por pestaña:
  - `components/taller/tabs/ResumenTab.tsx`
  - `components/taller/tabs/ServiciosTab.tsx`
  - `components/taller/tabs/RepuestosTab.tsx`
  - `components/taller/tabs/TercerosTab.tsx`
  - `components/taller/tabs/ChecklistTab.tsx`
  - `components/taller/tabs/DviTab.tsx`
  - `components/taller/tabs/EntregaTab.tsx`
- Mover las mutaciones (addServicio, deleteServicio, addRepuesto, deleteRepuesto,
  updateStatus) a hooks dedicados (`useOrdenMutations(id)`) para que cada tab
  consuma sólo lo que necesita.
- `page.tsx` queda como orquestador: fetch, tabs, header, status menu.
- **Regla:** cero cambios funcionales; sólo movimiento de código.
- **Verificación:** typecheck + lint web + smoke manual de las 7 pestañas.

### Fase 2 — Desacoplar facturación de la OT
- Mover `issueInvoiceMut` y el modal de factura a un componente/hook propio
  (`components/taller/IssueInvoiceModal.tsx` + `useIssueInvoice(id)`).
- La OT deja de conocer el tipo de facturación; el modal recibe `totalGeneral` y
  emite el evento `onInvoiced` que invalida `["orden-detail", id]`.
- Agregar guardas: no facturar si `status !== "Listo"` o si ya hay factura emitida.
- **Verificación:** emitir factura electrónica y manual en e2e; re-render del
  detalle no re-dispara la mutación.

### Fase 3 — Consumo de repuestos bien separado
- Separar "agregar repuesto a la OT" (línea de costo) de "consumo de stock"
  (que hoy ocurre al cerrar la OT). Hoy el stock preview es una vista previa;
  dejar explícito en UI: "el stock se descuenta al pasar a Listo/Finalizado".
- Extraer `RepuestosTab` con su propio estado de formulario y validación
  (cantidad > 0, precio > 0, repuesto del catálogo cuando exista).
- **Verificación:** agregar/eliminar repuesto, ver preview de stock, cerrar OT y
  confirmar descuento en inventario (test e2e).

### Fase 4 — DVI integrado pero desacoplado
- El tab DVI ya lista inspecciones; agregar acción "Nueva inspección DVI" que
  abre el flujo DVI con `ordenId` pre-cargado (hoy hay que ir a `/dashboard/dvi`).
- No mezclar el estado del DVI con el de la OT: el DVI es un recurso propio que
  referencia la OT.
- **Verificación:** crear DVI desde la OT y verlo listado en el tab.

### Fase 5 — Recepción: wizard claro y conexión con OT/DVI
- `recepcion/page.tsx`: mantener los 4 pasos (vehículo → checklist → firma →
  resumen) pero extraer cada paso a componente y tipar los payloads (hoy hay
  `as any`).
- Al crear la OT (`crearOrden`), enlazar el DVI opcional y mostrar el link al
  detalle de OT en el resumen (ya existe `ordenId`).
- Reemplazar `alert()` por toast y manejar errores de foto/upload.
- **Verificación:** flujo completo recepción → OT → checklist → firma.

### Fase 6 — Verificación integral
- `npm run typecheck` (web) 0 errores.
- `npm run lint` web: 0 errores (warnings aceptables, no nuevos).
- `npm test` web: suite verde.
- `npm run test:e2e` (Playwright, contra build de producción): agregar/ajustar
  specs para: recepción completa, cambio de estado de OT, agregar servicio y
  repuesto, emitir factura, crear DVI desde OT, firma de entrega.
- Backend: `npx tsc --noEmit` 0 y `npx vitest run` verde (ya verde tras F1).
- **Entregable:** checklist de verificación con resultado de cada gate.

## Riesgos y dependencias

- La extracción de Fase 1 toca el archivo más grande del frontend; conviene hacerla
  por pestaña y commitear por pestaña para poder revertir.
- `api.request` sin tipado (`as any`) se mantiene en Fase 1; el tipado fuerte es
  Fase 2+.
- DVI y recepción comparten el ingreso (`ingresoId`); no romper ese vínculo al
  refactorizar.
- No cambiar el backend en este plan salvo que aparezca un bug bloqueante.

## Criterio de aprobación

Aprobá las fases que querés que ejecute (todas, o un subconjunto) y el orden.
Por defecto propongo: F0 → F1 → F2 → F3 → F4 → F5 → F6, una fase por PR/commit
para mantener la trazabilidad (igual que Sprint 132).
SQL
echo "plan escrito"