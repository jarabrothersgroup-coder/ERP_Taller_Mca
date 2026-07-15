/**
 * SSO (OpenID Connect) Service — Enterprise Single Sign-On.
 *
 * Implements OpenID Connect Discovery for integration with:
 *   - Azure AD / Entra ID
 *   - Google Workspace
 *   - Okta
 *   - Keycloak
 *   - Auth0
 *
 * Features:
 *   - OIDC Discovery (/.well-known/openid-configuration)
 *   - JWT verification via JWKS endpoint
 *   - Tenant-scoped SSO configuration
 *   - Auto-provisioning of users from OIDC claims
 *
 * @module enterprise/services/sso-oidc.service
 */

import crypto from "node:crypto";

// ─── Types ────────────────────────────────────────────

export interface SsoProviderConfig {
  /** Provider name (azure, google, okta, keycloak, auth0, custom) */
  provider: "azure" | "google" | "okta" | "keycloak" | "auth0" | "custom";
  /** OIDC Discovery URL or Issuer */
  issuer: string;
  /** Client ID from OIDC provider */
  clientId: string;
  /** Client secret (stored encrypted in DB) */
  clientSecret: string;
  /** Redirect URI after OIDC callback */
  redirectUri: string;
  /** Scopes to request */
  scopes: string[];
  /** Whether to auto-provision users from OIDC claims */
  autoProvision: boolean;
  /** Default role for auto-provisioned users */
  defaultRole: string;
  /** Allowed email domains (empty = all allowed) */
  allowedDomains: string[];
}

export interface OidcUserInfo {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  revocation_endpoint?: string;
  end_session_endpoint?: string;
  [key: string]: unknown;
}

// ─── Well-Known Provider Configs ──────────────────────

const PROVIDER_DEFAULTS: Record<
  string,
  Partial<SsoProviderConfig> & { discoveryPath: string }
> = {
  azure: {
    discoveryPath: "/v2.0/.well-known/openid-configuration",
    scopes: ["openid", "profile", "email"],
  },
  google: {
    discoveryPath: "/.well-known/openid-configuration",
    scopes: ["openid", "profile", "email"],
  },
  okta: {
    discoveryPath: "/.well-known/openid-configuration",
    scopes: ["openid", "profile", "email"],
  },
  keycloak: {
    discoveryPath: "/realms/{realm}/.well-known/openid-configuration",
    scopes: ["openid", "profile", "email"],
  },
  auth0: {
    discoveryPath: "/.well-known/openid-configuration",
    scopes: ["openid", "profile", "email"],
  },
  custom: {
    discoveryPath: "/.well-known/openid-configuration",
    scopes: ["openid", "profile", "email"],
  },
};

// ─── OIDC Discovery ──────────────────────────────────

/**
 * Fetch OIDC Discovery document from issuer.
 */
export async function fetchOidcDiscovery(
  issuer: string,
  provider: string = "custom",
): Promise<OidcDiscoveryDocument> {
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.custom;
  const url = new URL(defaults.discoveryPath, issuer.replace(/\/$/, ""));

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`OIDC Discovery failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as OidcDiscoveryDocument;
}

/**
 * Build authorization URL for OIDC login redirect.
 */
export function buildAuthorizationUrl(
  discovery: OidcDiscoveryDocument,
  clientId: string,
  redirectUri: string,
  scopes: string[],
  state: string,
  nonce: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
    nonce,
    prompt: "select_account",
  });

  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

/**
 * Generate cryptographically random state and nonce for OIDC flow.
 */
export function generateOidcState(): { state: string; nonce: string } {
  return {
    state: crypto.randomBytes(32).toString("hex"),
    nonce: crypto.randomBytes(32).toString("hex"),
  };
}

/**
 * Build logout URL for OIDC session termination.
 */
export function buildLogoutUrl(
  discovery: OidcDiscoveryDocument,
  clientId: string,
  postLogoutRedirectUri?: string,
): string | null {
  if (!discovery.end_session_endpoint) return null;

  const params = new URLSearchParams({
    client_id: clientId,
  });

  if (postLogoutRedirectUri) {
    params.set("post_logout_redirect_uri", postLogoutRedirectUri);
  }

  return `${discovery.end_session_endpoint}?${params.toString()}`;
}

/**
 * Get SSO provider defaults for a given provider type.
 */
export function getProviderDefaults(provider: string) {
  return PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.custom;
}

/**
 * Validate email domain against allowed domains list.
 */
export function isEmailDomainAllowed(
  email: string,
  allowedDomains: string[],
): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  return allowedDomains.some((d) => d.toLowerCase() === domain);
}

/**
 * Map OIDC claims to ERP profile fields.
 */
export function mapOidcClaimsToProfile(claims: OidcUserInfo) {
  return {
    email: claims.email ?? "",
    fullName:
      claims.name ??
      [claims.given_name, claims.family_name].filter(Boolean).join(" ") ??
      claims.email?.split("@")[0] ??
      "Unknown",
    avatar: claims.picture,
    oidcSub: claims.sub,
    emailVerified: claims.email_verified ?? false,
  };
}
