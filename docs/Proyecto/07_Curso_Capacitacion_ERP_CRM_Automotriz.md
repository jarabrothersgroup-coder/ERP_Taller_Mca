# 📘 Plan de Estudios Completo — Capacitación ERP/CRM Automotriz Integrado
# AutomotiveOS Cloud ERP

**Versión:** 1.0.0  
**Fecha:** 19 de junio de 2026  
**Autor:** Capacitador Tecnológico Senior / Change Management Specialist  
**Duración estimada del curso:** 40 horas (8 módulos × 5 horas)  
**Modalidad:** Presencial + Virtual (Híbrida)  
**Certificación:** "Operador Certificado AutomotiveOS" (por módulo)

---

## Resumen Ejecutivo del Curso

### Objetivo General
Capacitar a todo el personal del taller automotriz en el uso proficient del sistema ERP/CRM Integrado mediante simulaciones End-to-End en entorno de pruebas, preparando al equipo para el Go-Live con base de datos limpia y lista para operar.

### Público Target
| Rol | Secciones | Horas | Certificación |
|-----|-----------|-------|---------------|
| Asesores de Servicio / Recepción | 1, 3, 4 | 15h | "Asesor Certificado" |
| Mecánicos | 3 | 5h | "Mecánico Digital" |
| Cajeros / Contadores | 4 | 10h | "Cajero Certificado" |
| Administradores / Jefes de Taller | 2, 5, 6 | 15h | "Admin Certificado" |
| Dueños de Taller / TI | 5, 6 | 10h | "Director Certificado" |

### Metodología de Enseñanza
1. **Demostración en vivo** (30%): El capacitador muestra la funcionalidad
2. **Práctica guiada** (40%): Los alumnos replican en su entorno de pruebas
3. **Simulación libre** (20%): Casos de uso inventados por el alumno
4. **Evaluación práctica** (10%): Examen de hands-on con checklist

### Entorno de Pruebas
- **URL:** `http://localhost:3000` (desarrollo) o `http://taller.test:3000` (capacitación)
- **Tenant:** `taller-capacitacion` (datos ficticios, limpieza segura)
- **Credenciales:** Proporcionadas al inicio de cada módulo
- **Base de datos:** Snapshots pre-cargados por sección

---

# ═══════════════════════════════════════════════════════════
#  SECCIÓN 1: CAPTACIÓN Y AGENDAMIENTO
#  Landing Page & CRM Twenty
# ═══════════════════════════════════════════════════════════
#  Duración: 5 horas
#  Público: Marketing, Recepción, Asesores de Servicio
#  Pre-requisitos: Navegador web actualizado, acceso a internet
# ═══════════════════════════════════════════════════════════

---

## CASO DE USO 1.1: El Embudo Digital (Landing Page)

### Diapositiva 1.1.1 — Introducción al Embudo Digital

**Título:** "Del Like al Taller: Cómo tus Clientes te Encuentran y Reservan Solos"

**Objetivo Didáctico:** Comprender el recorrido completo del cliente desde que ve un anuncio en redes sociales hasta que agenda un servicio en tu taller, sin que una persona intervenga.

**Guión del Expositor:**
> "Buenos días, equipo. Hoy vamos a aprender algo que va a cambiar la forma en que nuestro taller recibe clientes. Imagine esto: un cliente ve un post en Facebook sobre mantenimiento preventivo. Hace clic, llega a nuestra página web, cotiza su servicio favorito, elige un día disponible, y ¡listo! Ya tiene su turno agendado. Sin llamadas, sin esperas, sin errores de transcripción. Eso es el embudo digital, y hoy lo vamos a dominar juntos."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** La Landing Page pública (`/landing.html`).
> **Qué mostrar:** El formulario de cotización interactivo completamente visible.
> **Recorte:** Centrar el formulario con el título "Cotiza tu Mantenimiento" visible.
> **Flecha roja:** Señalar el botón "Agendar Ahora" en la parte inferior del formulario.
> **Elemento adicional:** Superponer un teléfono móvil simulado a la derecha mostrando el post de Facebook que enlaza a la landing.

---

### Diapositiva 1.1.2 — Formulario de Cotización Interactivo

**Título:** "Paso 1: El Cliente Elige su Servicio y Ve el Precio al Instante"

**Objetivo Didáctico:** Identificar los campos del formulario de cotización y entender cómo el sistema calcula automáticamente el precio según el tipo de vehículo y servicio seleccionado.

**Guión del Expositor:**
> "Miren esta pantalla. Nuestro formulario tiene tres partes mágicas. Primero: el cliente ingresa los datos de su vehículo — marca, modelo, año y placa. Segundo: selecciona el tipo de servicio que necesita — ¿es un cambio de aceite? ¿Una revisión general? ¿Un service completo? Tercero: al seleccionar el servicio, el sistema muestra el precio estimado al instante. No hay sorpresas, no hay llamadas para cotizar. El precio aparece transparente, y eso genera confianza."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** El formulario de la Landing Page con datos ya ingresados.
> **Qué mostrar:** Formulario llenado con: Toyota Hilux 2022, Chapa XYZ-789, Servicio "Service Completo 20.000km".
> **Recorte:** Formulario completo con precio visible (ej: Gs. 450.000).
> **Flecha roja:** Señalar el campo de precio calculado automáticamente.
> **Dato ficticio:** Usar los datos: Toyota Hilux, 2022, Chapa XYZ-789, Servicio "Service 20.000km", Precio Gs. 450.000.

---

### Diapositiva 1.1.3 — Confirmación de Turno y Datos Viajan al CRM

**Título:** "Paso 2: El Turno se Confirma y los Datos Viajan Solos al CRM"

**Objetivo Didáctico:** Observar cómo al confirmar el turno en la landing, los datos del cliente y del vehículo se crean automáticamente en Twenty CRM sin intervención humana.

**Guión del Expositor:**
> "Aquí es donde la magia sucede. Cuando el cliente presiona 'Confirmar Turno', tres cosas pasan simultáneamente: uno, se crea el registro del cliente en Twenty CRM con nombre, teléfono y email. Dos, se registra el vehículo con marca, modelo, placa y VIN si lo proporcionó. Tres, se agenda el turno para la fecha y hora que el cliente eligió. Todo esto en menos de dos segundos. Sin que nadie del taller tenga que escribir un solo dato."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** Dividir en dos paneles lado a lado.
> **Panel izquierdo:** La landing page mostrando el mensaje de confirmación "¡Turno Agendado! Te esperamos el martes 24 a las 9:00 AM".
> **Panel derecho:** La vista de Twenty CRM (tablero Kanban) mostrando la tarjeta nueva del cliente "Carlos Espínola" en la columna "Nuevos Leads".
> **Flechas rojas:** Una flecha saliendo del mensaje de confirmación y apuntando a la tarjeta en el CRM, indicando el flujo automático.

---

### Diapositiva 1.1.4 — Verificación en el Backend (Vista Administrativa)

**Título:** "Vista Detrás de Escenas: Cómo el Admin Verifica la Integridad del Flujo"

**Objetivo Didáctico:** Aprender a verificar desde el panel administrativo que el registro se creó correctamente en ambas plataformas (CRM + ERP).

**Guión del Expositor:**
> "Ahora vamos a poner el sombrero de detective. Si soy administrador, quiero confirmar que todo llegó bien. Vamos al módulo de clientes del ERP y buscamos a Carlos Espínola. Ahí está: nombre, teléfono, email, y el vehículo registrado. Ahora vamos al CRMTwenty: mismo cliente, misma información, misma oportunidad creada. Los dos sistemas hablan entre sí sin errores. Eso es lo que llamamos 'fuente única de verdad'."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** Vista del ERP en el módulo "Clientes" con el registro de Carlos Espínola visible.
> **Qué mostrar:** Tabla de clientes con la fila de Carlos Espínola resaltada.
> **Recorte:** Tabla completa con columnas: Nombre, Teléfono, Email, Último Servicio.
> **Flecha roja:** Señalar la fila del cliente nuevo con el tag "🆕 Recién registrado".

---

## CASO DE USO 1.2: Gestión Comercial en Twenty CRM

### Diapositiva 1.2.1 — El Tablero Kanban de Twenty CRM

**Título:** "El Mapa de tus Oportunidades: El Tablero Kanban que Todo lo Muestra"

**Objetivo Didáctico:** Navegar el tablero Kanban de Twenty CRM, entender las columnas del embudo comercial y asignar oportunidades a asesores.

**Guión del Expositor:**
> "Twenty CRM es nuestra central de comando comercial. Miren este tablero: cada columna representa una etapa del embudo. 'Nuevos Leads' son los que llegaron de la landing. 'Contactados' son los que ya les hablamos. 'Calificados' tienen presupuesto aprobado. 'Agendados' ya tienen turno. Y 'Cerrados' son servicios completados. Cada tarjeta es una oportunidad de negocio. Podemos moverlas con un simple drag-and-drop, como si fueran notas adhesivas en un pizarrón."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** Tablero Kanban completo de Twenty CRM.
> **Qué mostrar:** 5 columnas visibles con al menos 2 tarjetas en "Nuevos Leads" y 1 en "Agendados".
> **Recorte:** Tablero completo con el encabezado "Pipeline de Ventas" visible.
> **Flecha roja:** Señalar la tarjeta de "Carlos Espínola" moviéndose de "Nuevos Leads" a "Contactados" (indicar movimiento con una flecha curva).

---

### Diapositiva 1.2.2 — Asignación de Asesor y Calendario Drag-and-Drop

**Título:** "Asignar es Fácil: Un Clic en el Asesor, un Arrastre en el Calendario"

**Objetivo Didáctico:** Asignar un asesor de servicio a una oportunidad y agendar visualmente el turno en el calendario semanal con la función drag-and-drop.

