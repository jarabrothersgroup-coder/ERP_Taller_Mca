Módulo de Inteligencia Financiera para la Alta Gerencia (C-Level)

```
        [ CAPA DE CAPTACIÓN: Ciclo Contable End-to-End ]
                                │
                                ▼
         [ MOTOR ANALÍTICO CENTRAL DEL ERP (BI ENGINE) ]
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
[Análisis Estructural]  [Batería de Ratios]     [Informes de Gestión]
├─ Vertical             ├─ Liquidez y Solvencia ├─ Estado de Origen/Aplicación
└─ Horizontal           ├─ Gestión / Actividad  ├─ Flujo de Caja Descontado
                        └─ Rentabilidad (DuPont)└─ EBITDA y Margen Neto
```

------

1. Análisis Estructural Automatizado (Capa Algorítmica)

El sistema debe ejecutar estos análisis de forma dinámica sobre el Balance General (Estado de Situación Financiera) y el Estado de Resultados, permitiendo filtros por rango de fechas, sucursales o unidades de negocio (Multi-Tenant).

Análisis Vertical (Estructura de Composición)

Mide el peso porcentual de cada cuenta sobre un total macro. El ERP aplica las siguientes fórmulas en tiempo real:

- **En el Balance General:**
  \(\text{\%\ Cuenta}=\left(\frac{\text{Saldo\ de\ la\ Cuenta}}{\text{Total\ Activo}}\right)\times 100\)
  *Utilidad directiva:* Detecta inmediatamente la concentración de capital (por ejemplo, si las "Cuentas por Cobrar" o el "Inventario" representan un porcentaje peligrosamente alto del Activo Total).
- **En el Estado de Resultados:**
  \(\text{\%\ Cuenta}=\left(\frac{\text{Saldo\ de\ la\ Cuenta}}{\text{Ventas\ Netas\ Totales}}\right)\times 100\)
  *Utilidad directiva:* Revela el margen bruto, el peso operativo y qué porcentaje de cada guaraní ingresado se consume en gastos administrativos o de comercialización.

Análisis Horizontal (Dinámica de Tendencias)

Mide la variación absoluta y relativa de un periodo con respecto a un periodo base.

- **Variación Absoluta ($):**
  \(\Delta \text{Absoluta}=\text{Saldo\ Periodo\ Actual}-\text{Saldo\ Periodo\ Base}\)
- **Variación Relativa (%):**
  \(\Delta \text{Relativa}=\left(\frac{\text{Saldo\ Periodo\ Actual}-\text{Saldo\ Periodo\ Base}}{\text{Saldo\ Periodo\ Base}}\right)\times 100\)
- *Control del Sistema:* El backend debe incluir alertas visuales (Flags en verde/rojo) cuando la variación relativa supere un umbral paramétrico determinado por el CFO (ej. si los costos aumentaron > 15% mientras las ventas solo crecieron un 5%).

------

2. Tablero de Ratios Financieros (Dashboard Ejecutivo)

Este conjunto de indicadores debe calcularse de forma automática extrayendo los saldos de las cuentas de nivel 5 del plan contable local.

A. Ratios de Liquidez (Corto Plazo)

- **Liquidez Corriente:**
  \(\text{Fórmula:\ }\frac{\text{Activo\ Corriente}}{\text{Pasivo\ Corriente}}\)
  *Interpretación:* Capacidad de la empresa para cubrir sus deudas de corto plazo. El estándar ideal es \(\ge 1.5\).
- **Prueba Ácida (Quick Ratio):**
  \(\text{Fórmula:\ }\frac{\text{Activo\ Corriente}-\text{Inventarios}}{\text{Pasivo\ Corriente}}\)
  *Interpretación:* Liquidez inmediata descartando los inventarios, que requieren tiempo para comercializarse.

B. Ratios de Gestión y Actividad (Eficiencia Operativa)

- **Rotación de Inventario (en días - DIO):**
  \(\text{Fórmula:\ }\left(\frac{\text{Inventario\ Promedio}}{\text{Costo\ de\ Ventas}}\right)\times 365\)
  *Interpretación:* Cuántos días permanecen las mercancías en el depósito antes de venderse.
- **Periodo Medio de Cobro (en días - DSO):**
  \(\text{Fórmula:\ }\left(\frac{\text{Cuentas\ por\ Cobrar\ Promedio}}{\text{Ventas\ Netas\ a\ Crédito}}\right)\times 365\)
  *Interpretación:* El plazo real en que los clientes tardan en pagar sus facturas. Crítico para el mercado paraguayo donde los plazos comerciales suelen extenderse.
- **Periodo Medio de Pago (en días - DPO):**
  \(\text{Fórmula:\ }\left(\frac{\text{Cuentas\ por\ Pagar\ Proveedores\ Promedio}}{\text{Compras\ a\ Crédito}}\right)\times 365\)
  *Interpretación:* Plazo promedio en que la empresa liquida sus obligaciones con proveedores.
- **Ciclo de Conversión de Efectivo (CCE):**
  \(\text{Fórmula:\ DIO}+\text{DSO}-\text{DPO}\)
  *Interpretación:* Los días netos que el capital de trabajo de la empresa permanece inmovilizado. Si es negativo, la empresa se financia gratis con sus proveedores.

