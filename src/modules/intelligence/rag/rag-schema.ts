import { sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
});

export const vehicleManualChunks = pgTable(
  "vehicle_manual_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id"),
    content: text("content").notNull(),
    pageNumber: integer("page_number").notNull(),
    section: text("section"),
    metadata: text("metadata"),
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (table) => ({
    embeddingIdx: index("vmc_hnsw_idx").using("hnsw", sql`${table.embedding} vector_cosine_ops`),
    vehicleIdx: index("vmc_vehicle_id_idx").on(table.vehicleId),
  }),
);
