import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";

export interface VisualUpdatePayload {
  orderId: string;
  vehicleModel: string;
  plate: string;
  status: "DIAGNOSTICO" | "REPARACION" | "AJUSTE_FINAL" | "CONTROL_CALIDAD";
  torqueSpecs: Array<{ component: string; value: string }>;
  isHighVoltage: boolean;
  sohPercentage?: number;
  dtcCodes?: string[];
  estimatedCompletion?: string;
}

const connectedScreens: Set<WebSocket> = new Set();

interface TenantInfo {
  companyName: string;
  logoBase64: string;
  rucOrTaxId: string;
}

let tenantInfo: TenantInfo | null = null;
let tenantInfoPromise: Promise<TenantInfo> | null = null;

async function loadTenantInfo(): Promise<TenantInfo> {
  const { getSettings, getLogoBase64 } = await import(
    "../../config/services/TenantConfigService.js"
  );
  const [settings, logoBase64] = await Promise.all([getSettings(), getLogoBase64()]);
  return {
    companyName: settings.companyName,
    logoBase64,
    rucOrTaxId: settings.rucOrTaxId,
  };
}

async function getTenantInfo(): Promise<TenantInfo> {
  if (tenantInfo) return tenantInfo;
  if (!tenantInfoPromise) tenantInfoPromise = loadTenantInfo();
  tenantInfo = await tenantInfoPromise;
  return tenantInfo;
}

export function invalidateTenantCache(): void {
  tenantInfo = null;
  tenantInfoPromise = null;
}

export class VisualStreamGateway {
  static registerGateway(app: FastifyInstance): void {
    app.get("/api/v1/visual/stream", { websocket: true }, (socket, _req) => {
      connectedScreens.add(socket);

      getTenantInfo().then((t) => {
        socket.send(
          JSON.stringify({
            event: "CONNECTED",
            timestamp: new Date().toISOString(),
            tenant: { companyName: t.companyName, logoBase64: t.logoBase64, ruc: t.rucOrTaxId },
          }),
        );
      });

      app.log.info({ totalScreens: connectedScreens.size }, "TV screen connected");

      const keepAlive = setInterval(() => {
        if (socket.readyState === 1) socket.ping();
        else clearInterval(keepAlive);
      }, 30000);

      socket.on("close", () => {
        connectedScreens.delete(socket);
        clearInterval(keepAlive);
        app.log.info({ totalScreens: connectedScreens.size }, "TV screen disconnected");
      });

      socket.on("error", () => {
        connectedScreens.delete(socket);
        clearInterval(keepAlive);
      });
    });
  }

  static async broadcastUpdate(payload: VisualUpdatePayload): Promise<void> {
    const t = await getTenantInfo();
    const message = JSON.stringify({
      event: "WORKSHOP_UPDATE",
      data: {
        ...payload,
        companyName: t.companyName,
        logoBase64: t.logoBase64,
        ruc: t.rucOrTaxId,
        updatedAt: new Date().toLocaleTimeString("es-PY"),
      },
    });

    for (const socket of connectedScreens) {
      if (socket.readyState === 1) {
        socket.send(message);
      }
    }
  }

  static get connectedCount(): number {
    return connectedScreens.size;
  }

  /**
   * Registers a mock WebSocket for testing purposes.
   * Only available when NODE_ENV=test.
   */
  static __testing_registerSocket(socket: WebSocket): void {
    connectedScreens.add(socket);
  }

  /**
   * Clears all connected screens (for test isolation).
   * Only available when NODE_ENV=test.
   */
  static __testing_clear(): void {
    connectedScreens.clear();
  }
}
