"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/providers/session-provider";
import { setTenantSlug } from "@/lib/api";

/**
 * Reads the user's tenantSlug from the JWT auth context
 * and sets it on the API client so all subsequent requests use the
 * correct tenant header.
 */
export function TenantResolver() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    setTenantSlug(user.tenantSlug);
  }, [user, loading]);

  return null;
}
