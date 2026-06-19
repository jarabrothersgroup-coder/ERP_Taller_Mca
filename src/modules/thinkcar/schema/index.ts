import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { vehiculos } from "../../workshop/schema/vehiculos.js";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";
import { clients } from "../../../shared/database/schema/clients.js";

export const thinkcarImports = pgTable(
  "thinkcar_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    fileName: text("file_name").notNull(),
    fileHash: text("file_hash").notNull(),
    fileSize: integer("file_size"),
    sourceChannel: text("source_channel").notNull().default("usb"),
    sourcePath: text("source_path"),

    vin: text("vin"),
    brand: text("brand"),
    model: text("model"),
    reportType: text("report_type"),
    scanDate: timestamp("scan_date", { withTimezone: true }),
    dtcCodes: text("dtc_codes").array(),
    dtcDescriptions: jsonb("dtc_descriptions"),

    vehicleId: uuid("vehicle_id").references(() => vehiculos.id, {
      onDelete: "set null",
    }),
    ordenTrabajoId: uuid("orden_trabajo_id").references(
      () => ordenesTrabajo.id,
      { onDelete: "set null" },
    ),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),

    status: text("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    healthScore: integer("health_score"),
    pendingAssignment: boolean("pending_assignment").notNull().default(false),

    rawText: text("raw_text"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    vinIdx: index("thinkcar_imports_vin_idx").on(table.vin),
    fileHashIdx: uniqueIndex("thinkcar_imports_file_hash_idx").on(
      table.fileHash,
    ),
    statusIdx: index("thinkcar_imports_status_idx").on(table.status),
    vehicleIdIdx: index("thinkcar_imports_vehicle_id_idx").on(
      table.vehicleId,
    ),
    createdAtIdx: index("thinkcar_imports_created_at_idx").on(table.createdAt),
  }),
);

export type ThinkcarImport = typeof thinkcarImports.$inferSelect;
export type NewThinkcarImport = typeof thinkcarImports.$inferInsert;
