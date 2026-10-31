/**
 * Password Reset Service — recuperación de contraseña (S132-9).
 *
 * Flujo en dos pasos, sin enumeración de usuarios:
 *
 *   1. `requestPasswordReset({ tenantSlug, email, ip })`
 *      — Rate-limited por ip+taller+email (3/hora).
 *      — Si el taller o el email no existen, la respuesta es idéntica y
 *        no se envía nada: un atacante no puede distinguir «existe» de
 *        «no existe».
 *      — Genera un token opaco (32 bytes CSPRNG, base64url), guarda SOLO
 *        su SHA-256, invalida los tokens pendientes anteriores y envía
 *        el enlace por email (Resend si está configurado, SMTP si no).
 *
 *   2. `resetPassword({ tenantSlug, token, password })`
 *      — Canje de un solo uso y 1 hora de vigencia.
 *      — Al canjear, marca usados todos los tokens del perfil y
 *        reemplaza el hash de la contraseña (scrypt, ver auth-utils).
 *      — Error genérico ante token inválido/vencido/usado: no se
 *        revela cuál de los tres falló.
 *
 * Limitación conocida: los JWT ya emitidos siguen siendo válidos hasta
 * expirar (el token es stateless y no hay versión de sesión). Un cambio
 * de contraseña no cierra sesiones abiertas en otros dispositivos.
 *
 * @module config/services/password-reset
 */

import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import {
  passwordResetTokens,
  profiles,
  tenants,
} from "../../../shared/database/schema/index.js";
import { ValidationError } from "../../../shared/errors/app-error.js";
import {
  checkRateLimit,
  recordAttempt,
} from "../../../shared/services/rate-limiter.js";
import { env } from "../../../config/env.js";
import { smartSend } from "../../email/services/email.service.js";
import { passwordResetTemplate } from "../../email/templates/index.js";
import { hashPassword } from "./auth-utils.js";

/** Vigencia del enlace de recuperación. */
export const RESET_TOKEN_TTL_MINUTES = 60;

/** Intentos de pedido de reset permitidos por ventana. */
const RESET_RATE_LIMIT = { maxAttempts: 3, windowMs: 60 * 60 * 1000 };

/** Mensaje único para token inválido/vencido/usado. */
const INVALID_TOKEN_MESSAGE =
  "El enlace de recuperación es inválido o expiró. Solicitá uno nuevo.";

/**
 * Hash determinista del token para almacenarlo/compararlo sin guardar
 * el valor en claro.
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface RequestPasswordResetInput {
  tenantSlug: string;
  email: string;
  ip?: string;
}

export interface ResetPasswordInput {
  tenantSlug: string;
  token: string;
  password: string;
}

/**
 * Paso 1 — emite (si corresponde) un token de recuperación y envía el
 * email. La respuesta es siempre la misma, exista o no la cuenta.
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput,
): Promise<{ ok: true }> {
  const { tenantSlug, email, ip } = input;

  // Rate limit ANTES de tocar la base: frena fuerza bruta y spam de
  // emails. Se cuenta todo pedido, incluso para emails inexistentes, así
  // el 429 tampoco revela si la cuenta existe.
  const rateKey = `password-reset:${ip ?? "unknown"}:${tenantSlug}:${email.toLowerCase()}`;
  checkRateLimit(rateKey, RESET_RATE_LIMIT);
  recordAttempt(rateKey);

  const [tenant] = await db()
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant) return { ok: true };

  const [profile] = await db()
    .select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.tenantId, tenant.id),
        eq(profiles.email, email),
        eq(profiles.isActive, true),
      ),
    )
    .limit(1);

  // Cuenta inexistente o inactiva: misma respuesta, sin email.
  if (!profile) return { ok: true };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  // Un solo token vigente por perfil: los pendientes anteriores mueren.
  await db()
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.profileId, profile.id),
        eq(passwordResetTokens.tenantSlug, tenant.slug),
        isNull(passwordResetTokens.usedAt),
      ),
    );

  await db().insert(passwordResetTokens).values({
    profileId: profile.id,
    tenantSlug: tenant.slug,
    tokenHash,
    expiresAt,
    requestedIp: ip ?? null,
  });

  const baseUrl = env.APP_URL || "http://localhost:3000";
  const resetUrl =
    `${baseUrl}/reset-password?token=${encodeURIComponent(token)}` +
    `&tenant=${encodeURIComponent(tenant.slug)}`;

  try {
    await smartSend({
      to: profile.email,
      subject: `Recuperá tu contraseña — ${tenant.name}`,
      html: passwordResetTemplate({
        fullName: profile.fullName,
        tenantName: tenant.name,
        resetUrl,
        expiresMinutes: RESET_TOKEN_TTL_MINUTES,
      }),
      text:
        `Hola ${profile.fullName}:\n\n` +
        `Recibimos un pedido para restablecer tu contraseña de ${tenant.name}.\n` +
        `Abrí este enlace (vence en ${RESET_TOKEN_TTL_MINUTES} minutos):\n${resetUrl}\n\n` +
        "Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia.",
      entityType: "password_reset",
      entityId: profile.id,
      tenantSlug: tenant.slug,
    });
  } catch (err) {
    // El fallo de email no debe cambiar la respuesta (evita enumeración
    // y no deja al usuario con un 500). Queda en el log de emails.
    console.error("[password-reset] fallo al enviar el email:", err);
  }

  return { ok: true };
}

/**
 * Paso 2 — canjea el token y reemplaza la contraseña.
 *
 * @throws {ValidationError} si el token no es válido, venció o ya se usó.
 */
export async function resetPassword(
  input: ResetPasswordInput,
): Promise<{ ok: true }> {
  const { tenantSlug, token, password } = input;

  const [tenant] = await db()
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  // Taller inexistente: mismo error genérico que un token inválido.
  if (!tenant) throw new ValidationError(INVALID_TOKEN_MESSAGE);

  const [row] = await db()
    .select({
      id: passwordResetTokens.id,
      profileId: passwordResetTokens.profileId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
      profileActive: profiles.isActive,
    })
    .from(passwordResetTokens)
    .innerJoin(profiles, eq(profiles.id, passwordResetTokens.profileId))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashResetToken(token)),
        eq(passwordResetTokens.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  if (!row.profileActive) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  const newHash = hashPassword(password);

  await db().transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(
        and(
          eq(profiles.id, row.profileId),
          eq(profiles.tenantId, tenant.id),
        ),
      );

    // Un solo uso: muere este token y cualquier otro pendiente del perfil.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.profileId, row.profileId),
          eq(passwordResetTokens.tenantSlug, tenantSlug),
          isNull(passwordResetTokens.usedAt),
        ),
      );
  });

  return { ok: true };
}
