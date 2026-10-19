/**
 * Seed script: Marketing / WhatsApp / Billing / Backup / Otros
 *
 * Creates sample data for tables that don't have seed scripts yet.
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/seed-marketing-backup-extra.ts <tenant_slug>
 *
 * @module scripts/seed-marketing-backup-extra
 */
import { db } from "../src/shared/database/drizzle.js";
import { closeDb } from "../src/shared/database/connection.js";
import { eq } from "drizzle-orm";

import {
  marketingSequences,
  marketingSequenceSteps,
  marketingSequenceEnrollments,
  marketingSequenceLog,
} from "../src/modules/marketing/schema/sequences.js";
import { whatsappTemplates } from "../src/modules/whatsapp/schema/whatsapp-template.js";
import { whatsappMessages } from "../src/modules/whatsapp/schema/whatsapp-log.js";
import { whatsappFollowups } from "../src/modules/whatsapp/schema/whatsapp-followup.js";
import { subscriptionInvoices } from "../src/modules/billing/schema/invoices.js";
import { subscriptions } from "../src/modules/billing/schema/subscriptions.js";
import { plans } from "../src/modules/billing/schema/plans.js";
import { tenants } from "../src/shared/database/schema/tenants.js";
import {
  backupPolicies,
  backupJobs,
  restoreSessions,
} from "../src/modules/backup/schema/backup-policies.js";
import { dataRetentionPolicy } from "../src/modules/enterprise/schema/index.js";
import { mobilePushTokens } from "../src/modules/mobile/schema/index.js";
import { donaciones } from "../src/modules/finance/schema/donaciones.js";
import { fleetContracts } from "../src/modules/fleet/schema/fleet-contracts.js";
import { thinkcarImports } from "../src/modules/thinkcar/schema/index.js";
import { clients } from "../src/shared/database/schema/clients.js";
import { ordenesTrabajo } from "../src/modules/workshop/schema/index.js";
import { vehiculos } from "../src/modules/workshop/schema/index.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error('Usage: DATABASE_URL="..." npx tsx scripts/seed-marketing-backup-extra.ts <tenant_slug>');
  process.exit(1);
}