**Guión del Expositor:**
> "Ahora vamos a asignar a María, nuestra asesora de servicio, a la oportunidad de Carlos. Un clic en la tarjeta, seleccionamos a María, y listo: ella recibe una notificación en su teléfono. Pero no termina ahí. Vamos al calendario semanal de agendamiento. Aquí vemos todos los turnos del taller. María simplemente arrastra el bloque de 'Carlos Espínola' desde la columna de la landing hasta el martes a las 9:00 AM en la bahía de Servicio Rápido. El sistema valida automáticamente que haya capacidad disponible en esa hora."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** Pantalla dividida en dos secciones.
> **Sección superior:** La tarjeta de Twenty CRM con el asesor "María González" asignado visible en el campo "Asesor Asignado".
> **Sección inferior:** El calendario semanal del ERP mostrando el bloque azul de "Carlos Espínola" en martes 9:00 AM, bahía "Servicio Rápido".
> **Flecha roja:** Señalar el bloque del turno en el calendario con el texto "Drag-and-Drop completado".

---

### Diapositiva 1.2.3 — Registro de Actividad y Seguimiento

**Título:** "Historial de Interacciones: Cada Llamada, Cada WhatsApp, Queda Registrado"

**Objetivo Didáctico:** Revisar el historial de interacciones con el cliente en el CRM y registrar notas de seguimiento manualmente si es necesario.

**Guión del Expositor:**
> "La memoria del sistema nunca olvida. Cada llamada, cada WhatsApp, cada email queda registrado aquí en la línea de tiempo del cliente. Si María habló con Carlos ayer a las 3 PM y le confirmó el turno, eso aparece aquí con la hora exacta. Si mañana Carlos llama para cambiar la fecha, María actualiza la nota y el sistema registra el cambio. Esto es invaluable cuando un cliente dice 'pero yo ya había llamado'. Tenemos la prueba documentada."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** Vista de detalles del contacto en Twenty CRM.
> **Qué mostrar:** Línea de tiempo con 3-4 interacciones: llamada inicial, WhatsApp de confirmación, nota de seguimiento, y el turno agendado.
> **Recorte:** Panel de actividad del contacto con la pestaña "Actividad" activa.
> **Flecha roja:** Señalar la nota más reciente: "Turno confirmado para martes 24/06 a las 9:00 AM".

---

## CASO DE USO 1.3: Confirmación Automatizada por WhatsApp

### Diapositiva 1.3.1 — El Cron Job de Recordatorios

**Título:** "El Reloj Inteligente: Cómo el Sistema Recuerda al Cliente 24 Horas Antes"

**Objetivo Didáctico:** Entender cómo funciona el Cron Job de recordatorios de WhatsApp y cómo auditar que se ejecutó correctamente.

**Guión del Expositor:**
> "Imaginen tener un asistente que nunca se olvida de llamar al cliente 24 horas antes de su turno para confirmar que va a asistir. Eso es nuestro Cron Job. Todos los días a las 9:00 AM, el sistema revisa qué turnos tienen fecha para mañana. Por cada turno, envía un WhatsApp interactivo que dice: 'Hola Carlos, le recordamos su turno mañana a las 9:00 AM. Responda 1 para confirmar o 2 para cancelar'. Automático, sin errores, sin que nadie del taller tenga que hacer la llamada."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** Panel de administración del ERP en la pestaña "Cron Jobs" o "Tareas Programadas".
> **Qué mostrar:** El job "reminder-cron" con estado "Activo", última ejecución visible, y los parámetros: "Horizonte: 24h, Filtro: CONFIRMADO, Template: recordatorio_24h".
> **Recorte:** Tabla de cron jobs con la fila del reminder resaltada.
> **Flecha roja:** Señalar el badge verde "🟢 Ejecutando" junto al job.

---

### Diapositiva 1.3.2 — El Mensaje WhatsApp del Cliente (Vista Móvil)

**Título": "Así Ve el Cliente el Mensaje: Interactivo, Claro, con un Solo Clic"

**Objetivo Didáctico:** Visualizar exactamente cómo se ve el mensaje de WhatsApp que recibe el cliente en su teléfono y cómo responde con un simple toque.

**Guión del Expositor:**
> "Ahora vamos a ponernos en los zapatos del cliente. Carlos recibe este mensaje en su WhatsApp. Miren: es limpio, es profesional, tiene el logo del taller, el fecha, la hora y los dos botones grandes: '1 ✅ Confirmar' y '2 ❌ Cancelar'. Carlos no tiene que escribir nada. Solo toca el '1' y listo. Su turno queda confirmado al instante. Si toca el '2', el sistema libera la bahía y avisa al taller automáticamente."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** Captura de pantalla de un teléfono móvil (o simulador de WhatsApp Business).
> **Qué mostrar:** El mensaje de WhatsApp recibido del taller con el template de recordatorio.
> **Recorte:** Teléfono completo con el chat abierto mostrando el mensaje y los botones interactivos.
> **Flecha roja:** Señalar el botón "1 ✅ Confirmar" que el cliente va a presionar.
> **Elemento adicional:** Superponer un segundo teléfono mostrando la respuesta "1" enviada.

---

### Diapositiva 1.3.3 — Procesamiento de la Respuesta en el ERP

**Título": "Del WhatsApp al ERP: Cómo se Procesa la Respuesta del Cliente"

**Objetivo Didáctico:** Observar en tiempo real cómo la respuesta del cliente ("1" o "2") se procesa en el ERP y actualiza el estado del turno automáticamente.

**Guión del Expositor:**
> "Carlos tocó el '1'. Ahora miren qué pasa en el sistema. En la pestaña de 'Log de Mensajería' del ERP, aparece inmediatamente: 'Respuesta recibida de Carlos Espínola: 1 — Confirmación'. El turno cambia de 'RESERVADO' a 'CONFIRMADO' con un check verde. Si Carlos hubiera tocado el '2', el turno cambiaría a 'CANCELADO' y la bahía se liberaría para otro cliente. Todo registrado, todo auditable, todo automático."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA:**
> **Pantalla a capturar:** Pestaña "Log de Mensajería" o "WhatsApp Monitor" del ERP.
> **Qué mostrar:** Lista de mensajes con el más reciente: "Carlos Espínola → 1 → Confirmado" con badge verde [🟢 Confirmado].
> **Recorte:** Panel completo del monitor con el mensaje resaltado.
> **Flecha roja:** Señalar el badge verde [🟢 Confirmado] junto a la respuesta del cliente.
> **Elemento adicional:** Miniatura del turno en el calendario cambiando de color amarillo (RESERVADO) a verde (CONFIRMADO).

---

# ═══════════════════════════════════════════════════════════
#  SECCIÓN 2: ONBOARDING DEL SISTEMA Y CARGAS INICIALES
#  Configuración ERP
# ═══════════════════════════════════════════════════════════
#  Duración: 5 horas
#  Público: Administradores, Jefes de Taller, Pañoleros
#  Pre-requisitos: Acceso de administrador al ERP
# ═══════════════════════════════════════════════════════════

---

## CASO DE USO 2.1: Configuración del Core del Taller

### Diapositiva 2.1.1 — Bienvenida al Panel de Configuración

**Título**: "El Centro de Mando: Configuración del Taller en 10 Minutos"

**Objetivo Didáctico**: Identificar todas las secciones del panel de configuración y entender qué se configura en cada una.

**Guión del Expositor**:
> "Bienvenidos al cerebro del taller. Todo lo que configuremos aquí define cómo el sistema se comporta cuando lleguen los primeros clientes reales. Vamos a recorrer las cuatro secciones principales: Sucursales, Bahías, Personal y Tarifas. Cada una es un pilar fundamental. Si configuramos bien esto, el resto del sistema funciona solo."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de configuración principal del ERP.
> **Qué mostrar**: Menú lateral con las 4 secciones visibles: "Sucursales y Bahías", "Personal y Tarifas", "Inventario", "SIFEN/Fiscal".
> **Recorte**: Panel completo con el encabezado "⚙️ Configuración del Taller".
> **Flecha roja**: Señalar la sección "Sucursales y Bahías" que vamos a configurar primero.

---

### Diapositiva 2.1.2 — Alta de Sucursales

**Título**: "Paso 1: Definir las Sucursales — ¿Dónde Operamos?"

**Objetivo Didáctico**: Crear una nueva sucursal en el sistema con todos sus datos fiscales y operativos.

**Guión del Expositor**:
> "Primero definimos dónde está nuestro taller. Si tenemos una sola sucursal, es un formulario sencillo. Si tenemos varias, repetimos el proceso por cada ubicación. Aquí ingresamos el nombre — por ejemplo, 'Taller Coronel Oviedo Central' — la dirección completa, el RUC, el teléfono de contacto, y si está activa o no. Un dato importante: el slug. Este es el identificador único que usa el sistema internamente. No lo cambien después de creado."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Formulario de alta de sucursal completado.
> **Qué mostrar**: Campos llenados: Nombre "Taller Coronel Oviedo Central", Dirección "Av. San Blas 1234", RUC "80012345-6", Teléfono "0521-456789", Slug "coronel-oviedo-central".
> **Recorte**: Formulario completo con el botón "Guardar Sucursal" visible.
> **Flecha roja**: Señalar el campo "Slug" con una nota: "Este identificador NO se puede cambiar después".

---

### Diapositiva 2.1.3 — Asignación de Bahías Físicas

**Título**: "Paso 2: Las Bahías — Cuántos Autos Atendemos Simultáneamente"

**Objetivo Didáctico**: Configurar las bahías de servicio de la sucursal definiendo su capacidad máxima por hora.

