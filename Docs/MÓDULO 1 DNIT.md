Actúa como un Arquitecto de Software de ERP Financiero de Clase Mundial (nivel SAP S/4HANA o NetSuite) y un Consultor Contable/Legal Senior experto en la legislación de la República del Paraguay. Tu objetivo es diseñar la arquitectura lógica, la estructura de datos y los flujos analíticos para un sistema ERP Multi-Tenant adaptado al mercado paraguayo.

Debes estructurar tu respuesta en 5 módulos de alta densidad de información, sin omitir detalles técnicos ni legales:

---

### MÓDULO 1: ARQUITECTURA MULTI-TENANT Y CRUD DE FORMAS JURÍDICAS (PARAGUAY)
Diseña el modelo de datos y la lógica CRUD (Create, Read, Update, Delete) para los diferentes tipos de empresas según la Ley N° 1183/85 (Código Civil Paraguayo) y la Ley N° 6480/20 (EAS). Para cada tipo de empresa, detalla las validaciones de negocio obligatorias:
1. S.A. (Sociedad Anónima): Control de capital suscrito/integrado y asambleas.
2. S.R.L. (Sociedad de Responsabilidad Limitada): Límite de socios (máx 50) y cuotas de capital.
3. E.A.S. (Empresas por Acciones Simplificadas): Constitución digital, control de firmas y registro en el Ministerio de Industria y Comercio (MIC).
4. S.A.E.C.A. (Sociedad Anónima Emisora de Capital Abierto): Regulada por la Superintendencia de Valores (CNV).
5. Unipersonal: Vinculación directa de Cédula de Identidad con el RUC.

Para el CRUD del Tenant, define la estructura del payload JSON que contenga: RUC (con dígito verificador calculado por algoritmo módulo 11), Razón Social, Tipo de Régimen Tributario (IRE General, IRE Simple, IRE Resimple) y Matrícula de Comerciante.

---

### MÓDULO 2: CICLO CONTABLE COMPLETO Y PRODUCCIÓN DE INFORMACIÓN (DNIT)
Genera las reglas de negocio para automatizar el ciclo contable paraguayo bajo las normas locales e internacionales (NIIF adoptadas).
1. Plan de Cuentas Parametrizable: Estructura de 5 niveles para multi-tenant.
2. Asientos Automáticos: Define la matriz de contabilización automática para Compras (con retenciones de IVA según RG 24/14), Ventas, Costo de Ventas (inventario permanente) y Devengamientos.
3. Cierre de Ejercicio: Proceso automatizado de refundición de cuentas de resultado, cálculo de Reserva Legal (5% hasta alcanzar el 20% del capital según Art. 91 del Cód. Civil) y determinación del IRE (10%).
4. Reportes Obligatorios de Salida: Estructura para exportar el Balance General, Estado de Resultados, Estado de Flujo de Efectivo (Método Directo/Indirecto) y el Libro Diario/Mayor en los formatos de importación requeridos por el sistema Marangatú de la DNIT (Hechauka / RG 90).

---

### MÓDULO 3: GESTIÓN DE TESORERÍA, CICLO DE CAJA Y PASARELA MULTI-INSTRUMENTO
Diseña la lógica financiera de control de flujo de efectivo diario con soporte de auditoría:
1. Apertura y Cierre de Caja: Workflow con validación de arqueo ciego, control de sobrantes/faltantes y asignación de cajeros por sucursal/punto de expedición.
2. Pasarela de Pagos (Instrumentos): Define el procesamiento de:
   - Efectivo: Validación de moneda local (PYG) y extranjeras con tabla de cotizaciones diarias del Banco Central del Paraguay (BCP).
   - Cheques: Gestión de estados (Al día, Diferidos), clearing bancario, control de endosos y leyes de cheques.
   - Tarjetas (Crédito/Débito): Captura de comisiones de procesadoras (Bancard, Dinelco), retenciones automáticas de IVA/Renta efectuadas por la procesadora y conciliación de vouchers.
   - Transferencias Bancarias (SIPAP / SPI): Estructura para conciliación automatizada mediante archivos de extractos bancarios estándar o API en tiempo real.
   - Código QR: Integración con la red de pagos nacional (EMVCo standard) para cobros inmediatos en el punto de venta.

---

### MÓDULO 4: FACTURACIÓN ELECTRÓNICA INTEGRADA (SIFEN)
Incorpora el control completo del Sistema Integrado de Facturación Electrónica Nacional (SIFEN):
1. Campos Mandatorios: CDC (Código de Control de 44 dígitos), Firma Digital (.p12), Timbrado Electrónico.
2. Eventos del Documento Electrónico: Emisión (DE), Aprobación (K請求 / Kuatia), Evento de Cancelación, Inutilización de números y Evento de Conformidad.
3. Contingencia: Flujo de emisión en caso de caída del webservice de la DNIT.

---

### MÓDULO 5: CUADRO DE MANDO ANALÍTICO (DASHBOARD C-LEVEL)
Diseña la interfaz de inteligencia de negocios para el CFO. Especifica el nombre del KPI, fórmula de cálculo exacta y la utilidad de gestión para:
1. Liquidez Corriente y Prueba Ácida.
2. Margen EBITDA y Margen Neto.
3. Días de Rotación de Inventario (DIO) y Días de Pago a Proveedores (DPO).
4. Carga Tributaria Efectiva (Ratio de impuestos pagados sobre utilidad antes de impuestos).
5. Exposición Cambiaria (Posición neta en USD frente al PYG).

Entrega esta investigación técnica y funcional de manera exhaustiva, utilizando terminología profesional de ingeniería de software y finanzas paraguayas.

Qué esperar al ejecutar este Meta-Prompt

Al introducir este prompt en el modelo de lenguaje, la IA generará una solución arquitectónica que resolverá los siguientes puntos críticos del ecosistema paraguayo:

```
  [ Tenant Multi-Empresa ] 
            │
            ├─► Cumplimiento Ley 6480/20 (EAS) y Código Civil
            ├─► Módulo 11 para validación de RUC
            ├─► Integración SIFEN (Generación de CDC de 44 dígitos)
            ├─► Retenciones Automáticas (RG 90 / RG 24/14)
            └─► Conciliación Bancaria vía SIPAP / BCP
```

Elementos Diferenciales Incluidos:

- **Algoritmo Módulo 11:** El sistema calculará automáticamente el dígito verificador del RUC de cada cuenta cliente/proveedor creado en el CRUD.
- **Gestión del SIFEN:** Estructura técnica para la firma digital de los Documentos Electrónicos (DE) exigidos por la **DNIT**.
- **Tratamiento de Comisiones Locales:** Automatización de los asientos de descuento por ventas con tarjetas procesadas por firmas locales (como **Bancard** o **Dinelco**), separando el gasto del IVA retenido.