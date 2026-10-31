/**
 * Password reset tokens — recuperación de contraseña (S132-9).
 *
 * Tabla pre-auth (sin RLS, igual que `profiles`): el pedido de reset
 * llega sin JWT y el canje se identifica por el hash del token, no por
 * el contexto de tenant. Ver la cabecera de la migración
 * `0038_password_reset_tokens.sql` para el criterio completo.
 *
 * Nunca se guarda el token en claro: `token_hash` es el SHA-256 del
 * token que viaja en el email.
 *
 * @module shared/database/schema/password-reset-tokens
 */

import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Perfil que puede canjear el token (ON DELETE CASCADE). */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Taller del perfil — se verifica al canjear. */
    tenantSlug: text("tenant_slug").notNull(),
    /** SHA-256 (hex) del token enviado por email. */
    tokenHash: text("token_hash").notNull(),
    /** Vigencia: 1 hora desde la emisión. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Momento del canje; `null` = pendiente. Un token se usa una vez. */
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** IP del pedido, para trazabilidad. */
    requestedIp: text("requested_ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("password_reset_tokens_token_hash_unique").on(
      table.tokenHash,
    ),
    profileIdx: index("password_reset_tokens_profile_idx").on(
      table.profileId,
      table.expiresAt,
    ),
  }),
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