**Guión del Expositor**:
> "Las bahías son los espacios físicos donde trabajamos los autos. Cada bahía tiene un nombre — 'Rampa 1', 'Elevador 2', 'Box de Servicio Rápido' — y una capacidad máxima por hora. Esto es crucial: si nuestra Rampa 1 puede atender máximo 5 autos por hora, el sistema no va a agendar el sexto. Evita saturación, evita colas, y le da al cliente una experiencia de espera realista."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla de configuración de bahías.
> **Qué mostrar**: Lista de bahías configuradas: "Rampa 1 (Cap: 5/h)", "Elevador 2 (Cap: 3/h)", "Servicio Rápido (Cap: 8/h)".
> **Recorte**: Tabla de bahías con las columnas: Nombre, Capacidad Máxima/Hora, Estado.
> **Flecha roja**: Señalar la columna "Capacidad Máxima/Hora" con un recuadro rojo alrededor del valor "5".

---

### Diapositiva 2.1.4 — Registro de Mecánicos y Tarifas Horarias

**Título**: "Paso 3: Nuestro Equipo — Mecánicos, Categorías y Tarifas"

**Objetivo Didáctico**: Registrar mecánicos en el sistema, asignarles categoría según el escalafón MTESS 2026 y definir su tarifa horaria para cálculo de costos.

**Guión del Expositor**:
> "Cada mecánico es un activo valioso. Aquí lo registramos con su nombre, categoría laboral según el escalafón paraguayo de 2026 — Ayudante, Medio Oficial, Oficial o Oficial Certificado — y su tarifa horaria. Esta tarifa es la que el sistema usa para calcular el costo de mano de obra en cada OT. Si Juan es Oficial Certificado a Gs. 30.000 por hora y trabaja 3 horas en un servicio, el costo de mano de obra es Gs. 90.000. Automático, transparente, sin cálculos manuales."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Formulario de registro de mecánico completado.
> **Qué mostrar**: Nombre "Juan Carlos Martínez", Categoría "Oficial Certificado", Tarifa Horaria "Gs. 30.000", Especialización "Mecánica General + Diagnóstico Electrónico".
> **Recorte**: Formulario completo con el botón "Guardar Mecánico" visible.
> **Flecha roja**: Señalar el campo "Categoría" con una nota: "Escalafón MTESS 2026 — Gs. 4.800.000/mes".

---

## CASO DE USO 2.2: Carga Inicial de Inventario y Herramientas Críticas

### Diapositiva 2.2.1 — Importación de Repuestos Base

**Título**: "Inventariar es Poder: Cómo Cargar tu Catálogo de Repuestos"

**Objetivo Didáctico**: Importar repuestos al sistema mediante carga masiva CSV o registro individual, estableciendo SKU, precios y stock.

**Guión del Expositor**:
> "Un taller sin inventario es como un hospital sin medicamentos. Vamos a cargar nuestros repuestos. Tenemos dos opciones: importación masiva si tenemos un archivo CSV con miles de repuestos, o registro individual para los artículos más críticos. Para la importación, preparamos un CSV con columnas: SKU, Nombre, Marca, Categoría, Costo Unitario, Precio de Venta, Stock Actual, Stock Mínimo. Lo subimos, el sistema valida los datos, y en segundos tenemos el catálogo completo."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla de importación de inventario con el modal de carga CSV abierto.
> **Qué mostrar**: El botón "📥 Importar desde CSV" y la tabla de repuestos cargados (mínimo 5 filas visibles).
> **Recorte**: Tabla de inventario con columnas: SKU, Nombre, Marca, Stock Actual, Precio.
> **Flecha roja**: Señalar el botón "Importar CSV" en la esquina superior derecha.

---

### Diapositiva 2.2.2 — Establecimiento de Stocks Mínimos y Puntos de Reorden

**Título**: "Nunca te Quedes Sin Stock: Puntos de Reorden Inteligentes"

**Objetivo Didáctico**: Configurar los niveles de stock mínimo y punto de reorden para que el sistema alerte automáticamente cuando un repuesto está por agotarse.

**Guión del Expositor**:
> "El stock mínimo es el piso: si bajamos de esa cantidad, necesitamos reponer YA. El punto de reorden es la señal: cuando llegamos ahí, es momento de hacer el pedido al proveedor. Por ejemplo, si tenemos 50 filtros de aceite y el mínimo es 20, estamos bien. Si llegamos a 15 — el punto de reorden — el sistema nos avisa: 'Hey, los filtros de aceite están por agotarse'. Así evitamos que un mecánico tenga que esperar a que llegue un repuesto para trabajar."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Tabla de inventario con los repuestos en estado de alerta.
> **Qué mostrar**: Fila de "Filtro de Aceite Toyota" con Stock Actual: 15, Stock Mínimo: 20, Punto de Reorden: 25. Badge rojo de "⚠️ Bajo Stock".
> **Recorte**: Tabla completa con las columnas "Stock Actual", "Stock Mínimo" y "Punto de Reorden" resaltadas con recuadro rojo.
> **Flecha roja**: Señalar el badge rojo "⚠️ Bajo Stock" y la fila del producto con stock por debajo del mínimo.

---

### Diapositiva 2.2.3 — Registro de Herramientas y Control de Check-Out

**Título**: "Herramientas: Saber Quién Tiene Qué y Cuándo lo Devuelve"

**Objetivo Didáctico**: Registrar herramientas críticas del taller y entender el sistema de check-out/check-in para control de activos.

**Guión del Expositor**:
> "Las herramientas son caras y se pierden fácilmente. Con nuestro sistema, cada herramienta tiene un registro: nombre, marca, número de serie, y estado actual. Cuando un mecánico necesita una herramienta, hace un check-out: selecciona la herramienta, confirma que la está tomando, y el sistema registra quién la tiene y cuándo la tomó. Cuando la devuelve, hace check-in. Si la herramienta no aparece en 48 horas, el sistema genera una alerta automática al jefe de taller."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de control de herramientas del módulo de inventario.
> **Qué mostrar**: Lista de herramientas con estados: "Llave Dinamométrica 1/2" (En Uso — Juan Martínez), "Scanner OBD2 Launch" (Disponible), "Compresor Atlas 30" (Mantenimiento).
> **Recorte**: Tabla completa con columnas: Herramienta, Estado, Asignado a, Último Check-out.
> **Flecha roja**: Señalar la herramienta "En Uso" con el nombre del mecánico y la fecha de check-out.

---

## CASO DE USO 2.3: Configuración del Dispositivo de Seguridad (Token USB)

### Diapositiva 2.3.1 — Bienvenida al Asistente de Seguridad

**Título**: "Tu Llave Digital: Configuración del Token USB de Seguridad"

**Objetivo Didáctico**: Entender la importancia del token USB de hardware y ejecutar la vinculación inicial del dispositivo al servidor.

**Guión del Expositor**:
> "Este es el momento más crítico de toda la configuración. El token USB es la llave maestra de nuestro taller. Sin él, el sistema NO funciona. Es como la llave del cajón fuerte: si la pierdes, no puedes operar. Hoy vamos a vincular nuestro USB físico al servidor del taller. Esto se hace UNA sola vez. Después, el USB debe estar conectado al servidor 24/7. Si alguien lo retira, el sistema se bloquea inmediatamente."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla de bienvenida del asistente de configuración de hardware.
> **Qué mostrar**: Título "🛡️ Configuración de Seguridad Hardware", botón "Iniciar Vinculación", y una nota de advertencia: "⚠️ Este proceso es irreversible. Asegúrese de tener el USB físico listo."
> **Recorte**: Pantalla completa del asistente.
> **Flecha roja**: Señalar el botón "Iniciar Vinculación" con un círculo rojo grande.

---

### Diapositiva 2.3.2 — Generación del Hardware Fingerprint

**Título**: "Paso 1: El Sistema Identifica tu Servidor — Firma Única de Hardware"

**Objetivo Didáctico**: Observar cómo el sistema genera un fingerprint único basado en los componentes físicos del servidor (placa madre, CPU, MAC address).

**Guión del Expositor**:
> "El sistema está escaneando los componentes físicos de nuestro servidor: número de serie de la placa madre, identificador de la CPU, dirección MAC de la tarjeta de red. Con estos tres datos, genera un hash SHA-256 único. Este hash es como la huella dactilar de nuestro servidor. Nadie más en el mundo tiene esta combinación exacta de hardware. Por eso es tan seguro."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla del asistente mostrando el progreso de generación del fingerprint.
> **Qué mostrar**: Mensaje "🔍 Escaneando hardware del servidor...", barra de progreso al 100%, y el hash generado: "Hardware Fingerprint: a7b3c9d2e1f4... (SHA-256)".
> **Recorte**: Panel central del asistente con el fingerprint visible.
> **Flecha roja**: Señalar el hash generado con la nota: "Esta firma es ÚNICA en el mundo".

---

### Diapositiva 2.3.3 — Grabación del Token en el USB

**Título**: "Paso 2: Grabando el Token en tu Unidad USB Física"

**Objetivo Didáctico**: Ejecutar la grabación del token cifrado en el dispositivo USB y verificar que la escritura fue exitosa.

**Guión del Expositor**:
> "Ahora insertamos nuestro USB en el servidor. El sistema va a cifrar el hardware fingerprint con AES-256-GCM — la misma tecnología que usan los bancos — y lo va a grabar en el USB. Este token cifrado es lo que el sistema verifica cada vez que inicia. Si el USB no está presente, o si alguien intenta copiar el token a otro USB, la verificación falla y el sistema se bloquea."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla del asistente mostrando el mensaje de éxito.
> **Qué mostrar**: Mensaje "✅ Hardware Fingerprint generado con éxito. Grabando Token en Unidad E:" con un check verde grande y la ruta del USB: "E:\automotiveos-token.key".
> **Recorte**: Panel central del asistente con el mensaje de éxito.
> **Flecha roja**: Señalar el mensaje "✅ Token grabado exitosamente" y la ruta del archivo en el USB.

