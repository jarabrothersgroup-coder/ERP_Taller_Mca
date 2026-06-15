/**
 * Supabase Fastify Plugin.
 *
 * Decorates Fastify instance with supabase admin and anon clients.
 * Registration is optional — both clients lazily initialize on first use.
 *
 * @module plugins/supabase
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    supabase: {
      admin: ReturnType<typeof import("../shared/database/supabase.js")["getSupabaseAdmin"]>;
      anon: ReturnType<typeof import("../shared/database/supabase.js")["getSupabaseAnon"]>;
    };
  }
}

const supabasePlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const { getSupabaseAdmin, getSupabaseAnon } = await import("../shared/database/supabase.js");

  app.decorate("supabase", {
    get admin() {
      return getSupabaseAdmin();
    },
    get anon() {
      return getSupabaseAnon();
    },
  });

  app.log.info("Supabase plugin registered");
};

export default fp(supabasePlugin, { name: "supabase" });
