-- 0032_loyalty_cliente_id_uuid.sql — fidelización: cliente_id pasa a uuid
--
-- Auditoría 2026-09-25 · Fase 4 (T-46 / CRM-02).
--
-- Problema: la migración 0028 creó `loyalty_accounts` / `loyalty_transactions`
-- con `cliente_id TEXT`, pero `clients.id` es UUID. El JOIN de
-- `getLoyaltyAccount` (`JOIN clients c ON c.id = la.cliente_id`) quedaba
--Operator does not exist: uuid = text, así que
-- GET /marketing/loyalty/:clienteId devolvía 500 SIEMPRE. El endpoint llevaba
-- meses "funcionando" porque solo había un GET y nadie lo ejercitó.
--
-- Se corrige el tipo en vez de castear el JOIN: `cliente_id` es una FK de
-- hecho, y castear en la consulta deja la puerta abierta a que otro servicio
-- reintroduzca la comparación rota y a que queden clientes inexistentes.
--
-- Idempotente: si `cliente_id` ya es uuid no hace nada. La conversión falla
-- ruidosamente si quedara algún cliente_id no-UUID, que es lo correcto: es un
-- dato corrupto que un CHECK silencioso ocultaría.
--
-- FKs con ON DELETE: el saldo del cliente es derivado de sus transacciones, no
-- un dato financiero; si se borra el cliente, sus puntos también.

-- ── loyalty_transactions: primero la tabla hija ────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_transactions'
      AND column_name = 'cliente_id'
      AND data_type = 'text'
  ) THEN
    -- Falla a propósito si algún cliente_id no es un UUID válido.
    EXECUTE 'ALTER TABLE loyalty_transactions
             ALTER COLUMN cliente_id TYPE uuid USING cliente_id::uuid';
    RAISE NOTICE 'loyalty_transactions.cliente_id convertido a uuid';
  END IF;
END $$;

-- ── loyalty_accounts ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_accounts'
      AND column_name = 'cliente_id'
      AND data_type = 'text'
  ) THEN
    EXECUTE 'ALTER TABLE loyalty_accounts
             ALTER COLUMN cliente_id TYPE uuid USING cliente_id::uuid';
    RAISE NOTICE 'loyalty_accounts.cliente_id convertido a uuid';
  END IF;
END $$;

-- ── Integridad referencial ─────────────────────────────────────────────────
-- La columna es UUID pero todavía no apunta a clients.id: sin esto, un UUID
-- arbitrario seguiría creando cuentas de fidelización de clientes inexistentes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'loyalty_accounts'::regclass
      AND conname = 'loyalty_accounts_cliente_fk'
  ) THEN
    ALTER TABLE loyalty_accounts
      ADD CONSTRAINT loyalty_accounts_cliente_fk
      FOREIGN KEY (cliente_id) REFERENCES clients (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'loyalty_transactions'::regclass
      AND conname = 'loyalty_transactions_cliente_fk'
  ) THEN
    ALTER TABLE loyalty_transactions
      ADD CONSTRAINT loyalty_transactions_cliente_fk
      FOREIGN KEY (cliente_id) REFERENCES clients (id) ON DELETE CASCADE;
  END IF;
END $$;