---

### Diapositiva 2.3.4 — Verificación de Integridad

**Título**: "Paso 3: Verificando que Todo Funciona — Prueba de Seguridad"

**Objetivo Didáctico**: Realizar una verificación de integridad del token y confirmar que el sistema reconoce el USB correctamente.

**Guión del Expositor**:
> "Último paso: verificación. El sistema lee el token del USB, lo descifra, compara el hash con el fingerprint del servidor, y si coinciden, muestra el mensaje de verificación exitosa. Si no coinciden — por ejemplo, si cambiaste la placa madre del servidor — el sistema rechaza el token y te pide reconfigurar. Esta verificación ocurre cada 5 segundos en segundo plano."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de estado de seguridad del ERP.
> **Qué mostrar**: Indicadores: "🔐 Token USB: Conectado", "✅ Fingerprint: Válido", "⏰ Última verificación: hace 3 segundos", "🛡️ Estado: OPERACIONAL".
> **Recorte**: Panel completo de estado de seguridad.
> **Flecha roja**: Señalar el badge verde "🛡️ Estado: OPERACIONAL" con un círculo verde grande.

---

# ═══════════════════════════════════════════════════════════
#  SECCIÓN 3: OPERACIÓN EN BAHÍA, DIAGNÓSTICO E INSPECCIÓN
#  DVI (Digital Vehicle Inspection)
# ═══════════════════════════════════════════════════════════
#  Duración: 5 horas
#  Público: Jefes de Taller, Recepcionistas, Mecánicos
#  Pre-requisitos: Tablet o computadora con cámara
# ═══════════════════════════════════════════════════════════

---

## CASO DE USO 3.1: Check-in del Vehículo y Apertura de OT

### Diapositiva 3.1.1 — El Vehículo Llega al Taller

**Título**: "¡Llegó el Auto! Cómo Registrar el Ingreso Físico"

**Objetivo Didáctico**: Ejecutar el check-in de un vehículo que llega físicamente al taller, validando los datos que vinieron del CRM.

**Guión del Expositor**:
> "Es las 8:45 AM del martes. Carlos llega con su Hilux al taller. La recepcionista abre el sistema, busca el turno de Carlos en el calendario, y ve los datos que ya están cargados: nombre, teléfono, vehículo, servicio solicitado. No tiene que volver a escribir nada. Solo verifica que los datos sean correctos y presiona 'Procesar Ingreso'. En ese momento, se crea la Orden de Trabajo activa y el sistema notifica a la bahía correspondiente."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla del ERP con el calendario de turnos abierto y el turno de Carlos seleccionado.
> **Qué mostrar**: Turno de "Carlos Espínola — Toyota Hilux 2022 — Service 20.000km" con el botón "📥 Procesar Ingreso / Generar OT" visible al lado.
> **Recorte**: Panel del turno con los datos del cliente y vehículo heredados del CRM.
> **Flecha roja**: Señalar el botón "Procesar Ingreso / Generar OT" con un círculo rojo grande.

---

### Diapositiva 3.1.2 — Herencia de Datos del CRM a la OT

**Título**: "De Turno a Orden de Trabajo: La Magia de la Herencia de Datos"

**Objetivo Didáctico**: Verificar que todos los datos del cliente, vehículo y servicio se transfieren correctamente del CRM a la nueva Orden de Trabajo.

**Guión del Expositor**:
> "Miren esto: al presionar 'Procesar Ingreso', el sistema tomó TODOS los datos del turno de Twenty CRM y los copió a la nueva OT. El nombre de Carlos, su teléfono, la Hilux 2022, la placa XYZ-789, el servicio solicitado, e incluso la nota que María dejó en el CRM: 'Cliente solicita revisión general + cambio de aceite synthetic'. Todo viajó solo. La recepcionista no tuvo que escribir ni una sola letra. Eso es eficiencia."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla de la Orden de Trabajo recién creada.
> **Qué mostrar**: OT #00042 con datos completos: Cliente "Carlos Espínola", Vehículo "Toyota Hilux 2022 — XYZ-789", Servicio "Service 20.000km", Nota "Cliente solicita revisión general + cambio de aceite synthetic".
> **Recorte**: Panel completo de la OT con todos los campos visibles.
> **Flecha roja**: Señalar la nota heredada del CRM con el texto "Datos heredados automáticamente del CRM".

---

### Diapositiva 3.1.3 — Asignación de Bahía y Mecánico

**Título**: "Asignando Recursos: Bahía y Mecánico para esta OT"

**Objetivo Didáctico**: Asignar una bahía disponible y un mecánico a la Orden de Trabajo activa.

**Guión del Expositor**:
> "Ahora asignamos recursos. El sistema nos muestra qué bahías están disponibles a las 9:00 AM. La Rampa 1 tiene capacidad — seleccionamos esa bahía. Luego elegimos al mecánico: Juan Martínez, Oficial Certificado, especialista en mecánica general. El sistema valida automáticamente que Juan no tenga otra OT asignada en el mismo horario. Si la tiene, nos avisa. Si no, confirma la asignación y Juan recibe una notificación en su teléfono."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Formulario de asignación de la OT.
> **Qué mostrar**: Dropdowns de "Bahía: Rampa 1" y "Mecánico: Juan Carlos Martínez" seleccionados, con el botón "✅ Confirmar Asignación".
> **Recorte**: Panel de asignación de la OT con ambos campos visibles.
> **Flecha roja**: Señalar los dos dropdowns seleccionados con la nota "Asignación validada por el sistema".

---

## CASO DE USO 3.2: Diagnóstico con Thinkcar Mini (OBD2)

### Diapositiva 3.2.1 — El Wizard de Conexión OBD2

**Título**: "Conectando el Scanner: Tres Formas de Leer las Fallas del Auto"

**Objetivo Didáctico**: Identificar las tres opciones de importación de códigos de falla (DTC) desde el Thinkcar Mini.

**Guión del Expositor**:
> "El mecánico está frente al auto con el Thinkcar Mini. Tiene tres formas de conectarse. Opción uno: Bluetooth en vivo — el scanner se conecta al teléfono del mecánico y transmite los códigos en tiempo real. Opción dos: archivo USB — si el taller tiene un computador dedicado al scanner, puede exportar un archivo .csv y subirlo al ERP. Opción tres: correo electrónico — el Thinkcar puede enviar los resultados por email, y el ERP los importa automáticamente desde la casilla configurada. El mecánico elige la que le sea más cómoda."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Modal del "Wizard de Conexión OBD2".
> **Qué mostrar**: Tres tarjetas grandes: "📶 Bluetooth en Vivo", "💾 Archivo USB", "📧 Correo Electrónico", cada una con su ícono y descripción.
> **Recorte**: Modal completo con las tres opciones visibles.
> **Flecha roja**: Señalar la opción "Bluetooth en Vivo" con una nota: "Recomendado para diagnóstico en tiempo real".

---

### Diapositiva 3.2.2 — Lectura de Códigos de Falla en Tiempo Real

**Título**: "Los Códigos Hablan: Leyendo las Fallas del Vehículo en Vivo"

**Objetivo Didáctico**: Observar la lectura de códigos DTC en tiempo real vía Bluetooth y su importación automática al ERP.

**Guión del Expositor**:
> "El mecánico presiona 'Conectar Bluetooth' y el sistema busca el Thinkcar Mini. En 5 segundos está conectado. Ahora el scanner lee los códigos de falla del vehículo: P0301 — Fallo de encendido en cilindro 1. P0171 — Mezcla aire/combustible pobre. El mecánico presiona 'Importar al ERP' y esos códigos aparecen automáticamente en la OT, listos para ser diagnosticados."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla del ERP con los códigos DTC importados visibles en la OT.
> **Qué mostrar**: Sección "Diagnóstico OBD2" de la OT con los códigos: P0301 (Fallo de encendido cil. 1), P0171 (Mezcla pobre), con descripciones y nivel de severidad.
> **Recorte**: Panel de diagnóstico con los códigos listados.
> **Flecha roja**: Señalar el código P0301 con badge rojo de "🔴 Crítico".

---

### Diapositiva 3.2.3 — Historial de Diagnósticos por Vehículo

**Título**: "La Memoria del Auto: Comparando Diagnósticos Anteriores"

**Objetivo Didáctico**: Revisar el historial de diagnósticos de un vehículo para identificar patrones recurrentes de fallas.

**Guión del Expositor**:
> "Una ventaja poderosa: el ERP recuerda TODOS los diagnósticos anteriores de cada vehículo. Si la Hilux de Carlos tuvo el código P0301 hace 6 meses y ahora vuelve a aparecer, el sistema nos alerta: '⚠️ Esta falla ya se detectó el 15/12/2025. Verificar si el reparo anterior fue definitivo'. Eso le da al mecánico un contexto invaluable para no repetir trabajos innecesarios."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de historial de diagnósticos del vehículo.
> **Qué mostrar**: Timeline de diagnósticos: "15/12/2025 — P0301 (Reparado: Bujía + Cable)", "19/06/2026 — P0301 (⚠️ Repetido)".
> **Recorte**: Panel de historial con las dos entradas visibles.
> **Flecha roja**: Señalar la alerta de "⚠️ Repetido" con la nota "Falla recurrente detectada automáticamente".

---

## CASO DE USO 3.3: Checklist e Inspección Visual Digital (DVI)

### Diapositiva 3.3.1 — El Checklist Digital del Mecánico

