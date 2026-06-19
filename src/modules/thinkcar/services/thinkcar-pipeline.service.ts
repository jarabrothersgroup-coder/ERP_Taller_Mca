import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { thinkcarImports } from "../schema/index.js";
import type { NewThinkcarImport } from "../schema/index.js";
import { computeFileHash, parseFromPdf } from "./thinkcar-parser.service.js";
import { smartLink, markManualReview } from "./thinkcar-linker.service.js";
import type {
  ImportStatus,
  PipelineResult,
  SourceChannel,
} from "../types.js";

export async function checkDuplicate(
  fileHash: string,
): Promise<{ duplicate: boolean; existingId?: string }> {
  const [existing] = await db()
    .select({ id: thinkcarImports.id })
    .from(thinkcarImports)
    .where(eq(thinkcarImports.fileHash, fileHash))
    .limit(1);
  if (existing) {
    return { duplicate: true, existingId: existing.id };
  }
  return { duplicate: false };
}

export async function processBuffer(
  buffer: Buffer,
  fileName: string,
  sourceChannel: SourceChannel,
  sourcePath?: string,
): Promise<PipelineResult> {
  const fileHash = computeFileHash(buffer);

  const dupCheck = await checkDuplicate(fileHash);
  if (dupCheck.duplicate) {
    return {
      importId: dupCheck.existingId!,
      status: "duplicate",
      parsed: null,
      linking: null,
      duplicate: true,
      error: `Archivo duplicado omitido: ${fileName}`,
    };
  }

  let parsed;
  try {
    parsed = await parseFromPdf(buffer, fileName);
  } catch (err: any) {
    const newImport: NewThinkcarImport = {
      fileName,
      fileHash,
      fileSize: buffer.length,
      sourceChannel,
      sourcePath: sourcePath ?? null,
      status: "error",
      errorMessage: `Error al parsear PDF: ${err.message}`,
    };

    const [saved] = await db()
      .insert(thinkcarImports)
      .values(newImport)
      .returning({ id: thinkcarImports.id });

    return {
      importId: saved!.id,
      status: "error",
      parsed: null,
      linking: null,
      duplicate: false,
      error: err.message,
    };
  }

  const dtcCodes = parsed.dtcs.map((d) => d.code);

  const newImport: NewThinkcarImport = {
    fileName,
    fileHash,
    fileSize: buffer.length,
    sourceChannel,
    sourcePath: sourcePath ?? null,
    vin: parsed.vin ?? null,
    brand: parsed.brand ?? null,
    model: parsed.model ?? null,
    reportType: parsed.reportType ?? null,
    scanDate: parsed.scanDate ?? null,
    dtcCodes: dtcCodes.length > 0 ? dtcCodes : null,
    dtcDescriptions: parsed.dtcs.length > 0
      ? (JSON.parse(JSON.stringify(parsed.dtcs)) as any)
      : null,
    status: "pending",
    rawText: parsed.rawText.substring(0, 50000),
  };

  const [saved] = await db()
    .insert(thinkcarImports)
    .values(newImport)
    .returning();

  if (!saved) {
    return {
      importId: "error",
      status: "error",
      parsed,
      linking: null,
      duplicate: false,
      error: "Error al guardar en base de datos",
    };
  }

  let linking = null;
  try {
    linking = await smartLink(saved, parsed);
  } catch (err: any) {
    await markManualReview(saved.id, `Error en vinculación: ${err.message}`);
    linking = {
      status: "manual_review" as const,
      vehicleId: null,
      ordenTrabajoId: null,
      clientId: null,
      message: err.message,
    };
  }

  return {
    importId: saved.id,
    status: (linking?.status as ImportStatus) ?? "pending",
    parsed,
    linking,
    duplicate: false,
  };
}

export async function processFile(
  filePath: string,
  sourceChannel: SourceChannel,
): Promise<PipelineResult> {
  const buffer = await readFile(filePath);
  const fileName = filePath.split("/").pop() ?? filePath;
  return processBuffer(buffer, fileName, sourceChannel, filePath);
}

export function formatSummary(results: PipelineResult[]): string {
  const total = results.length;
  const linked = results.filter((r) => r.status === "linked").length;
  const dupes = results.filter((r) => r.duplicate).length;
  const errors = results.filter((r) => r.status === "error").length;
  const manual = results.filter((r) => r.status === "manual_review").length;
  let totalDtcs = 0;
  for (const r of results) {
    if (r.parsed?.dtcs) totalDtcs += r.parsed.dtcs.length;
  }

  return [
    `Procesados: ${total} archivos`,
    `  Vinculados: ${linked}`,
    `  Duplicados omitidos: ${dupes}`,
    `  Revisión manual: ${manual}`,
    `  Errores: ${errors}`,
    `Total DTCs extraídos: ${totalDtcs}`,
  ].join("\n");
}
