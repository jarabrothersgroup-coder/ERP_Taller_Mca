import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { readdir, copyFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { processFile } from "./thinkcar-pipeline.service.js";
import { withRetry } from "../../../shared/utils/retry.js";
import { recordSuccess, recordError } from "./thinkcar-health.service.js";

const MOUNT_POINT = join(process.env.HOME || "/root", "Thinkcar");
const THINKCAR_PATH = join(
  MOUNT_POINT,
  "Almacenamiento interno compartido",
  "ThinkCar",
);
const STAGING_DIR = join(
  process.env.HOME || "/root",
  ".thinkcar_staging",
);

interface CmdError extends Error {
  stderr?: string;
  stdout?: string;
}

function runCmd(cmd: string, timeoutMs = 30000): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: timeoutMs });
  } catch (err: unknown) {
    const cmdErr = err as CmdError;
    throw new Error(
      `Comando falló: ${cmd}\n${cmdErr?.stderr ?? cmdErr?.message ?? "Error desconocido"}`,
    );
  }
}

export async function ensureDirectories(): Promise<void> {
  if (!existsSync(MOUNT_POINT)) {
    mkdirSync(MOUNT_POINT, { recursive: true });
  }
  if (!existsSync(STAGING_DIR)) {
    mkdirSync(STAGING_DIR, { recursive: true });
  }
}

export async function mountThinkcar(): Promise<void> {
  await ensureDirectories();
  const isMounted = existsSync(THINKCAR_PATH);
  if (isMounted) return;

  await withRetry(
    async () => {
      runCmd(`aft-mtp-mount "${MOUNT_POINT}" 2>/dev/null`);
      await new Promise((r) => setTimeout(r, 3000));

      if (!existsSync(THINKCAR_PATH)) {
        throw new Error("MTP mount completed but THINKCAR_PATH not found");
      }
    },
    {
      maxRetries: 2,
      baseDelayMs: 2000,
      onRetry: (attempt, err) => {
        console.warn(`[Thinkcar USB] Reintento ${attempt} de montaje: ${err.message}`);
      },
    },
  );
}

export async function unmountThinkcar(): Promise<void> {
  try {
    runCmd(`fusermount -u "${MOUNT_POINT}" 2>/dev/null`, 10000);
  } catch {
    try {
      runCmd(`umount "${MOUNT_POINT}" 2>/dev/null`, 10000);
    } catch {
      // Best-effort unmount — continue even if it fails
    }
  }
}

export async function scanForNewFiles(): Promise<string[]> {
  await ensureDirectories();

  if (!existsSync(THINKCAR_PATH)) {
    return [];
  }

  let files: string[];
  try {
    files = await readdir(THINKCAR_PATH);
  } catch {
    return [];
  }

  const pdfs = files.filter(
    (f) => extname(f).toLowerCase() === ".pdf",
  );

  const newFiles: string[] = [];
  for (const pdf of pdfs) {
    const src = join(THINKCAR_PATH, pdf);
    const dest = join(STAGING_DIR, pdf);

    try {
      await copyFile(src, dest);
      newFiles.push(dest);
    } catch {
      // File may be locked — skip
    }
  }

  return newFiles;
}

export async function ingestFromUsb(
  cleanupAfter = true,
): Promise<{ processed: number; summary: string }> {
  let mounted = false;
  try {
    await mountThinkcar();
    mounted = true;

    const files = await scanForNewFiles();
    if (files.length === 0) {
      recordSuccess("usb");
      return { processed: 0, summary: "No se encontraron nuevos archivos PDF en la tableta." };
    }

    const results = [];
    for (const f of files) {
      try {
        const result = await processFile(f, "usb");
        results.push(result);
        recordSuccess("usb");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        console.error(`[Thinkcar USB] Error procesando ${f}: ${msg}`);
        recordError("usb", msg);
      } finally {
        try {
          await unlink(f);
        } catch {
          // Best-effort cleanup
        }
      }
    }

    const { formatSummary } = await import("./thinkcar-pipeline.service.js");
    const summary = formatSummary(results);
    return { processed: results.length, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    recordError("usb", msg);
    throw err;
  } finally {
    if (mounted && cleanupAfter) {
      await unmountThinkcar();
    }
  }
}

let _usbTimer: ReturnType<typeof setInterval> | null = null;
let _consecutiveMountFailures = 0;

export function startUsbWatcher(
  intervalMs = 60000,
  onIngest?: (result: { processed: number; summary: string }) => void,
): void {
  if (_usbTimer) return;

  _usbTimer = setInterval(async () => {
    try {
      const result = await ingestFromUsb(true);
      _consecutiveMountFailures = 0;
      if (result.processed > 0 && onIngest) {
        onIngest(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      _consecutiveMountFailures++;
      console.error(`[Thinkcar USB Watcher] ${_consecutiveMountFailures}x: ${msg}`);

      // After 3 consecutive mount failures, increase interval temporarily
      if (_consecutiveMountFailures >= 3 && _usbTimer) {
        clearInterval(_usbTimer);
        const backoffInterval = Math.min(intervalMs * 5, 600000); // max 10 min
        console.warn(`[Thinkcar USB Watcher] Extendiendo intervalo a ${backoffInterval}ms por fallos consecutivos`);
        _usbTimer = setInterval(async () => {
          try {
            const result = await ingestFromUsb(true);
            _consecutiveMountFailures = 0;
            if (result.processed > 0 && onIngest) onIngest(result);
            // Reset to original interval on success
            clearInterval(_usbTimer!);
            startUsbWatcher(intervalMs, onIngest);
          } catch {
            _consecutiveMountFailures++;
          }
        }, backoffInterval);
        _usbTimer.unref();
      }
    }
  }, intervalMs);

  _usbTimer.unref();
}

export function stopUsbWatcher(): void {
  if (_usbTimer) {
    clearInterval(_usbTimer);
    _usbTimer = null;
  }
  _consecutiveMountFailures = 0;
}