async function main() {
  console.log(`🌱 Seeding marketing/whatsapp/billing/backup/extra data for tenant: ${TENANT_SLUG}\n`);

  const tenant = await db().select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, TENANT_SLUG)).limit(1);
  if (tenant.length === 0) { console.error(`Tenant '${TENANT_SLUG}' not found`); process.exit(1); }
  const tenantId = tenant[0]!.id;
  let seqId: string | null = null;
  let seq2Id: string | null = null;
  let inserted = 0; let skipped = 0;

  const clientList = await db().select({ id: clients.id, name: clients.name, phone: clients.phone }).from(clients).where(eq(clients.tenantSlug, TENANT_SLUG)).limit(5);
  const otList = await db().select({ id: ordenesTrabajo.id, description: ordenesTrabajo.description }).from(ordenesTrabajo).where(eq(ordenesTrabajo.tenantSlug, TENANT_SLUG)).limit(3);
  const vehiculosList = await db().select({ id: vehiculos.id }).from(vehiculos).where(eq(vehiculos.tenantSlug, TENANT_SLUG)).limit(3);
  const planStarter = await db().select({ id: plans.id }).from(plans).where(eq(plans.code, "STARTER")).limit(1);
  const planPro = await db().select({ id: plans.id }).from(plans).where(eq(plans.code, "PRO")).limit(1);

  // 1. Sequences
  console.log("   1. Marketing sequences...");
  const existingSeqs = await db().select({ id: marketingSequences.id, nombre: marketingSequences.nombre }).from(marketingSequences).where(eq(marketingSequences.tenantSlug, TENANT_SLUG));
  if (existingSeqs.find(s => s.nombre === "Bienvenida nuevos clientes")) { seqId = existingSeqs.find(s => s.nombre === "Bienvenida nuevos clientes")!.id; skipped++; }
  else { const [seq] = await db().insert(marketingSequences).values({ tenantSlug: TENANT_SLUG, nombre: "Bienvenida nuevos clientes", triggerEvent: "new_client", estado: "ACTIVO" }).returning(); seqId = seq!.id; inserted++; }
  if (existingSeqs.find(s => s.nombre === "Recordatorio de mantenimiento")) { seq2Id = existingSeqs.find(s => s.nombre === "Recordatorio de mantenimiento")!.id; skipped++; }
  else { const [seq2] = await db().insert(marketingSequences).values({ tenantSlug: TENANT_SLUG, nombre: "Recordatorio de mantenimiento", triggerEvent: "service_reminder", estado: "ACTIVO" }).returning(); seq2Id = seq2!.id; inserted++; }

  // 2. Steps
  console.log("   2. Marketing sequence steps...");
  if (seqId) {
    const existing = await db().select({ orden: marketingSequenceSteps.orden }).from(marketingSequenceSteps).where(eq(marketingSequenceSteps.sequenceId, seqId));
    const steps = [
      { sequenceId: seqId, tenantSlug: TENANT_SLUG, orden: 1, delayDays: 0, tipo: "whatsapp", asunto: "Bienvenida", mensaje: "Hola {{nombre_cliente}}, gracias por elegirnos.", activo: true },
      { sequenceId: seqId, tenantSlug: TENANT_SLUG, orden: 2, delayDays: 3, tipo: "whatsapp", asunto: "Feedback", mensaje: "¿Cómo fue su experiencia?", activo: true },
      { sequenceId: seqId, tenantSlug: TENANT_SLUG, orden: 3, delayDays: 7, tipo: "whatsapp", asunto: "Descuento", mensaje: "10% descuento en su próximo servicio.", activo: true },
    ];
    for (const s of steps) { if (!existing.find(e => e.orden === s.orden)) { await db().insert(marketingSequenceSteps).values(s as any); inserted++; } else skipped++; }
  }
  if (seq2Id) {
    const existing = await db().select({ orden: marketingSequenceSteps.orden }).from(marketingSequenceSteps).where(eq(marketingSequenceSteps.sequenceId, seq2Id));
    const steps = [
      { sequenceId: seq2Id, tenantSlug: TENANT_SLUG, orden: 1, delayDays: 0, tipo: "whatsapp", asunto: "Recordatorio", mensaje: "Su vehículo necesita mantenimiento.", activo: true },
      { sequenceId: seq2Id, tenantSlug: TENANT_SLUG, orden: 2, delayDays: 1, tipo: "whatsapp", asunto: "Turno", mensaje: "Puede agendar su turno.", activo: true },
    ];
    for (const s of steps) { if (!existing.find(e => e.orden === s.orden)) { await db().insert(marketingSequenceSteps).values(s as any); inserted++; } else skipped++; }
  }

  // 3. Enrollments + Logs
  console.log("   3. Marketing sequence enrollments...");
  if (seqId && clientList.length > 0) {
    const existingEnrolls = await db().select({ id: marketingSequenceEnrollments.id, clienteId: marketingSequenceEnrollments.clienteId }).from(marketingSequenceEnrollments).where(eq(marketingSequenceEnrollments.sequenceId, seqId));
    for (let i = 0; i < Math.min(2, clientList.length); i++) {
      const c = clientList[i]!;
      if (!existingEnrolls.find(e => e.clienteId === c.id)) {
        const [enr] = await db().insert(marketingSequenceEnrollments).values({ sequenceId: seqId, tenantSlug: TENANT_SLUG, clienteId: c.id, clienteNombre: c.name, clientePhone: c.phone, estado: "ACTIVO", currentStep: 1 }).returning();
        inserted++;
        const steps = await db().select({ id: marketingSequenceSteps.id, orden: marketingSequenceSteps.orden }).from(marketingSequenceSteps).where(eq(marketingSequenceSteps.sequenceId, seqId));
        const step1 = steps.find(s => s.orden === 1);
        if (enr && step1) {
          const existingLog = await db().select({ id: marketingSequenceLog.id }).from(marketingSequenceLog).where(eq(marketingSequenceLog.enrollmentId, enr.id));
          if (existingLog.length === 0) { await db().insert(marketingSequenceLog).values({ enrollmentId: enr.id, stepId: step1.id, tenantSlug: TENANT_SLUG, channel: "whatsapp", status: "SENT" }); inserted++; } else skipped++;
        }
      } else skipped++;
    }
  }

  // 5. WhatsApp Templates
  console.log("   5. WhatsApp templates...");
  const existingTemplates = await db().select({ key: whatsappTemplates.key }).from(whatsappTemplates).where(eq(whatsappTemplates.tenantSlug, TENANT_SLUG));
  const templates = [
    { key: "recepcion", name: "Recepción de vehículo", body: "Hola {{nombre_cliente}}, su vehículo ha sido recibido. Orden: {{orden_id}}", category: "recepcion", variables: ["nombre_cliente","orden_id"], triggerEvent: "ot_created" },
    { key: "presupuesto", name: "Presupuesto listo", body: "Estimado {{nombre_cliente}}, su presupuesto está listo.", category: "presupuesto", variables: ["nombre_cliente"], triggerEvent: "ot_budget_ready" },
    { key: "listo_entrega", name: "Listo para entrega", body: "Su vehículo está listo para retiro. Orden: {{orden_id}}", category: "entrega", variables: ["nombre_cliente","orden_id"], triggerEvent: "ot_ready" },
    { key: "recordatorio", name: "Recordatorio de mantenimiento", body: "Hola {{nombre_cliente}}, recordatorio de mantenimiento.", category: "general", variables: ["nombre_cliente"] },
  ];
  for (const t of templates) { if (!existingTemplates.find(et => et.key === t.key)) { await db().insert(whatsappTemplates).values({ tenantSlug: TENANT_SLUG, key: t.key, name: t.name, body: t.body, category: t.category, variables: t.variables as any, triggerEvent: t.triggerEvent }); inserted++; } else skipped++; }

  // 6. WhatsApp Messages
  console.log("   6. WhatsApp messages...");
  const existingMsgs = await db().select({ ordenId: whatsappMessages.ordenId, template: whatsappMessages.template }).from(whatsappMessages).where(eq(whatsappMessages.tenantSlug, TENANT_SLUG));
  if (otList.length > 0 && clientList.length > 0) {
    const msgs = [
      { ordenId: otList[0]!.id, clienteName: clientList[0]!.name, phoneNumber: clientList[0]!.phone, template: "RECEPCIONADO" as const, messageText: "Recibido", status: "SENT" as const, sentBy: "seed-demo-admin", tenantSlug: TENANT_SLUG },
      { ordenId: otList[1]!.id, clienteName: clientList[1]!.name, phoneNumber: clientList[1]!.phone, template: "LISTO_ENTREGA" as const, messageText: "Listo para entrega", status: "SENT" as const, sentBy: "seed-demo-admin", tenantSlug: TENANT_SLUG },
      { ordenId: otList[2]!.id, clienteName: clientList[2]!.name, phoneNumber: clientList[2]!.phone, template: "PRESUPUESTADO" as const, messageText: "Presupuesto listo", status: "SENT" as const, sentBy: "seed-demo-admin", tenantSlug: TENANT_SLUG },
      { ordenId: otList[0]!.id, clienteName: clientList[0]!.name, phoneNumber: clientList[0]!.phone, template: "CUSTOM" as const, messageText: "Gracias", status: "PENDING" as const, sentBy: "seed-demo-admin", tenantSlug: TENANT_SLUG },
      { ordenId: otList[1]!.id, clienteName: clientList[1]!.name, phoneNumber: clientList[1]!.phone, template: "EN_REPARACION" as const, messageText: "En reparación", status: "SENT" as const, sentBy: "seed-demo-admin", tenantSlug: TENANT_SLUG },
    ];
    for (const m of msgs) { if (!existingMsgs.find(em => em.ordenId === m.ordenId && em.template === m.template)) { await db().insert(whatsappMessages).values(m); inserted++; } else skipped++; }
  }

  // 7. Followups
  console.log("   7. WhatsApp followups...");
  const existingFollowups = await db().select({ templateKey: whatsappFollowups.templateKey, phone: whatsappFollowups.phone }).from(whatsappFollowups).where(eq(whatsappFollowups.tenantSlug, TENANT_SLUG));
  if (clientList.length > 0) {
    const now = new Date(); const future1 = new Date(now.getTime()+86400000); const future2 = new Date(now.getTime()+259200000);
    const followups = [
      { tenantSlug: TENANT_SLUG, templateKey: "recordatorio", ordenId: otList[0]?.id || null, phone: clientList[0]!.phone, filledBody: "Recordatorio de mantenimiento", status: "SCHEDULED" as const, scheduledAt: future1 },
      { tenantSlug: TENANT_SLUG, templateKey: "presupuesto", ordenId: otList[1]?.id || null, phone: clientList[1]!.phone, filledBody: "Presupuesto listo", status: "SCHEDULED" as const, scheduledAt: future2 },
      { tenantSlug: TENANT_SLUG, templateKey: "recordatorio", ordenId: null, phone: clientList[2]!.phone, filledBody: "Gracias por su preferencia", status: "SCHEDULED" as const, scheduledAt: future1 },
    ];
    for (const f of followups) { if (!existingFollowups.find(ef => ef.templateKey === f.templateKey && ef.phone === f.phone)) { await db().insert(whatsappFollowups).values({ ...f, ordenId: f.ordenId as any }); inserted++; } else skipped++; }
  }

  // 8-17
  console.log("   8. Billing invoices...");
  const existingInv = await db().select({ stripeInvoiceId: subscriptionInvoices.stripeInvoiceId }).from(subscriptionInvoices).where(eq(subscriptionInvoices.tenantId, tenantId));
  const invs = [
    { tenantId, stripeInvoiceId: "seed-demo-inv-001", stripeSubscriptionId: "seed-demo-sub-001", amountPyg: 350000, status: "paid" as const, periodLabel: "Octubre 2026", paidAt: new Date() },
    { tenantId, stripeInvoiceId: "seed-demo-inv-002", stripeSubscriptionId: "seed-demo-sub-001", amountPyg: 350000, status: "pending" as const, periodLabel: "Noviembre 2026", dueDate: new Date(Date.now()+1296000000) },
    { tenantId, stripeInvoiceId: "seed-demo-inv-003", stripeSubscriptionId: "seed-demo-sub-002", amountPyg: 700000, status: "paid" as const, periodLabel: "Septiembre 2026", paidAt: new Date(Date.now()-2592000000) },
  ];
  for (const inv of invs) { if (!existingInv.find(ei => ei.stripeInvoiceId === inv.stripeInvoiceId)) { await db().insert(subscriptionInvoices).values(inv); inserted++; } else skipped++; }

  console.log("   9. Billing subscriptions...");
  const existingSubs = await db().select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId }).from(subscriptions).where(eq(subscriptions.tenantId, tenantId));
  if (existingSubs.length === 0 && planStarter.length > 0) {
    const subs = [
      { tenantId, stripeSubscriptionId: "seed-demo-sub-001", stripeCustomerId: "seed-demo-cus-001", planId: planStarter[0]!.id, status: "active" as const, interval: "monthly" as const, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now()+2592000000), activeUsers: 3 },
    ];
    if (planPro.length > 0) subs.push({ tenantId, stripeSubscriptionId: "seed-demo-sub-002", stripeCustomerId: "seed-demo-cus-001", planId: planPro[0]!.id, status: "active" as const, interval: "monthly" as const, currentPeriodStart: new Date(Date.now()-5184000000), currentPeriodEnd: new Date(Date.now()-2592000000), activeUsers: 3 } as any);
    for (const s of subs) { await db().insert(subscriptions).values(s as any); inserted++; }
  } else skipped += existingSubs.length;

  console.log("  10. Backup policies...");
  const existingPol = await db().select({ id: backupPolicies.id, nombre: backupPolicies.nombre }).from(backupPolicies).where(eq(backupPolicies.tenantSlug, TENANT_SLUG));
  let polId1: string | null = null, polId2: string | null = null;
  if (!existingPol.find(p => p.nombre === "Backup Diario")) { const [p] = await db().insert(backupPolicies).values({ nombre: "Backup Diario", activo: true, frecuencia: "DIARIA" as const, horaEjecucion: 23, minutoEjecucion: 30, tipoBackup: "COMPLETO" as const, destino: "LOCAL" as const, destinoConfig: { path: "/var/backups/erp" }, retencionDias: 30, maxBackups: 10, comprimir: true, tenantSlug: TENANT_SLUG }).returning(); polId1 = p!.id; inserted++; } else { polId1 = existingPol.find(p => p.nombre === "Backup Diario")!.id; skipped++; }
  if (!existingPol.find(p => p.nombre === "Backup Semanal")) { const [p] = await db().insert(backupPolicies).values({ nombre: "Backup Semanal", activo: true, frecuencia: "SEMANAL" as const, horaEjecucion: 23, minutoEjecucion: 0, diaSemana: 1, tipoBackup: "COMPLETO" as const, destino: "LOCAL" as const, destinoConfig: { path: "/var/backups/erp" }, retencionDias: 90, maxBackups: 12, comprimir: true, tenantSlug: TENANT_SLUG }).returning(); polId2 = p!.id; inserted++; } else { polId2 = existingPol.find(p => p.nombre === "Backup Semanal")!.id; skipped++; }

  console.log("  11. Backup jobs...");
  const existingJobs = await db().select({ policyId: backupJobs.policyId }).from(backupJobs).where(eq(backupJobs.tenantSlug, TENANT_SLUG));
  if (polId1 && !existingJobs.find(j => j.policyId === polId1)) { await db().insert(backupJobs).values({ policyId: polId1, estado: "COMPLETADO" as const, filePath: "/var/backups/erp/backup-completo-20261017.sql.gz", fileSize: 5242880, checksum: "seed-demo-checksum-ok", duracionMs: 1250, progreso: 100, log: [], trigger: "CRON" as const, tenantSlug: TENANT_SLUG, completedAt: new Date() }); inserted++; } else if (polId1) skipped++;
  if (polId2 && !existingJobs.find(j => j.policyId === polId2)) { await db().insert(backupJobs).values({ policyId: polId2, estado: "ERROR" as const, filePath: null, error: "seed-demo-error-simulado", progreso: 45, log: [], trigger: "CRON" as const, tenantSlug: TENANT_SLUG }); inserted++; } else if (polId2) skipped++;

  console.log("  12. Restore sessions...");
  const jobs = await db().select({ id: backupJobs.id }).from(backupJobs).where(eq(backupJobs.tenantSlug, TENANT_SLUG)).limit(1);
  const existingRest = await db().select({ id: restoreSessions.id }).from(restoreSessions).where(eq(restoreSessions.tenantSlug, TENANT_SLUG));
  if (jobs.length > 0 && existingRest.length === 0) { await db().insert(restoreSessions).values({ backupJobId: jobs[0]!.id, estado: "PENDIENTE" as const, initiatedBy: "seed-demo-admin", twoFactorVerified: false, progreso: 0, log: [], tenantSlug: TENANT_SLUG }); inserted++; } else skipped += existingRest.length;

  console.log("  13. Data retention policy...");
  const existingDrp = await db().select({ id: dataRetentionPolicy.id }).from(dataRetentionPolicy).where(eq(dataRetentionPolicy.tenantSlug, TENANT_SLUG));
  if (existingDrp.length === 0) { await db().insert(dataRetentionPolicy).values({ id: `drp-${TENANT_SLUG}`, tenantSlug: TENANT_SLUG, auditLogRetentionDays: "2555", emailLogRetentionDays: "365", backupRetentionDays: "90", sessionRetentionDays: "30", autoCleanupEnabled: true, encryptionAtRest: true, encryptionInTransit: true, gdprCompliant: true, dataExportEnabled: true, rightToErasure: true }); inserted++; } else skipped++;

  console.log("  14. Mobile push tokens...");
  const existingTokens = await db().select({ id: mobilePushTokens.id }).from(mobilePushTokens).where(eq(mobilePushTokens.tenantSlug, TENANT_SLUG));
  for (const tid of ["seed-demo-token-001","seed-demo-token-002"]) { if (!existingTokens.find(et => et.id === tid)) { await db().insert(mobilePushTokens).values({ id: tid, tenantSlug: TENANT_SLUG, deviceId: tid.replace("token","device"), pushToken: `seed-demo-expo-push-${tid.split("-")[3]}`, platform: "ios" as const }); inserted++; } else skipped++; }

  console.log("  15. Donaciones...");
  const existingDons = await db().select({ beneficiario: donaciones.beneficiario }).from(donaciones).where(eq(donaciones.tenantSlug, TENANT_SLUG));
  const dons = [
    { beneficiario: "Casa de Acogida Esperanza", descripcion: "Donación", monto: "500000.00", comprobante: "seed-demo-comp-d001", deducible: true, fecha: new Date(), tenantSlug: TENANT_SLUG },
    { beneficiario: "Fundación Niño Feliz", descripcion: "Apoyo", monto: "300000.00", comprobante: "seed-demo-comp-d002", deducible: true, fecha: new Date(Date.now()-2592000000), tenantSlug: TENANT_SLUG },
  ];
  for (const d of dons) { if (!existingDons.find(ed => ed.beneficiario === d.beneficiario)) { await db().insert(donaciones).values(d); inserted++; } else skipped++; }

  console.log("  16. Fleet contracts...");
  const existingFleet = await db().select({ nombre: fleetContracts.nombre }).from(fleetContracts).where(eq(fleetContracts.tenantSlug, TENANT_SLUG));
  if (clientList.length > 0) {
    const fcs = [
      { tenantSlug: TENANT_SLUG, fleetId: clientList[0]!.id, nombre: "Contrato de Mantenimiento Flota 1", montoMensual: "1500000.00", cicloFacturacion: "MENSUAL" as const, diaCobro: 5, proximaFactura: new Date(Date.now()+432000000), estado: "ACTIVO" as const },
      { tenantSlug: TENANT_SLUG, fleetId: clientList[1]!.id, nombre: "Contrato de Servicio Anual", montoMensual: "2500000.00", cicloFacturacion: "ANUAL" as const, diaCobro: 1, proximaFactura: new Date(Date.now()+2592000000), estado: "ACTIVO" as const },
    ];
    for (const fc of fcs) { if (!existingFleet.find(ef => ef.nombre === fc.nombre)) { await db().insert(fleetContracts).values(fc as any); inserted++; } else skipped++; }
  } else skipped++;

  console.log("  17. Thinkcar imports...");
  const existingThink = await db().select({ fileHash: thinkcarImports.fileHash }).from(thinkcarImports);
  const think = [
    { fileName: "thinkcar-report-001.pdf", fileHash: "seed-demo-thinkhash-001", fileSize: 204800, sourceChannel: "usb" as const, vin: "1HGCM82633A123456", brand: "Toyota", model: "Corolla Cross", reportType: "diagnostic", scanDate: new Date(), dtcCodes: ["P0300","P0420"], dtcDescriptions: { P0300: "Random Misfire", P0420: "Catalyst" }, vehicleId: vehiculosList[0]?.id || null, ordenTrabajoId: otList[0]?.id || null, clientId: clientList[0]?.id || null, status: "completed" as const, healthScore: 75, pendingAssignment: false },
    { fileName: "thinkcar-report-002.pdf", fileHash: "seed-demo-thinkhash-002", fileSize: 102400, sourceChannel: "bluetooth" as const, vin: "KNDMC5C12A6234567", brand: "Kia", model: "Sportage", reportType: "full_scan", scanDate: new Date(Date.now()-86400000), dtcCodes: ["P0010"], dtcDescriptions: { P0010: "Camshaft" }, vehicleId: vehiculosList[1]?.id || null, ordenTrabajoId: otList[1]?.id || null, clientId: clientList[1]?.id || null, status: "pending" as const, healthScore: 85, pendingAssignment: true },
  ];
  for (const t of think) { if (!existingThink.find(et => et.fileHash === t.fileHash)) { await db().insert(thinkcarImports).values(t as any); inserted++; } else skipped++; }

  console.log(`\n   ✅ Done: ${inserted} inserted, ${skipped} skipped/existing`);
  console.log(`\n🌱 Seed complete!`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