**Título**: "Tablet en Mano: El Checklist que Sustituye al Papel"

**Objetivo Didáctico**: Completar el checklist de inspección visual del vehículo en una tablet, marcando componentes con semáforo de salud.

**Guión del Expositor**:
> "El mecánico toma su tablet y abre el módulo DVI. Aquí tiene una lista de verificación visual: frenos, neumáticos, suspensión, motor, filtros, luces, líquidos. Por cada ítem, marca con semáforo: 🟢 Bueno, 🟡 Requiere atención, 🔴 Crítico. Si el amortiguador derecho está perdiendo líquido, lo marca en rojo y toma una foto. Si los frenos están bien, los marca en verde y sigue. En 10 minutos tiene la inspección completa."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Interfaz DVI en modo tablet (pantalla táctil).
> **Qué mostrar**: Checklist con semáforos: "Frenos: 🟢", "Neumáticos: 🟡", "Suspensión: 🔴", "Motor: 🟢", "Filtros: 🟡", "Luces: 🟢", "Líquidos: 🔴".
> **Recorte**: Panel completo del checklist con todos los ítems visibles.
> **Flecha roja**: Señalar el ítem "Suspensión: 🔴" con el botón "📸 Tomar Foto".

---

### Diapositiva 3.3.2 — Captura de Fotos y Editor de Anotaciones

**Título**: "Una Foto Vale Más: Capturando Evidencia Visual del Daño"

**Objetivo Didáctico**: Tomar fotos del daño encontrado y usar el editor de anotaciones para marcar flechas, círculos y texto sobre la imagen.

**Guión del Expositor**:
> "El mecánico toma la foto del amortiguador con la tablet. La imagen se carga al editor DVI. Ahora usa su dedo o stylus para dibujar una flecha roja señalando la fuga de líquido. Puede agregar un círculo alrededor del área dañada y escribir una nota: 'Fuga de aceite en amortiguador derecho — reemplazo necesario'. Esta foto anotada queda guardada en la OT como evidencia técnica. Cuando el cliente vea el presupuesto, va a ver exactamente por qué necesita cambiar el amortiguador."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Editor de fotos DVI con una imagen de un amortiguador.
> **Qué mostrar**: Foto del amortiguador con flecha roja dibujada señalando la fuga, círculo rojo alrededor del área dañada, y nota de texto: "Fuga de aceite — reemplazo necesario".
> **Recorte**: Editor completo con la foto anotada y las herramientas de dibujo visibles.
> **Flecha roja**: Señalar la flecha roja dibujada sobre la foto con la nota "Editor HTML5 Canvas — trazos en tiempo real".

---

### Diapositiva 3.3.3 — Semáforo de Salud del Vehículo

**Título**: "El Semáforo: Resumen Visual de la Salud del Auto"

**Objetivo Didáctico**: Interpretar el semáforo de salud consolidado que muestra el estado general del vehículo después de la inspección.

**Guión del Expositor**:
> "Al terminar la inspección, el sistema genera un semáforo consolidado. Si hay 5 ítems verdes, 2 amarillos y 1 rojo, el semáforo general es 🔴 Rojo — el auto necesita reparaciones críticas antes de salir. Este semáforo se muestra en la OT, en el presupuesto enviado al cliente, y en el reporte del DVI. Es la primera cosa que el cliente ve cuando abre el link de su inspección."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de resumen DVI con el semáforo consolidado.
> **Qué mostrar**: Semáforo grande 🔴 con la leyenda "Estado: REPARACIONES CRÍTICAS NECESARIAS", desglose: "5 🟢 Buenos | 2 🟡 Atención | 1 🔴 Crítico".
> **Recorte**: Panel de resumen con el semáforo y desglose visibles.
> **Flecha roja**: Señalar el semáforo 🔴 con la nota "Se muestra en el link enviado al cliente".

---

# ═══════════════════════════════════════════════════════════
#  SECCIÓN 4: INGENIERÍA FINANCIERA Y FACTURACIÓN
#  ELECTRÓNICA SIFEN (DNIT)
# ═══════════════════════════════════════════════════════════
#  Duración: 10 horas
#  Público: Asesores de Servicio, Cajeros, Contadores
#  Pre-requisitos: Secciones 1-3 completadas
# ═══════════════════════════════════════════════════════════

---

## CASO DE USO 4.1: Construcción de Presupuestos y Envío por WhatsApp

### Diapositiva 4.1.1 — Mapeo de Repuestos en la OT

**Título**: "Construyendo el Presupuesto: Repuestos + Mano de Obra = Total"

**Objetivo Didáctico**: Agregar repuestos y mano de obra a una Orden de Trabajo para construir un presupuesto completo.

**Guión del Expositor**:
> "La OT está diagnosticada. Ahora vamos a construir el presupuesto. El asesor abre la OT y va a la pestaña 'Presupuesto'. Aquí agrega los repuestos: filtro de aceite synthetic (Gs. 85.000), aceite 5W-30 4 litros (Gs. 120.000), filtro de aire (Gs. 45.000). Luego agrega mano de obra: 'Cambio de aceite + filtro' — 1.5 horas a Gs. 30.000/hora = Gs. 45.000. El sistema calcula automáticamente el total: Gs. 295.000. Sin calculadora, sin errores."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pestaña "Presupuesto" de la OT con los ítems agregados.
> **Qué mostrar**: Tabla de ítems: 3 repuestos + 1 mano de obra, columnas: Descripción, Cantidad, Precio Unitario, Subtotal. Total visible: Gs. 295.000.
> **Recorte**: Panel completo del presupuesto con el total visible.
> **Flecha roja**: Señalar el campo "Total: Gs. 295.000" con un recuadro rojo.

---

### Diapositiva 4.1.2 — Envío del Presupuesto por WhatsApp

**Título**: "Un Clic y el Cliente Recibe su Presupuesto en el Celular"

**Objetivo Didáctico**: Enviar el presupuesto generado al cliente vía WhatsApp con un link interactivo para aprobar o rechazar.

**Guión del Expositor**:
> "El presupuesto está listo. El asesor presiona el botón '💬 Enviar por WhatsApp'. El sistema genera un link interactivo y se lo envía a Carlos por WhatsApp. Carlos abre el mensaje en su teléfono, ve el desglose detallado del presupuesto, y tiene dos botones: '✅ Aprobar Presupuesto' y '❌ Solicitar Cambios'. Si Carlos aprueba, la OT pasa automáticamente a estado 'PRESUPUESTADO' y el asesor recibe una notificación. Sin llamadas, sin emails, sin fricción."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla dividida en dos paneles.
> **Panel izquierdo**: La OT en estado "PRESUPUESTADO" con el botón "💬 Enviar por WhatsApp" resaltado.
> **Panel derecho**: Captura de teléfono mostrando el mensaje de WhatsApp con el presupuesto y botones interactivos.
> **Flecha roja**: Flecha conectando el botón del ERP con el mensaje del teléfono.

---

### Diapositiva 4.1.3 — Aprobación del Cliente y Cambio de Estado

**Título**: "El Cliente Aprobó: La OT Avanza Automáticamente"

**Objetivo Didáctico**: Observar cómo la aprobación del cliente vía WhatsApp cambia el estado de la OT y notifica al equipo.

**Guión del Expositor**:
> "Carlos tocó '✅ Aprobar' en su WhatsApp. En el ERP, la OT cambia de 'PENDIENTE DE APROBACIÓN' a 'PRESUPUESTADO' con un check verde. María, la asesora, recibe una notificación: 'Carlos Espínola aprobó el presupuesto de Gs. 295.000'. El sistema ya está listo para facturar. Todo fluye, nada se detiene."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de notificaciones del ERP con la alerta de aprobación.
> **Qué mostrar**: Notificación: "🔔 Carlos Espínola aprobó presupuesto — OT #00042 — Gs. 295.000" con badge verde.
> **Recorte**: Panel de notificaciones con la alerta visible.
> **Flecha roja**: Señalar la notificación con la nota "Aprobación recibida vía WhatsApp en tiempo real".

---

## CASO DE USO 4.2: Escenarios de Co-Pago Avanzado

### Diapositiva 4.2.1 — Facturación con Aseguradora (Split 80/20)

**Título**: "Cuando Paga la Aseguradora: División Inteligente de Facturas"

**Objetivo Didáctico**: Configurar la división de una OT en dos facturas distintas cuando parte del costo lo paga una aseguradora y parte lo paga el cliente.

**Guión del Expositor**:
> "Este es un escenario real muy común. La reparación de la Hilux de Carlos costó Gs. 500.000. Pero la póliza de Mapfre Seguros cubre el 80% (Gs. 400.000) y el cliente paga el 20% de franquicia (Gs. 100.000). Necesitamos DOS facturas distintas: una para Mapfre con su RUC, y otra para Carlos con su cédula. El sistema hace esto con un solo clic: seleccionamos 'Split por Aseguradora', elegimos Mapfre, ponemos el porcentaje, y el sistema genera las dos facturas automáticamente."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla de facturación con el modal de "Split por Aseguradora" abierto.
> **Qué mostrar**: Modal con: "Aseguradora: Mapfre Seguros S.A.", "Porcentaje cubierto: 80%", "RUC Aseguradora: 80012345-6", "Franquicia Cliente: 20% — Gs. 100.000".
> **Recorte**: Modal completo con ambos porcentajes visibles.
> **Flecha roja**: Señalar los dos campos de porcentaje (80% y 20%) con la nota "Split automático — dos facturas generadas".

---

### Diapositiva 4.2.2 — Las Dos Facturas Generadas

**Título**: "Dos Facturas, Un Solo Clic: El Sistema Divide y Factura"

**Objetivo Didáctico**: Verificar que se generaron correctamente las dos facturas SIFEN con los montos y RUCs correctos.

