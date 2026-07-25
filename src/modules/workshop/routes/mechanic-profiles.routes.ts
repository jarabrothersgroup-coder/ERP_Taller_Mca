import type { FastifyInstance } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { mechanicProfiles } from "../../finance/schema/mechanic-profiles.js";
import { profiles } from "../../../shared/database/schema/profiles.js";
import { eq } from "drizzle-orm";

export async function mechanicProfilesRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /workshop/mechanic-profiles
   * List all mechanic profiles with profile name.
   */
  app.get("/workshop/mechanic-profiles", async (_request, reply) => {
    const rows = await db()
      .select({
        id: mechanicProfiles.id,
        profileId: mechanicProfiles.profileId,
        category: mechanicProfiles.category,
        baseSalary: mechanicProfiles.baseSalary,
        commissionRate: mechanicProfiles.commissionRate,
        createdAt: mechanicProfiles.createdAt,
        nombre: profiles.fullName,
      })
      .from(mechanicProfiles)
      .leftJoin(profiles, eq(mechanicProfiles.profileId, profiles.id));

    return reply.send(rows);
  });

  /**
   * POST /workshop/mechanic-profiles
   * Create a new mechanic profile.
   */
  app.post("/workshop/mechanic-profiles", async (request, reply) => {
    const body = request.body as {
      profileId: string;
      category: string;
      baseSalary: number;
      commissionRate: number;
    };

    const [row] = await db()
      .insert(mechanicProfiles)
      .values({
        profileId: body.profileId,
        category: body.category as any,
        baseSalary: body.baseSalary,
        commissionRate: String(body.commissionRate),
      })
      .returning();

    return reply.status(201).send(row);
  });

  /**
   * PATCH /workshop/mechanic-profiles/:id
   * Update a mechanic profile.
   */
  app.patch("/workshop/mechanic-profiles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      category: string;
      baseSalary: number;
      commissionRate: number;
    }>;

    const updateData: Record<string, any> = {};
    if (body.category !== undefined) updateData.category = body.category;
    if (body.baseSalary !== undefined) updateData.baseSalary = body.baseSalary;
    if (body.commissionRate !== undefined) updateData.commissionRate = String(body.commissionRate);
    updateData.updatedAt = new Date();

    const [row] = await db()
      .update(mechanicProfiles)
      .set(updateData)
      .where(eq(mechanicProfiles.id, id))
      .returning();

    return reply.send(row);
  });
}
