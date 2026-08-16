-- 0020: Idempotencia contable — prevenir doble contabilización
-- ---------------------------------------------------------------------------
-- Problema: el accounting-bus (consumidor Kafka, at-least-once) crea asientos
-- con documentoRef = `<referenciaTipo>:<referenciaId>` sin check de dedup.
-- Una redelivery del mismo evento producía asientos duplicados (doble ingreso,
-- doble gasto, doble impuesto).
--
-- Solución: índice único PARCIAL sobre (documento_ref, modulo_origen) para
-- asientos CONTABILIZADOS con documento_ref no nulo.
--
-- Exclusión `NOT LIKE 'nota_%'`: las NC/ND comparten el ref
-- `nota_credito:<facturaId>` / `nota_debito:<facturaId>` y el negocio permite
-- MÚLTIPLES notas contra la misma factura (créditos parciales). Un único
-- asiento por ref rompería ese flujo legítimo.
--
-- Cubre: events del bus (FACTURA:<id>, INGRESO:<id>, ...), reversiones
-- (reversal:<asientoId>), nómina mensual, centralizaciones (CEN-*),
-- cierres (CIERRE-*), consolidaciones (RF-*).
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_asientos_documento_ref_contabilizado
  ON asientos_contables (documento_ref, modulo_origen)
  WHERE estado = 'CONTABILIZADO'
    AND documento_ref IS NOT NULL
    AND documento_ref NOT LIKE 'nota_%';
