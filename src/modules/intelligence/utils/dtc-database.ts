/**
 * DTC Code Definitions Reference Database.
 *
 * Provides lookup of OBD-II Diagnostic Trouble Codes with
 * Spanish descriptions, severity, repair suggestions, and
 * parts recommendations for Paraguayan workshop context.
 *
 * Size: ~40KB heap, loaded lazily on first access.
 * This is a constant map — no DB query involved.
 *
 * @module intelligence/utils/dtc-database
 */

// ─── DTC Definition Type ─────────────────────────

export interface DtcDefinition {
  /** Standard OBD-II code */
  code: string;
  /** Spanish description */
  description: string;
  /** Severity classification */
  severity: "Info" | "Warning" | "Critical" | "Emergency";
  /** Suggested repair actions */
  suggestions: string[];
  /** Parts that may need replacement */
  suggestedParts: string[];
  /** Whether this code is EV/HEV related */
  isEvRelated: boolean;
}

// ─── Database ────────────────────────────────────

/**
 * Lazy-loaded DTC definitions map.
 * Loaded on first call to `getDtcDefinition()`.
 */
let _definitions: Map<string, DtcDefinition> | null = null;

/**
 * Loads all DTC definitions into memory (lazy singleton).
 */
function loadDefinitions(): Map<string, DtcDefinition> {
  if (_definitions) return _definitions;

  const map = new Map<string, DtcDefinition>();

  // ─── Powertrain (P-codes) ──────────────────────

  // Fuel & Air Metering (P0xxx)
  map.set("P0000", makeDef("P0000", "Sin falla detectada", "Info", [], []));
  map.set("P0010", makeDef("P0010", "Circuito del actuador de posición del árbol de levas (Banco 1)", "Warning",
    ["Verificar cableado del actuador VVT", "Comprobar resistencia del solenoide VVT", "Reemplazar solenoide VVT si está en corto o abierto"],
    ["Solenoide VVT", "Arnés de cableado motor"], false));
  map.set("P0011", makeDef("P0011", "Avance de posición del árbol de levas (Banco 1) — Respuesta lenta", "Warning",
    ["Verificar nivel y presión de aceite del motor", "Comprobar solenoide VVT", "Revisar cadena/correa de distribución"],
    ["Solenoide VVT", "Sensor de posición de árbol de levas", "Aceite de motor"], false));
  map.set("P0016", makeDef("P0016", "Correlación cigüeñal/árbol de levas (Banco 1, Sensor A)", "Critical",
    ["Verificar cadena/correa de distribución por desgaste o salto", "Comprobar tensor de cadena", "Verificar alineación de marcas de distribución"],
    ["Cadena/correa de distribución", "Tensor de distribución", "Sensor de posición"], false));
  map.set("P0017", makeDef("P0017", "Correlación cigüeñal/árbol de levas (Banco 1, Sensor B)", "Critical",
    ["Verificar distribución", "Comprobar sensor de cigüeñal", "Revisar daños en el volante del motor"],
    ["Cadena de distribución", "Sensor de cigüeñal", "Sensor de levas"], false));
  map.set("P0020", makeDef("P0020", "Circuito del actuador de posición del árbol de levas (Banco 2)", "Warning",
    ["Verificar cableado del actuador VVT", "Comprobar resistencia del solenoide VVT en banco 2"],
    ["Solenoide VVT", "Arnés de cableado motor"], false));
  map.set("P0030", makeDef("P0030", "Circuito de control del calentador del sensor de O2 (Banco 1, Sensor 1)", "Warning",
    ["Verificar resistencia del calentador del sensor", "Comprobar fusible de la bomba de combustible", "Revisar cableado del sensor lambda"],
    ["Sensor de oxígeno (lambda)", "Fusible bomba de combustible", "Relé de calentador"], false));
  map.set("P0031", makeDef("P0031", "Circuito de control del calentador del sensor de O2 — Bajo (Banco 1, Sensor 1)", "Warning",
    ["Verificar cortocircuito a masa", "Comprobar resistencia del calentador", "Reemplazar sensor lambda si está en corto"],
    ["Sensor de oxígeno (lambda)", "Arnes de sensor"], false));
  map.set("P0032", makeDef("P0032", "Circuito de control del calentador del sensor de O2 — Alto (Banco 1, Sensor 1)", "Warning",
    ["Verificar cortocircuito a positivo", "Comprobar señal del calentador", "Revisar módulo de control del motor (ECU)"],
    ["Sensor de oxígeno (lambda)", "Módulo ECU"], false));
  map.set("P0033", makeDef("P0033", "Circuito de control de la válvula de descarga del turbo", "Warning",
    ["Verificar cableado de la válvula wastegate", "Comprobar resistencia de la válvula", "Revisar funcionamiento de la válvula"],
    ["Válvula wastegate", "Arnes de turbo"], false));
  map.set("P0034", makeDef("P0034", "Circuito de control de la válvula de descarga del turbo — Bajo", "Warning",
    ["Verificar cortocircuito del actuador wastegate", "Comprobar señal de la ECU"],
    ["Válvula wastegate", "Actuador de turbo"], false));
  map.set("P0035", makeDef("P0035", "Circuito de control de la válvula de descarga del turbo — Alto", "Warning",
    ["Verificar señal alta del actuador", "Comprobar referencia de voltaje de la ECU"],
    ["Válvula wastegate", "ECU"], false));

  // Injector circuit (P02xx)
  map.set("P0200", makeDef("P0200", "Falla en el circuito de inyectores", "Critical",
    ["Verificar resistencia de cada inyector", "Comprobar cableado del arnés de inyectores", "Revisar módulo de control del motor"],
    ["Inyectores", "Arnes de inyectores", "Módulo ECU"], false));
  map.set("P0201", makeDef("P0201", "Circuito del inyector 1 — Falla", "Warning",
    ["Verificar resistencia del inyector 1 (~12-17 ohmios)", "Comprobar pulso de la ECU al inyector", "Reemplazar inyector si está en corto/abierto"],
    ["Inyector 1", "Conector de inyector"], false));
  map.set("P0202", makeDef("P0202", "Circuito del inyector 2 — Falla", "Warning",
    ["Verificar resistencia del inyector 2", "Comprobar continuidad del cableado"],
    ["Inyector 2"], false));
  map.set("P0203", makeDef("P0203", "Circuito del inyector 3 — Falla", "Warning",
    ["Verificar resistencia del inyector 3", "Comprobar continuidad del cableado"],
    ["Inyector 3"], false));
  map.set("P0204", makeDef("P0204", "Circuito del inyector 4 — Falla", "Warning",
    ["Verificar resistencia del inyector 4", "Comprobar continuidad del cableado"],
    ["Inyector 4"], false));

  // Ignition System (P03xx)
  map.set("P0300", makeDef("P0300", "Fallo de encendido aleatorio/múltiple cilindros", "Critical",
    ["Verificar bujías (estado, gap, tipo correcto)", "Comprobar bobinas de encendido", "Revisar presión de compresión del motor", "Verificar inyectores y presión de combustible", "Comprobar vacío de admisión (fugas)"],
    ["Bujías", "Bobinas de encendido", "Cables de bujía", "Inyectores"], false));
  map.set("P0301", makeDef("P0301", "Fallo de encendido en cilindro 1", "Warning",
    ["Intercambiar bujía/bobina del cilindro 1 con otro y verificar si el fallo se desplaza", "Verificar compresión del cilindro 1", "Comprobar inyector del cilindro 1"],
    ["Bujía cilindro 1", "Bobina cilindro 1", "Inyector cilindro 1"], false));
  map.set("P0302", makeDef("P0302", "Fallo de encendido en cilindro 2", "Warning",
    ["Realizar diagnóstico de bujía/bobina en cilindro 2", "Verificar inyector"],
    ["Bujía cilindro 2", "Bobina cilindro 2"], false));
  map.set("P0303", makeDef("P0303", "Fallo de encendido en cilindro 3", "Warning",
    ["Realizar diagnóstico de bujía/bobina en cilindro 3", "Verificar inyector"],
    ["Bujía cilindro 3", "Bobina cilindro 3"], false));
  map.set("P0304", makeDef("P0304", "Fallo de encendido en cilindro 4", "Warning",
    ["Realizar diagnóstico de bujía/bobina en cilindro 4", "Verificar inyector"],
    ["Bujía cilindro 4", "Bobina cilindro 4"], false));
  map.set("P0305", makeDef("P0305", "Fallo de encendido en cilindro 5", "Warning", [], []));
  map.set("P0306", makeDef("P0306", "Fallo de encendido en cilindro 6", "Warning", [], []));
  map.set("P0316", makeDef("P0316", "Fallo de encendido al arrancar (primeros 1000 revoluciones)", "Critical",
    ["Verificar presión de combustible en arranque", "Comprobar señal del sensor de posición del cigüeñal"],
    ["Sensor de cigüeñal", "Bomba de combustible"], false));

  // Catalyst (P04xx)
  map.set("P0420", makeDef("P0420", "Eficiencia del catalizador por debajo del umbral (Banco 1)", "Warning",
    ["Verificar funcionamiento de sensores de O2", "Comprobar si el catalizador está tapado o dañado", "Revisar fugas de escape antes del catalizador", "Medir temperatura de entrada/salida del catalizador"],
    ["Catalizador", "Sensor de O2 aguas abajo"], false));
  map.set("P0430", makeDef("P0430", "Eficiencia del catalizador por debajo del umbral (Banco 2)", "Warning",
    ["Verificar funcionamiento de sensores de O2 banco 2", "Comprobar catalizador banco 2"],
    ["Catalizador", "Sensor de O2"], false));

  // EVAP (P04xx)
  map.set("P0440", makeDef("P0440", "Falla en el sistema de control de emisiones evaporativas", "Warning",
    ["Verificar tapa de combustible correctamente cerrada", "Realizar prueba de humo en el sistema EVAP", "Comprobar válvula de purga del canister EVAP"],
    ["Tapa de combustible", "Válvula de purga EVAP", "Canister"], false));
  map.set("P0442", makeDef("P0442", "Fuga pequeña detectada en el sistema EVAP", "Warning",
    ["Realizar prueba de humo del sistema EVAP", "Verificar tapa de combustible", "Comprobar mangueras de admisión"],
    ["Tapa de combustible", "Mangueras EVAP"], false));
  map.set("P0445", makeDef("P0445", "Circuito de purga del sistema EVAP — Cortocircuito", "Warning",
    ["Verificar cableado de la válvula de purga", "Reemplazar válvula de purga si está en corto"],
    ["Válvula de purga EVAP"], false));
  map.set("P0455", makeDef("P0455", "Fuga grande detectada en el sistema EVAP", "Warning",
    ["Verificar tapa de combustible firmemente ajustada", "Realizar prueba de humo", "Comprobar mangueras del sistema EVAP rotas o desconectadas"],
    ["Tapa de combustible", "Mangueras de admisión"], false));
  map.set("P0456", makeDef("P0456", "Fuga muy pequeña detectada en el sistema EVAP", "Info",
    ["Realizar prueba de humo del sistema EVAP", "Verificar tapa de combustible"],
    ["Tapa de combustible"], false));

  // Vehicle Speed / IAC (P05xx)
  map.set("P0500", makeDef("P0500", "Falla en el sensor de velocidad del vehículo (VSS)", "Warning",
    ["Verificar sensor de velocidad en transmisión/diferencial", "Comprobar cableado del sensor VSS", "Revisar instrumentos del tablero"],
    ["Sensor VSS", "Cableado de sensor"], false));
  map.set("P0501", makeDef("P0501", "Rango del sensor de velocidad del vehículo fuera de especificación", "Warning", [], []));
  map.set("P0505", makeDef("P0505", "Falla en el sistema de control de ralentí (IAC)", "Warning",
    ["Limpiar cuerpo de aceleración y válvula IAC", "Verificar funcionamiento del motor paso a paso IAC", "Revisar fugas de vacío en admisión"],
    ["Válvula IAC", "Cuerpo de aceleración"], false));
  map.set("P0507", makeDef("P0507", "Ralentí más alto de lo esperado", "Warning",
    ["Verificar fugas de vacío en mangueras de admisión", "Limpiar cuerpo de aceleración", "Revisar válvula IAC atascada abierta"],
    ["Válvula IAC", "Mangueras de admisión"], false));
  map.set("P0510", makeDef("P0510", "Falla en el interruptor de posición de mariposa cerrada", "Warning", [], []));
  map.set("P0520", makeDef("P0520", "Falla en el circuito del sensor de presión de aceite", "Warning",
    ["Verificar nivel de aceite del motor", "Comprobar sensor de presión de aceite", "Verificar cableado del sensor"],
    ["Sensor de presión de aceite"], false));
  map.set("P0521", makeDef("P0521", "Rango del sensor de presión de aceite fuera de especificación", "Warning", [], []));
  map.set("P0530", makeDef("P0530", "Falla en el circuito del sensor de presión del refrigerante del A/C", "Info", [], []));
  map.set("P0540", makeDef("P0540", "Falla en el circuito del calentador de admisión (Banco 1)", "Info", [], []));
  map.set("P0560", makeDef("P0560", "Falla en el voltaje del sistema de alimentación", "Warning",
    ["Verificar voltaje de la batería con el motor apagado", "Comprobar alternador y regulador de voltaje", "Revisar bornes y masas de la batería"],
    ["Alternador", "Batería", "Regulador de voltaje"], false));
  map.set("P0562", makeDef("P0562", "Voltaje del sistema bajo", "Warning",
    ["Verificar batería descargada o en mal estado", "Comprobar alternador", "Revisar correa del alternador"],
    ["Batería", "Alternador", "Correa de alternador"], false));
  map.set("P0563", makeDef("P0563", "Voltaje del sistema alto", "Warning",
    ["Verificar regulador de voltaje del alternador", "Comprobar si hay sobrecarga en el sistema eléctrico"],
    ["Alternador", "Regulador de voltaje"], false));
  map.set("P0571", makeDef("P0571", "Falla en el circuito del interruptor de freno (A)", "Warning",
    ["Verificar interruptor de luz de freno", "Comprobar ajuste del pedal de freno"],
    ["Interruptor de freno"], false));
  map.set("P0572", makeDef("P0572", "Señal baja del interruptor de freno", "Info",
    ["Verificar interruptor de freno atascado", "Comprobar ajuste del pedal de freno"],
    ["Interruptor de freno"], false));

  // Internal Control Module (P06xx)
  map.set("P0600", makeDef("P0600", "Falla de comunicación con el módulo de control (ECM/PCM)", "Critical",
    ["Verificar alimentación y masa de la ECU", "Comprobar comunicación CAN del vehículo", "Revisar posibles daños por agua en la ECU"],
    ["Módulo ECU", "Arnes principal", "Fusibles ECU"], false));
  map.set("P0601", makeDef("P0601", "Falla de checksum de memoria interna de la ECU", "Critical",
    ["Reintentar borrar código y verificar si regresa", "Actualizar software de la ECU si está disponible", "Reemplazar ECU si el código persiste"],
    ["Módulo ECU"], false));
  map.set("P0602", makeDef("P0602", "Error de programación de la ECU", "Critical",
    ["Reprogramar la ECU con software correcto", "Verificar que la ECU sea compatible con el vehículo"],
    ["Módulo ECU (reprogramación)"], false));
  map.set("P0603", makeDef("P0603", "Falla de memoria interna de la ECU (KAM)", "Warning",
    ["Verificar alimentación constante de la ECU (batería)", "Comprobar fusible de memoria de la ECU"],
    ["ECU", "Fusible ECU"], false));
  map.set("P0604", makeDef("P0604", "Falla de RAM interna de la ECU", "Critical",
    ["Reemplazar la ECU — falla de hardware interno"],
    ["Módulo ECU"], false));
  map.set("P0605", makeDef("P0605", "Falla de ROM interna de la ECU", "Critical",
    ["Reemplazar la ECU — falla de hardware interno"],
    ["Módulo ECU"], false));
  map.set("P0606", makeDef("P0606", "Falla interna del procesador de la ECU", "Critical",
    ["Reemplazar la ECU — falla interna del procesador", "Verificar que no haya entrado agua a la ECU"],
    ["Módulo ECU"], false));
  map.set("P0607", makeDef("P0607", "Rendimiento fuera de rango del módulo de control", "Warning",
    ["Verificar temperatura ambiente de la ECU", "Comprobar que no haya interferencias eléctricas"],
    ["Módulo ECU"], false));
  map.set("P0610", makeDef("P0610", "Error de opciones de configuración del módulo de control", "Warning",
    ["Verificar programación correcta de la ECU para el vehículo"],
    ["Módulo ECU (reprogramación)"], false));
  map.set("P0620", makeDef("P0620", "Falla en el circuito de control del alternador", "Warning",
    ["Verificar cableado del alternador al módulo de control", "Comprobar funcionamiento del alternador"],
    ["Alternador", "Regulador de voltaje"], false));
  map.set("P0622", makeDef("P0622", "Falla en el circuito de control del campo del alternador", "Warning",
    ["Verificar cableado de excitación del alternador", "Comprobar módulo de control del motor"],
    ["Alternador", "ECU"], false));
  map.set("P0630", makeDef("P0630", "VIN no programado en la ECU", "Warning",
    ["Programar el VIN correcto en la ECU con escáner profesional"],
    [""], false));
  map.set("P0640", makeDef("P0640", "Falla en el circuito de control del calentador de admisión", "Info", [], []));
  map.set("P0645", makeDef("P0645", "Falla en el circuito del relé del embrague del compresor A/C", "Info",
    ["Verificar relé del compresor de A/C", "Comprobar cableado del embrague del compresor"],
    ["Relé de A/C", "Compresor de A/C"], false));
  map.set("P0650", makeDef("P0650", "Falla en el circuito de la luz indicadora de mal funcionamiento (MIL)", "Info",
    ["Verificar lámpara/testigo MIL en tablero", "Comprobar cableado de la luz testigo"],
    ["Lámpara MIL", "Tablero de instrumentos"], false));
  map.set("P0685", makeDef("P0685", "Falla en el circuito de control del relé principal de la ECU", "Critical",
    ["Verificar relé principal de la ECU", "Comprobar alimentación y masa de la ECU"],
    ["Relé principal", "Fusible ECU"], false));
  map.set("P0686", makeDef("P0686", "Señal baja en el circuito de control del relé principal de la ECU", "Warning",
    ["Verificar circuito de control del relé de la ECU"],
    ["Relé principal"], false));
  map.set("P0687", makeDef("P0687", "Señal alta en el circuito de control del relé principal de la ECU", "Warning",
    ["Verificar cortocircuito en el circuito de control del relé"],
    ["Relé principal", "Cableado"], false));

  // Transmission (P07xx, P08xx)
  map.set("P0700", makeDef("P0700", "Falla general del sistema de control de la transmisión (TCM)", "Critical",
    ["Escaneo completo de la transmisión para códigos específicos", "Verificar nivel y estado del fluido de transmisión", "Comprobar comunicación CAN con TCM"],
    ["Fluido de transmisión", "TCM (módulo de control de transmisión)"], false));
  map.set("P0710", makeDef("P0710", "Falla en el circuito del sensor de temperatura del fluido de transmisión", "Warning",
    ["Verificar conector del sensor", "Comprobar resistencia del sensor de temperatura"],
    ["Sensor de temperatura de transmisión"], false));
  map.set("P0711", makeDef("P0711", "Rango del sensor de temperatura del fluido de transmisión fuera de especificación", "Warning",
    ["Verificar sensor de temperatura", "Comprobar nivel de fluido de transmisión"],
    ["Sensor de temperatura de transmisión", "Fluido de transmisión"], false));
  map.set("P0712", makeDef("P0712", "Señal baja del sensor de temperatura del fluido de transmisión", "Warning", [], []));
  map.set("P0713", makeDef("P0713", "Señal alta del sensor de temperatura del fluido de transmisión", "Warning", [], []));
  map.set("P0715", makeDef("P0715", "Falla en el circuito del sensor de velocidad de turbina (entrada)", "Warning",
    ["Verificar sensor de velocidad de entrada de la transmisión", "Comprobar nivel de fluido de transmisión"],
    ["Sensor de velocidad de entrada", "Fluido de transmisión"], false));
  map.set("P0720", makeDef("P0720", "Falla en el circuito del sensor de velocidad de salida", "Warning",
    ["Verificar sensor de velocidad de salida de la transmisión", "Comprobar cableado del sensor"],
    ["Sensor de velocidad de salida"], false));
  map.set("P0730", makeDef("P0730", "Relación de transmisión incorrecta", "Critical",
    ["Verificar nivel y estado del fluido de transmisión", "Comprobar si hay deslizamiento interno de la transmisión", "Realizar prueba de presión de la transmisión"],
    ["Fluido de transmisión", "Transmisión (reparación interna)"], false));
  map.set("P0731", makeDef("P0731", "Relación incorrecta en 1ra marcha", "Critical",
    ["Verificar nivel de fluido ATF", "Comprobar solenoides de cambio de marcha", "Revisar paquete de embragues de 1ra"],
    ["Solenoides de transmisión", "Paquete de embragues"], false));
  map.set("P0732", makeDef("P0732", "Relación incorrecta en 2da marcha", "Critical", [], []));
  map.set("P0733", makeDef("P0733", "Relación incorrecta en 3ra marcha", "Critical", [], []));
  map.set("P0734", makeDef("P0734", "Relación incorrecta en 4ta marcha", "Critical", [], []));
  map.set("P0740", makeDef("P0740", "Falla en el circuito del embrague del convertidor de par (TCC)", "Warning",
    ["Verificar solenoide TCC del convertidor", "Comprobar nivel de fluido de transmisión"],
    ["Solenoide TCC", "Convertidor de par"], false));
  map.set("P0741", makeDef("P0741", "Embrague del convertidor de par (TCC) no acopla", "Warning",
    ["Verificar funcionamiento del solenoide TCC", "Comprobar presión del convertidor", "Revisar estado del convertidor de par"],
    ["Solenoide TCC", "Convertidor de par"], false));
  map.set("P0742", makeDef("P0742", "Embrague del convertidor de par (TCC) atascado en acople", "Warning", [], []));
  map.set("P0750", makeDef("P0750", "Falla en el solenoide de cambio A", "Warning",
    ["Verificar resistencia del solenoide", "Comprobar cableado del solenoide", "Revisar cuerpo de válvulas"],
    ["Solenoide A", "Cuerpo de válvulas"], false));
  map.set("P0751", makeDef("P0751", "Rendimiento del solenoide de cambio A fuera de rango", "Warning", [], []));
  map.set("P0755", makeDef("P0755", "Falla en el solenoide de cambio B", "Warning", [], []));
  map.set("P0760", makeDef("P0760", "Falla en el solenoide de cambio C", "Warning", [], []));
  map.set("P0765", makeDef("P0765", "Falla en el solenoide de cambio D", "Warning", [], []));
  map.set("P0770", makeDef("P0770", "Falla en el solenoide de cambio E", "Warning", [], []));
  map.set("P0780", makeDef("P0780", "Falla general en el sistema de cambios", "Critical", [], []));

  // HEV/BEV specific (P0Axx–P3xxx EV range)
  map.set("P0A00", makeDef("P0A00", "Falla en el sistema de la batería de tracción HV", "Critical",
    ["Realizar protocolo de seguridad HV antes de cualquier intervención", "Verificar voltaje de la batería HV con multímetro CAT III", "Comprobar aislamiento del cableado HV"],
    [], true));
  map.set("P0A01", makeDef("P0A01", "Temperatura de la batería HV fuera de rango", "Critical",
    ["Verificar sistema de refrigeración de la batería HV", "Comprobar ventilación del pack de baterías", "Revisar sensor de temperatura del pack HV"],
    [], true));
  map.set("P0A02", makeDef("P0A02", "Voltaje de celda HV fuera de rango", "Critical",
    ["Verificar balance de celdas de la batería HV", "Comprobar BMS (sistema de gestión de batería)", "Revisar conexiones entre módulos del pack"],
    [], true));
  map.set("P0A03", makeDef("P0A03", "Falla en el contactor principal de la batería HV", "Emergency",
    ["NO intervenir sin protocolo HV", "Verificar señal de cierre del contactor", "Comprobar resistencia del circuito de precarga"],
    ["Contactor principal HV", "BMS"], true));
  map.set("P0A04", makeDef("P0A04", "Falla en el circuito de precarga de la batería HV", "Critical",
    ["Verificar resistencia de precarga", "Comprobar relé de precarga", "Medir tiempo de precarga con osciloscopio"],
    ["Resistencia de precarga", "Relé de precarga"], true));
  map.set("P0A05", makeDef("P0A05", "Falla de aislamiento en el sistema HV", "Emergency",
    ["PELIGRO: Riesgo de electrocución", "Realizar medición de aislamiento con megóhmetro", "Localizar punto de fuga a masa", "NO operar el vehículo hasta reparar"],
    ["Cableado HV", "Conectores HV", "Inversor/convertidor"], true));
  map.set("P0A06", makeDef("P0A06", "Falla en el inversor/convertidor de tracción", "Critical",
    ["Verificar refrigeración del inversor", "Comprobar voltaje DC link del inversor", "Revisar módulos IGBT del inversor"],
    ["Inversor de tracción", "Módulo IGBT"], true));
  map.set("P0A07", makeDef("P0A07", "Falla en el motor-generador (MG1)", "Critical",
    ["Verificar resistencia de bobinados del MG1", "Comprobar sensor de posición del rotor (resolver)", "Revisar refrigeración del motor eléctrico"],
    ["Motor-generador MG1", "Sensor resolver"], true));
  map.set("P0A08", makeDef("P0A08", "Falla en el motor de tracción (MG2)", "Critical",
    ["Verificar resistencia de bobinados del MG2", "Comprobar sensor de posición", "Revisar aislamiento del motor"],
    ["Motor de tracción MG2", "Sensor resolver"], true));
  map.set("P0A09", makeDef("P0A09", "Falla en el convertidor DC-DC (HV a 12V)", "Warning",
    ["Verificar voltaje de salida del convertidor DC-DC", "Comprobar refrigeración del convertidor", "Revisar fusible HV del convertidor"],
    ["Convertidor DC-DC", "Fusible HV"], true));
  map.set("P0A0A", makeDef("P0A0A", "Falla en el cargador a bordo (OBC) del vehículo eléctrico", "Warning",
    ["Verificar conexión del cargador externo", "Comprobar voltaje de entrada AC", "Revisar comunicación OBC con BMS"],
    ["Cargador a bordo (OBC)", "Cable de carga"], true));
  map.set("P0A0B", makeDef("P0A0B", "Falla en la comunicación BMS-CAN (red HV)", "Critical",
    ["Verificar bus CAN del sistema HV", "Comprobar terminación de la red CAN", "Revisar módulo BMS"],
    ["BMS", "Red CAN HV"], true));
  map.set("P1A00", makeDef("P1A00", "Falla en el sistema híbrido/eléctrico (genérica de fabricante)", "Critical",
    ["Realizar diagnóstico con escáner específico del fabricante", "Verificar códigos adicionales en módulos HV"],
    [], true));
  map.set("P1A01", makeDef("P1A01", "Falla en el embrague del generador híbrido", "Warning",
    ["Verificar actuador del embrague del generador", "Comprobar presión hidráulica del sistema híbrido"],
    ["Embrague híbrido", "Actuador hidráulico"], true));

  // Common P1xxx manufacturer codes
  map.set("P1000", makeDef("P1000", "Diagnóstico OBD no completado (ciclo de conducción requerido)", "Info",
    ["Completar ciclo de conducción OBD-II (arranque en frío, varios regímenes de motor)"], [], false));
  map.set("P1100", makeDef("P1100", "Falla en el sensor de flujo de aire (MAF) — señal intermitente", "Warning",
    ["Limpiar sensor MAF con limpiador específico", "Verificar conector del MAF", "Reemplazar sensor MAF si persiste la falla"],
    ["Sensor MAF", "Limpiador MAF"], false));
  map.set("P1101", makeDef("P1101", "Rendimiento del sensor MAF fuera de rango", "Warning",
    ["Verificar admisión de aire (filtro, ductos)", "Limpiar o reemplazar sensor MAF", "Verificar fugas de vacío posteriores al MAF"],
    ["Sensor MAF", "Filtro de aire"], false));
  map.set("P1110", makeDef("P1110", "Falla en el sensor de temperatura del aire de admisión (IAT)", "Warning", [], []));
  map.set("P1120", makeDef("P1120", "Falla en el sensor de posición del pedal del acelerador (APP)", "Warning",
    ["Verificar sensor de posición del pedal", "Comprobar cableado del pedal electrónico", "Revisar módulo ECU"],
    ["Sensor de pedal acelerador", "Arnes del pedal"], false));
  map.set("P1121", makeDef("P1121", "Señal del sensor de posición del pedal fuera de rango", "Warning", [], []));
  map.set("P1122", makeDef("P1122", "Señal baja del sensor de posición del pedal", "Warning", [], []));
  map.set("P1130", makeDef("P1130", "Falla en la realimentación de mezcla del sensor de O2 (Banco 1)", "Warning",
    ["Verificar sensor lambda", "Comprobar fugas de admisión", "Revisar inyectores"],
    ["Sensor de O2 (lambda)", "Inyectores"], false));
  map.set("P1135", makeDef("P1135", "Falla en el circuito del calentador del sensor de O2 (Banco 1, Sensor 1)", "Warning", [], []));
  map.set("P1170", makeDef("P1170", "Mezcla pobre/rica fuera de rango (Banco 1)", "Warning",
    ["Verificar presión de combustible", "Comprobar inyectores", "Revisar sensor MAF"],
    ["Bomba de combustible", "Regulador de presión", "Inyectores"], false));
  map.set("P1180", makeDef("P1180", "Falla en el sistema de combustible — presión fuera de rango", "Warning",
    ["Verificar presión de combustible con manómetro", "Comprobar bomba de combustible y regulador"],
    ["Bomba de combustible", "Regulador de presión"], false));
  map.set("P1190", makeDef("P1190", "Falla en el circuito de control de la bomba de combustible", "Critical",
    ["Verificar relé de la bomba de combustible", "Comprobar fusible de la bomba", "Revisar cableado de la bomba"],
    ["Relé de bomba", "Bomba de combustible", "Fusible"], false));
  map.set("P1191", makeDef("P1191", "Circuito de la bomba de combustible — señal baja", "Warning",
    ["Verificar resistencia de la bomba de combustible", "Comprobar conectores del arnés"],
    ["Bomba de combustible"], false));
  map.set("P1192", makeDef("P1192", "Circuito de la bomba de combustible — señal alta", "Warning", [], []));

  map.set("P1220", makeDef("P1220", "Falla en el circuito de control del acelerador electrónico (ETC)", "Critical",
    ["Verificar cuerpo de aceleración electrónico", "Comprobar cableado del actuador del acelerador", "Revisar pedal del acelerador"],
    ["Cuerpo de aceleración", "Pedal de acelerador", "Módulo ECU"], false));
  map.set("P1221", makeDef("P1221", "Rango del acelerador electrónico fuera de especificación", "Warning", [], []));
  map.set("P1225", makeDef("P1225", "Falla en el circuito del inyector adicional (arranque en frío)", "Info", [], []));
  map.set("P1230", makeDef("P1230", "Falla en el circuito de la bomba de combustible (relé)", "Warning", [], []));
  map.set("P1240", makeDef("P1240", "Falla en el circuito de control del sensor de detonación", "Warning",
    ["Verificar sensor de detonación (knock)", "Comprobar cableado del sensor"],
    ["Sensor de detonación"], false));
  map.set("P1241", makeDef("P1241", "Señal baja del sensor de detonación", "Warning", [], []));
  map.set("P1242", makeDef("P1242", "Señal alta del sensor de detonación", "Warning", [], []));
  map.set("P1245", makeDef("P1245", "Falla en el circuito del sensor de detonación 2", "Warning", [], []));
  map.set("P1250", makeDef("P1250", "Falla en el sistema de control de la presión de combustible", "Warning",
    ["Verificar regulador de presión de combustible", "Comprobar válvula de control de presión"],
    ["Regulador de presión", "Válvula de control"], false));
  map.set("P1260", makeDef("P1260", "Sistema antirrobo detectado — vehículo inhabilitado", "Warning",
    ["Verificar llave/chip del vehículo", "Reiniciar sistema antirrobo con escáner profesional", "Comprobar antena del inmovilizador"],
    ["Llave/chip", "Antena inmovilizador", "Módulo ECU"], false));
  map.set("P1280", makeDef("P1280", "Falla en el sistema de control de la presión del turbo", "Warning",
    ["Verificar actuador wastegate", "Comprobar mangueras de presión del turbo", "Revisar válvula de descarga"],
    ["Actuador wastegate", "Válvula de descarga"], false));
  map.set("P1281", makeDef("P1281", "Presión del turbo fuera de rango", "Warning",
    ["Verificar fugas en las mangueras de presión", "Comprobar funcionamiento del turbo", "Revisar sensor MAP"],
    ["Turbo", "Mangueras de presión", "Sensor MAP"], false));

  // ─── Chassis (C-codes) ──────────────────────────

  map.set("C0035", makeDef("C0035", "Falla en el sensor de velocidad de la rueda delantera izquierda", "Critical",
    ["Verificar sensor ABS delantero izquierdo", "Comprobar anillo de reluctancia / regla magnética", "Revisar cableado del sensor"],
    ["Sensor ABS delantero izquierdo", "Cableado ABS"], false));
  map.set("C0040", makeDef("C0040", "Falla en el sensor de velocidad de la rueda delantera derecha", "Critical",
    ["Verificar sensor ABS delantero derecho", "Comprobar anillo de reluctancia"],
    ["Sensor ABS delantero derecho"], false));
  map.set("C0045", makeDef("C0045", "Falla en el sensor de velocidad de la rueda trasera izquierda", "Critical",
    ["Verificar sensor ABS trasero izquierdo"],
    ["Sensor ABS trasero izquierdo"], false));
  map.set("C0050", makeDef("C0050", "Falla en el sensor de velocidad de la rueda trasera derecha", "Critical",
    ["Verificar sensor ABS trasero derecho"],
    ["Sensor ABS trasero derecho"], false));
  map.set("C0060", makeDef("C0060", "Falla en el sensor de presión de freno", "Warning",
    ["Verificar sensor de presión hidráulica del ABS", "Comprobar cableado del sensor"],
    ["Sensor de presión de freno"], false));
  map.set("C0065", makeDef("C0065", "Falla en el sensor de ángulo de dirección", "Warning",
    ["Realizar calibración del sensor de ángulo de dirección", "Verificar alineación de la dirección"],
    ["Sensor de ángulo de dirección"], false));
  map.set("C0070", makeDef("C0070", "Falla en el sensor de aceleración lateral", "Warning",
    ["Verificar sensor G (aceleración lateral)", "Comprobar montaje y posición del sensor"],
    ["Sensor de aceleración lateral"], false));
  map.set("C0075", makeDef("C0075", "Falla en el sensor de velocidad de giro (yaw)", "Warning",
    ["Verificar sensor de velocidad de giro", "Revisar conexiones del sensor"],
    ["Sensor yaw"], false));
  map.set("C0080", makeDef("C0080", "Falla en el módulo de control del ABS", "Critical",
    ["Verificar alimentación y masa del módulo ABS", "Comprobar comunicación CAN del ABS", "Reemplazar módulo ABS si falla interna"],
    ["Módulo ABS", "Fusible ABS"], false));
  map.set("C0100", makeDef("C0100", "Falla en el sistema de control de tracción (TCS)", "Warning",
    ["Verificar funcionamiento del ABS base", "Comprobar comunicación con la ECU del motor", "Revisar sensores de rueda"],
    ["Módulo TCS", "Sensores de rueda"], false));
  map.set("C0110", makeDef("C0110", "Falla en el sistema de estabilidad (ESC/ESP)", "Critical",
    ["Verificar sensores de ángulo de dirección", "Comprobar sensor de yaw y aceleración lateral", "Revisar comunicación CAN con módulo ESP"],
    ["Módulo ESP", "Sensor de ángulo de dirección"], false));
  map.set("C0120", makeDef("C0120", "Falla en la válvula solenoide del ABS", "Critical",
    ["Verificar resistencia de los solenoides del ABS", "Comprobar cableado de la unidad hidráulica", "Reemplazar unidad hidráulica ABS si es necesario"],
    ["Unidad hidráulica ABS", "Solenoides ABS"], false));
  map.set("C0121", makeDef("C0121", "Falla en la válvula solenoide del ABS — circuito abierto", "Critical", [], []));
  map.set("C0122", makeDef("C0122", "Falla en la válvula solenoide del ABS — cortocircuito", "Critical", [], []));
  map.set("C0130", makeDef("C0130", "Falla en la bomba del sistema ABS", "Critical",
    ["Verificar relé de la bomba ABS", "Comprobar motor de la bomba ABS", "Revisar fusible de la bomba"],
    ["Bomba ABS", "Relé de bomba ABS"], false));
  map.set("C0140", makeDef("C0140", "Falla en el sistema de control de descenso (HDC)", "Warning", [], []));
  map.set("C0200", makeDef("C0200", "Falla en el sistema de control de suspensión activa", "Warning",
    ["Verificar sensores de altura de suspensión", "Comprobar compresor de suspensión neumática"],
    ["Compresor de suspensión", "Sensor de altura"], false));
  map.set("C0240", makeDef("C0240", "Falla en el sistema de dirección asistida eléctrica (EPS)", "Critical",
    ["Verificar motor de dirección asistida", "Comprobar sensor de par de dirección", "Revisar refrigeración del motor EPS"],
    ["Motor EPS", "Sensor de par de dirección"], false));
  map.set("C0245", makeDef("C0245", "Falla en el sensor de par de la dirección", "Warning",
    ["Verificar sensor de par en la columna de dirección", "Calibrar sensor de par de dirección"],
    ["Sensor de par de dirección"], false));
  map.set("C0250", makeDef("C0250", "Falla en el sensor de posición del volante", "Warning",
    ["Verificar sensor de posición del volante", "Realizar calibración de volante con escáner"],
    ["Sensor de posición del volante"], false));
  map.set("C0300", makeDef("C0300", "Falla en el sistema de control de la carrocería (BCM)", "Warning",
    ["Verificar alimentación del módulo de carrocería", "Comprobar comunicación CAN del BCM", "Revisar daños por agua en el BCM"],
    ["Módulo BCM"], false));
  map.set("C0310", makeDef("C0310", "Falla en el sistema de iluminación adaptativa (AFS)", "Info",
    ["Verificar motor de nivelación de faros", "Comprobar sensores de altura traseros"],
    ["Motor de nivelación de faros", "Sensor de altura"], false));

  // ─── Body (B-codes) ─────────────────────────────

  map.set("B1000", makeDef("B1000", "Falla interna del módulo de control de carrocería", "Warning",
    ["Verificar alimentación y masa del BCM", "Reemplazar BCM si la falla persiste"],
    ["Módulo BCM"], false));
  map.set("B1005", makeDef("B1005", "Falla en la configuración del BCM", "Warning",
    ["Reprogramar BCM con configuraciones correctas del vehículo"],
    [], false));
  map.set("B1010", makeDef("B1010", "Falla en el módulo de control de la climatización (HVAC)", "Info",
    ["Verificar actuadores de compuertas HVAC", "Comprobar sensores de temperatura interior"],
    ["Actuador HVAC", "Sensor de temperatura"], false));
  map.set("B1015", makeDef("B1015", "Falla en el módulo de control de asientos", "Info", [], []));
  map.set("B1020", makeDef("B1020", "Falla en el módulo de control de ventanas", "Info",
    ["Verificar motor de levantavidrios", "Comprobar interruptor de ventana"],
    ["Motor de levantavidrio", "Interruptor de ventana"], false));
  map.set("B1025", makeDef("B1025", "Falla en el módulo de control de cierre centralizado", "Info",
    ["Verificar actuador de cierre de puerta", "Comprobar interruptor de cierre"],
    ["Actuador de cierre", "Interruptor de cierre"], false));
  map.set("B1030", makeDef("B1030", "Falla en el sistema de airbag / SRS", "Critical",
    ["NO reparar sin formación en sistemas SRS", "Verificar módulo de airbag", "Comprobar pretensores de cinturones"],
    ["Módulo SRS", "Pretensor de cinturón"], false));
  map.set("B1035", makeDef("B1035", "Falla en el sensor de impacto delantero", "Critical",
    ["Verificar sensor de impacto frontal", "Comprobar cableado del sensor SRS"],
    ["Sensor de impacto", "Cableado SRS"], false));
  map.set("B1040", makeDef("B1040", "Falla en el sensor de impacto lateral", "Critical",
    ["Verificar sensor de impacto lateral", "Comprobar cableado"],
    ["Sensor de impacto lateral"], false));
  map.set("B1045", makeDef("B1045", "Falla en el sensor de impacto trasero", "Critical", [], []));
  map.set("B1050", makeDef("B1050", "Falla en el sensor de posición del asiento (airbag)", "Critical",
    ["Verificar sensor de ocupación del asiento", "Comprobar cableado bajo el asiento"],
    ["Sensor de ocupación asiento"], false));
  map.set("B1055", makeDef("B1055", "Falla en el testigo de airbag (SRS MIL)", "Warning",
    ["Verificar comunicación entre el módulo SRS y el tablero", "Escanear módulo SRS para códigos específicos"],
    ["Módulo SRS"], false));
  map.set("B1060", makeDef("B1060", "Falla en el sistema de control de presión de neumáticos (TPMS)", "Warning",
    ["Verificar presión de cada neumático", "Comprobar sensores TPMS por batería baja", "Reiniciar sistema TPMS"],
    ["Sensor TPMS", "Válvula TPMS"], false));
  map.set("B1070", makeDef("B1070", "Falla en el módulo de control de techo solar", "Info", [], []));
  map.set("B1080", makeDef("B1080", "Falla en el sistema de alarma perimétrica", "Info", [], []));

  // ─── Network (U-codes) ──────────────────────────

  map.set("U0001", makeDef("U0001", "Bus CAN de alta velocidad — falla general", "Emergency",
    ["Verificar resistencia de terminación CAN (60 ohmios entre CAN-H y CAN-L)", "Comprobar cortocircuitos en el bus CAN", "Desconectar módulos uno a uno para aislar la falla"],
    ["Cableado CAN", "Resistencia de terminación", "Módulo defectuoso"], false));
  map.set("U0002", makeDef("U0002", "Bus CAN de baja velocidad — falla general", "Emergency",
    ["Verificar bus CAN de baja velocidad", "Comprobar módulos en la red de baja velocidad"],
    ["Cableado CAN"], false));
  map.set("U0003", makeDef("U0003", "Bus CAN de alta velocidad — voltaje fuera de rango", "Emergency",
    ["Medir voltaje CAN-H (2.5-3.5V) y CAN-L (1.5-2.5V) con el bus activo", "Verificar cortocircuito a positivo/masa"],
    ["Cableado CAN", "Módulo con falla interna"], false));
  map.set("U0004", makeDef("U0004", "Bus CAN de baja velocidad — voltaje fuera de rango", "Emergency", [], []));
  map.set("U0005", makeDef("U0005", "Bus CAN de alta velocidad — señal baja", "Emergency", [], []));
  map.set("U0006", makeDef("U0006", "Bus CAN de baja velocidad — señal baja", "Emergency", [], []));
  map.set("U0010", makeDef("U0010", "Bus CAN interno — falla de comunicación del bus de medios", "Warning", [], []));
  map.set("U0020", makeDef("U0020", "Bus LIN — falla de comunicación", "Warning",
    ["Verificar bus LIN (Local Interconnect Network)", "Comprobar módulos esclavos LIN"],
    ["Cableado LIN"], false));
  map.set("U0073", makeDef("U0073", "Bus CAN apagado — falla de comunicación", "Emergency",
    ["Verificar alimentación de los módulos CAN", "Comprobar resistencia de terminación CAN", "Revisar módulo de puerta de enlace (gateway)"],
    ["Módulo gateway", "Resistencia CAN"], false));
  map.set("U0100", makeDef("U0100", "Comunicación perdida con ECM/PCM (módulo de control del motor)", "Emergency",
    ["Verificar alimentación y masa de la ECU", "Comprobar red CAN entre módulos", "Revisar fusibles principales de la ECU"],
    ["Módulo ECU", "Fusibles ECU", "Cableado CAN"], false));
  map.set("U0101", makeDef("U0101", "Comunicación perdida con TCM (módulo de control de transmisión)", "Critical",
    ["Verificar alimentación del TCM", "Comprobar red CAN del TCM", "Revisar fusibles del TCM"],
    ["Módulo TCM", "Cableado CAN", "Fusible TCM"], false));
  map.set("U0102", makeDef("U0102", "Comunicación perdida con el módulo de control de tracción (TCS)", "Warning", [], []));
  map.set("U0103", makeDef("U0103", "Comunicación perdida con el módulo de control de cambios (GCM)", "Warning", [], []));
  map.set("U0104", makeDef("U0104", "Comunicación perdida con el módulo de control de velocidad crucero (CCM)", "Info", [], []));
  map.set("U0105", makeDef("U0105", "Comunicación perdida con el módulo de combustible (FCM)", "Info", [], []));
  map.set("U0106", makeDef("U0106", "Comunicación perdida con el módulo de control de puertas (DCM)", "Info", [], []));
  map.set("U0107", makeDef("U0107", "Comunicación perdida con el módulo de control de accesorios (ACM)", "Info", [], []));
  map.set("U0108", makeDef("U0108", "Comunicación perdida con el módulo de control de combustible alternativo (AFCM)", "Info", [], []));
  map.set("U0109", makeDef("U0109", "Comunicación perdida con el módulo de control de combustible (FCM)", "Info", [], []));
  map.set("U0120", makeDef("U0120", "Comunicación perdida con el módulo de arranque (SCM)", "Critical",
    ["Verificar alimentación del módulo de arranque", "Comprobar comunicación CAN con el módulo de arranque"],
    ["Módulo SCM"], false));
  map.set("U0121", makeDef("U0121", "Comunicación perdida con el módulo de control del ABS", "Critical",
    ["Verificar alimentación del módulo ABS", "Comprobar red CAN del ABS"],
    ["Módulo ABS", "Cableado CAN"], false));
  map.set("U0122", makeDef("U0122", "Comunicación perdida con el módulo de control de chasis (CCM)", "Critical",
    ["Verificar alimentación del CCM", "Comprobar red CAN del chasis"],
    ["Módulo CCM"], false));
  map.set("U0123", makeDef("U0123", "Comunicación perdida con el sensor de velocidad de giro (yaw)", "Warning", [], []));
  map.set("U0124", makeDef("U0124", "Comunicación perdida con el módulo de control lateral (LCM)", "Warning", [], []));
  map.set("U0125", makeDef("U0125", "Comunicación perdida con el sensor de aceleración múltiple (MAM)", "Warning", [], []));
  map.set("U0126", makeDef("U0126", "Comunicación perdida con el módulo de control de dirección (SAS)", "Critical",
    ["Verificar módulo de control de dirección", "Comprobar alimentación del SAS"],
    ["Módulo SAS"], false));
  map.set("U0127", makeDef("U0127", "Comunicación perdida con el sensor de presión de neumáticos (TPMS)", "Info", [], []));
  map.set("U0128", makeDef("U0128", "Comunicación perdida con el módulo de control de estacionamiento (PCM)", "Info", [], []));
  map.set("U0130", makeDef("U0130", "Comunicación perdida con el módulo de control de la dirección (EPS)", "Critical",
    ["Verificar módulo EPS", "Comprobar red CAN del EPS"],
    ["Módulo EPS"], false));
  map.set("U0131", makeDef("U0131", "Comunicación perdida con el módulo de control de freno eléctrico (EBCM)", "Critical",
    ["Verificar módulo EBCM", "Comprobar alimentación del módulo de freno"],
    ["Módulo EBCM"], false));
  map.set("U0140", makeDef("U0140", "Comunicación perdida con el módulo de control de carrocería (BCM)", "Warning",
    ["Verificar alimentación del BCM", "Comprobar red CAN del BCM"],
    ["Módulo BCM"], false));
  map.set("U0141", makeDef("U0141", "Comunicación perdida con el módulo de control de carrocería 2 (BCM2)", "Warning", [], []));
  map.set("U0151", makeDef("U0151", "Comunicación perdida con el módulo de control de airbag (SRS)", "Critical",
    ["Verificar módulo SRS/airbag", "NO intercambiar módulos SRS de otros vehículos"],
    ["Módulo SRS"], false));
  map.set("U0155", makeDef("U0155", "Comunicación perdida con el módulo de control de tablero (IPC)", "Warning",
    ["Verificar alimentación del tablero de instrumentos", "Comprobar red CAN del IPC"],
    ["Tablero de instrumentos (IPC)"], false));
  map.set("U0160", makeDef("U0160", "Comunicación perdida con el módulo de control de climatización (HVAC)", "Info",
    ["Verificar módulo HVAC", "Comprobar red LIN del HVAC"],
    ["Módulo HVAC"], false));
  map.set("U0161", makeDef("U0161", "Comunicación perdida con el módulo de control de asientos", "Info", [], []));
  map.set("U0162", makeDef("U0162", "Comunicación perdida con el módulo de control de techo solar", "Info", [], []));
  map.set("U0163", makeDef("U0163", "Comunicación perdida con el módulo de control de alarma", "Info", [], []));
  map.set("U0164", makeDef("U0164", "Comunicación perdida con el módulo de control HVAC 2", "Info", [], []));
  map.set("U0165", makeDef("U0165", "Comunicación perdida con el módulo de control de espejos", "Info", [], []));
  map.set("U0166", makeDef("U0166", "Comunicación perdida con el módulo de control de puerta de enlace (GWM)", "Warning",
    ["Verificar módulo gateway", "Comprobar red CAN principal y secundaria"],
    ["Módulo gateway"], false));
  map.set("U0167", makeDef("U0167", "Comunicación perdida con el módulo de acceso pasivo (PEPS)", "Warning",
    ["Verificar módulo PEPS (acceso sin llave)", "Comprobar antenas del sistema de entrada pasiva"],
    ["Módulo PEPS"], false));

  // EV/HEV specific U-codes
  map.set("U0168", makeDef("U0168", "Comunicación perdida con el sistema de gestión de batería (BMS) — HV", "Emergency",
    ["Verificar alimentación del BMS", "Comprobar red CAN aislada del sistema HV", "Realizar protocolo HV antes de intervenir"],
    ["Módulo BMS", "Cableado CAN HV"], true));
  map.set("U0169", makeDef("U0169", "Comunicación perdida con el cargador a bordo (OBC)", "Warning",
    ["Verificar comunicación entre OBC y BMS", "Comprobar red CAN del cargador"],
    ["Cargador OBC"], true));
  map.set("U0170", makeDef("U0170", "Comunicación perdida con el inversor de tracción", "Emergency",
    ["Verificar comunicación CAN con inversor", "Comprobar alimentación HV del inversor", "NO intervenir sin protocolo HV"],
    ["Inversor de tracción", "Cableado CAN HV"], true));
  map.set("U0171", makeDef("U0171", "Comunicación perdida con el convertidor DC-DC", "Critical",
    ["Verificar comunicación con convertidor DC-DC", "Comprobar alimentación HV del convertidor"],
    ["Convertidor DC-DC"], true));
  map.set("U0172", makeDef("U0172", "Comunicación perdida con el compresor HV de A/C", "Warning",
    ["Verificar comunicación con compresor HV", "Comprobar alimentación HV del compresor de A/C"],
    ["Compresor HV de A/C"], true));
  map.set("U0300", makeDef("U0300", "Configuración de software incompatible entre módulos", "Warning",
    ["Verificar compatibilidad de software entre todos los módulos", "Reprogramar módulos con la misma versión de software"],
    [], false));
  map.set("U0301", makeDef("U0301", "Incompatibilidad de software con ECM/PCM", "Warning", [], []));
  map.set("U0302", makeDef("U0302", "Incompatibilidad de software con TCM", "Warning", [], []));
  map.set("U0303", makeDef("U0303", "Incompatibilidad de software con módulo de tracción", "Warning", [], []));
  map.set("U0315", makeDef("U0315", "Incompatibilidad de software con el módulo ABS", "Warning", [], []));
  map.set("U0320", makeDef("U0320", "Incompatibilidad de software con el módulo de climatización", "Warning", [], []));
  map.set("U0327", makeDef("U0327", "Incompatibilidad de software con el sensor de presión de neumáticos", "Warning", [], []));
  map.set("U0400", makeDef("U0400", "Datos inválidos recibidos del ECM/PCM", "Warning",
    ["Verificar integridad de los datos en la red CAN", "Comprobar versión de software del ECM"],
    [], false));
  map.set("U0401", makeDef("U0401", "Datos inválidos recibidos del ECM/PCM", "Warning", [], []));
  map.set("U0402", makeDef("U0402", "Datos inválidos recibidos del TCM", "Warning", [], []));
  map.set("U0403", makeDef("U0403", "Datos inválidos recibidos del módulo de tracción", "Warning", [], []));
  map.set("U0420", makeDef("U0420", "Datos inválidos recibidos del módulo de control de carrocería", "Warning", [], []));
  map.set("U0421", makeDef("U0421", "Datos inválidos recibidos del módulo ABS", "Warning", [], []));
  map.set("U0422", makeDef("U0422", "Datos inválidos recibidos del módulo de control de chasis", "Warning", [], []));
  map.set("U0423", makeDef("U0423", "Datos inválidos recibidos del módulo de tablero", "Warning", [], []));
  map.set("U0424", makeDef("U0424", "Datos inválidos recibidos del módulo de climatización", "Warning", [], []));
  map.set("U1000", makeDef("U1000", "Falla de comunicación en red (genérica del fabricante)", "Warning",
    ["Verificar bus CAN del vehículo", "Comprobar cada módulo del sistema"],
    [], false));
  map.set("U2000", makeDef("U2000", "Comando de control remoto — falla de recepción", "Info", [], []));
  map.set("U2010", makeDef("U2010", "Falla en la recepción de señal de radiofrecuencia", "Info", [], []));
  map.set("U2020", makeDef("U2020", "Falla en el sistema de navegación GPS", "Info", [], []));
  map.set("U2100", makeDef("U2100", "Configuración CAN no programada", "Warning",
    ["Programar la configuración CAN del vehículo con escáner profesional"],
    [], false));

  _definitions = map;
  return map;
}

