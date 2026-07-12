/**
 * SSO & White-Label Configuration Schema
 *
 * Defines the database schema for enterprise features:
 * - SSO (SAML/OIDC) configuration per tenant
 * - White-label settings (custom domain, branding, logo)
 * - Data retention policies for SOC2 compliance
 *
 * @module enterprise/schema
 */

import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

/* ── SSO Configuration ─────────────────────── */

export const ssoConfig = pgTable("sso_config", {
  id: text("id").primaryKey(),
  tenantSlug: text("tenant_slug").notNull().unique(),

  // SAML 2.0
  samlEnabled: boolean("saml_enabled").default(false).notNull(),
  samlMetadataUrl: text("saml_metadata_url"),
  samlEntityId: text("saml_entity_id"),
  samlAcsUrl: text("saml_acs_url"),
  samlCertificate: text("saml_certificate"),

  // OIDC
  oidcEnabled: boolean("oidc_enabled").default(false).notNull(),
  oidcIssuer: text("oidc_issuer"),
  oidcClientId: text("oidc_client_id"),
  oidcClientSecret: text("oidc_client_secret"),
  oidcScopes: text("oidc_scopes").default("openid email profile"),

  // General
  enforceSso: boolean("enforce_sso").default(false).notNull(),
  defaultRole: text("default_role").default("user"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("sso_config_tenant_idx").on(table.tenantSlug),
]);

export type SsoConfig = typeof ssoConfig.$inferSelect;
export type NewSsoConfig = typeof ssoConfig.$inferInsert;

/* ── White-Label Settings ───────────────────── */

export const whiteLabelConfig = pgTable("white_label_config", {
  id: text("id").primaryKey(),
  tenantSlug: text("tenant_slug").notNull().unique(),

  // Custom domain
  customDomain: text("custom_domain"),
  sslEnabled: boolean("ssl_enabled").default(true).notNull(),

  // Branding
  companyName: text("company_name"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").default("#f97316"),
  secondaryColor: text("secondary_color").default("#1e293b"),
  accentColor: text("accent_color").default("#3b82f6"),

  // Footer / Legal
  footerText: text("footer_text"),
  privacyPolicyUrl: text("privacy_policy_url"),
  termsOfServiceUrl: text("terms_of_service_url"),

  // Email branding
  emailFromName: text("email_from_name"),
  emailFromAddress: text("email_from_address"),
  emailHeaderHtml: text("email_header_html"),
  emailFooterHtml: text("email_footer_html"),

  // App branding
  iosAppId: text("ios_app_id"),
  androidPackageId: text("android_package_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("white_label_tenant_idx").on(table.tenantSlug),
  index("white_label_domain_idx").on(table.customDomain),
]);

export type WhiteLabelConfig = typeof whiteLabelConfig.$inferSelect;
export type NewWhiteLabelConfig = typeof whiteLabelConfig.$inferInsert;

/* ── Data Retention Policies (SOC2) ─────────── */

export const dataRetentionPolicy = pgTable("data_retention_policy", {
  id: text("id").primaryKey(),
  tenantSlug: text("tenant_slug").notNull().unique(),

  // Retention periods (days)
  auditLogRetentionDays: text("audit_log_retention_days").default("2555").notNull(), // 7 years
  emailLogRetentionDays: text("email_log_retention_days").default("365").notNull(), // 1 year
  backupRetentionDays: text("backup_retention_days").default("90").notNull(), // 90 days
  sessionRetentionDays: text("session_retention_days").default("30").notNull(), // 30 days

  // Auto-cleanup
  autoCleanupEnabled: boolean("auto_cleanup_enabled").default(true).notNull(),
  lastCleanupAt: timestamp("last_cleanup_at", { withTimezone: true }),

  // Encryption
  encryptionAtRest: boolean("encryption_at_rest").default(true).notNull(),
  encryptionInTransit: boolean("encryption_in_transit").default(true).notNull(),

  // Compliance
  gdprCompliant: boolean("gdpr_compliant").default(true).notNull(),
  dataExportEnabled: boolean("data_export_enabled").default(true).notNull(),
  rightToErasure: boolean("right_to_erasure").default(true).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("data_retention_tenant_idx").on(table.tenantSlug),
]);

export type DataRetentionPolicy = typeof dataRetentionPolicy.$inferSelect;
export type NewDataRetentionPolicy = typeof dataRetentionPolicy.$inferInsert;
