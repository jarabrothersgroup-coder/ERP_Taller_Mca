import fs from 'fs';
import path from 'path';

const files = [
'src/modules/tenants/schema/tenant-config.ts',
'src/modules/inventory/schema/herramientas.ts',
'src/modules/inventory/schema/control-herramientas.ts',
'src/modules/inventory/schema/purchase-orders.ts',
'src/modules/inventory/schema/tool-instances.ts',
'src/modules/inventory/schema/tool-depreciation-entries.ts',
'src/modules/inventory/schema/cost-history.ts',
'src/modules/inventory/schema/reorder-alerts.ts',
'src/modules/inventory/schema/repuestos.ts',
'src/modules/inventory/schema/stock-movements.ts',
'src/modules/workshop/schema/ordenes-trabajo.ts',
'src/modules/workshop/schema/servicios-catalogo.ts',
'src/modules/workshop/schema/orden-repuestos.ts',
'src/modules/workshop/schema/orden-servicios.ts',
'src/modules/workshop/schema/service-pricing.ts',
'src/modules/finance/schema/fiscal-forms.ts',
'src/modules/finance/schema/fixed-assets.ts',
'src/modules/finance/schema/treasury.ts',
'src/modules/finance/schema/accounting.ts',
'src/modules/finance/schema/budget.ts',
'src/modules/finance/schema/factura-detalle.ts',
'src/modules/finance/schema/facturas.ts',
'src/modules/finance/schema/fiscal-docs.ts',
];

for (const file of files) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  for (let i = 0; i < lines.length - 1; i++) {
    const currentLine = lines[i].trim();
    const nextLine = lines[i+1].trim();

    if (currentLine === ',' && nextLine === ');') {
      // Check if the previous line was actually the end of a block
      // This is a bit naive, but let's see.
      // We want to replace ',' with '}),'
      lines[i] = lines[i].replace(',', '}),');
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed: ${file}`);
  } else {
    console.log(`No changes needed for: ${file}`);
  }
}
