/**
 * FAQ Data — AutomotiveOS Help System
 * Base de datos de preguntas frecuentes y troubleshooting
 */
(function() {
  'use strict';

  window.FAQ_DATA = [
    // ═══ FACTURACIÓN ═══
    {
      id: 'faq-001',
      category: 'facturacion',
      keywords: ['factura', 'anular', 'sifen', 'nota', 'credito', 'cancelar'],
      question: '¿Cómo anular una factura SIFEN?',
      answer: 'La anulación genera automáticamente una Nota de Crédito vinculada al CDC original.',
      steps: [
        'Ir al módulo de Facturación',
        'Buscar la factura por número o fecha',
        'Hacer clic en el botón "Anular"',
        'Confirmar el motivo de anulación',
        'El sistema genera la Nota de Crédito automáticamente',
        'Se envía a la DNIT/SIFEN para su procesamiento'
      ]
    },
    {
      id: 'faq-002',
      category: 'facturacion',
      keywords: ['dnit', 'contingencia', 'error', 'sifen', 'offline', 'sin internet'],
      question: '¿Qué hacer si la DNIT da error de contingencia?',
      answer: 'Activa el modo contingencia para continuar facturando sin conexión a la DNIT.',
      steps: [
        'Ir a Configuración → SIFEN',
        'Hacer clic en "Activar Modo Contingencia"',
        'El sistema guarda los DTE localmente',
        'Al restablecer la conexión, se envían automáticamente',
        'Verificar estado en el Monitor SIFEN'
      ]
    },
    {
      id: 'faq-003',
      category: 'facturacion',
      keywords: ['factura', 'electronica', 'emitir', 'crear', 'sifen', 'dni'],
      question: '¿Cómo emitir una factura electrónica?',
      answer: 'Cierra la OT y el sistema genera la factura electrónica lista para enviar a SIFEN.',
      steps: [
        'Cerrar la Orden de Trabajo desde Taller',
        'Ir al módulo de Facturación',
        'Hacer clic en "Nueva Factura"',
        'Seleccionar el cliente',
        'Revisar los ítems y montos',
        'Confirmar — la factura se envía a SIFEN automáticamente'
      ]
    },

    // ═══ WHATSAPP ═══
    {
      id: 'faq-004',
      category: 'whatsapp',
      keywords: ['whatsapp', 'reconectar', 'qr', 'conexion', 'desconectado'],
      question: '¿Cómo reconectar WhatsApp?',
      answer: 'Si WhatsApp se desconecta, necesitas escanear un nuevo código QR.',
      steps: [
        'Ir a Configuración',
        'Sección "WhatsApp"',
        'Hacer clic en "Reconectar WhatsApp"',
        'Abrir WhatsApp en el teléfono del taller',
        'Ir a Dispositivos vinculados → Vincular dispositivo',
        'Escanear el QR mostrado en pantalla',
        'Esperar confirmación de conexión'
      ]
    },

    // ═══ INVENTARIO ═══
    {
      id: 'faq-005',
      category: 'inventario',
      keywords: ['inventario', 'repuesto', 'agregar', 'nuevo', 'stock', 'producto'],
      question: '¿Cómo agregar un nuevo repuesto al inventario?',
      answer: 'Registra el repuesto con código, descripción, precios y stock inicial.',
      steps: [
        'Ir al módulo de Inventario',
        'Hacer clic en "Nuevo Repuesto"',
        'Completar: Código, Descripción, Categoría',
        'Ingresar Precio de Compra y Precio de Venta',
        'Definir Stock Mínimo para alertas',
        'Guardar el repuesto'
      ]
    },
    {
      id: 'faq-006',
      category: 'inventario',
      keywords: ['repuesto', 'stock', 'fisico', 'ajuste', 'rotulo', 'etiqueta', 'qr'],
      question: '¿Qué hacer si un repuesto figura sin stock pero físicamente está en el estante?',
      answer: 'Realiza un ajuste manual de inventario e imprime el rótulo QR.',
      steps: [
        'Ir al módulo de Inventario',
        'Buscar el repuesto por código o nombre',
        'Seleccionar "Ajuste de Inventario"',
        'Ingresar la cantidad correcta',
        'Guardar el ajuste',
        'Seleccionar el repuesto → Botón "Etiqueta"',
        'Seleccionar protocolo de impresión → Imprimir rótulo QR'
      ]
    },

    // ═══ COPILOTO IA ═══
    {
      id: 'faq-007',
      category: 'thinkcar',
      keywords: ['thinkcar', 'copiloto', 'ia', 'inteligencia', 'diagnostico', 'dtc', 'obd'],
      question: '¿Cómo uso el Copiloto IA para diagnóstico?',
      answer: 'El Copiloto IA analiza los códigos DTC del vehículo y sugiere reparaciones.',
      steps: [
        'Ir al módulo Thinkcar',
        'Conectar el dispositivo (Bluetooth/USB/Email)',
        'Ejecutar el escaneo del vehículo',
        'El sistema carga los códigos DTC detectados',
        'El Copiloto IA analiza y genera sugerencias',
        'Revisar las sugerencias y hacer clic en "Aplicar a OT"',
        'El diagnóstico se vincula a la Orden de Trabajo'
      ]
    },

    // ═══ AGENDAMIENTO ═══
    {
      id: 'faq-008',
      category: 'calendario',
      keywords: ['agendamiento', 'turno', 'cita', 'calendario', 'reserva', 'booking'],
      question: '¿Cómo configuro los turnos de agendamiento?',
      answer: 'El sistema controla la capacidad del taller automáticamente.',
      steps: [
        'Ir al módulo de Calendario',
        'Hacer clic en "Nueva Cita"',
        'Seleccionar fecha y hora disponible',
        'Elegir tipo de servicio (Rápido/Pesado)',
        'Asociar al cliente y vehículo',
        'Confirmar — se envía confirmación por WhatsApp',
        'El cliente puede responder 1=Confirmar, 2=Cancelar'
      ]
    },

    // ═══ ETIQUETAS ═══
    {
      id: 'faq-009',
      category: 'inventario',
      keywords: ['etiqueta', 'imprimir', 'rotulo', 'escpos', 'zpl', 'tspl', 'thermal'],
      question: '¿Cómo imprimo etiquetas para repuestos?',
      answer: 'Genera etiquetas térmicas con código de barras o QR.',
      steps: [
        'Ir al módulo de Inventario',
        'Seleccionar el repuesto',
        'Hacer clic en botón "Etiqueta"',
        'Seleccionar protocolo: ESC/POS, ZPL o TSPL',
        'Configurar cantidad de copias',
        'Vista previa → Imprimir'
      ]
    },

    // ═══ SEGURIDAD ═══
    {
      id: 'faq-010',
      category: 'seguridad',
      keywords: ['usb', 'token', 'seguridad', 'kill', 'switch', 'bloqueo', 'pantalla negra'],
      question: '¿Por qué el sistema muestra "Pantalla Negra de Bloqueo"?',
      answer: 'El USB de seguridad fue desconectado o el servidor se movió.',
      steps: [
        'Verificar que el USB de seguridad esté conectado',
        'Conectar en el puerto USB 3.0 original',
        'Esperar 5 segundos para verificación automática',
        'Recargar la página del navegador',
        'Si persiste, contactar al administrador del sistema'
      ]
    }
  ];
})();
