/**
 * Seed script: CRM / Administración / Seguridad tables.
 *
 * Poblates the 21 tables specified that currently have no seed data:
 * crm_pipeline_stages, crm_deals, sucursales, staff_profiles, mechanic_profiles,
 * commission_records, notificaciones, notification_priorities, api_keys, api_key_usage_log,
 * audit_log, security_audit_log, enterprise_audit_log, two_factor_secrets,
 * usb_security_tokens, hardware_fingerprints, sso_config, email_log, label_templates,
 * print_jobs, white_label_config
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/seed-admin-extra.ts <tenant_slug>
 *
 * @module scripts/seed-admin-extra
 */
import { db } from "../src/shared/database/drizzle.js";
import { closeDb } from "../src/shared/database/connection.js";
import { eq } from "drizzle-orm";

// Import from barrel where available
import {
  profiles,
  clients,
  tenants,
  ordenesTrabajo,
  notificaciones,
  staffProfiles,
  mechanicProfiles,
  commissionRecords,
  twoFactorSecrets,
  ssoConfig,
  whiteLabelConfig,
  emailLog,
} from "../src/shared/database/schema/index.js";

// Import from specific modules where not exported in barrel
import { crmPipelineStages, crmDeals } from "../src/modules/crm/schema/deals.js";
import { sucursales } from "../src/modules/config/schema/sucursales.js";
import { notificationPriorities } from "../src/modules/workshop/schema/notification-priority.js";
import { apiKeys, apiKeyUsageLog } from "../src/modules/api-keys/schema/api-keys.js";
import { auditLog } from "../src/modules/finance/schema/audit-log.js";
import {
  hardwareFingerprints,
  usbSecurityTokens,
  securityAuditLog,
} from "../src/modules/security-hw/schema/security-tokens.js";
import { enterpriseAuditLog } from "../src/modules/enterprise/schema/audit-enterprise.js";
import { labelTemplates, printJobs } from "../src/modules/label-printing/schema/label-templates.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-admin-extra.ts <tenant_slug>");
  process.exit(1);
}

