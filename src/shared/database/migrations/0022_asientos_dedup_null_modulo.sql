-- 0022: Fix idempotencia de asientos — NULL modulo_origen eludía el dedup
-- ---------------------------------------------------------------------------
-- Problema: el índice único parcial 0020 (documento_ref, modulo_origen)
-- NO bloqueaba asientos con modulo_origen NULL, porque en PostgreSQL los
-- índices únicos tratan NULLs como distintos por defecto.
--
-- Los asientos creados por el accounting-bus SIEMPRE llevan modulo_origen
-- (MODULE_MAP con fallback "SISTEMA"), pero el endpoint manual
-- POST /finance/contabilidad/asientos NO lo setea → doble click o retry
-- duplicaban la contabilización silenciosamente (doble ingreso/gasto/IVA).
--
-- Solución: NULLS NOT DISTINCT (PostgreSQL 15+) — (ref, NULL) y (ref, NULL)
-- ahora colisionan. Se conserva la exclusión nota_% (múltiples NC/ND contra
-- la misma factura siguen permitidas).
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS uq_asientos_documento_ref_contabilizado;

CREATE UNIQUE INDEX uq_asientos_documento_ref_contabilizado
  ON asientos_contables (documento_ref, modulo_origen) NULLS NOT DISTINCT
  WHERE estado = 'CONTABILIZADO'
    AND documento_ref IS NOT NULL
    AND documento_ref NOT LIKE 'nota_%';
