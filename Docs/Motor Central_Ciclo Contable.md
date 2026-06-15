Actúa como un Líder de Arquitectura de Software Financiero y un Auditor Contable Forense experto en la legislación comercial y fiscal de la República del Paraguay (DNIT, Abogacía del Tesoro, Ley 1183/85 de Código Civil, Ley 6380/19 de Modernización Fiscal y normativas del MIC para MIPYMES). 

Tu objetivo es diseñar las reglas de negocio, matrices de transacciones y la estructura de base de datos para automatizar el "Ciclo Contable Completo" y la generación de "Libros Obligatorios Rúbricados e Informativos" según el tamaño y forma jurídica del Tenant.

Estructura tu respuesta detallada en 4 grandes capas funcionales:

---

### CAPA 1: MATRIZ DE SEGMENTACIÓN (TAMAÑO, FORMA JURÍDICA Y OBLIGATORIEDAD DE LIBROS)
Diseña la lógica del sistema para activar y exigir los libros obligatorios según los siguientes parámetros locales:

1. Clasificación por Tamaño (Parámetros del MIC actualizados):
   - Microempresa / Pequeña / Mediana / Grande (Definir filtros automáticos basados en ingresos anuales en Guaraníes y cantidad de personal).
2. Mapeo de Libros Obligatorios según Forma Jurídica y Régimen:
   - Régimen IRE General (S.A., S.R.L., E.A.S., S.A.E.C.A., Unipersonales Grandes): Activar obligatoriamente Libro Diario, Libro Mayor, Libro de Inventario, Libro de Actas de Asamblea (para S.A., S.A.E.C.A. y E.A.S.), Libro de Registro de Acciones (para S.A., S.A.E.C.A. y E.A.S.) y Libro de Registro de Socios (para S.R.L.).
   - Régimen IRE Simple (MIPYMES): Activar Libros de Compras y Ventas unificados (Estructura simplificada).
   - Régimen IRE Resimple: Activar únicamente el Libro de Ingresos y Egresos del Resimple.

---

### CAPA 2: AUTOMATIZACIÓN DEL CICLO CONTABLE COMPLETO (END-TO-END)
Define los algoritmos, validaciones y flujos de datos para las 4 fases del ciclo en moneda local (PYG) y bimoneda (USD):

Fase 1: Apertura de Ejercicio
   - Script de reversión y apertura automática: Transferencia de saldos de cuentas patrimoniales del Periodo N al Periodo N+1.
   - Control de Capital: Validación de cuentas de Capital Suscrito e Integrado según el tipo societario.

Fase 2: Procesamiento Diario y Sub-asientos Automáticos
   - Diseño de motores de devengamiento (Amortizaciones de bienes de uso con tablas de vida útil de la DNIT, Seguros, Alquileres).
   - Centralización automática desde módulos periféricos: Facturación Electrónica (SIFEN), Tesorería (Cajas, SIPAP, Vouchers de Tarjetas) y Compras.

Fase 3: Ajustes de Cierre y Revaluación
   - Motor de Revalúo de Bienes de Uso: Aplicación del coeficiente de revaluación según los índices publicados por la DNIT para el cierre de ejercicio, calculando la depreciación del periodo y el asiento de Ajuste por Revalúo.
   - Diferencia de Cambio Automatizada: Revaluación mensual/anual de saldos en moneda extranjera utilizando la cotización "Tipo Comprador / Vendedor" del Banco Central del Paraguay (BCP) al cierre del día, imputando a las cuentas de pérdidas o ganancias por diferencia de cambio.

Fase 4: Cierre Técnico y Patrimonial
   - Asiento de Refundición de Cuentas de Resultado.
   - Algoritmo de cálculo automático de la Reserva Legal (5% sobre la utilidad neta antes de impuestos, topado al 20% del capital social integrado para S.A., S.R.L. y E.A.S.).
   - Provisión del Impuesto a la Renta (IRE 10%) y determinación del Resultado del Ejercicio Neto.

---

### CAPA 3: ESPECIFICACIONES TÉCNICAS DE LOS LIBROS EXIGIDOS POR LEY
Detalla la estructura de datos, campos mandatorios y formato de exportación para los reportes que se presentan ante la DNIT y se resguardan legalmente:

1. Libro Diario: Estructura de cabecera y detalle. ID de asiento único correlativo, Fecha, Código de Cuenta (Nivel 5), Debe, Haber, Detalle/Glosa de la transacción, UUID del documento electrónico SIFEN asociado (CDC de 44 dígitos) o Número de comprobante físico.
2. Libro Mayor: Agrupación histórica por cuenta, arrastre de saldo anterior, movimientos del periodo y saldo de cierre.
3. Libro de Inventario: Detalle analítico de existencias (Costo FIFO/PPP), Saldos de Cuentas por Cobrar y por Pagar, y detalle pormenorizado de Bienes de Uso.
4. Registro Electrónico de Comprobantes (RG 90 / Hechauka): Estructura exacta para exportar de forma mensual los módulos de Ventas, Compras y Retenciones en formato de texto plano (.txt) comprimido o JSON aceptado por el Sistema Marangatú.

---

### CAPA 4: COMPLIANCE DIGITAL Y AUDITORÍA DE DATOS
Diseña los controles de seguridad y consistencia lógica que eviten infracciones y multas fiscales:
- Regla Anti-Borrado (Inmutabilidad): Una vez cerrado un mes o un asiento rubricado, bloqueo estricto de edición (Generación exclusiva de Notas de Crédito, Débito o Asientos de Ajuste inversos con trazabilidad).
- Cuadratura Diaria Automatizada: Validación en background donde Suma del Debe == Suma del Haber en toda la base de datos transaccional del periodo.
- Logs de Auditoría: Registro inalterable de Usuario, Timestamp, IP y datos modificados (Valor Anterior vs. Valor Nuevo).

Entrega la arquitectura conceptual completa utilizando terminología técnica avanzada de base de datos (PostgreSQL/NoSQL) y estándares financieros internacionales adaptados a Paraguay.

El Impacto en la Ingeniería de tu ERP

Al inyectar este Meta-Prompt en la IA, obtendrás una especificación técnica de clase mundial orientada a resolver las fricciones operativas reales de las empresas en Paraguay:

```
  [ Transacción SIFEN / Pago / Gasto ]
                   │
                   ▼
     [ Motor Contable Centralizado ] ──► (Validación Cuadratura Debe/Haber)
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
 [ Libros Operativos ]    [ Libros Societarios ] (Abogacía del Tesoro)
 ├─ Libro Diario          ├─ Registro de Acciones (S.A. / E.A.S.)
 ├─ Libro Mayor           ├─ Registro de Socios (S.R.L.)
 ├─ Libro Inventario      └─ Actas de Asamblea
 └─ RG 90 Marangatú
```

Innovaciones Críticas que Resolverá este Prompt:

1. **Revalúo Automático:** Evita que el contador calcule manualmente en hojas de cálculo el desgaste de maquinarias o vehículos; el sistema aplicará los coeficientes oficiales de la **DNIT** de forma nativa.
2. **Inmutabilidad de Libros Rúbricados:** El diseño de software garantizará que los registros cumplan con las exigencias de las auditorías externas impositivas obligatorias de Paraguay, impidiendo alteraciones de saldos históricos sin dejar rastro (Logs de Auditoría).