**Guión del Expositor**:
> "Miren: el sistema generó dos facturas. Factura #001: Mapfre Seguros S.A., RUC 80012345-6, monto Gs. 400.000. Factura #002: Carlos Espínola, Cédula 1.234.567, monto Gs. 100.000. Ambas con IVA calculado correctamente, ambas listas para ser transmitidas a la SIFEN. El asesor solo tiene que presionar 'Emitir' en cada una."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Lista de facturas de la OT con las dos facturas visibles.
> **Qué mostrar**: Dos facturas: "#001 — Mapfre Seguros — Gs. 400.000" y "#002 — Carlos Espínola — Gs. 100.000", ambas con estado "PENDIENTE DE EMISIÓN".
> **Recorte**: Lista de facturas con ambas filas visibles.
> **Flecha roja**: Señalar cada factura con su monto y RUC/Cédula correspondiente.

---

### Diapositiva 4.2.3 — Validación de Integridad Contable

**Título**: "El Contador Verifica: Todo Cuadra al Centavo"

**Objetivo Didáctico**: Verificar que la suma de las dos facturas cubre exactamente el total de la OT, y que los asientos contables se generaron correctamente.

**Guión del Expositor**:
> "El contador abre el reporte de integridad. Factura #001: Gs. 400.000. Factura #002: Gs. 100.000. Total facturado: Gs. 500.000. Total de la OT: Gs. 500.000. Diferencia: Gs. 0. ¡Cuadra perfecto! Los asientos contables también se generaron: Débito en Cuentas por Cobrar, Crédito en Ingresos por Servicios. Todo automático, todo balanceado."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Reporte de integridad contable de la OT.
> **Qué mostrar**: Resumen: "Total OT: Gs. 500.000 | Total Facturado: Gs. 500.000 | Diferencia: Gs. 0" con badge verde "✅ CUADRA".
> **Recorte**: Panel de integridad con el resumen visible.
> **Flecha roja**: Señalar el badge verde "✅ CUADRA" con la nota "Diferencia = 0 — Integridad verificada".

---

## CASO DE USO 4.3: Facturación Mixta y Contingencia SIFEN

### Diapositiva 4.3.1 — Facturación con IVA Mixto (10%, 5%, Exenta)

**Título**: "IVA Mixto: Cuando una Factura Tiene Tres Tasas Distintas"

**Objetivo Didáctico**: Configurar una factura con ítems sujetos a diferentes tasas de IVA (10%, 5% y exentas) según la normativa paraguaya.

**Guión del Expositor**:
> "En Paraguay, no todo paga el mismo IVA. Los repuestos mecánicos pagan 10%. Las gomas de llanta pagan 5%. Y los servicios de mano de obra pueden estar exentos si son exportación. Nuestra factura de Carlos tiene los tres: filtro de aceite (10%), gomas de repuesto (5%), y mano de obra (exenta). El sistema desglosa automáticamente: IVA 10%: Gs. 21.000, IVA 5%: Gs. 2.250, Exenta: Gs. 45.000. Total IVA: Gs. 23.250. Legalmente correcto, automáticamente calculado."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pie de factura con el desglose de IVA visible.
> **Qué mostrar**: Desglose: "Subtotal 10%: Gs. 210.000 | IVA 10%: Gs. 21.000 | Subtotal 5%: Gs. 45.000 | IVA 5%: Gs. 2.250 | Exenta: Gs. 45.000 | Total IVA: Gs. 23.250 | TOTAL: Gs. 300.000".
> **Recorte**: Pie de factura completo con el desglose visible.
> **Flecha roja**: Señalar cada tasa de IVA con colores distintos: rojo para 10%, amarillo para 5%, verde para exenta.

---

### Diapositiva 4.3.2 — Contingencia SIFEN: Cuando la DNIT se Cae

**Título**: "Modo Contingencia: Operando Sin Internet con la DNIT"

**Objetivo Didáctico**: Emitir facturas en modo contingencia cuando los servidores de la SIFEN/DNIT no están disponibles, generando el KUDE localmente.

**Guión del Expositor**:
> "Es viernes a las 4:50 PM. Los servidores de la DNIT se cayeron. Tenemos 3 clientes esperando para pagar. ¿Qué hacemos? Presionamos el botón amarillo 'Emitir en Modo Contingencia'. El sistema genera un KUDE local — un código QR que contiene toda la información fiscal de la factura. Cuando la DNIT vuelva, el sistema transmite automáticamente todas las facturas de contingencia en lote. El taller no para de cobrar nunca."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla de facturación con el botón de contingencia visible.
> **Qué mostrar**: Botón amarillo "⚠️ Emitir en Modo Contingencia / Generar KUDE" con el estado de SIFEN: "🔴 DNIT No Disponible — Modo Contingencia Activo".
> **Recorte**: Panel de facturación con el botón y el estado visibles.
> **Flecha roja**: Señalar el botón amarillo de contingencia con la nota "Operar sin conexión — KUDE local generado".

---

### Diapositiva 4.3.3 — Resolución de Contingencia y Transmisión Automática

**Título**: "Cuando Vuelve la Conexión: Transmisión Automática en Lote"

**Objetivo Didáctico**: Observar cómo el sistema transmite automáticamente las facturas de contingencia cuando la DNIT vuelve a estar disponible.

**Guión del Expositor**:
> "La DNIT volvió a las 5:15 PM. El sistema detectó la reconexión automáticamente. En el monitor de SIFEN, vemos: 'Transmitiendo 3 facturas de contingencia...' — una, dos, tres. Las tres facturas cambiaron de '⚠️ Contingencia' a '✅ Aprobadas'. El KUDE local fue reemplazado por el KUDE oficial de la DNIT. El cliente recibe su factura oficial por WhatsApp. Todo se resolvió solo."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Monitor de SIFEN con el historial de transmisión.
> **Qué mostrar**: Log de transmisión: "17:15 — Conexión DNIT restaurada", "17:15 — Transmitiendo factura #001... ✅", "17:15 — Transmitiendo factura #002... ✅", "17:16 — Transmitiendo factura #003... ✅".
> **Recorte**: Monitor completo con el log de transmisión visible.
> **Flecha roja**: Señalar el mensaje "Conexión DNIT restaurada" con un check verde.

---

# ═══════════════════════════════════════════════════════════
#  SECCIÓN 5: ADMINISTRACIÓN, SEGURIDAD PERIMETRAL
#  Y CONTROL DE CRÍTICOS
# ═══════════════════════════════════════════════════════════
#  Duración: 5 horas
#  Público: Dueños de Talleres, Personal de TI
#  Pre-requisitos: Acceso de administrador
# ═══════════════════════════════════════════════════════════

---

## CASO DE USO 5.1: Control de Eficiencia del Personal (Flat Rate)

### Diapositiva 5.1.1 — El Reloj Marcador Digital

**Título**: "Fichar es Poder: Cómo el Mecánico Registra su Tiempo de Trabajo"

**Objetivo Didáctico**: Usar el reloj marcador digital para registrar el inicio y fin de cada tarea asignada al mecánico.

**Guión del Expositor**:
> "Juan recibe la OT #00042 en su teléfono. Ve la tarea: 'Cambio de aceite + filtro — 1.5 horas estimadas'. Presiona '▶️ Iniciar Tarea'. El cronómetro empieza a correr. Trabaja en el auto. Cuando termina, presiona '⏹️ Finalizar Tarea'. El sistema registra que Juan tardó 1.2 horas en una tarea estimada en 1.5 horas. Eso significa que Juan es un 20% más eficiente que el estándar. Esa eficiencia se traduce en bonos."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel del mecánico en su teléfono/tablet.
> **Qué mostrar**: Tarea activa con cronómetro corriendo: "⏱️ 01:12:34", botón "⏹️ Finalizar Tarea" visible, y la estimación: "Estimado: 1:30:00".
> **Recorte**: Panel completo del mecánico con el cronómetro visible.
> **Flecha roja**: Señalar el cronómetro con la nota "Tiempo real vs. Estimado — Base para bono por eficiencia".

---

### Diapositiva 5.1.2 — Panel de Eficiencia del Equipo

**Título**: "El Dashboard de Eficiencia: Quién Rinde Más y Quién Necesita Apoyo"

**Objetivo Didáctico**: Interpretar el panel de eficiencia del personal que muestra el rendimiento de cada mecánico en tiempo real.

**Guión del Expositor**:
> "El jefe de taller abre el dashboard de eficiencia. Ve una tabla: Juan Martínez — 112% de eficiencia (trabaja más rápido que el estándar). Pedro López — 95% (casi en el estándar). María González — 88% (necesita capacitación en diagnose rápido). El sistema calcula automáticamente el bono mensual de Juan: si su estándar es Gs. 3.773.989 y rinde 112%, su bono es el 12% adicional. Todo transparente, todo justo."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Dashboard de eficiencia del personal.
> **Qué mostrar**: Tabla con mecánicos: Juan (112% — 🟢), Pedro (95% — 🟡), María (88% — 🔴), con columnas: Tareas Completadas, Tiempo Promedio, Eficiencia %, Bono Estimado.
> **Recorte**: Dashboard completo con la tabla de eficiencia visible.
> **Flecha roja**: Señalar la columna "Eficiencia %" con los colores de semáforo.

---

### Diapositiva 5.1.3 — Reporte de Comisiones por Mecánico

**Título**: "Comisiones Justas: El Sistema Calcula el Bono de Cada Mecánico"

**Objetivo Didáctico**: Generar el reporte de comisiones mensuales que muestra el bono calculado automáticamente para cada mecánico según su rendimiento.

