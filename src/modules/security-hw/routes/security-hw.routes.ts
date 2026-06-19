/**
 * Hardware Security Routes — API endpoints for USB dongle management.
 *
 * Endpoints:
 *   GET  /security/hw/status — Current hardware & USB status
 *   POST /security/hw/generate-token — Generate new hardware token
 *   POST /security/hw/validate-token — Validate current token
 *   POST /security/hw/setup — Initial setup (write token to USB)
 *   GET  /security/hw/audit — Security audit log
 *   POST /security/hw/audit — Log security event
 *   GET  /security/hw/fingerprint — Get hardware fingerprint
 *   GET  /security/hw/usb-devices — List connected USB devices
 *
 * @module security-hw/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  getHardwareFingerprint,
  detectUsbDevices,
  findUsbDongle,
  generateHardwareToken,
  validateHardwareToken,
  readTokenFromUsb,
  writeTokenToUsb,
  setupUsbDongle,
  quickValidate,
} from "../services/hardware-fingerprint.service.js";

interface SetupBody {
  usbMountPoint: string;
  nombre: string;
}

interface ValidateBody {
  token: string;
}

interface AuditBody {
  eventType: string;
  descripcion: string;
  usbSerial?: string;
  severidad?: string;
}

export async function securityHwRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /security/hw/status — Current security status ──
  app.get(
    "/security/hw/status",
    {},
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const fingerprint = getHardwareFingerprint();
      const usbDevices = detectUsbDevices();
      const isValid = quickValidate();

      // Check for USB with token
      let tokenFound = false;
      let tokenValid = false;
      let usbSerial = "";

      for (const device of usbDevices) {
        if (device.mountPoint) {
          const token = readTokenFromUsb(device.mountPoint);
          if (token) {
            tokenFound = true;
            usbSerial = device.serial;
            const result = validateHardwareToken(token);
            tokenValid = result.valid;
            break;
          }
        }
      }

      return reply.send({
        system: {
          hostname: fingerprint.hostname,
          platform: fingerprint.platform,
          arch: fingerprint.arch,
        },
        hardware: {
          motherboardUuid: fingerprint.motherboardUuid,
          cpuSerial: fingerprint.cpuSerial,
          diskSerial: fingerprint.diskSerial,
        },
        usb: {
          devices: usbDevices.map(d => ({
            serial: d.serial,
            model: d.model,
            mountPoint: d.mountPoint,
          })),
          tokenFound,
          tokenValid,
          usbSerial,
        },
        security: {
          overallStatus: isValid ? "PROTEGIDO" : "VULNERABLE",
          killSwitchActive: !isValid,
          message: isValid
            ? "Token USB verificado correctamente. Sistema protegido."
            : "⚠ Token USB no detectado o inválido. Sistema en riesgo.",
        },
      });
    },
  );

  // ── GET /security/hw/fingerprint — Get hardware fingerprint ──
  app.get(
    "/security/hw/fingerprint",
    {},
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const fingerprint = getHardwareFingerprint();
      return reply.send(fingerprint);
    },
  );

  // ── GET /security/hw/usb-devices — List USB devices ──
  app.get(
    "/security/hw/usb-devices",
    {},
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const devices = detectUsbDevices();
      return reply.send({ devices });
    },
  );

  // ── POST /security/hw/generate-token — Generate hardware token ──
  app.post(
    "/security/hw/generate-token",
    {},
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const fingerprint = getHardwareFingerprint();
      const token = generateHardwareToken(fingerprint);
      return reply.send({
        token,
        fingerprint,
        message: "Token generado. Use /security/hw/setup para escribirlo en el USB.",
      });
    },
  );

  // ── POST /security/hw/validate-token — Validate a token ──
  app.post<{ Body: ValidateBody }>(
    "/security/hw/validate-token",
    {
      schema: {
        body: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ValidateBody }>, reply: FastifyReply) => {
      const result = validateHardwareToken(request.body.token);
      return reply.send(result);
    },
  );

  // ── POST /security/hw/setup — Initial USB dongle setup ──
  app.post<{ Body: SetupBody }>(
    "/security/hw/setup",
    {
      schema: {
        body: {
          type: "object",
          required: ["usbMountPoint", "nombre"],
          properties: {
            usbMountPoint: { type: "string", minLength: 1 },
            nombre: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SetupBody }>, reply: FastifyReply) => {
      const result = setupUsbDongle(
        request.body.usbMountPoint,
        request.body.nombre,
      );

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send({
        ...result,
        message: "USB Dongle configurado correctamente. El token ha sido escrito en el dispositivo.",
        instructions: [
          "1. No retire el USB del servidor.",
          "2. El sistema verificará el token en cada petición HTTP.",
          "3. Si el USB es retirado, el sistema entrará en modo aislamiento.",
          "4. Guarde una copia del token en lugar seguro.",
        ],
      });
    },
  );

  // ── GET /security/hw/audit — Security audit log ──
  app.get(
    "/security/hw/audit",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100 },
            severity: { type: "string" },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // In production, read from security_audit_log table
      // For now, return recent events from in-memory store
      return reply.send({
        events: [],
        message: "Audit log — integración con tabla security_audit_log pendiente",
      });
    },
  );
}
