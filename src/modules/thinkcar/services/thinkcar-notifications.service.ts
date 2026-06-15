/**
 * Thinkcar Notification Service — Manual Review Alert Dispatcher
 *
 * Sends email alerts when a diagnostic report enters manual_review state
 * (auto-linking failed due to illegible/partial VIN). Opens SMTP connections
 * on-demand only, then closes them immediately to respect the <50MB RAM constraint.
 *
 * @module src/modules/thinkcar/services/thinkcar-notifications
 */

import nodemailer from "nodemailer";

export interface ManualReviewNotificationPayload {
  tenantSlug: string;
  dtcCount: number;
  detectedVin: string;
  importSource: "USB" | "EMAIL" | "BLUETOOTH";
}

export class ThinkcarNotificationService {
  /**
   * Dispatches an immediate email alert to the workshop reception team
   * when a physical diagnostic report enters the manual review queue.
   *
   * @param payload - Details about the unlinked report
   * @returns `true` if the alert was sent successfully, `false` if skipped
   *          due to missing credentials or transport failure.
   */
  public static async sendManualReviewAlert(
    payload: ManualReviewNotificationPayload,
  ): Promise<boolean> {
    const username =
      process.env.THINKCAR_EMAIL_USER || "jarabrothersgroup@gmail.com";
    const password = process.env.THINKCAR_EMAIL_PASSWORD;
    const alertRecipient = process.env.THINKCAR_ALERT_RECIPIENT || username;

    if (!password) {
      console.warn(
        "[THINKCAR_ALERT] Alerta omitida: Credenciales no configuradas.",
      );
      return false;
    }

    // On-demand transport — open, send, close to minimise RAM footprint
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: username, pass: password },
    });

    const mailOptions = {
      from: `"AutomotiveOS Core" <${username}>`,
      to: alertRecipient,
      subject: `⚠️ Acción Requerida: Revisión Manual de Diagnóstico [${payload.tenantSlug.toUpperCase()}]`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ffcc00; border-radius: 8px;">
          <h2 style="color: #d9383a; margin-top: 0;">Reporte de Escaneo No Vinculado</h2>
          <p>Un diagnóstico vehicular físico requiere vinculación manual en el sistema.</p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <ul>
            <li><strong>Taller (Tenant):</strong> ${payload.tenantSlug}</li>
            <li><strong>Origen de Ingesta:</strong> ${payload.importSource}</li>
            <li><strong>VIN Detectado en Escáner:</strong> <code>${payload.detectedVin || "Desconocido / Ilegible"}</code></li>
            <li><strong>Códigos DTC Registrados:</strong> <span style="background: #f8d7da; color: #721c24; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${payload.dtcCount} errores</span></li>
          </ul>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #666;">Por favor, ingresa al panel de control <strong>Thinkcar UI</strong> en la SPA para asignar este diagnóstico a una Orden de Trabajo activa.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(
        `[THINKCAR_ALERT] Notificación de revisión manual enviada con éxito para ${payload.tenantSlug}`,
      );
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[THINKCAR_ALERT] Fallo crítico al enviar correo de alerta:",
        message,
      );
      return false;
    } finally {
      // Destroy the connection pool immediately to free heap / network resources
      transporter.close();
    }
  }
}