**Guión del Expositor**:
> "Al final del mes, el sistema genera el reporte de comisiones. Juan: 45 tareas completadas, eficiencia promedio 112%, bono estimado Gs. 452.878. Pedro: 38 tareas, 95% eficiencia, bono Gs. 178.234. María: 32 tareas, 88% eficiencia, bono Gs. 89.123. El dueño del taller revisa el reporte, aprueba los montos, y el sistema genera los asientos contables de nómina automáticamente. Sin Excel, sin cálculos manuales, sin errores."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Reporte de comisiones mensuales del módulo de Nómina.
> **Qué mostrar**: Tabla con mecánicos y sus comisiones: Juan (Gs. 452.878), Pedro (Gs. 178.234), María (Gs. 89.123), Total: Gs. 720.235.
> **Recorte**: Reporte completo con el total visible.
> **Flecha roja**: Señalar el botón "✅ Aprobar Comisiones" con la nota "Un clic genera los asientos contables".

---

## CASO DE USO 5.2: Políticas de Backup y Respaldo en la Nube

### Diapositiva 5.2.1 — El Módulo de Backups

**Título**: "Dormir Tranquilo: Respaldo Automático de Todos tus Datos"

**Objetivo Didáctico**: Configurar y verificar las tareas de backup automático diario hacia la nube (Supabase/AWS S3).

**Guión del Expositor**:
> "El backup es como el seguro del auto: no lo necesitas hasta que lo necesitas. Nuestro sistema ejecuta un backup completo todas las noches a las 3 AM. Cada backup contiene: la base de datos completa, los archivos de facturación SIFEN, las fotos del DVI, y los logs de auditoría. Los backups se guardan en la nube con cifrado AES-256. Retenemos 30 días. Si hoy es martes y necesito restaurar el backup del viernes pasado, lo tengo."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Dashboard del módulo de Backups.
> **Qué mostrar**: Historial de backups: "18/06 — 3:00 AM — ✅ Éxito — 45.2 MB", "17/06 — 3:00 AM — ✅ Éxito — 44.8 MB", "16/06 — 3:00 AM — ✅ Éxito — 45.0 MB".
> **Recorte**: Dashboard completo con el historial visible.
> **Flecha roja**: Señalar el badge verde "✅ Éxito" y el tamaño del backup.

---

### Diapositiva 5.2.2 — Verificación de Integridad del Backup

**Título**: "No Solo Back up: Verificamos que el Backup No Esté Corrupto"

**Objetivo Didáctico**: Ejecutar la verificación de integridad de un backup para confirmar que es restaurable y no está corrupto.

**Guión del Expositor**:
> "Hacer backup no es suficiente. Hay que verificar que el backup se pueda restaurar. El sistema ejecuta automáticamente una verificación después de cada backup: descomprime el archivo, valida la checksum SHA-256, y confirma que la estructura de tablas es íntegra. Si algo falla, nos avisa inmediatamente por WhatsApp al administrador. Pero si todo está bien, vemos el badge verde: '✅ Integridad verificada — 45.2 MB — Checksum: a7b3c9...'".

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de verificación de integridad del backup más reciente.
> **Qué mostrar**: Detalle del backup: "Fecha: 18/06/2026 3:00 AM", "Tamaño: 45.2 MB", "Checksum: a7b3c9d2...", "Estado: ✅ Integridad verificada", "Tiempo de verificación: 12 segundos".
> **Recorte**: Panel de detalle del backup.
> **Flecha roja**: Señalar el badge "✅ Integridad verificada" y el checksum.

---

### Diapositiva 5.2.3 — Restauración de Backup (Simulación)

**Título**: "El Día D: Cómo Restaurar un Backup cuando Todo Falla"

**Objetivo Didáctico**: Ejecutar la restauración de un backup completo en un entorno de pruebas para validar que funciona correctamente.

**Guión del Expositor**:
> "Vamos a simular una emergencia. Supongamos que un error humano borró todos los registros de facturación de ayer. El administrador entra al módulo de backups, selecciona el backup del día anterior, presiona '🔄 Restaurar', confirma la acción, y en 2 minutos todos los datos están de vuelta. Las facturas, los asientos contables, los logs de SIFEN. Todo restaurado, nada perdido."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Modal de confirmación de restauración de backup.
> **Qué mostrar**: Modal: "⚠️ ¿Restaurar backup del 17/06/2026? Esto sobrescribirá los datos actuales." con botón "🔄 Confirmar Restauración".
> **Recorte**: Modal de confirmación con la advertencia visible.
> **Flecha roja**: Señalar el botón de confirmación con la nota "Acción irreversible — solo para emergencias".

---

## CASO DE USO 5.3: El Escenario "Kill-Switch"

### Diapositiva 5.3.1 — El Kill-Switch: ¿Qué es y Por Qué Existe?

**Título**: "El Botón de Apagado: Entendiendo el Kill-Switch de Seguridad"

**Objetivo Didáctico**: Comprender la función del Kill-Switch hardware, por qué existe, y en qué escenarios se activa.

**Guión del Expositor**:
> "El Kill-Switch es nuestro último recurso de seguridad. Si alguien roba el servidor del taller, si detectamos un ataque cibernético, o si el USB de seguridad es removido físicamente, el sistema se bloquea INMEDIATAMENTE. Todas las sesiones activas se cierran, todas las conexiones a la base de datos se terminan, y el sistema muestra un mensaje de error 503. Nadie puede operar sin el USB físico. Es como el seguro anti-robo de un auto, pero para nuestros datos."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Diagrama conceptual del Kill-Switch (no una pantalla del sistema).
> **Qué mostrar**: Diagrama simple: USB Físico → Servidor → Verificación cada 5s → Si USB ausente → BLOQUEO TOTAL.
> **Recorte**: Diagrama completo con las flechas del flujo.
> **Flecha roja**: Señalar la conexión USB con la nota "Verificación cada 5 segundos — Sin USB = Sin Operación".

---

### Diapositiva 5.3.2 — Simulación: Retiro del USB

**Título**: "En Vivo: Retirando el USB y Observando el Bloqueo Instantáneo"

**Objetivo Didáctico**: Ejecutar una simulación del retiro del USB de seguridad y observar el bloqueo inmediato del sistema.

**Guión del Expositor**:
> "Vamos a la práctica. Tengo el USB conectado al servidor. El sistema está operacional — miren, puedo navegar, facturar, todo funciona. Ahora... retiro el USB físicamente. Observen: 1, 2, 3, 4, 5 segundos... ¡BLOQUEO! Todas las pantallas muestran el error 503. Nadie puede entrar. Nadie puede facturar. El taller queda congelado hasta que el USB vuelva a estar conectado."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla de bloqueo del sistema (HTTP 503).
> **Qué mostrar**: Pantalla completa de error: "🚫 Error Crítico: Token de hardware ausente. Conexiones denegadas. Contacte al administrador del sistema." con fondo rojo oscuro.
> **Recorte**: Pantalla completa de bloqueo.
> **Flecha roja**: Señalar el código de error "503" con la nota "Bloqueo total — Sin acceso a ninguna funcionalidad".

---

### Diapositiva 5.3.3 — Restauración: Reconectando el USB

**Título**: "Restaurando la Operación: El USB Vuelve y todo Funciona de Nuevo"

**Objetivo Didáctico**: Reconectar el USB de seguridad y verificar que el sistema se desbloquea automáticamente sin pérdida de datos.

**Guión del Expositor**:
> "Ahora reconecto el USB. El sistema detecta la presencia del token en menos de 5 segundos. Verifica el fingerprint, confirma que es el USB legítimo, y... ¡listo! Todas las pantallas vuelven a la normalidad. Las sesiones que estaban abiertas se restauran. Los datos que estaban en proceso se recuperan. No se perdió ni un solo byte. Eso es la robustez de nuestro sistema de seguridad."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de estado de seguridad después de la reconexión.
> **Qué mostrar**: Indicadores: "🔐 Token USB: Reconectado", "✅ Fingerprint: Válido", "🔓 Estado: DESBLOQUEADO", "⏰ Desbloqueado hace: 3 segundos".
> **Recorte**: Panel de estado de seguridad con los indicadores verdes.
> **Flecha roja**: Señalar el badge "🔓 DESBLOQUEADO" con la nota "Restauración automática — Sin pérdida de datos".

---

# ═══════════════════════════════════════════════════════════
#  SECCIÓN 6: PROTOCOLO DE PASO A PRODUCCIÓN
#  Base Limpia — Go-Live
# ═══════════════════════════════════════════════════════════
#  Duración: 5 horas
#  Público: Todo el Equipo y Administradores
#  Pre-requisitos: Secciones 1-5 completadas + Certificación
# ═══════════════════════════════════════════════════════════

---

## CASO DE USO 6.1: Limpieza Estructural de Datos de Prueba

### Diapositiva 6.1.1 — ¿Por Qué Limpiar la Base de Datos?

**Título**: "El Día Antes del Go-Live: Por Qué Debemos Purgar los Datos de Prueba"

**Objetivo Didáctico**: Entender la diferencia entre datos de prueba (que se borran) y datos de configuración (que se preservan) antes del paso a producción.

**Guión del Expositor**:
> "Durante la capacitación, creamos decenas de OTs ficticias, facturas de prueba, turnos inventados. Todo eso está en la base de datos. Cuando entramos en producción real, NO queremos que esos datos aparezcan. Un cliente no debería ver una OT de 'Juan Pérez — Prueba 1' cuando está buscando sus propios registros. Por eso existe el protocolo de limpieza: borramos lo que es basura de prueba, pero PRESERVAMOS lo que configuramos para siempre."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: No es una pantalla del sistema. Es un diagrama conceptual.
> **Qué mostrar**: Dos columnas: "🗑️ SE BORRA" (OTs de prueba, facturas ficticias, turnos inventados, fotos de ejemplo) y "✅ SE PRESERVA" (Sucursales, bahías, usuarios, tarifas, inventario, configuración SIFEN).
> **Recorte**: Diagrama completo con ambas columnas visibles.
> **Flecha roja**: Señalar la columna "SE PRESERVA" con la nota "Esto queda para siempre".