/**
 * Builds a DtcDefinition with the given parameters.
 */
function makeDef(
  code: string,
  description: string,
  severity: DtcDefinition["severity"],
  suggestions: string[],
  suggestedParts: string[],
  isEvRelated = false,
): DtcDefinition {
  return { code, description, severity, suggestions, suggestedParts, isEvRelated };
}

// ─── Public API ──────────────────────────────────

/**
 * Retrieves the definition for a given DTC code.
 *
 * @param code - OBD-II code (e.g. "P0171", "U0100")
 * @returns The DTC definition or undefined if not found
 */
export function getDtcDefinition(code: string): DtcDefinition | undefined {
  const db = loadDefinitions();
  return db.get(code.toUpperCase());
}

/**
 * Returns the total number of DTC definitions in the database.
 */
export function getDtcDefinitionCount(): number {
  const db = loadDefinitions();
  return db.size;
}

/**
 * Searches DTC definitions by keyword in description, code, or suggestions.
 *
 * @param query - Search text (case-insensitive)
 * @returns Matching DTC definitions
 */
export function searchDtcDefinitions(query: string): DtcDefinition[] {
  const db = loadDefinitions();
  const q = query.toLowerCase();
  const results: DtcDefinition[] = [];

  for (const def of db.values()) {
    if (
      def.code.toLowerCase().includes(q) ||
      def.description.toLowerCase().includes(q) ||
      def.suggestions.some((s) => s.toLowerCase().includes(q)) ||
      def.suggestedParts.some((p) => p.toLowerCase().includes(q))
    ) {
      results.push(def);
    }
  }

  return results;
}

/**
 * Returns all EV/HEV related DTC definitions.
 */
export function getEvRelatedDefinitions(): DtcDefinition[] {
  const db = loadDefinitions();
  const results: DtcDefinition[] = [];
  for (const def of db.values()) {
    if (def.isEvRelated) results.push(def);
  }
  return results;
}
