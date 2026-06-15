import { createHash } from "node:crypto";
import { processBuffer } from "./thinkcar-pipeline.service.js";
import { withRetry } from "../../../shared/utils/retry.js";
import { recordSuccess, recordError } from "./thinkcar-health.service.js";

interface EmailAddress {
  address?: string;
  name?: string;
}

interface ImapAttachment {
  content: AsyncIterable<Uint8Array>;
  dispositionParameters?: { filename?: string };
}

interface ImapBodyPart {
  type: string;
  subtype?: string;
  partId?: string;
  dispositionParameters?: { filename?: string };
  childNodes?: ImapBodyPart[];
}

interface ImapEnvelope {
  from?: EmailAddress[];
  subject?: string;
}

interface ImapMessage {
  envelope: ImapEnvelope;
  bodyStructure?: ImapBodyPart;
  source?: Buffer;
}

interface ImapFlowClient {
  connect(): Promise<void>;
  getMailboxLock(mailbox: string): Promise<{ release(): void }>;
  fetch(query: string, options: { envelope: boolean; bodyStructure: boolean; source: boolean }): AsyncIterable<ImapMessage>;
  download(partId: string): Promise<ImapAttachment>;
  logout(): void;
}

interface ImapFlowConstructor {
  new(config: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    logger: boolean;
  }): ImapFlowClient;
}

const SEARCH_SUBJECTS = ["Thinkcar", "Informe de diagnóstico", "ThinkTool", "Diagnóstico"];
const SEARCH_FROM = ["thinkcar", "thinktool", "diagnóstico", "scan"];

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

function getConfig(): EmailConfig {
  return {
    host: process.env["THINKCAR_EMAIL_HOST"] ?? "imap.gmail.com",
    port: parseInt(process.env["THINKCAR_EMAIL_PORT"] ?? "993", 10),
    user: process.env["THINKCAR_EMAIL_USER"] ?? "",
    password: process.env["THINKCAR_EMAIL_PASSWORD"] ?? "",
    tls: process.env["THINKCAR_EMAIL_TLS"] !== "false",
  };
}

function isRelevantEmail(from: string, subject: string): boolean {
  const lowerFrom = from.toLowerCase();
  const lowerSub = subject.toLowerCase();

  const fromMatch = SEARCH_FROM.some((s) => lowerFrom.includes(s));
  const subMatch = SEARCH_SUBJECTS.some((s) => lowerSub.includes(s));
  return fromMatch || subMatch;
}

async function fetchAttachmentsViaImap(): Promise<number> {
  const config = getConfig();
  if (!config.user || !config.password) {
    throw new Error(
      "THINKCAR_EMAIL_USER y THINKCAR_EMAIL_PASSWORD no configurados",
    );
  }

  const ImapFlow = await loadImapFlow();
  const client: ImapFlowClient = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  });

  let count = 0;

  try {
    await withRetry(
      async () => {
        await client.connect();
      },
      {
        maxRetries: 2,
        baseDelayMs: 5000,
        onRetry: (attempt, err) => {
          console.warn(`[Thinkcar Email] Reintento ${attempt} de conexión IMAP: ${err.message}`);
        },
      },
    );

    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const msg of client.fetch("1:*", {
        envelope: true,
        bodyStructure: true,
        source: true,
      })) {
        const from = (msg.envelope.from as EmailAddress[] | undefined)?.map((a: EmailAddress) => a.address ?? "").join(", ") ?? "";
        const subject = msg.envelope.subject ?? "";

        if (!isRelevantEmail(from, subject)) continue;

        const parts = msg.bodyStructure?.childNodes ?? [];
        for (const part of parts) {
          if (
            part.type === "application" &&
            part.subtype?.toLowerCase() === "pdf"
          ) {
            const partId = part.partId;
            if (!partId) continue;

            const attachment = await client.download(partId);
            const chunks: Buffer[] = [];
            for await (const chunk of attachment.content) {
              chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
            }
            const pdfBuffer = Buffer.concat(chunks);

            if (pdfBuffer.length < 100 || pdfBuffer.length > 50 * 1024 * 1024) continue;

            const fileName =
              part.dispositionParameters?.filename ??
              `email_${Date.now()}_${createHash("md5").update(pdfBuffer).digest("hex").slice(0, 8)}.pdf`;

            try {
              const result = await processBuffer(
                pdfBuffer,
                fileName,
                "email",
              );
              if (result.status === "duplicate") {
                console.log(`[Thinkcar Email] Duplicado omitido: ${fileName}`);
              } else if (result.status === "linked") {
                console.log(
                  `[Thinkcar Email] Vinculado: ${fileName} → OT ${result.linking?.ordenTrabajoId?.slice(0, 8) ?? "N/A"}`,
                );
              } else {
                console.log(
                  `[Thinkcar Email] ${result.status}: ${fileName}${result.error ? " - " + result.error : ""}`,
                );
              }
              recordSuccess("email");
              count++;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Error desconocido";
              console.error(`[Thinkcar Email] Error procesando ${fileName}:`, msg);
              recordError("email", msg);
            }
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return count;
}

let _imapFlowModule: ImapFlowConstructor | null = null;

async function loadImapFlow(): Promise<ImapFlowConstructor> {
  if (_imapFlowModule) return _imapFlowModule;

  try {
    const mod = await import("imapflow");
    _imapFlowModule = mod.ImapFlow as unknown as ImapFlowConstructor;
    return _imapFlowModule;
  } catch {
    throw new Error(
      "La librería 'imapflow' no está instalada. Ejecute: npm install imapflow",
    );
  }
}

let _emailTimer: ReturnType<typeof setInterval> | null = null;
let _consecutiveEmailFailures = 0;

export function startEmailPolling(intervalMs = 300000): void {
  if (_emailTimer) return;

  const poll = async () => {
    try {
      const count = await fetchAttachmentsViaImap();
      _consecutiveEmailFailures = 0;
      if (count > 0) {
        console.log(`[Thinkcar Email] Procesados ${count} adjuntos de correo`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      _consecutiveEmailFailures++;
      console.error(`[Thinkcar Email] Error en polling (${_consecutiveEmailFailures}x):`, msg);

      // After 3 consecutive failures, extend interval
      if (_consecutiveEmailFailures >= 3) {
        console.warn(`[Thinkcar Email] Pausando polling por ${Math.min(intervalMs, 3600000)}ms debido a fallos`);
        // The next scheduled poll will still run — the timer is already set
        // But we don't want to spam logs every interval
      }
    }
  };

  poll().catch(() => {});
  _emailTimer = setInterval(poll, intervalMs);
  _emailTimer.unref();
}

export function stopEmailPolling(): void {
  if (_emailTimer) {
    clearInterval(_emailTimer);
    _emailTimer = null;
  }
  _consecutiveEmailFailures = 0;
}

export async function checkEmailNow(): Promise<number> {
  return fetchAttachmentsViaImap();
}