---

### Diapositiva 6.1.2 — El Script de Purga

**Título**: "El Botón Rojo: Ejecutando la Purga de Datos de Prueba"

**Objetivo Didáctico**: Localizar y ejecutar el script de limpieza que elimina los datos de prueba de forma segura.

**Guión del Expositor**:
> "El script de purga está en el panel de administración, en la sección 'Herramientas Avanzadas'. Es un botón rojo grande que dice '🗑️ Purgar Datos de Prueba'. Antes de ejecutarlo, el sistema nos muestra un resumen: 'Se eliminarán: 47 OTs, 23 facturas, 156 fotos DVI, 89 turnos. Se preservarán: 3 sucursales, 12 bahías, 8 usuarios, 342 repuestos, configuración SIFEN'. Si estamos de acuerdo, presionamos 'Confirmar Purga' y en 30 segundos la base está limpia."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Modal de confirmación de purga con el resumen visible.
> **Qué mostrar**: Modal: "⚠️ PURGA DE DATOS DE PRUEBA" con desglose: "Se eliminarán: 47 OTs, 23 facturas, 156 fotos DVI" y "Se preservarán: 3 sucursales, 12 bahías, 8 usuarios". Botón rojo "🗑️ Confirmar Purga".
> **Recorte**: Modal completo con ambas secciones visibles.
> **Flecha roja**: Señalar el botón rojo de confirmación con la nota "Última oportunidad para cancelar".

---

### Diapositiva 6.1.3 — Verificación Post-Purga

**Título**: "Verificando: La Base Está Limpia y Lista para Producción"

**Objetivo Didáctico**: Verificar que la purga se ejecutó correctamente y que la base de datos está lista para recibir datos reales.

**Guión del Expositor**:
> "La purga terminó. Ahora verificamos. Entramos a la sección de OTs: cero órdenes de prueba. Entramos a facturación: cero facturas ficticias. Entramos a configuración: las 3 sucursales siguen ahí, las 12 bahías configuradas, los 8 usuarios con sus permisos, los 342 repuestos en inventario. La base está lista. Es como una hoja en blanco con la infraestructura ya montada."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Panel de administración mostrando el estado post-purga.
> **Qué mostrar**: Contadores: "OTs: 0", "Facturas: 0", "Turnos: 0", "Fotos: 0" (todo en cero), y abajo "Sucursales: 3", "Bahías: 12", "Usuarios: 8", "Repuestos: 342" (todo preservado).
> **Recorte**: Panel completo con los contadores visibles.
> **Flecha roja**: Señalar los contadores en cero con la nota "Base limpia — lista para producción".

---

## CASO DE USO 6.2: Uso del Menú de Ayuda Contextual Integrado

### Diapositiva 6.2.1 — El Panel de Ayuda Lateral

**Título**: "¿Duda? El Panel de Ayuda Contextual Responde al Instante"

**Objetivo Didáctico**: Localizar y usar el panel de ayuda lateral (HelpSidebar) que aparece contextualmente según la pantalla donde se encuentre el usuario.

**Guión del Expositor**:
> "Mientras trabajamos en el día a inevitablemente surgen dudas. ¿Cómo hago para facturar con IVA exento? ¿Dónde está el botón de contingencia SIFEN? ¿Cómo configuro una nueva bahía? Para todo eso existe el panel de ayuda. Miren este signo de interrogación azul en la esquina inferior derecha. Un clic y se abre un panel lateral con las preguntas frecuentes más relevantes para la pantalla donde estoy parado. Si estoy en facturación, me muestra FAQs de facturación. Si estoy en inventario, FAQs de inventario."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Pantalla del ERP con el panel de ayuda lateral abierto.
> **Qué mostrar**: El panel lateral "❓ Ayuda" desplegado sobre la pantalla de caja, mostrando 3-4 FAQs relevantes: "¿Cómo facturar con IVA exento?", "¿Qué hago si la DNIT no responde?", "¿Cómo aplico un descuento?".
> **Recorte**: Panel completo con el HelpSidebar abierto sobre la pantalla de caja.
> **Flecha roja**: Señalar el botón "❓" en la esquina y el panel lateral abierto.

---

### Diapositiva 6.2.2 — Indicadores de Salud del Sistema

**Título**: "Semáforos de Salud: Todo Verde, Todo Operacional"

**Objetivo Didáctico**: Interpretar los indicadores de salud de las conexiones críticas (SIFEN, WhatsApp, Token USB, Base de Datos) que se muestran en el header del sistema.

**Guión del Expositor**:
> "Arriba a la derecha de la pantalla, siempre vemos estos semáforos. Si están todos verdes, todo funciona. SIFEN 🟢 significa que podemos facturar electrónicamente. WhatsApp 🟢 significa que los clientes reciben sus mensajes. Token USB 🟢 significa que el sistema está desbloqueado. Base de Datos 🟢 significa que hay conexión. Si alguno se pone rojo, sabemos inmediatamente qué está fallando y podemos actuar."

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: Header del ERP con los indicadores de salud visibles.
> **Qué mostrar**: Indicadores en la barra superior: "SIFEN 🟢 Operacional", "WhatsApp 🟢 Operacional", "Token USB 🟢 Conectado", "BD 🟢 Online".
> **Recorte**: Header del ERP con los 4 indicadores visibles.
> **Flecha roja**: Señalar cada indicador verde con su nombre y estado.

---

### Diapositiva 6.2.3 — Cierre del Curso y Certificación

**Título**: "¡Felicitaciones! Eres un Operador Certificado AutomotiveOS"

**Objetivo Didáctico**: Revisar lo aprendido, entregar la certificación y establecer los próximos pasos para el Go-Live.

**Guión del Expositor**:
> "Equipo, llegamos al final de este curso. Repasamos desde que un cliente nos encuentra en internet hasta que facturamos electrónicamente, pasando por el diagnóstico con Thinkcar, la inspección visual digital, y la seguridad perimetral. Cada uno de ustedes ahora es un operador certificado de AutomotiveOS. Recuerden: el sistema está diseñado para facilitar su trabajo, no para complicarlo. Si tienen dudas, el panel de ayuda está siempre ahí. Si detectan un problema, los semáforos les avisan. Y si algo sale mal, el backup está ahí para restaurar. ¡Muchas gracias y vamos a producir!"

**📸 INSTRUCCIÓN DE CAPTURA DE PANTALLA**:
> **Pantalla a capturar**: No es una pantalla del sistema. Es un slide de cierre con diseño corporativo.
> **Qué mostrar**: Logo de AutomotiveOS, texto "🎓 Operador Certificado — Capacitación Completada", fecha del certificado, y un QR code que enlaza al manual de usuario en línea.
> **Recorte**: Slide de cierre con diseño profesional.
> **Elemento adicional**: Superponer una imagen de certificado impreso con el nombre del alumno.

---

# ═══════════════════════════════════════════════════════════
#  ANEXOS
# ═══════════════════════════════════════════════════════════

## A. Checklist de Pre-Go-Live

| # | Verificación | Estado |
|---|-------------|--------|
| 1 | Todos los usuarios certificados en su módulo | ☐ |
| 2 | Base de datos purgada de datos de prueba | ☐ |
| 3 | Sucursales y bahías configuradas | ☐ |
| 4 | Inventario cargado con stock real | ☐ |
| 5 | Token USB vinculado y verificado | ☐ |
| 6 | SIFEN configurado con certificado de producción | ☐ |
| 7 | WhatsApp/Evolution API conectado | ☐ |
| 8 | Twenty CRM vinculado al ERP | ☐ |
| 9 | Backup automático verificado (último backup exitoso) | ☐ |
| 10 | Redis cache configurado y funcionando | ☐ |
| 11 | Supavisor en modo Transaction (puerto 6543) | ☐ |
| 12 | CI/CD pipeline ejecutándose sin errores | ☐ |
| 13 | Kill-Switch verificado (prueba de retiro de USB) | ☐ |
| 14 | Panel de ayuda contextual funcional | ☐ |
| 15 | Plan de contingencia documentado y probado | ☐ |

## B. Datos Semilla Recomendados para Go-Live

| Entidad | Cantidad | Notas |
|---------|----------|-------|
| Sucursales | 1-3 | Según estructura real del taller |
| Bahías | 3-10 | Según capacidad física |
| Usuarios/Mecánicos | 5-15 | Personal activo del taller |
| Repuestos base | 200-500 | Catálogo crítico del taller |
| Tarifas horarias | 4 | Por categoría MTESS 2026 |
| Plan de cuentas | 50-100 | Según complejidad contable |

## C. Cronograma de Capacitación Sugerido

| Día | Horario | Sección | Duración |
|-----|---------|---------|----------|
| Lunes | 8:00-13:00 | Sección 1: Captación y Agendamiento | 5h |
| Martes | 8:00-13:00 | Sección 2: Onboarding del Sistema | 5h |
| Miércoles | 8:00-13:00 | Sección 3: Operación en Bahía + DVI | 5h |
| Jueves | 8:00-18:00 | Sección 4: Finanzas + SIFEN | 10h |
| Viernes | 8:00-13:00 | Sección 5: Administración + Seguridad | 5h |
| Sábado | 8:00-13:00 | Sección 6: Go-Live + Certificación | 5h |

---

**Fin del Plan de Estudios — Capacitación AutomotiveOS Cloud ERP v1.0.0**
