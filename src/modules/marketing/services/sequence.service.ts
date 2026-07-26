/**
 * Marketing Sequence Service — multi-step drip automation.
 *
 * Manages sequences, enrollments, and step processing.
 *
 * @module marketing/services/sequence.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql } from "drizzle-orm";
import { getDb } from "../../../shared/database/connection.js";

// ─── Types ────────────────────────────────────

export interface SequenceRow {
  id: string;
  tenant_slug: string;
  nombre: string;
  descripcion: string | null;
  trigger_event: string;
  estado: string;
  total_enrolled: number;
  total_completed: number;
}

export interface StepRow {
  id: string;
  sequence_id: string;
  tenant_slug: string;
  orden: number;
  delay_days: number;
  tipo: string;
  asunto: string | null;
  mensaje: string;
  activo: boolean;
}

export interface EnrollmentRow {
  id: string;
  sequence_id: string;
  tenant_slug: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_phone: string | null;
  cliente_email: string | null;
  estado: string;
  current_step: number;
  next_action_at: string | null;
  started_at: string;
  completed_at: string | null;
}

// ─── Sequence CRUD ────────────────────────────

export async function createSequence(
  data: { nombre: string; descripcion?: string; triggerEvent?: string; steps: Array<{ orden: number; delayDays: number; tipo: string; asunto?: string; mensaje: string }> },
  tenantSlug: string,
): Promise<SequenceRow> {
  const rows = await db().execute(sql`
    INSERT INTO marketing_sequences (tenant_slug, nombre, descripcion, trigger_event)
    VALUES (${tenantSlug}, ${data.nombre}, ${data.descripcion || null}, ${data.triggerEvent || "manual"})
    RETURNING *
  `);
  const seq = rows[0] as any;

  for (const step of data.steps) {
    await db().execute(sql`
      INSERT INTO marketing_sequence_steps (sequence_id, tenant_slug, orden, delay_days, tipo, asunto, mensaje)
      VALUES (${seq.id}, ${tenantSlug}, ${step.orden}, ${step.delayDays}, ${step.tipo}, ${step.asunto || null}, ${step.mensaje})
    `);
  }

  return seq;
}

export async function listSequences(tenantSlug: string): Promise<SequenceRow[]> {
  const rows = await db().execute(sql`
    SELECT * FROM marketing_sequences WHERE tenant_slug = ${tenantSlug} ORDER BY created_at DESC
  `);
  return rows as unknown as SequenceRow[];
}

export async function getSequence(id: string, tenantSlug: string): Promise<{ sequence: SequenceRow; steps: StepRow[] } | null> {
  const rows = await db().execute(sql`
    SELECT * FROM marketing_sequences WHERE id = ${id} AND tenant_slug = ${tenantSlug}
  `);
  if (rows.length === 0) return null;

  const steps = await db().execute(sql`
    SELECT * FROM marketing_sequence_steps WHERE sequence_id = ${id} AND tenant_slug = ${tenantSlug} ORDER BY orden
  `);

  return { sequence: rows[0] as unknown as SequenceRow, steps: steps as unknown as StepRow[] };
}

export async function updateSequence(
  id: string,
  data: Partial<{ nombre: string; descripcion: string; triggerEvent: string; estado: string }>,
  tenantSlug: string,
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.nombre !== undefined) { sets.push(`nombre = $${idx++}`); values.push(data.nombre); }
  if (data.descripcion !== undefined) { sets.push(`descripcion = $${idx++}`); values.push(data.descripcion); }
  if (data.triggerEvent !== undefined) { sets.push(`trigger_event = $${idx++}`); values.push(data.triggerEvent); }
  if (data.estado !== undefined) { sets.push(`estado = $${idx++}`); values.push(data.estado); }
  sets.push("updated_at = now()");
  if (sets.length === 1) return false;

  values.push(id, tenantSlug);
  const rows = await getDb().unsafe(`
    UPDATE marketing_sequences SET ${sets.join(", ")}
    WHERE id = $${idx++} AND tenant_slug = $${idx} RETURNING id
  `, values as any[]);
  return rows.length > 0;
}

export async function deleteSequence(id: string, tenantSlug: string): Promise<boolean> {
  const rows = await db().execute(sql`
    UPDATE marketing_sequences SET estado = 'CANCELADO', updated_at = now()
    WHERE id = ${id} AND tenant_slug = ${tenantSlug} RETURNING id
  `);
  return rows.length > 0;
}

// ─── Enrollment ────────────────────────────────

export async function enrollCustomer(
  sequenceId: string,
  data: { clienteId?: string; clienteNombre: string; clientePhone?: string; clienteEmail?: string },
  tenantSlug: string,
): Promise<EnrollmentRow | null> {
  // Get first step delay
  const steps = await db().execute(sql`
    SELECT delay_days FROM marketing_sequence_steps
    WHERE sequence_id = ${sequenceId} AND tenant_slug = ${tenantSlug} AND activo = true
    ORDER BY orden LIMIT 1
  `);
  const firstDelay = steps.length > 0 ? (steps[0] as any).delay_days : 0;
  const nextAction = new Date(Date.now() + firstDelay * 86400000);

  const rows = await db().execute(sql`
    INSERT INTO marketing_sequence_enrollments
      (sequence_id, tenant_slug, cliente_id, cliente_nombre, cliente_phone, cliente_email, next_action_at)
    VALUES
      (${sequenceId}, ${tenantSlug}, ${data.clienteId || null}, ${data.clienteNombre},
       ${data.clientePhone || null}, ${data.clienteEmail || null}, ${nextAction.toISOString()})
    RETURNING *
  `);

  // Increment enrolled counter
  await db().execute(sql`
    UPDATE marketing_sequences SET total_enrolled = total_enrolled + 1, updated_at = now()
    WHERE id = ${sequenceId}
  `);

  return rows[0] as unknown as EnrollmentRow | null;
}

export async function listEnrollments(sequenceId: string, tenantSlug: string): Promise<EnrollmentRow[]> {
  const rows = await db().execute(sql`
    SELECT * FROM marketing_sequence_enrollments
    WHERE sequence_id = ${sequenceId} AND tenant_slug = ${tenantSlug}
    ORDER BY started_at DESC
  `);
  return rows as unknown as EnrollmentRow[];
}

// ─── Step Processing ───────────────────────────

export async function processSequences(tenantSlug: string): Promise<number> {
  // Find enrollments due for next step
  const enrollments = await db().execute(sql`
    SELECT * FROM marketing_sequence_enrollments
    WHERE tenant_slug = ${tenantSlug}
      AND estado = 'ACTIVO'
      AND next_action_at <= now()
  `);

  let processed = 0;

  for (const enrollment of enrollments as any[]) {
    try {
      const nextStepNum = enrollment.current_step + 1;

      // Get the next step
      const stepRows = await db().execute(sql`
        SELECT * FROM marketing_sequence_steps
        WHERE sequence_id = ${enrollment.sequence_id}
          AND tenant_slug = ${tenantSlug}
          AND orden = ${nextStepNum}
          AND activo = true
      `);

      if (stepRows.length === 0) {
        // No more steps — mark completed
        await db().execute(sql`
          UPDATE marketing_sequence_enrollments
          SET estado = 'COMPLETED', completed_at = now(), next_action_at = NULL
          WHERE id = ${enrollment.id}
        `);
        await db().execute(sql`
          UPDATE marketing_sequences SET total_completed = total_completed + 1, updated_at = now()
          WHERE id = ${enrollment.sequence_id}
        `);
        processed++;
        continue;
      }

      const step = stepRows[0] as any;

      // Log the sent message
      await db().execute(sql`
        INSERT INTO marketing_sequence_log (enrollment_id, step_id, tenant_slug, channel, status)
        VALUES (${enrollment.id}, ${step.id}, ${tenantSlug}, ${step.tipo}, 'SENT')
      `);

      // Calculate next step delay
      const nextStepRows = await db().execute(sql`
        SELECT delay_days FROM marketing_sequence_steps
        WHERE sequence_id = ${enrollment.sequence_id}
          AND tenant_slug = ${tenantSlug}
          AND orden > ${nextStepNum}
          AND activo = true
        ORDER BY orden LIMIT 1
      `);

      let nextActionAt: string | null = null;
      if (nextStepRows.length > 0) {
        const delay = (nextStepRows[0] as any).delay_days;
        nextActionAt = new Date(Date.now() + delay * 86400000).toISOString();
      }

      await db().execute(sql`
        UPDATE marketing_sequence_enrollments
        SET current_step = ${nextStepNum}, next_action_at = ${nextActionAt}
        WHERE id = ${enrollment.id}
      `);

      processed++;
    } catch (err) {
      // Log error
      await db().execute(sql`
        INSERT INTO marketing_sequence_log (enrollment_id, step_id, tenant_slug, channel, status, error_message)
        VALUES (${enrollment.id}, '00000000-0000-0000-0000-000000000000', ${tenantSlug}, 'system', 'FAILED', ${String(err instanceof Error ? err.message : err)})
      `);
    }
  }

  if (processed > 0) {
    console.log(`[sequence-check] Tenant "${tenantSlug}": ${processed} enrollment(s) processed`);
  }
  return processed;
}