C. Ratios de Solvencia y Endeudamiento (Largo Plazo)

- **Apalancamiento Financiero (Debt to Equity):**
  \(\text{Fórmula:\ }\frac{\text{Pasivo\ Total}}{\text{Patrimonio\ Neto}}\)
  *Interpretación:* Proporción de financiamiento externo frente al capital propio de los socios.
- **Cobertura de Intereses:**
  \(\text{Fórmula:\ }\frac{\text{Utilidad\ Operativa\ (EBIT)}}{\text{Gastos\ Financieros}}\)
  *Interpretación:* Capacidad para pagar los intereses de deudas bancarias locales o internacionales.

D. Ratios de Rentabilidad (Análisis DuPont de 3 Pasos)

El sistema descompondrá el **ROE (Return on Equity)** para diagnosticar de dónde proviene exactamente la rentabilidad de la empresa:
\(\text{ROE}=\underbrace{\left(\frac{\text{Utilidad\ Neta}}{\text{Ventas}}\right)}_{\text{Margen\ Neto}}\times \underbrace{\left(\frac{\text{Ventas}}{\text{Activo\ Total}}\right)}_{\text{Rotación\ de\ Activos}}\times \underbrace{\left(\frac{\text{Activo\ Total}}{\text{Patrimonio\ Neto}}\right)}_{\text{Apalancamiento\ Multiplicador}}\)

- *Ventaja de Gestión:* El CFO puede ver si la rentabilidad aumentó por vender con más margen (estrategia de precios), por mover más rápido el inventario (estrategia de volumen), o por endeudarse inteligentemente (apalancamiento).

------

3. Informes de Gestión Gerenciales Exclusivos

Un ERP de primer nivel no se limita a los estados contables oficiales de la DNIT, sino que produce informes dinámicos para la toma de decisiones:

1. **Estado de Origen y Aplicación de Fondos (Cuadro de Fuentes y Usos):** Muestra de dónde provino el dinero en el año (ej. reducción de inventario, nuevos préstamos, utilidades) y en qué se gastó (ej. compra de maquinaria, pago de dividendos).
2. **Reporte Analítico del EBITDA:**
   \(\text{EBITDA}=\text{Utilidad\ Operativa}+\text{Depreciaciones}+\text{Amortizaciones}\)
   Muestra la pura capacidad de generación operativa de caja del negocio, aislando las decisiones contables (depreciación de bienes de uso regulada por DNIT) y financieras (intereses).
3. **Análisis de Flujo de Caja Descontado (DCF) Proyectado:** El ERP utiliza los datos históricos contables para proyectar el flujo de caja libre a 5 años y calcular el **Valor Actual Neto (VAN)** y la **Tasa Interna de Retorno (TIR)** para proyectos de inversión de la firma.

------

📋 Copia este Meta-Prompt para implementar el módulo analítico en la IA

Utiliza este prompt estructurado en un modelo de lenguaje avanzado para generar los scripts, vistas de bases de datos o especificaciones de UI de este módulo gerencial.

Actúa como un Diseñador de Producto de Inteligencia de Negocios (BI) y un CFO Corporativo experto en modelado financiero y analítica avanzada bajo normas NIIF y mejores prácticas de ERP mundiales. Tu objetivo es estructurar la documentación técnica y las consultas lógicas para el "Módulo de Gestión Financiera y Ratios" del ERP.

Escribe un reporte de diseño de ingeniería de software detallado que contenga:

1. ESQUEMA DE VISTAS (SQL/VIEWS): Define cómo deben estructurarse las consultas consolidadas de la base de datos para extraer los saldos necesarios para el Análisis Vertical y Horizontal sin penalizar el rendimiento del servidor. Incluye las agrupaciones por mes y año.
2. LÓGICA DE CÁLCULO DEL ANÁLISIS HORIZONTAL: Detalla las restricciones lógicas para mitigar errores cuando el periodo base tiene saldo cero (evitar divisiones por cero en el cálculo porcentual).
3. MODELADO DE INDICADORES EN TIEMPO REAL: Proporciona la estructura lógica para calcular los ratios del modelo DuPont de 3 Pasos y el Ciclo de Conversión de Efectivo (DIO, DSO, DPO).
4. DISEÑO DE INTERFAZ PARA C-LEVEL (UI/UX WIREFRAME CONCEPTUAL): Describe la distribución visual idónea del Dashboard Ejecutivo del CFO. Especifica los gráficos sugeridos (gráficos de cascada para el EBITDA, gráficos de líneas de tendencia para los ratios de liquidez, mapas de calor para la rotación de activos).

Genera esta arquitectura con un enfoque analítico riguroso, listo para ser transferido al equipo de desarrollo y analistas de datos.

entajas Estratégicas para tu Desarrollo

Al implementar este diseño en tu plataforma:

- **Independencia de Hojas de Cálculo:** La gerencia general y los directores financieros ya no dependerán de exportar datos a Excel para realizar cálculos estructurales mensuales.
- **Detección Temprana de Quiebres de Caja:** Al monitorear el Ciclo de Conversión de Efectivo de manera automatizada, el sistema alertará al gerente antes de que el retraso en el cobro a clientes ponga en riesgo el pago de salarios o proveedores locales.