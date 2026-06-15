import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { thinkcarRoutes } from "./routes/index.js";
import { startUsbWatcher, stopUsbWatcher } from "./services/thinkcar-usb.service.js";
import { startEmailPolling, stopEmailPolling } from "./services/thinkcar-email.service.js";
import { startBluetoothListener, stopBluetoothListener } from "./services/thinkcar-bluetooth.service.js";

async function thinkcarPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(thinkcarRoutes);

  const enableUsb = process.env["THINKCAR_USB_WATCH"] !== "false";
  const enableEmail = process.env["THINKCAR_EMAIL_WATCH"] !== "false";
  const enableBluetooth = process.env["THINKCAR_BT_WATCH"] !== "false";

  if (enableUsb) {
    const usbInterval = parseInt(
      process.env["THINKCAR_USB_INTERVAL"] ?? "60000",
      10,
    );
    startUsbWatcher(usbInterval);
    app.log.info(
      `[Thinkcar] USB watcher iniciado (intervalo: ${usbInterval}ms)`,
    );
  }

  if (enableEmail) {
    const emailInterval = parseInt(
      process.env["THINKCAR_EMAIL_INTERVAL"] ?? "300000",
      10,
    );
    if (process.env["THINKCAR_EMAIL_USER"]) {
      startEmailPolling(emailInterval);
      app.log.info(
        `[Thinkcar] Email polling iniciado (intervalo: ${emailInterval}ms)`,
      );
    } else {
      app.log.warn(
        "[Thinkcar] THINKCAR_EMAIL_USER no configurado — email deshabilitado",
      );
    }
  }

  if (enableBluetooth) {
    startBluetoothListener();
    app.log.info("[Thinkcar] Bluetooth listener iniciado");
  }

  app.addHook("onClose", async () => {
    stopUsbWatcher();
    stopEmailPolling();
    stopBluetoothListener();
    app.log.info("[Thinkcar] Todos los workers detenidos");
  });

  app.log.info("Thinkcar Automated Importer Module registered");
}

export default thinkcarPlugin;
