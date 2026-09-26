-- Migration 0025: 2FA (TOTP) secret storage — SEG-03 / T-21b
-- Server-side enrollment per admin profile:
--   * secret_encrypted  : AES-256-GCM, key derivada de TOKEN_SECRET (reusa encryptBuffer/decryptBuffer)
--   * backup_codes_hash : scrypt hashes ("salt:hash") de códigos de uso único
-- Nunca se persiste el secret en plaintext.
-- Los endpoints destructivos de backup (execute/restore/purge) fallan en
-- modo cerrado (403) cuando el admin no tiene enrollment.

CREATE TABLE IF NOT EXISTS two_factor_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  backup_codes_hash TEXT[] NOT NULL,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT two_factor_secrets_tenant_profile_unique UNIQUE (tenant_slug, profile_id)
);

CREATE INDEX IF NOT EXISTS two_factor_secrets_profile_idx ON two_factor_secrets (profile_id);
CREATE INDEX IF NOT EXISTS two_factor_secrets_tenant_idx ON two_factor_secrets (tenant_slug);
