/* ─── Print Templates ───────────────────────── */
/* Invoice & Work Order print views              */

/**
 * Print a work order (OT) with full detail.
 * Fetches OT data and renders a print-friendly template.
 */
async function printOT(otId) {
  try {
    const ot = await api(`/workshop/ordenes/${otId}`);
    const v = ot.vehiculo || {};
    const c = ot.cliente || {};

    const printContent = `
    <div class="print-template">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:15px">
        <div>
          <h1 style="font-size:20px;margin:0">ORDEN DE TRABAJO</h1>
          <p style="color:#666;margin:4px 0 0;font-size:13px">AutomotiveOS — ${esc(state.auth.tenant?.name || 'Taller')}</p>
        </div>
        <div style="text-align:right">
          <p style="font-size:13px;margin:0"><strong>N°:</strong> ${ot.id.slice(0, 8).toUpperCase()}</p>
          <p style="font-size:13px;margin:2px 0 0"><strong>Fecha:</strong> ${ot.createdAt ? new Date(ot.createdAt).toLocaleDateString('es-PY') : '—'}</p>
          <p style="font-size:13px;margin:2px 0 0"><strong>Estado:</strong> ${ot.status}</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px">
        <div style="padding:10px;border:1px solid #ddd;border-radius:6px">
          <h3 style="font-size:13px;color:#666;margin:0 0 8px;text-transform:uppercase">Cliente</h3>
          <p style="margin:2px 0;font-size:13px"><strong>${esc(c.name || '—')}</strong></p>
          ${c.ruc ? `<p style="margin:2px 0;font-size:12px;color:#666">RUC: ${esc(c.ruc)}</p>` : ''}
          ${c.phone ? `<p style="margin:2px 0;font-size:12px;color:#666">Tel: ${esc(c.phone)}</p>` : ''}
          ${c.email ? `<p style="margin:2px 0;font-size:12px;color:#666">${esc(c.email)}</p>` : ''}
        </div>
        <div style="padding:10px;border:1px solid #ddd;border-radius:6px">
          <h3 style="font-size:13px;color:#666;margin:0 0 8px;text-transform:uppercase">Vehículo</h3>
          <p style="margin:2px 0;font-size:13px"><strong>${esc(v.brand || '')} ${esc(v.model || '')}</strong></p>
          ${v.vin ? `<p style="margin:2px 0;font-size:12px;color:#666">VIN: ${esc(v.vin)}</p>` : ''}
          ${v.plate ? `<p style="margin:2px 0;font-size:12px;color:#666">Chapa: ${esc(v.plate)}</p>` : ''}
          ${v.year ? `<p style="margin:2px 0;font-size:12px;color:#666">Año: ${v.year}</p>` : ''}
          ${v.kilometraje ? `<p style="margin:2px 0;font-size:12px;color:#666">Km: ${v.kilometraje.toLocaleString('es-PY')}</p>` : ''}
        </div>
      </div>

      ${ot.description || ot.diagnosis ? `
      <div style="margin-bottom:15px">
        <h3 style="font-size:13px;color:#666;margin:0 0 5px;text-transform:uppercase">Descripción / Diagnóstico</h3>
        <p style="font-size:13px;border:1px solid #ddd;padding:8px;border-radius:4px">${esc(ot.description || ot.diagnosis || '')}</p>
      </div>` : ''}

      ${ot.servicios?.length ? `
      <div style="margin-bottom:15px">
        <h3 style="font-size:13px;color:#666;margin:0 0 8px;text-transform:uppercase">Servicios</h3>
        <table>
          <thead><tr><th>Servicio</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${ot.servicios.map(s => `<tr><td>${esc(s.descripcion || s.nombre || '')}</td><td>${s.cantidad || 1}</td><td>₲${Number(s.precioUnitario || 0).toLocaleString('es-PY')}</td><td>₲${Number((s.precioUnitario || 0) * (s.cantidad || 1)).toLocaleString('es-PY')}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${ot.repuestos?.length ? `
      <div style="margin-bottom:15px">
        <h3 style="font-size:13px;color:#666;margin:0 0 8px;text-transform:uppercase">Repuestos</h3>
        <table>
          <thead><tr><th>Repuesto</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${ot.repuestos.map(r => `<tr><td>${esc(r.descripcion || r.nombre || '')}</td><td>${r.cantidad || 1}</td><td>₲${Number(r.precioUnitario || 0).toLocaleString('es-PY')}</td><td>₲${Number((r.precioUnitario || 0) * (r.cantidad || 1)).toLocaleString('es-PY')}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <div style="border-top:2px solid #333;padding-top:15px;display:flex;justify-content:flex-end">
        <div style="text-align:right">
          <p style="font-size:13px;margin:2px 0"><strong>TOTAL:</strong> <span style="font-size:18px">₲${Number(ot.totalCost || 0).toLocaleString('es-PY')}</span></p>
        </div>
      </div>

      <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
        <div style="text-align:center;border-top:1px solid #999;padding-top:5px">
          <p style="font-size:11px;color:#666">Firma del Cliente</p>
        </div>
        <div style="text-align:center;border-top:1px solid #999;padding-top:5px">
          <p style="font-size:11px;color:#666">Firma del Técnico</p>
        </div>
      </div>
    </div>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>OT ${ot.id.slice(0,8)} — AutomotiveOS</title><style>body{font-family:Inter,system-ui,sans-serif;margin:20px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;font-size:12px;text-align:left}th{background:#f5f5f5;font-weight:600}@media print{body{margin:0}}</style></head><body>${printContent}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Error al imprimir: ${err.message}`, 'error');
  }
}

/**
 * Print an invoice with full detail.
 */
async function printInvoice(invoiceId) {
  try {
    const inv = await api(`/finance/invoices/${invoiceId}`);

    const printContent = `
    <div class="print-template">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:15px">
        <div>
          <h1 style="font-size:20px;margin:0">FACTURA</h1>
          <p style="color:#666;margin:4px 0 0;font-size:13px">${esc(state.auth.tenant?.name || 'Taller')}</p>
        </div>
        <div style="text-align:right">
          <p style="font-size:13px;margin:0"><strong>N°:</strong> ${esc(inv.serie || '')}-${esc(inv.numero || inv.id?.slice(0,8) || '')}</p>
          <p style="font-size:13px;margin:2px 0 0"><strong>Fecha:</strong> ${inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('es-PY') : '—'}</p>
          <p style="font-size:13px;margin:2px 0 0"><strong>Estado:</strong> ${inv.estadoPago || '—'}</p>
        </div>
      </div>

      <div style="margin-bottom:20px;padding:10px;border:1px solid #ddd;border-radius:6px">
        <h3 style="font-size:13px;color:#666;margin:0 0 8px;text-transform:uppercase">Cliente</h3>
        <p style="margin:2px 0;font-size:13px"><strong>${esc(inv.cliente?.name || inv.receptorRazonSocial || '—')}</strong></p>
        ${inv.receptorRuc ? `<p style="margin:2px 0;font-size:12px;color:#666">RUC: ${esc(inv.receptorRuc)}</p>` : ''}
      </div>

      ${inv.detalles?.length ? `
      <div style="margin-bottom:20px">
        <table>
          <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${inv.detalles.map(d => `<tr><td>${esc(d.descripcion || '')}</td><td>${d.cantidad || 1}</td><td>₲${Number(d.precioUnitario || 0).toLocaleString('es-PY')}</td><td>₲${Number(d.subtotal || (d.precioUnitario || 0) * (d.cantidad || 1)).toLocaleString('es-PY')}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <div style="border-top:2px solid #333;padding-top:15px;display:flex;justify-content:flex-end">
        <div style="text-align:right;min-width:200px">
          ${inv.subtotal ? `<p style="font-size:13px;margin:2px 0">Subtotal: ₲${Number(inv.subtotal).toLocaleString('es-PY')}</p>` : ''}
          ${inv.iva ? `<p style="font-size:13px;margin:2px 0">IVA (10%): ₲${Number(inv.iva).toLocaleString('es-PY')}</p>` : ''}
          <p style="font-size:13px;margin:2px 0"><strong>TOTAL:</strong> <span style="font-size:18px">₲${Number(inv.total || 0).toLocaleString('es-PY')}</span></p>
          ${inv.saldoPendiente ? `<p style="font-size:12px;color:#666;margin:4px 0 0">Saldo pendiente: ₲${Number(inv.saldoPendiente).toLocaleString('es-PY')}</p>` : ''}
        </div>
      </div>
    </div>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Factura ${inv.id?.slice(0,8)} — AutomotiveOS</title><style>body{font-family:Inter,system-ui,sans-serif;margin:20px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;font-size:12px;text-align:left}th{background:#f5f5f5;font-weight:600}@media print{body{margin:0}}</style></head><body>${printContent}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Error al imprimir: ${err.message}`, 'error');
  }
}

/* Expose to global scope */
window.printOT = printOT;
window.printInvoice = printInvoice;
