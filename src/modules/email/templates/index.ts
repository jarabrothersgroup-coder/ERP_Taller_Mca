/**
 * HTML Email Templates for AutomotiveOS.
 *
 * Professional, responsive templates for:
 *   - Invoice ready notification
 *   - Estimate/budget notification
 *   - Service reminders
 *   - General notifications
 *
 * @module email/templates
 */

/** Base template wrapper with shared styles */
function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; color: #18181b; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 800; color: #f97316; letter-spacing: -0.5px; }
    .logo span { color: #18181b; }
    h1 { font-size: 20px; font-weight: 700; margin: 16px 0 8px; color: #18181b; }
    p { color: #52525b; margin-bottom: 12px; }
    .details { background: #fafafa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .details dt { font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 12px; }
    .details dt:first-child { margin-top: 0; }
    .details dd { font-size: 16px; font-weight: 600; color: #18181b; margin: 2px 0 0 0; }
    .button { display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .button-primary { background: #f97316; color: #ffffff; }
    .button-secondary { background: #f4f4f5; color: #18181b; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #a1a1aa; }
    .footer a { color: #f97316; text-decoration: none; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-warning { background: #fef3c7; color: #b45309; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">Automotive<span>OS</span></div>
        <h1>${title}</h1>
      </div>
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>AutomotiveOS Cloud ERP — Jara Brothers Group, Coronel Oviedo, Paraguay</p>
      <p><a href="mailto:soporte@taller-mca.py">soporte@taller-mca.py</a></p>
    </div>
  </div>
</body>
</html>`;
}

export interface InvoiceTemplateData {
  numeroFactura: string;
  cliente: string;
  ruc: string;
  total: string;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: string;
  lineaItems: { descripcion: string; cantidad: number; precio: string; total: string }[];
  cdc?: string;
}

/** Invoice ready email template */
export function invoiceReadyTemplate(data: InvoiceTemplateData): string {
  const itemsHtml = data.lineaItems
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-size:14px">${item.descripcion}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:center">${item.cantidad}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:right">${item.precio}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:right;font-weight:600">${item.total}</td>
        </tr>`
    )
    .join("");

  const bodyHtml = `
    <p>Estimado/a ${data.cliente}, su factura electrónica está lista.</p>
    <div class="details">
      <dl>
        <dt>Factura N°</dt>
        <dd>${data.numeroFactura}</dd>
        <dt>RUC</dt>
        <dd>${data.ruc}</dd>
        <dt>Fecha de Emisión</dt>
        <dd>${data.fechaEmision}</dd>
        <dt>Fecha de Vencimiento</dt>
        <dd>${data.fechaVencimiento}</dd>
        ${data.cdc ? `<dt>Código de Control (CDC)</dt><dd style="font-size:13px;word-break:break-all">${data.cdc}</dd>` : ""}
        <dt>Total</dt>
        <dd style="font-size:24px;color:#f97316">₲ ${data.total}</dd>
      </dl>
    </div>
    ${itemsHtml ? `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr>
          <th style="text-align:left;font-size:12px;color:#71717a;padding:8px 0;border-bottom:2px solid #e4e4e7">Descripción</th>
          <th style="text-align:center;font-size:12px;color:#71717a;padding:8px 0;border-bottom:2px solid #e4e4e7">Cant.</th>
          <th style="text-align:right;font-size:12px;color:#71717a;padding:8px 0;border-bottom:2px solid #e4e4e7">Precio</th>
          <th style="text-align:right;font-size:12px;color:#71717a;padding:8px 0;border-bottom:2px solid #e4e4e7">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    ` : ""}
    <div style="text-align:center;margin-top:24px">
      <span class="badge badge-success">${data.estado}</span>
    </div>
    <div style="text-align:center;margin-top:16px">
      <p style="font-size:13px">Gracias por confiar en nosotros. Puede descargar el PDF de su factura desde el portal del cliente.</p>
    </div>
  `;

  return baseTemplate(`Factura #${data.numeroFactura}`, bodyHtml);
}

export interface EstimateTemplateData {
  numeroEstimacion: string;
  cliente: string;
  vehiculo: string;
  total: string;
  validez: string;
  items: { descripcion: string; cantidad: number; precio: string; total: string }[];
}

/** Estimate/budget email template */
export function estimateTemplate(data: EstimateTemplateData): string {
  const itemsHtml = data.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-size:14px">${item.descripcion}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:center">${item.cantidad}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:right">${item.precio}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;font-size:14px;text-align:right;font-weight:600">${item.total}</td>
        </tr>`
    )
    .join("");

  const bodyHtml = `
    <p>Estimado/a ${data.cliente}, adjuntamos el presupuesto para su vehículo ${data.vehiculo}.</p>
    <div class="details">
      <dl>
        <dt>Presupuesto N°</dt>
        <dd>${data.numeroEstimacion}</dd>
        <dt>Vehículo</dt>
        <dd>${data.vehiculo}</dd>
        <dt>Validez</dt>
        <dd>${data.validez}</dd>
        <dt>Total Estimado</dt>
        <dd style="font-size:24px;color:#f97316">₲ ${data.total}</dd>
      </dl>
    </div>
    ${itemsHtml ? `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr>
          <th style="text-align:left;font-size:12px;color:#71717a;padding:8px 0;border-bottom:2px solid #e4e4e7">Descripción</th>
          <th style="text-align:center;font-size:12px;color:#71717a;padding:8px 0;border-bottom:2px solid #e4e4e7">Cant.</th>
          <th style="text-align:right;font-size:12px;color:#71717a;padding:8px 0;border-bottom:2px solid #e4e4e7">Precio</th>
          <th style="text-align:right;font-size:12px;color:#71717a;padding:8px 0;border-bottom:2px solid #e4e4e7">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    ` : ""}
    <div style="text-align:center;margin-top:24px">
      <span class="badge badge-warning">Pendiente de Aprobación</span>
    </div>
    <p style="text-align:center;margin-top:16px;font-size:13px">Para aprobar este presupuesto, responda a este correo o comuníquese con nosotros.</p>
  `;

  return baseTemplate(`Presupuesto #${data.numeroEstimacion}`, bodyHtml);
}

export interface ReminderTemplateData {
  cliente: string;
  vehiculo: string;
  tipoServicio: string;
  fecha: string;
  hora: string;
}

/** Service reminder email template */
export function serviceReminderTemplate(data: ReminderTemplateData): string {
  const bodyHtml = `
    <p>Estimado/a ${data.cliente}, le recordamos su próxima cita en nuestro taller.</p>
    <div class="details">
      <dl>
        <dt>Servicio</dt>
        <dd>${data.tipoServicio}</dd>
        <dt>Vehículo</dt>
        <dd>${data.vehiculo}</dd>
        <dt>Fecha</dt>
        <dd>${data.fecha}</dd>
        <dt>Hora</dt>
        <dd>${data.hora}</dd>
      </dl>
    </div>
    <p>Por favor, confirme su asistencia respondiendo a este correo o vía WhatsApp.</p>
    <p style="font-size:13px;color:#71717a">Si necesita cancelar o reagendar, avísenos con 24 horas de anticipación.</p>
  `;
  return baseTemplate("Recordatorio de Servicio", bodyHtml);
}

export interface NotificationTemplateData {
  titulo: string;
  mensaje: string;
  entidad?: string;
  entidadId?: string;
}

/** General notification email template */
export function notificationTemplate(data: NotificationTemplateData): string {
  const bodyHtml = `
    <p>${data.mensaje}</p>
    ${data.entidad ? `<p style="font-size:13px;color:#71717a">${data.entidad}: ${data.entidadId ?? "—"}</p>` : ""}
  `;
  return baseTemplate(data.titulo, bodyHtml);
}

/* ── Order Completed Template ──────────────── */

export interface OrderCompletedTemplateData {
  cliente: string;
  vehiculo: string;
  serviciosRealizados: string;
  total: string;
  tallerNombre: string;
  tallerDireccion: string;
  fecha: string;
}

/** Order completed notification email template */
export function orderCompletedTemplate(data: OrderCompletedTemplateData): string {
  const bodyHtml = `
    <p>Estimado/a ${data.cliente}, ¡su vehículo está listo!</p>
    <p>El servicio en nuestro taller ha sido completado. Puede pasar a retirar su vehículo.</p>
    <div class="details">
      <dl>
        <dt>Vehículo</dt>
        <dd>${data.vehiculo}</dd>
        <dt>Servicios Realizados</dt>
        <dd>${data.serviciosRealizados}</dd>
        <dt>Total</dt>
        <dd style="font-size:24px;color:#f97316">₲ ${data.total}</dd>
        <dt>Fecha de Finalización</dt>
        <dd>${data.fecha}</dd>
        <dt>Taller</dt>
        <dd>${data.tallerNombre} — ${data.tallerDireccion}</dd>
      </dl>
    </div>
    <div style="text-align:center;margin-top:24px">
      <span class="badge badge-success">Completado</span>
    </div>
    <p style="text-align:center;margin-top:16px;font-size:13px">Gracias por confiar en nosotros. ¡Esperamos verlo pronto!</p>
  `;
  return baseTemplate("✅ Servicio Completado", bodyHtml);
}
