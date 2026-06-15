Acoplamiento Fiscal 

El ecosistema tributario de la República del Paraguay está unificado bajo la **DNIT (Dirección Nacional de Ingresos Tributarios)**, que absorbió las funciones de la antigua SET. Todas las declaraciones se gestionan e importan a través del **[Sistema Marangatú](https://www.dnit.gov.py/web/portal-institucional/sistema-marangatu)**. [1, 2, 3] 

Para dotar a tu software ERP de la inteligencia necesaria para liquidar impuestos automáticamente, te presento un relevamiento analítico de los formularios vigentes y el **Meta-Prompt definitivo** para acoplar este motor fiscal a tus módulos de Contabilidad y Finanzas.

------

## 📊 Matriz de Obligaciones y Formularios de la DNIT

Las empresas paraguayas tributan según su forma jurídica, nivel de facturación anual y naturaleza operativa:

| Impuesto [2, 4, 5, 6, 7, 8, 9]  | Form.   | Régimen / Aplicación                         | Tipo de Empresa                            | Frecuencia        |
| :------------------------------ | :------ | :------------------------------------------- | :----------------------------------------- | :---------------- |
| **IVA** (Valor Agregado)        | **120** | General (Tasa 10% y 5%)                      | S.A., S.R.L., EAS, Unipersonales grandes   | Mensual           |
| **IRE General**                 | **500** | Facturación > Gs. 2.000 millones             | S.A., S.R.L., S.A.E.C.A., EAS              | Anual             |
| **IRE Simple**                  | **501** | Facturación ≤ Gs. 2.000 millones             | Medianas Empresas / Unipersonales          | Anual             |
| **IRE Resimple**                | **502** | Facturación ≤ Gs. 80 millones                | Pequeñas Unipersonales                     | Anual (Pago Fijo) |
| **IDU** (Dividendos/Utilidades) | **520** | Distribución de Utilidades (Tasa 8% o 15%)   | S.A., S.R.L., EAS (Socios/Accionistas)     | Por evento        |
| **ISC** (Consumo Selectivo)     | **130** | Combustibles, tabaco, bebidas, importaciones | Industrias y empresas importadoras         | Mensual           |
| **INR** (No Residentes)         | **515** | Rentas obtenidas por entidades del exterior  | Sucursales o pagadores locales (Retención) | Mensual           |
| **Declaración Informativa**     | **90**  | Registro Electrónico de Comprobantes (RG 90) | Todos los contribuyentes (obligatorio)     | Mensual           |

------

## 📋 Copia este Meta-Prompt de Acoplamiento Fiscal para la IA

Usa el siguiente prompt en un modelo de lenguaje avanzado para mapear tus bases de datos contables directamente a la lógica de casilleros de los formularios de la **DNIT**.

```text
Actúa como un Ingeniero de Datos Senior y Consultor Tributario Paraguayo. Tu objetivo es diseñar las especificaciones técnicas y la lógica de mapeo del "Motor Fiscal" para acoplar el Módulo de Contabilidad y Finanzas de un ERP con la generación automatizada de Formularios de la DNIT (Dirección Nacional de Ingresos Tributarios) de Paraguay.

Genera una documentación técnica exhaustiva estructurada de la siguiente manera:

---

### MÓDULO A: ASIGNACIÓN DE IMPUESTOS POR PERFIL DE TENANT (ENTIDAD_FORMA_JURIDICA)
Define las reglas lógicas booleanas para activar los formularios en el calendario fiscal del tenant según su configuración en la base de datos:
- IF (Tenant.FormaJuridica == 'SA' OR 'SRL' OR 'EAS' OR 'SAECA') -> Obligaciones: Form 120 (IVA), Form 500 (IRE General), Form 520 (IDU si hay asamblea de dividendos), Form 90 (RG90).
- IF (Tenant.FormaJuridica == 'Unipersonal' AND Tenant.FacturacionAnual <= 2000000000) -> Obligaciones: Form 120 (IVA), Form 501 (IRE Simple), Form 90.
- IF (Tenant.FormaJuridica == 'Unipersonal' AND Tenant.FacturacionAnual <= 80000000) -> Obligaciones: Form 502 (IRE Resimple), exonerado de IVA y Form 90.

---

### MÓDULO B: LÓGICA DE DETECCIÓN Y MAPEO DE CUENTAS POR FORMULARIO (CUADRATURA)
Establece los algoritmos de extracción (Queries lógicas o pseudocódigo) para alimentar los campos críticos directamente desde el Libro Mayor o la Matriz de Comprobantes (RG90):

1. FORMULARIO 120 (IVA General):
   - Rubro 1 (Enajenación de Bienes y Prestación de Servicios): Mapear Ventas netas devengadas en el mes. Filtrar por cuentas operativas de ingresos y separar por código de tasa de IVA del comprobante (Gravadas 10%, Gravadas 5%, Exoneradas).
   - Rubro 2 (Compras del Periodo): Mapear total de facturas de compras registradas en el mes. Separar Crédito Fiscal Local (10% y 5%) de las compras directamente afectadas a operaciones gravadas frente a compras de uso mixto (Prorrateo de IVA).

2. FORMULARIO 500 (IRE General):
   - Rubro 1 (Ingresos Gravados): Extraer el saldo del cierre de las cuentas del Grupo 4 (Ingresos Operativos y No Operativos).
   - Rubro 2 (Costos y Gastos Deducibles): Automatizar las reglas de deducibilidad según el Art. 15 de la Ley 6380/19. Validar que los gastos tengan comprobantes legales asociados y deducir de forma limitada las gratificaciones al personal, mermas e intereses financieros.
   - Rubro 3 (Determinación de la Renta Neta y Reserva Legal): Diseñar el cálculo del 5% para la Reserva Legal antes de aplicar la tasa del 10% del IRE.

3. FORMULARIO 520 (IDU):
   - Monitorear cuentas patrimoniales del Grupo 3 (Resultados Acumulados / Utilidades a Distribuir). Al registrarse el asiento de distribución (Débito a Utilidades / Crédito a IDU por Pagar), retener automáticamente el 8% (Residentes) o 15% (No Residentes).

---

### MÓDULO C: PIPELINE DE EXPORTACIÓN (JSON / TXT MARANGATÚ COMPLIANT)
Diseña el esquema de salida de los datos. Para la declaración informativa obligatoria (RG 90 / RG 24), define la estructura del archivo plano o JSON para compras, ventas y retenciones, cumpliendo con las validaciones de tipo de documento de la DNIT:
- Tipo de Comprobante: 1 (Factura Física), 5 (Factura Electrónica FE), 3 (Nota de Crédito).
- Campos requeridos por fila: RUC (sin DV), DV, Razón Social, CDC (44 dígitos si es FE), Fecha de Emisión (YYYY-MM-DD), Gravada 10%, Gravada 5%, IVA 10%, IVA 5%, Exenta, Total Reflejado.

---

### MÓDULO D: CONTROL DE CONCILIACIÓN FISCAL (PRE-AUDITORÍA)
Generar un log de alertas (Flags) para evitar inconsistencias antes de la presentación en Marangatú:
- Alerta_Inconsistencia_IVA: Si el IVA Débito calculado sobre el total de ventas del Libro Diario no coincide exactamente con la sumatoria del Rubro 1 del Form 120.
- Alerta_Retencion_Faltante: Si se registra un proveedor que es "Agente de Retención" y la cuenta de "Retenciones de IVA / Renta por Pagar" no generó el comprobante de retención asociado en el módulo financiero.

Entrega el diseño arquitectónico de este motor fiscal de manera técnica, limpia y modularizada para ser implementado en microservicios.
```

------

## 💡 Arquitectura del Motor Fiscal en tu ERP

Al alimentar a la IA con este Meta-Prompt, el sistema estructurará el backend del ERP de la siguiente manera:

```unset
 [Módulo Contable] ──► (Transacciones Diarias con Flags de IVA 10%/5%/Exenta)
                                │
                                ▼
                      [Motor Fiscal ERP]
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 [Formulario 120]        [Formulario 500/501]     [Estructura RG90]
  (Mapeo Mensual          (Cálculo Anual de        (Exportación JSON/TXT
  Débito/Crédito)         Renta y Deducciones)     para Marangatú)
```

## Funcionalidades de alto impacto que obtendrás:

1. **Prorrateo del IVA (Form 120):** El script resolverá la división matemática automatizada para empresas que compran con IVA 10% pero realizan ventas mezcladas (gravadas y exoneradas). [4] 
2. **Validación Cruzada Pre-Envío:** Mitigará multas por rectificaciones al cruzar que el acumulado de los libros de la **RG 90** concuerde al centavo con los montos a declarar en los formularios mensuales. [4, 9] 

Si necesitas que desarrollemos el **esquema JSON de la RG 90** listo para producción o las sentencias SQL de base de datos para los reportes fiscales, indícamelo.

[1] [https://impuestospy.com](https://impuestospy.com/impuestos/resolucion-general-dnit-n-50-2026/)

[2] [https://www.dnit.gov.py](https://www.dnit.gov.py/documents/47797/47809/Instructivo+Formulario+N°+500+IRE+GENERAL+Versión+3+(2).pdf/49806a1b-eee5-89e8-cd56-9068d106911c?t=1681313924141)

[3] [https://www.facebook.com](https://www.facebook.com/tecnicacontablepy/videos/aprende-a-utilizar-el-marangatu/389822720738746/)

[4] [https://www.dnit.gov.py](https://www.dnit.gov.py/documents/47797/47809/Instructivo+del+Formulario+N°+120+IVA+Versión+4.pdf/63799cd8-6212-3c22-779b-51b2f97a136b?t=1680624028092)

[5] [https://www.dnit.gov.py](https://www.dnit.gov.py/web/portal-institucional/irp)

[6] [https://www.dnit.gov.py](https://www.dnit.gov.py/web/portal-institucional/ire-resimple)

[7] [https://consultoria.com.py](https://consultoria.com.py/impuesto-a-la-renta-empresarial-regimen-simple/)

[8] [https://www.dnit.gov.py](https://www.dnit.gov.py/web/portal-institucional/ire-resimple)

[9] [https://www.youtube.com](https://www.youtube.com/watch?v=2Nt7L5AOc1E&t=224)