async function main() {
  console.log(`🌱 Seeding admin/CRM/security data for tenant: ${TENANT_SLUG}\n`);

  // Resolve tenant
  const [tenant] = await db().select().from(tenants).where(eq(tenants.slug, TENANT_SLUG));
  if (!tenant) {
    console.error(`❌ Tenant ${TENANT_SLUG} not found`);
    process.exit(1);
  }
  const tenantId = tenant.id;

  // Resolve profiles
  const profileList = await db()
    .select()
    .from(profiles)
    .where(eq(profiles.tenantId, tenantId));
  const profileByEmail = new Map(profileList.map((p) => [p.email, p]));

  // Resolve clients
  const clientList = await db()
    .select()
    .from(clients)
    .where(eq(clients.tenantSlug, TENANT_SLUG));
  const clientByName = new Map(clientList.map((c) => [c.name, c]));

  // Resolve orders
  const orderList = await db()
    .select()
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.tenantSlug, TENANT_SLUG));
  const orderByDescription = new Map(orderList.map((o) => [o.description, o]));

  // 1. crm_pipeline_stages
  console.log("   Creating crm_pipeline_stages...");
  const existingStages = await db()
    .select({ nombre: crmPipelineStages.nombre })
    .from(crmPipelineStages)
    .where(eq(crmPipelineStages.tenantSlug, TENANT_SLUG));
  const stageNames = new Set(existingStages.map((s) => s.nombre));
  const stagesToInsert = [
    { nombre: "Lead", orden: 0, color: "#94a3b8" },
    { nombre: "Contactado", orden: 1, color: "#3b82f6" },
    { nombre: "Cotizado", orden: 2, color: "#f59e0b" },
    { nombre: "Ganado", orden: 3, color: "#10b981" },
    { nombre: "Perdido", orden: 4, color: "#ef4444" },
  ].filter((s) => !stageNames.has(s.nombre));
  for (const s of stagesToInsert) {
    await db().insert(crmPipelineStages).values({ ...s, tenantSlug: TENANT_SLUG, activo: true });
  }
  console.log(`   ✅  crm_pipeline_stages: ${stagesToInsert.length} inserted (${existingStages.length} existed)`);

  const allStages = await db()
    .select()
    .from(crmPipelineStages)
    .where(eq(crmPipelineStages.tenantSlug, TENANT_SLUG));

  // 2. crm_deals
  console.log("\n   Creating crm_deals...");
  const existingDeals = await db()
    .select({ titulo: crmDeals.titulo })
    .from(crmDeals)
    .where(eq(crmDeals.tenantSlug, TENANT_SLUG));
  const dealTitles = new Set(existingDeals.map((d) => d.titulo));
  const leadStage = allStages.find((s) => s.nombre === "Lead");
  const contactadoStage = allStages.find((s) => s.nombre === "Contactado");
  const cotizadoStage = allStages.find((s) => s.nombre === "Cotizado");
  const ganadoStage = allStages.find((s) => s.nombre === "Ganado");
  const dealsToInsert: any[] = [];
  if (leadStage && clientByName.get("Juan Carlos Martínez")) {
    dealsToInsert.push({
      titulo: "Revisión general vehículo",
      clienteNombre: "Juan Carlos Martínez",
      stageId: leadStage.id,
      valorEstimado: "500000",
      probabilidad: 30,
      fuente: "directo",
      tenantSlug: TENANT_SLUG,
    });
  }
  if (contactadoStage && clientByName.get("María Fernanda González")) {
    dealsToInsert.push({
      titulo: "Mantenimiento preventivo",
      clienteNombre: "María Fernanda González",
      stageId: contactadoStage.id,
      valorEstimado: "850000",
      probabilidad: 50,
      fuente: "llamada",
      tenantSlug: TENANT_SLUG,
    });
  }
  if (cotizadoStage && clientByName.get("Roberto Carlos Ávila")) {
    dealsToInsert.push({
      titulo: "Cambio de frenos completo",
      clienteNombre: "Roberto Carlos Ávila",
      stageId: cotizadoStage.id,
      valorEstimado: "1200000",
      probabilidad: 70,
      fuente: "presupuesto",
      tenantSlug: TENANT_SLUG,
    });
  }
  if (ganadoStage && clientByName.get("Ana Lucía Ferreira")) {
    dealsToInsert.push({
      titulo: "Reparación suspensión",
      clienteNombre: "Ana Lucía Ferreira",
      stageId: ganadoStage.id,
      valorEstimado: "950000",
      probabilidad: 100,
      fuente: "referencia",
      tenantSlug: TENANT_SLUG,
    });
  }
  if (cotizadoStage && clientByName.get("Pedro Enrique Benítez")) {
    dealsToInsert.push({
      titulo: "Diagnóstico motor",
      clienteNombre: "Pedro Enrique Benítez",
      stageId: cotizadoStage.id,
      valorEstimado: "750000",
      probabilidad: 60,
      fuente: "whatsapp",
      tenantSlug: TENANT_SLUG,
    });
  }
  const dealsFiltered = dealsToInsert.filter((d) => !dealTitles.has(d.titulo));
  for (const d of dealsFiltered) {
    await db().insert(crmDeals).values(d);
  }
  console.log(`   ✅  crm_deals: ${dealsFiltered.length} inserted (${existingDeals.length} existed)`);

  // 3. sucursales
  console.log("\n   Creating sucursales...");
  const existingSucursales = await db()
    .select({ codigo: sucursales.codigo })
    .from(sucursales)
    .where(eq(sucursales.tenantSlug, TENANT_SLUG));
  const sucCodes = new Set(existingSucursales.map((s) => s.codigo));
  const sucToInsert = [
    {
      nombre: "Sucursal Central",
      codigo: "SC01",
      direccion: "Av. Mariscal López 1234",
      ciudad: "Asunción",
      departamento: "Central",
      telefono: "+595211234567",
      email: "central@demo.com",
      gerente: "Admin Demo",
      esPrincipal: true,
      activa: true,
      tenantSlug: TENANT_SLUG,
    },
    {
      nombre: "Sucursal San Lorenzo",
      codigo: "SL02",
      direccion: "Ruta 1 Km 12",
      ciudad: "San Lorenzo",
      departamento: "Central",
      telefono: "+595217654321",
      email: "sanlorenzo@demo.com",
      gerente: "Gerente Demo",
      esPrincipal: false,
      activa: true,
      tenantSlug: TENANT_SLUG,
    },
  ].filter((s) => !sucCodes.has(s.codigo));
  for (const s of sucToInsert) {
    await db().insert(sucursales).values(s);
  }
  console.log(`   ✅  sucursales: ${sucToInsert.length} inserted (${existingSucursales.length} existed)`);

  // 4. staff_profiles
  console.log("\n   Creating staff_profiles...");
  const existingStaff = await db().select({ profileId: staffProfiles.profileId }).from(staffProfiles);
  const staffIds = new Set(existingStaff.map((s) => s.profileId));
  const staffToInsert: any[] = [];
  if (profileByEmail.get("admin@demo.com") && !staffIds.has(profileByEmail.get("admin@demo.com")!.id)) {
    staffToInsert.push({
      profileId: profileByEmail.get("admin@demo.com")!.id,
      position: "GERENTE_GENERAL" as const,
      baseSalary: 8000000,
      profitSharing: true,
    });
  }
  if (profileByEmail.get("manager@demo.com") && !staffIds.has(profileByEmail.get("manager@demo.com")!.id)) {
    staffToInsert.push({
      profileId: profileByEmail.get("manager@demo.com")!.id,
      position: "GERENTE_OPERATIVO" as const,
      baseSalary: 6000000,
      profitSharing: false,
    });
  }
  for (const s of staffToInsert) {
    await db().insert(staffProfiles).values(s);
  }
  console.log(`   ✅  staff_profiles: ${staffToInsert.length} inserted (${existingStaff.length} existed)`);

  // 5. mechanic_profiles
  console.log("\n   Creating mechanic_profiles...");
  const existingMech = await db().select({ profileId: mechanicProfiles.profileId }).from(mechanicProfiles);
  const mechIds = new Set(existingMech.map((m) => m.profileId));
  const mechToInsert: any[] = [];
  if (profileByEmail.get("mechanic@demo.com") && !mechIds.has(profileByEmail.get("mechanic@demo.com")!.id)) {
    mechToInsert.push({
      profileId: profileByEmail.get("mechanic@demo.com")!.id,
      category: "OFICIAL_CERTIFICADO" as const,
      baseSalary: 4500000,
      commissionRate: "10.00",
      activo: true,
    });
  }
  // Add a second mechanic profile by linking to manager? No - manager is staff, not mechanic. We only have 3 profiles total as per base data.
  for (const m of mechToInsert) {
    await db().insert(mechanicProfiles).values(m);
  }
  console.log(`   ✅  mechanic_profiles: ${mechToInsert.length} inserted (${existingMech.length} existed)`);

  const allMechProfiles = await db().select().from(mechanicProfiles);
  const mechProfileByUserEmail = new Map<string, any>();
  for (const m of allMechProfiles) {
    const prof = profileList.find((p) => p.id === m.profileId);
    if (prof) {
      mechProfileByUserEmail.set(prof.email, m);
    }
  }

  // 6. commission_records
  console.log("\n   Creating commission_records...");
  const existingComms = await db().select().from(commissionRecords).where(eq(commissionRecords.tenantId, tenantId));
  const commExists = existingComms.length > 0;
  const commToInsert: any[] = [];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const mechProf = mechProfileByUserEmail.get("mechanic@demo.com");
  const ot1 = orderByDescription.get("Service básico 45.000 km — cambio de aceite, filtro, inspección");
  const ot2 = orderByDescription.get("Cambio de pastillas delanteras y discos");
  if (!commExists && mechProf) {
    if (ot1) {
      commToInsert.push({
        tenantId,
        orderId: ot1.id,
        mechanicProfileId: mechProf.id,
        laborAmount: 150000,
        commissionRate: "10.00",
        commissionAmount: 15000,
        status: "LIBERADO" as const,
        month: currentMonth,
        year: currentYear,
      });
    }
    if (ot2) {
      commToInsert.push({
        tenantId,
        orderId: ot2.id,
        mechanicProfileId: mechProf.id,
        laborAmount: 200000,
        commissionRate: "10.00",
        commissionAmount: 20000,
        status: "EN_ESPERA_DE_UMBRAL" as const,
        month: currentMonth - 1 === 0 ? 12 : currentMonth - 1,
        year: currentMonth - 1 === 0 ? currentYear - 1 : currentYear,
      });
    }
  }
  for (const c of commToInsert) {
    await db().insert(commissionRecords).values(c);
  }
  console.log(`   ✅  commission_records: ${commToInsert.length} inserted (${existingComms.length} existed)`);

  // 7. notificaciones
  console.log("\n   Creating notificaciones...");
  const existingNotif = await db().select({ titulo: notificaciones.titulo }).from(notificaciones).where(eq(notificaciones.tenantSlug, TENANT_SLUG));
  const notifTitles = new Set(existingNotif.map((n) => n.titulo));
  const notifToInsert: any[] = [
    { tipo: "INVENTARIO", titulo: "Stock bajo: Aceite 20W50", mensaje: "Nivel de stock por debajo del mínimo configurado.", tenantSlug: TENANT_SLUG },
    { tipo: "COBRO", titulo: "Factura vencida", mensaje: "Una factura se encuentra vencida.", tenantSlug: TENANT_SLUG },
    { tipo: "OT", titulo: "OT lista para retiro", mensaje: "Orden de trabajo lista para entregar.", tenantSlug: TENANT_SLUG },
    { tipo: "SISTEMA", titulo: "Mantenimiento programado", mensaje: "Recordatorio de mantenimiento programado.", tenantSlug: TENANT_SLUG },
    { tipo: "SEGURIDAD", titulo: "Acceso desde nuevo dispositivo", mensaje: "Se detectó acceso desde IP no habitual.", tenantSlug: TENANT_SLUG },
  ].filter((n) => !notifTitles.has(n.titulo));
  for (const n of notifToInsert) {
    await db().insert(notificaciones).values(n);
  }
  console.log(`   ✅  notificaciones: ${notifToInsert.length} inserted (${existingNotif.length} existed)`);

  // 8. notification_priorities
  console.log("\n   Creating notification_priorities...");
  const existingNP = await db().select({ titulo: notificationPriorities.titulo }).from(notificationPriorities).where(eq(notificationPriorities.tenantSlug, TENANT_SLUG));
  const npTitles = new Set(existingNP.map((n) => n.titulo));
  const npToInsert: any[] = [
    { tipo: "INVENTARIO", priority: "HIGH", titulo: "Stock bajo crítico", mensaje: "Stock crítico en repuesto.", tenantSlug: TENANT_SLUG },
    { tipo: "COBRO", priority: "URGENT", titulo: "Factura vencida hace 3 días", mensaje: "Factura vencida hace varios días.", tenantSlug: TENANT_SLUG },
    { tipo: "SEGURIDAD", priority: "URGENT", titulo: "Intento de acceso fallido", mensaje: "Múltiples intentos de acceso.", tenantSlug: TENANT_SLUG },
    { tipo: "OT", priority: "NORMAL", titulo: "OT asignada", mensaje: "Nueva OT asignada al mecánico.", tenantSlug: TENANT_SLUG },
  ].filter((n) => !npTitles.has(n.titulo));
  for (const n of npToInsert) {
    await db().insert(notificationPriorities).values(n as any);
  }
  console.log(`   ✅  notification_priorities: ${npToInsert.length} inserted (${existingNP.length} existed)`);

  // 9. api_keys
  console.log("\n   Creating api_keys...");
  const existingKeys = await db()
    .select({ name: apiKeys.name })
    .from(apiKeys)
    .where(eq(apiKeys.tenantSlug, TENANT_SLUG));
  const keyNames = new Set(existingKeys.map((k) => k.name));
  const keysToInsert = [
    {
      name: "Integración Taller (demo)",
      keyHash: "3b1f8c2e4d5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e",
      keyPrefix: "erp_...d5e",
      scopes: ["read:workshop", "read:inventory"],
      rateLimit: 120,
      dailyLimit: 10000,
      ipWhitelist: [],
    },
    {
      name: "Dashboard Analítica (demo)",
      keyHash: "9a8b7c6d5e4f30213210fedcba9876543210fedcba9876543210fedcba987654",
      keyPrefix: "erp_...654",
      scopes: ["read:analytics", "read:finance"],
      rateLimit: 60,
      dailyLimit: 5000,
      ipWhitelist: ["127.0.0.1"],
    },
  ].filter((k) => !keyNames.has(k.name));
  for (const k of keysToInsert) {
    await db().insert(apiKeys).values({ ...k, tenantSlug: TENANT_SLUG, isActive: true });
  }
  console.log(`   ✅  api_keys: ${keysToInsert.length} inserted (${existingKeys.length} existed)`);

  const allKeys = await db()
    .select({ id: apiKeys.id, name: apiKeys.name })
    .from(apiKeys)
    .where(eq(apiKeys.tenantSlug, TENANT_SLUG));
  const keyIdByName = new Map(allKeys.map((k) => [k.name, k.id]));

  // 10. api_key_usage_log
  console.log("\n   Creating api_key_usage_log...");
  const existingUsage = await db()
    .select({ id: apiKeyUsageLog.id })
    .from(apiKeyUsageLog)
    .where(eq(apiKeyUsageLog.tenantSlug, TENANT_SLUG))
    .limit(1);
  let usageCount = 0;
  const firstKeyId = keyIdByName.get("Integración Taller (demo)");
  if (existingUsage.length === 0 && firstKeyId) {
    const usageToInsert = [
      { endpoint: "/api/v1/workshop/ordenes", method: "GET", statusCode: 200, responseTimeMs: 42, ipAddress: "190.10.20.30", userAgent: "Mozilla/5.0" },
      { endpoint: "/api/v1/inventory/repuestos", method: "GET", statusCode: 200, responseTimeMs: 55, ipAddress: "190.10.20.30", userAgent: "Mozilla/5.0" },
      { endpoint: "/api/v1/workshop/ordenes", method: "POST", statusCode: 201, responseTimeMs: 88, ipAddress: "190.10.20.30", userAgent: "Mozilla/5.0" },
    ];
    for (const u of usageToInsert) {
      await db().insert(apiKeyUsageLog).values({ ...u, apiKeyId: firstKeyId, tenantSlug: TENANT_SLUG });
      usageCount++;
    }
  }
  console.log(`   ✅  api_key_usage_log: ${usageCount} inserted (${existingUsage.length} existed)`);

  // 11. two_factor_secrets
  console.log("\n   Creating two_factor_secrets...");
  const existing2fa = await db()
    .select({ profileId: twoFactorSecrets.profileId })
    .from(twoFactorSecrets)
    .where(eq(twoFactorSecrets.tenantSlug, TENANT_SLUG));
  const twoFaProfileIds = new Set(existing2fa.map((t) => t.profileId));
  const adminProfile = profileByEmail.get("admin@demo.com");
  let twoFaCount = 0;
  if (adminProfile && !twoFaProfileIds.has(adminProfile.id)) {
    await db().insert(twoFactorSecrets).values({
      tenantSlug: TENANT_SLUG,
      profileId: adminProfile.id,
      secretEncrypted: "JBSWY3DPEHPK3PXP-encrypted-demo-secret",
      backupCodesHash: ["hash-1", "hash-2", "hash-3", "hash-4"],
      enabledAt: new Date(),
    });
    twoFaCount++;
  }
  console.log(`   ✅  two_factor_secrets: ${twoFaCount} inserted (${existing2fa.length} existed)`);

  // 12. sso_config
  console.log("\n   Creating sso_config...");
  const [existingSso] = await db().select({ id: ssoConfig.id }).from(ssoConfig).where(eq(ssoConfig.tenantSlug, TENANT_SLUG));
  let ssoCount = 0;
  if (!existingSso) {
    await db().insert(ssoConfig).values({
      id: `sso-${TENANT_SLUG}`,
      tenantSlug: TENANT_SLUG,
      samlEnabled: false,
      oidcEnabled: false,
      oidcScopes: "openid email profile",
      enforceSso: false,
      defaultRole: "user",
    });
    ssoCount++;
  }
  console.log(`   ✅  sso_config: ${ssoCount} inserted`);

  // 13. white_label_config
  console.log("\n   Creating white_label_config...");
  const [existingWl] = await db().select({ id: whiteLabelConfig.id }).from(whiteLabelConfig).where(eq(whiteLabelConfig.tenantSlug, TENANT_SLUG));
  let wlCount = 0;
  if (!existingWl) {
    await db().insert(whiteLabelConfig).values({
      id: `wl-${TENANT_SLUG}`,
      tenantSlug: TENANT_SLUG,
      sslEnabled: true,
      companyName: "Taller Demo",
      primaryColor: "#f97316",
      secondaryColor: "#1e293b",
      accentColor: "#3b82f6",
      emailFromName: "Taller Demo",
      emailFromAddress: "no-reply@demo.com",
    });
    wlCount++;
  }
  console.log(`   ✅  white_label_config: ${wlCount} inserted`);

  // 14. email_log
  console.log("\n   Creating email_log...");
  const existingEmails = await db()
    .select({ subject: emailLog.subject, to: emailLog.to })
    .from(emailLog)
    .where(eq(emailLog.tenantSlug, TENANT_SLUG));
  const emailKeys = new Set(existingEmails.map((e) => `${e.to}|${e.subject}`));
  const emailsToInsert = [
    { from: "no-reply@demo.com", to: "juan.martinez@example.com", subject: "Su vehículo está listo para retiro", status: "SENT" },
    { from: "no-reply@demo.com", to: "maria.gonzalez@example.com", subject: "Recordatorio de mantenimiento", status: "SENT" },
    { from: "no-reply@demo.com", to: "roberto.avila@example.com", subject: "Presupuesto de reparación Nº 1042", status: "PENDING" },
  ].filter((e) => !emailKeys.has(`${e.to}|${e.subject}`));
  for (const e of emailsToInsert) {
    await db().insert(emailLog).values({ ...e, tenantSlug: TENANT_SLUG });
  }
  console.log(`   ✅  email_log: ${emailsToInsert.length} inserted (${existingEmails.length} existed)`);

  // 15. audit_log (finance audit trail)
  console.log("\n   Creating audit_log...");
  const existingAudit = await db()
    .select({ descripcion: auditLog.descripcion })
    .from(auditLog)
    .where(eq(auditLog.tenantSlug, TENANT_SLUG));
  const auditDescriptions = new Set(existingAudit.map((a) => a.descripcion));
  const auditToInsert = [
    { accion: "DELETE", entidad: "cliente", entidadId: clientList[0]?.id ?? "00000000-0000-0000-0000-000000000000", descripcion: "Cliente de prueba eliminado desde auditoría demo" },
    { accion: "UPDATE", entidad: "orden_trabajo", entidadId: orderList[0]?.id ?? "00000000-0000-0000-0000-000000000001", descripcion: "Estado de OT actualizado a Finalizado (demo)" },
  ].filter((a) => !auditDescriptions.has(a.descripcion));
  for (const a of auditToInsert) {
    await db().insert(auditLog).values({
      ...a,
      tenantSlug: TENANT_SLUG,
      usuarioId: adminProfile?.email ?? "admin@demo.com",
      ip: "190.10.20.30",
    });
  }
  console.log(`   ✅  audit_log: ${auditToInsert.length} inserted (${existingAudit.length} existed)`);

  // 16. enterprise_audit_log
  console.log("\n   Creating enterprise_audit_log...");
  const existingEnt = await db()
    .select({ id: enterpriseAuditLog.id })
    .from(enterpriseAuditLog)
    .where(eq(enterpriseAuditLog.tenantSlug, TENANT_SLUG))
    .limit(1);
  let entCount = 0;
  if (existingEnt.length === 0) {
    const entToInsert = [
      { action: "create", entityType: "client", entityId: clientList[0]?.id ?? null, severity: "info", details: { origen: "seed-demo" } },
      { action: "update", entityType: "work_order", entityId: orderList[0]?.id ?? null, severity: "info", details: { campo: "status", nuevo: "Finalizado" } },
      { action: "export", entityType: "report", entityId: null, severity: "warning", details: { formato: "csv", filas: 55 } },
    ];
    for (const e of entToInsert) {
      await db().insert(enterpriseAuditLog).values({
        ...e,
        tenantSlug: TENANT_SLUG,
        userId: adminProfile?.id ?? null,
        userEmail: adminProfile?.email ?? "admin@demo.com",
        userRole: "admin",
        ipAddress: "190.10.20.30",
        userAgent: "seed-demo/1.0",
      });
      entCount++;
    }
  }
  console.log(`   ✅  enterprise_audit_log: ${entCount} inserted (${existingEnt.length} existed)`);

  // 17. hardware_fingerprints
  console.log("\n   Creating hardware_fingerprints...");
  const existingHw = await db()
    .select({ motherboardUuid: hardwareFingerprints.motherboardUuid })
    .from(hardwareFingerprints);
  let hwCount = 0;
  let fingerprintId: string | undefined;
  const hwUuid = "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80";
  const existingHwRow = existingHw.find((h) => h.motherboardUuid === hwUuid);
  if (!existingHwRow) {
    const [ins] = await db().insert(hardwareFingerprints).values({
      nombre: "Taller Demo - Servidor Principal",
      motherboardUuid: hwUuid,
      cpuSerial: "CPU-DEMO-0001",
      diskSerial: "DISK-DEMO-0001",
      hostname: "taller-demo-server",
      platform: "linux",
      activo: true,
    }).returning({ id: hardwareFingerprints.id });
    fingerprintId = ins?.id;
    hwCount++;
  }
  console.log(`   ✅  hardware_fingerprints: ${hwCount} inserted (${existingHw.length} existed)`);

  // 18. usb_security_tokens
  console.log("\n   Creating usb_security_tokens...");
  const existingUsb = await db()
    .select({ usbSerial: usbSecurityTokens.usbSerial })
    .from(usbSecurityTokens);
  const usbSerials = new Set(existingUsb.map((u) => u.usbSerial));
  const usbSerial = "USB-DEMO-0001";
  let usbCount = 0;
  if (!usbSerials.has(usbSerial)) {
    let fpId = fingerprintId;
    if (!fpId) {
      const [fp] = await db()
        .select({ id: hardwareFingerprints.id })
        .from(hardwareFingerprints)
        .where(eq(hardwareFingerprints.motherboardUuid, hwUuid))
        .limit(1);
      fpId = fp?.id;
    }
    await db().insert(usbSecurityTokens).values({
      nombre: "Dongle Principal Taller Demo",
      usbSerial,
      usbVendorId: "0781",
      usbProductId: "5583",
      usbModel: "SanDisk Cruzer Blade",
      tokenHash: "aes256-demo-token-hash-0000000000000000000000000000",
      fingerprintId: fpId ?? null,
      activo: true,
    });
    usbCount++;
  }
  console.log(`   ✅  usb_security_tokens: ${usbCount} inserted (${existingUsb.length} existed)`);

  // 19. security_audit_log
  console.log("\n   Creating security_audit_log...");
  const existingSec = await db()
    .select({ id: securityAuditLog.id })
    .from(securityAuditLog)
    .limit(1);
  let secCount = 0;
  if (existingSec.length === 0) {
    const secToInsert = [
      { eventType: "USB_INSERT", descripcion: "Dongle USB insertado en el servidor", severidad: "INFO", usbSerial },
      { eventType: "VALIDATION_OK", descripcion: "Validación de licencia correcta", severidad: "INFO", usbSerial },
      { eventType: "UNAUTHORIZED_ACCESS", descripcion: "Intento de acceso desde dispositivo no reconocido", severidad: "CRITICAL", usbSerial: null },
    ];
    for (const s of secToInsert) {
      await db().insert(securityAuditLog).values({
        ...s,
        fingerprintId: fingerprintId ?? null,
        ipAddress: "190.10.20.30",
        userAgent: "seed-demo/1.0",
      });
      secCount++;
    }
  }
  console.log(`   ✅  security_audit_log: ${secCount} inserted (${existingSec.length} existed)`);

  // 20. label_templates
  console.log("\n   Creating label_templates...");
  const existingLabels = await db()
    .select({ nombre: labelTemplates.nombre })
    .from(labelTemplates)
    .where(eq(labelTemplates.tenantSlug, TENANT_SLUG));
  const labelNames = new Set(existingLabels.map((l) => l.nombre));
  const labelsToInsert = [
    {
      nombre: "Etiqueta Repuesto Estándar",
      tipo: "REPUESTO" as const,
      protocolo: "ESCPOS" as const,
      anchoMm: 50,
      altoMm: 30,
      dpi: 203,
      copiasDefault: 1,
      layout: { fields: [{ type: "barcode", format: "CODE128", dataField: "codigo_barras" }, { type: "text", dataField: "descripcion" }], cutPaper: true },
    },
    {
      nombre: "Rótulo Herramienta Pesada",
      tipo: "HERRAMIENTA" as const,
      protocolo: "ZPL" as const,
      anchoMm: 60,
      altoMm: 40,
      dpi: 203,
      copiasDefault: 1,
      layout: { fields: [{ type: "barcode", format: "QR", dataField: "codigo" }, { type: "text", dataField: "nombre" }] },
    },
  ].filter((l) => !labelNames.has(l.nombre));
  for (const l of labelsToInsert) {
    await db().insert(labelTemplates).values({ ...l, tenantSlug: TENANT_SLUG, activo: true });
  }
  console.log(`   ✅  label_templates: ${labelsToInsert.length} inserted (${existingLabels.length} existed)`);

  const allLabels = await db()
    .select({ id: labelTemplates.id, nombre: labelTemplates.nombre, protocolo: labelTemplates.protocolo })
    .from(labelTemplates)
    .where(eq(labelTemplates.tenantSlug, TENANT_SLUG));
  const labelByName = new Map(allLabels.map((l) => [l.nombre, l]));

  // 21. print_jobs
  console.log("\n   Creating print_jobs...");
  const existingPrint = await db()
    .select({ id: printJobs.id })
    .from(printJobs)
    .where(eq(printJobs.tenantSlug, TENANT_SLUG))
    .limit(1);
  let printCount = 0;
  const repuestoLabel = labelByName.get("Etiqueta Repuesto Estándar");
  if (existingPrint.length === 0 && repuestoLabel) {
    const printToInsert = [
      { entityType: "repuesto", entityId: "REP-DEMO-001", copias: 2, impresora: "192.168.1.50", protocolo: "ESCPOS" as const, payload: "ESC/POS demo payload", estado: "IMPRESO" },
      { entityType: "repuesto", entityId: "REP-DEMO-002", copias: 1, impresora: "192.168.1.50", protocolo: "ESCPOS" as const, payload: "ESC/POS demo payload 2", estado: "PENDIENTE", error: null },
    ];
    for (const p of printToInsert) {
      await db().insert(printJobs).values({ ...p, templateId: repuestoLabel.id, tenantSlug: TENANT_SLUG });
      printCount++;
    }
  }
  console.log(`   ✅  print_jobs: ${printCount} inserted (${existingPrint.length} existed)`);

  console.log("\n🌱 Admin/CRM/security seed data created!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
