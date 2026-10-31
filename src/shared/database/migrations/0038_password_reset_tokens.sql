-- 0038_password_reset_tokens.sql — recuperación de contraseña (S132-9)
--
-- Cierra el último hueco funcional de Fase 1: /forgot-password era un
-- stub de Clerk (setTimeout) y no existía backend de reset. Sin esto,
-- un usuario que olvidaba su contraseña quedaba sin acceso y el único
-- camino era que un admin le reescribiera el hash a mano en la base.
--
-- Diseño:
--   * Token opaco de 32 bytes (base64url) generado con CSPRNG; en la
--     base se guarda SOLO el SHA-256 (token_hash). Un dump de la tabla
--     no permite canjear enlaces.
--   * TTL 1 hora, un solo uso. Al emitir un token nuevo se invalidan
--     (used_at) los pendientes del mismo perfil, y al consumirlo se
--     invalidan todos los demás: un enlace viejo no sobrevive.
--   * tenant_slug denormalizado para que el canje verifique el taller
--     sin lookup extra y para auditoría.
--   * requested_ip: trazabilidad del pedido (la ruta está rate-limited
--     por ip+tenant+email).
--
-- RLS: la tabla queda FUERA de las policies, con el mismo criterio
-- documentado en 0019/0037 para `profiles`: es una tabla pre-auth (el
-- pedido de reset llega sin JWT ni contexto de tenant, y el canje se
-- identifica por el hash del token, no por app.current_tenant). Un RLS
-- fail-closed acá rompería la recuperación de contraseña bajo el rol
-- least-privilege de S132-8. El aislamiento se garantiza en la
-- aplicación: toda consulta filtra por token_hash y tenant_slug.
--
-- Retención: los tokens vencidos/usados no se borran solos. La limpieza
-- (DELETE WHERE expires_at < now() - interval '30 days') queda como
-- tarea de mantenimiento; el volumen es despreciable.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_slug   text NOT NULL,
  token_hash    text NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  requested_ip  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Un token (hash) no puede existir dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_unique
  ON public.password_reset_tokens (token_hash);

-- Búsqueda del token vigente de un perfil al emitir uno nuevo.
CREATE INDEX IF NOT EXISTS password_reset_tokens_profile_idx
  ON public.password_reset_tokens (profile_id, expires_at DESC);
