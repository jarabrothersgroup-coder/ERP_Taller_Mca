-- Seed 0020c: Excel Catalog — 40 services + pricing rules from Docs/
-- Sprint 62 — Maestro ERP + Tempario Maestro + Matriz Costos
--
-- Run AFTER seed-0020-reference-data.sql and seed-0020-pricing-rules.sql
-- Tenant: taller-el-chero
-- Source files:
--   Docs/Maestro_ERP_Automotriz_Completo_2026.xlsx  (20 advanced services)
--   Docs/Estructura_Tempario_Maestro_ERP_Automotriz.xlsx  (20 traditional services)
--   Docs/Matriz_Complejidad_y_Costos_Automotriz_Paraguay.xlsx  (cost matrix)

-- ═══════════════════════════════════════════════════
--  1. New Service Categories
-- ═══════════════════════════════════════════════════

INSERT INTO service_categories (nombre, descripcion, icono, color, orden) VALUES
  ('Motor y Componentes', 'Bloque, culata, distribución, inyección, periféricos del motor', '🔩', '#8B4513', 9),
  ('Transmisión y Embrague', 'Embrague, caja automática/CVT, semiejes, homocinéticas', '⚙️', '#696969', 10),
  ('Tren Delantero', 'Suspensión delantera, dirección, bujes, rótulas, parrillas', '🏎️', '#4682B4', 11),
  ('Tren Trasero', 'Suspensión trasera, eje rígido, multibrazo, bujes de eje', '🔧', '#708090', 12),
  ('Eléctrico', 'Arranque, carga, alternador, iluminación, fusibles', '⚡', '#FFD700', 13),
  ('Electrónica', 'Módulos, sensores, ADAS, cámaras, telemática', '💻', '#00CED1', 14),
  ('Carrocería', 'Paragolpes, mecanismos de puerta, alzacristales, cerraduras', '🚗', '#CD853F', 15),
  ('Chasis', 'Soportes de motor, tacos, sistema de escape, silenciador', '🔩', '#A0522D', 16),
  ('Vehículos Eléctricos (BEV)', 'Batería de tracción HV, motor síncrono, inversor, gestión térmica', '🔋', '#00AA00', 17),
  ('Vehículos Híbridos', 'Transmisión e-CVT, batería NiMH/Litio, seguridad HV', '⚡', '#FF8C00', 18),
  ('Nuevos Combustibles', 'Pila de combustible H2, tanques GLP/LPI, Flex Fuel', '⛽', '#32CD32', 19),
  ('Frenos y Seguridad', 'Pastillas, discos, EPB, control de estabilidad', '🛑', '#DC143C', 20),
  ('Climatización (HVAC)', 'A/C R134a/R1234yf, compresores eléctricos, filtros', '❄️', '#00BFFF', 21),
  ('Asistencia ADAS', 'Radares, cámaras, calibración estática/dinámica, OTA', '📡', '#9400D3', 22)
ON CONFLICT (nombre) DO NOTHING;

-- ═══════════════════════════════════════════════════
--  2. Tempario Maestro — 20 Traditional Services
-- ═══════════════════════════════════════════════════

-- 2.1 Motor y Componentes (4 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-MOT-001', 'Reemplazo de Junta de Tapa de Cilindros / Culata', 'Reemplazo completo de junta multilaminada de culata',
  'Motor y Componentes', 1850000, 390, 'ECM_RESET',
  'Desmontaje completo de culata, cambio de junta multilaminada, torque de pernos según especificación OEM. Aplicable a motores GDI y convencionales.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-MOT-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-MOT-002', 'Cambio de Kit de Correa / Cadena de Distribución', 'Kit completo de distribución con tensor y poleas',
  'Motor y Componentes', 1200000, 180, 'TIMING_REVIEW',
  'Kit completo de distribución con tensor hidráulico, guías y poleas. Incluye alineación de marcas de fábrica y verificación de tensión.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-MOT-002' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-MOT-003', 'Cambio de Inyectores (Nafta GDI / Diésel CRDI)', 'Extracción e inserción de inyectores de alta presión',
  'Motor y Componentes', 850000, 120, 'INJECTOR_CODING_THROTTLE_RELEARN',
  'Extracción e inserción de inyectores de alta presión. Requiere codificación de aprendizaje EEPROM y verificación de presión rail.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-MOT-003' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-MOT-004', 'Reemplazo de Bomba de Agua y Correa de Accesorios', 'Cambio de bomba de agua y correa de accesorios',
  'Motor y Componentes', 550000, 90, 'BELT_TENSION',
  'Cambio de bomba de agua y correa de accesorios. Verificación de tensor automático y alineación de poleas.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-MOT-004' AND tenant_slug = 'taller-el-chero');

-- 2.2 Transmisión y Embrague (3 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TRA-001', 'Cambio de Kit de Embrague (Disco, Plato, Rulemán)', 'Kit completo de embrague con disco self-adjusting',
  'Transmisión y Embrague', 1500000, 240, 'CLUTCH_ADAPT',
  'Kit completo de embrague con disco self-adjusting, plato y rulemán de agujas. Incluye sangrado hidráulico.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TRA-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TRA-002', 'Mantenimiento de Fluido ATF/CVT y Filtro Interno', 'Cambio de fluido ATF/CVT y filtro interno',
  'Transmisión y Embrague', 650000, 90, 'TRANSMISSION_ADAPT',
  'Cambio de fluido ATF/CVT por bomba de circulación. Reemplazo de filtro interno y verificación de niveles con escáner.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TRA-002' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TRA-003', 'Reemplazo de Homocinética o Palier Completo', 'Reemplazo de junta homocinética o palier',
  'Transmisión y Embrague', 450000, 72, NULL,
  'Reemplazo de junta homocinética o palier completo. Incluye retenes, grasa especial y verificación de holguras axiales.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TRA-003' AND tenant_slug = 'taller-el-chero');

-- 2.3 Tren Delantero (3 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TRD-001', 'Cambio de Amortiguadores Delanteros (Par)', 'Reemplazo de amortiguadores delanteros en par',
  'Tren Delantero', 400000, 120, NULL,
  'Reemplazo de amortiguadores delanteros en par. Verificación de muelles, bujes y rótulas superiores.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TRD-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TRD-002', 'Reemplazo de Cremallera de Dirección', 'Reemplazo de cremallera de dirección asistida',
  'Tren Delantero', 1200000, 210, 'EPS_CALIBRATE',
  'Reemplazo de cremallera de dirección asistida eléctrica/hidráulica. Calibración de sensor de par y alineación de ruedas.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TRD-002' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TRD-003', 'Reemplazo de Parrillas de Suspensión / Bujes / Rótulas', 'Cambio de parrillas, bujes y rótulas',
  'Tren Delantero', 550000, 90, NULL,
  'Cambio de parrillas de suspensión (brazos inferiores/superiores) con bujes de caucho-metal y rótulas de seguridad.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TRD-003' AND tenant_slug = 'taller-el-chero');

-- 2.4 Tren Trasero (2 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TRT-001', 'Cambio de Amortiguadores Traseros / Espirales', 'Reemplazo de amortiguadores y/o muelles traseros',
  'Tren Trasero', 350000, 72, NULL,
  'Reemplazo de amortiguadores y/o muelles espirales traseros. Verificación de brazos de torsión y bujes de eje.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TRT-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TRT-002', 'Reemplazo de Bujes de Eje Trasero / Brazos Tensores', 'Cambio de bujes de eje o brazos tensores',
  'Tren Trasero', 750000, 150, NULL,
  'Cambio de bujes de eje trasero o brazos tensores. Requiere desmontaje parcial del eje y prensado hidráulico.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TRT-002' AND tenant_slug = 'taller-el-chero');

-- 2.5 Eléctrico (2 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'ELE-ELC-001', 'Reemplazo de Alternador / Motor de Arranque', 'Reemplazo o reparación de alternador o motor de arranque',
  'Eléctrico', 550000, 108, 'ALTERNATOR_RELearn',
  'Reemplazo de alternador o motor de arranque. Verificación de tensión de carga y circuito de excitación.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'ELE-ELC-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'ELE-ELC-002', 'Cambio de Ópticas Faros Delanteros', 'Reemplazo de ópticas de faros con desmontaje de paragolpes',
  'Eléctrico', 650000, 72, 'HEADLIGHT_ADJUST',
  'Reemplazo de ópticas de faros delanteros. Incluye desmontaje de paragolpes, conexión de harness y ajuste de alcance.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'ELE-ELC-002' AND tenant_slug = 'taller-el-chero');

-- 2.6 Electrónica (2 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'ELE-ELN-001', 'Diagnóstico Avanzado y Cambio de Sensores Críticos', 'CKP, CMP, ABS — diagnóstico y reemplazo',
  'Electrónica', 350000, 60, 'FULL_SYSTEM_SCAN',
  'Diagnóstico con escáner de nivel OEM. Cambio de sensores de posición de cigüeñal/culata o sensores de velocidad ABS. Verificación de señales con osciloscopio.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'ELE-ELN-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'ELE-ELN-002', 'Calibración de Cámaras / Sensores de Carril / Radar ADAS', 'Calibración estática y dinámica de sistemas ADAS',
  'Electrónica', 850000, 90, 'ADAS_CALIBRATE',
  'Calibración estática y dinámica de sistemas ADAS. Requiere lienzos de calibración, targets de referencia y espacio de 8m mínimo.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'ELE-ELN-002' AND tenant_slug = 'taller-el-chero');

-- 2.7 Carrocería (2 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'CAR-CRR-001', 'Desmontaje y Montaje de Paragolpes / Guardabarros', 'Desmontaje y montaje de componentes de carrocería exterior',
  'Carrocería', 450000, 90, NULL,
  'Desmontaje y montaje de componentes de carrocería exterior. Incluye clips, tornillería, alineación de gaps y verificación de pintura.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'CAR-CRR-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'CAR-CRR-002', 'Cambio de Alzacristales Eléctrico o Cerradura de Puerta', 'Reemplazo de mecanismo de alzacristales o cerradura',
  'Carrocería', 400000, 78, NULL,
  'Reemplazo de mecanismo de alzacristales eléctrico o cerradura de puerta. Verificación de funcionamiento eléctrico y mecánico.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'CAR-CRR-002' AND tenant_slug = 'taller-el-chero');

-- 2.8 Chasis (2 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'CHA-CHS-001', 'Cambio de Soportes / Tacos de Motor y Caja', 'Cambio de soportes de motor y caja (set completo)',
  'Chasis', 850000, 150, 'ENGINE_MOUNT_RECAL',
  'Cambio de soportes de motor y caja de cambios (set completo). Incluye alineación de motor y verificación de vibraciones.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'CHA-CHS-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'CHA-CHS-002', 'Reemplazo de Silenciador, Catalizador o Tramo de Escape', 'Reemplazo de componentes del sistema de escape',
  'Chasis', 450000, 72, NULL,
  'Reemplazo de silenciador, catalizador o tramo de escape. Verificación de fugas y cumplimiento normativa ambiental.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'CHA-CHS-002' AND tenant_slug = 'taller-el-chero');

-- ═══════════════════════════════════════════════════
--  3. Maestro ERP — 20 Advanced/EV/HEV Services
-- ═══════════════════════════════════════════════════

-- 3.1 Inyección Electrónica (3 services — reuse Especialidad Alta Performance + Descarbonización y EGR)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'INM-ELN-001', 'Calibración de Cuerpo de Aceleración Motorizado', 'Diagnóstico y calibración drive-by-wire',
  'Especialidad Alta Performance', 450000, 72, 'THROTTLE_RELEARN',
  'Diagnóstico y calibración de cuerpo de aceleración motorizado drive-by-wire. Incluye relearn de posición de mariposa y verificación de señales TPS.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'INM-ELN-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'INM-ELN-002', 'Limpieza Ultrasónica de Inyectores Nafta/Flex', 'Banco de pruebas + ultrasonido + cambio de sellos',
  'Especialidad Alta Performance', 650000, 108, 'INJECTOR_CODING_THROTTLE_RELEARN',
  'Limpieza de inyectores por ultrasonido en banco de pruebas. Verificación de caudal y patrón de spray. Cambio de sellos de alta presión.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'INM-ELN-002' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'INM-ELN-003', 'Reemplazo de Sonda Lambda / Válvula EGR', 'Sensor O2 o EGR obstruida por hollín local',
  'Descarbonización y EGR', 400000, 66, 'EGR_CALIBRATION',
  'Reemplazo de sonda lambda pre/post catalizador o válvula EGR. Calibración de mezcla aire/combustible y verificación de emisiones.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'INM-ELN-003' AND tenant_slug = 'taller-el-chero');

-- 3.2 Vehículos Eléctricos BEV (4 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'EVO-BAT-001', 'Aislamiento y Balanceo de Pack de Batería Litio HV', 'Protocolo de seguridad HV + desmontaje + balanceo celdas',
  'Vehículos Eléctricos (BEV)', 3500000, 330, 'HV_ISOLATION_TEST',
  'Protocolo de seguridad HV: aislamiento de batería, verificación de aislamiento con megóhmetro, desmontaje de pack y balanceo de celdas. Requiere EPP completo nivel B.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'EVO-BAT-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'EVO-MOT-002', 'Servicio de Motor Síncrono de Imanes Permanentes (PMSM)', 'Reemplazo o servicio de motor + reductor axial',
  'Vehículos Eléctricos (BEV)', 2500000, 240, 'MOTOR_ADAPTIVE',
  'Servicio o reemplazo de motor síncrono de imanes permanentes (PMSM). Incluye verificación de reductor axial, rodamientos y codificador de posición.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'EVO-MOT-002' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'EVO-TRM-003', 'Servicio de Gestión Térmica de Batería HV', 'Refrigeración líquida/chiller de batería de tracción',
  'Vehículos Eléctricos (BEV)', 850000, 132, 'THERMAL_MANAGE',
  'Servicio al circuito de refrigeración de batería HV. Incluye vacío, carga de refrigerante, verificación de chiller y sensores de temperatura.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'EVO-TRM-003' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'EVO-INV-004', 'Diagnóstico de Inversor DC-AC / Conversor DC-DC', 'Sustitución de inversor de potencia o conversor LT',
  'Vehículos Eléctricos (BEV)', 1800000, 180, 'INVERTER_DIAG',
  'Diagnóstico y sustitución de inversor de potencia o conversor DC-DC de baja tensión. Verificación de onda sinusoidal y eficiencia.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'EVO-INV-004' AND tenant_slug = 'taller-el-chero');

-- 3.3 Vehículos Híbridos (3 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'HYB-POW-001', 'Servicio de Transeje e-CVT (MG1/MG2)', 'Desacople motor térmico + reemplazo + calibración e-CVT',
  'Vehículos Híbridos', 3200000, 300, 'TRANSMISSION_ADAPTIVE',
  'Desacople de motor térmico y servicio de transeje e-CVT con motores generadores MG1/MG2. Calibración de sincronización y verificación de modo EV.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'HYB-POW-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'HYB-BAT-002', 'Limpieza de Sistema de Enfriamiento de Batería Híbrida', 'Filtros + soplador + sensores + BMS',
  'Vehículos Híbridos', 550000, 90, 'BATTERY_COOLING',
  'Limpieza profunda de sistema de enfriamiento de batería híbrida. Incluye filtros, soplador, sensores de temperatura y verificación de BMS.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'HYB-BAT-002' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'HYB-SFT-003', 'Inspección de Cableado Naranja HV y Relés SMR', 'Cableado HV + relés SMR + interlock',
  'Vehículos Híbridos', 400000, 72, 'HV_ISOLATION_TEST',
  'Inspección visual y eléctrica de cableado HV naranja, relés SMR (System Main Relay), fusibles HV y circuitos de interlock. Verificación de aislamiento.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'HYB-SFT-003' AND tenant_slug = 'taller-el-chero');

-- 3.4 Nuevos Combustibles (4 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'H2O-CEL-001', 'Mantenimiento de Pila de Combustible de Hidrógeno', 'Purga PEM + filtros aire químico + humidificación',
  'Nuevos Combustibles', 2800000, 270, 'FUEL_CELL_PURGE',
  'Mantenimiento de pila de combustible PEM. Incluye purga de membrana, cambio de filtros de aire químico, verificación de humidificación y presión de H2.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'H2O-CEL-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'H2O-TNK-002', 'Prueba de Fuga de Tanque H2 a 700 bar', 'Helio trazador + válvulas solenoides + sensores P/T',
  'Nuevos Combustibles', 1200000, 150, 'H2_LEAK_TEST',
  'Prueba de hermeticidad con helio trazador a 700 bar. Revisión de válvulas solenoides de llenado y descarga, sensores de presión y temperatura.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'H2O-TNK-002' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'GLP-LPI-003', 'Sustitución de Bomba de Gas Licuado LPI', 'Bomba GLP fase líquida + regulador + inyectores gas',
  'Nuevos Combustibles', 1500000, 168, 'LPI_PUMP_RECAL',
  'Sustitución de bomba de gas licuado LPI en fase líquida. Incluye verificación de regulador, inyectores de gas y sincronización ECU.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'GLP-LPI-003' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'FLX-ETH-004', 'Sensor de Etanol + Inyectores Flex Fuel Sobredimensionados', 'Cambio de sensor O2 flex e inyectores Mercosur',
  'Nuevos Combustibles', 750000, 84, 'FLEX_FUEL_CAL',
  'Cambio de sensor de concentración de etanol (O2 flex) e inyectores de mayor caudal para mezcla E85. Calibración de mapas de inyección.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'FLX-ETH-004' AND tenant_slug = 'taller-el-chero');

-- 3.5 Frenos y Seguridad (2 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'BRK-ABS-001', 'Pastillas + Rectificado Discos + Purga Hidráulica ABS', 'Cambio de pastillas, rectificado y purga completa',
  'Frenos y Seguridad', 550000, 72, 'ABS_BLEEDING',
  'Cambio de pastillas de freno, rectificado de discos y purga completa del circuito hidráulico con equipo de sangrado por presión.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'BRK-ABS-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'BRK-EPB-002', 'Sustitución de Calipers EPB y Purga por Software', 'Freno de mano electrónico con motor integrado',
  'Frenos y Seguridad', 950000, 96, 'EPB_SERVICE',
  'Sustitución de calipers EPB con motor integrado. Purga y aprendizaje por software. Requiere modo de servicio con escáner.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'BRK-EPB-002' AND tenant_slug = 'taller-el-chero');

-- 3.6 Climatización HVAC (2 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'VAC-HVC-001', 'Recarga Gas R134a/R1234yf + Detección Fugas + Filtro', 'Recarga de gas refrigerante con equipo de recuperación',
  'Climatización (HVAC)', 450000, 78, 'AC_RECHARGE',
  'Recarga de gas refrigerante R134a o R1234yf con equipo de recuperación. Detección de fugas con UV/gas trazador. Cambio de filtro de habitáculo y secador.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'VAC-HVC-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'VAC-HVC-002', 'Cambio de Compresor A/C Scroll Eléctrico', 'Compresor HV con aceite dieléctrico POE',
  'Climatización (HVAC)', 1200000, 144, 'AC_COMPRESSOR',
  'Cambio de compresor scroll eléctrico para HEV/EV. Requiere aceite dieléctrico POE, vacío profundo y calibración de presión de trabajo.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'VAC-HVC-002' AND tenant_slug = 'taller-el-chero');

-- 3.7 Asistencia ADAS (2 services)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'ADA-SCY-001', 'Calibración de Radar de Proximidad y Cámaras de Carril', 'Calibración estática/dinámica ADAS con targets OEM',
  'Asistencia ADAS', 1500000, 120, 'ADAS_CALIBRATE',
  'Sustitución de radar de proximidad o cámara de visión frontal. Calibración estática con targets y dinámica en ruta. Requiere lienzos y herramiental OEM.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'ADA-SCY-001' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'ADA-SCY-002', 'Actualización de Firmware Gateway / Módulos OTA', 'Pasarelas de conectividad 4G/5G/WiFi',
  'Asistencia ADAS', 550000, 60, 'OTA_UPDATE',
  'Actualización de firmware de gateway central y módulos de conectividad (4G/5G/WiFi). Verificación de versión y funcionalidad post-update.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'ADA-SCY-002' AND tenant_slug = 'taller-el-chero');

-- ═══════════════════════════════════════════════════
--  4. Pricing Rules — Multi-Dimensional Matrix
-- ═══════════════════════════════════════════════════
-- Source: Docs/Matriz_Complejidad_y_Costos_Automotriz_Paraguay.xlsx
--
-- Cost Base H/H = 100,000 Gs. for all segments
-- Complexity factors per vehicle origin and maintenance type:
--   Súper Liviano → factor 1.0-1.1 → precio ~100K-110K
--   Liviano       → factor 1.1-1.2 → precio ~110K-120K
--   Mediano       → factor 1.25-1.35 → precio ~125K-135K
--   Pesado        → factor 1.4-1.6 → precio ~145K-160K
--
-- Mapping: segmento → vehicle_type, tipo → complejidad
--   Auto Pequeño (A-B) → AUTOMOVIL
--   Auto Mediano (C) → AUTOMOVIL
--   SUV Mediano (4x2) → SUV
--   SUV Gde / Pick-Up → PICK_UP
--   Súper Liviano → BASICO, Liviano → NORMAL, Mediano → AVANZADO, Pesado → CRITICO

DO $$
DECLARE
  v_servicio_id UUID;
  v_vehicle_auto UUID;
  v_vehicle_suv UUID;
  v_vehicle_pickup UUID;
  v_fuel_flex UUID;
  v_fuel_diesel UUID;
  v_fuel_hybrid UUID;
BEGIN
  -- Get vehicle type IDs
  SELECT id INTO v_vehicle_auto FROM vehicle_types WHERE nombre = 'AUTOMOVIL';
  SELECT id INTO v_vehicle_suv FROM vehicle_types WHERE nombre = 'SUV';
  SELECT id INTO v_vehicle_pickup FROM vehicle_types WHERE nombre = 'PICK_UP';

  -- Get fuel type IDs
  SELECT id INTO v_fuel_flex FROM fuel_types WHERE nombre = 'FLEX';
  SELECT id INTO v_fuel_diesel FROM fuel_types WHERE nombre = 'DIESEL_CR';
  SELECT id INTO v_fuel_hybrid FROM fuel_types WHERE nombre = 'HIBRIDO';

  -- ═══════════════════════════════════════════════════
  --  4.1 Tempario Maestro — Traditional Services (20)
  --  Each gets 3 rules: AUTOMOVIL + SUV + PICK_UP
  -- ═══════════════════════════════════════════════════

  -- MEC-MOT-001: Junta de Culata (390 min) — Pesado
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-MOT-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 1850000, 145000, 390, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 2200000, 145000, 450, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 2500000, 160000, 480, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-MOT-002: Kit Distribución (180 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-MOT-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 1200000, 125000, 180, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 1500000, 125000, 210, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 1700000, 135000, 240, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-MOT-003: Inyectores GDI/CRDI (120 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-MOT-003' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 850000, 125000, 120, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 1050000, 125000, 144, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 1200000, 135000, 160, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-MOT-004: Bomba Agua + Correa (90 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-MOT-004' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 550000, 110000, 90, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 680000, 110000, 108, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 750000, 120000, 120, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TRA-001: Kit Embrague (240 min) — Mediano/Pesado
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TRA-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 1500000, 125000, 240, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 1800000, 135000, 280, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 2100000, 145000, 300, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TRA-002: Fluido ATF/CVT (90 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TRA-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 650000, 110000, 90, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 780000, 110000, 108, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 850000, 120000, 120, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TRA-003: Homocinética (72 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TRA-003' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 450000, 100000, 72, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 550000, 100000, 84, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 600000, 110000, 96, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TRD-001: Amortiguadores Delanteros (120 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TRD-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 400000, 110000, 120, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 500000, 110000, 144, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 550000, 120000, 160, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TRD-002: Cremallera Dirección (210 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TRD-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 1200000, 125000, 210, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 1450000, 125000, 240, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 1600000, 135000, 270, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TRD-003: Parrillas/Bujes/Rótulas (90 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TRD-003' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 550000, 110000, 90, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 650000, 110000, 108, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 700000, 120000, 120, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TRT-001: Amortiguadores Traseros (72 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TRT-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 350000, 100000, 72, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 420000, 100000, 84, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 480000, 110000, 96, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TRT-002: Bujes Eje Trasero (150 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TRT-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 750000, 125000, 150, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 900000, 125000, 180, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 1050000, 135000, 200, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ELE-ELC-001: Alternador/Arranque (108 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'ELE-ELC-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 550000, 110000, 108, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 650000, 110000, 120, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 720000, 120000, 132, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ELE-ELC-002: Ópticas Faros (72 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'ELE-ELC-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 650000, 100000, 72, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 780000, 100000, 84, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 850000, 110000, 96, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ELE-ELN-001: Diagnóstico Sensores (60 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'ELE-ELN-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 350000, 100000, 60, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 420000, 100000, 72, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 480000, 110000, 84, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ELE-ELN-002: Calibración ADAS (90 min) — Mediano/Pesado
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'ELE-ELN-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 850000, 125000, 90, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 1050000, 135000, 108, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 1200000, 145000, 120, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- CAR-CRR-001: Paragolpes (90 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'CAR-CRR-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 450000, 110000, 90, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 550000, 110000, 108, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 600000, 120000, 120, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- CAR-CRR-002: Alzacristales/Cerradura (78 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'CAR-CRR-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 400000, 100000, 78, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 480000, 100000, 90, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 520000, 110000, 102, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- CHA-CHS-001: Soportes Motor/Caja (150 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'CHA-CHS-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 850000, 125000, 150, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 1000000, 135000, 180, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 1150000, 145000, 200, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- CHA-CHS-002: Escape/Catalizador (72 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'CHA-CHS-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 450000, 100000, 72, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 520000, 100000, 84, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 580000, 110000, 96, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ═══════════════════════════════════════════════════
  --  4.2 Maestro ERP — Advanced/EV/HEV Services (20)
  -- ═══════════════════════════════════════════════════

  -- INM-ELN-001: Cuerpo Aceleración (72 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'INM-ELN-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 450000, 110000, 72, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 550000, 110000, 84, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 600000, 120000, 96, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- INM-ELN-002: Limpieza Inyectores Ultrasónico (108 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'INM-ELN-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 650000, 125000, 108, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 800000, 125000, 132, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 900000, 135000, 144, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- INM-ELN-003: Sonda Lambda / EGR (66 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'INM-ELN-003' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 400000, 110000, 66, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 500000, 110000, 78, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 550000, 120000, 90, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- EVO-BAT-001: Batería HV (330 min) — Pesado
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'EVO-BAT-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_hybrid, 3500000, 145000, 330, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_hybrid, 4200000, 160000, 390, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_hybrid, 4800000, 160000, 420, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- EVO-MOT-002: Motor PMSM (240 min) — Mediano/Pesado
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'EVO-MOT-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_hybrid, 2500000, 135000, 240, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_hybrid, 3000000, 145000, 280, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_hybrid, 3500000, 160000, 320, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- EVO-TRM-003: Gestión Térmica EV (132 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'EVO-TRM-003' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_hybrid, 850000, 125000, 132, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_hybrid, 1050000, 135000, 156, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_hybrid, 1200000, 145000, 168, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- EVO-INV-004: Inversor DC-AC (180 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'EVO-INV-004' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_hybrid, 1800000, 135000, 180, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_hybrid, 2200000, 145000, 210, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_hybrid, 2500000, 160000, 240, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- HYB-POW-001: Transeje e-CVT (300 min) — Pesado
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'HYB-POW-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_hybrid, 3200000, 145000, 300, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_hybrid, 3800000, 160000, 360, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_hybrid, 4500000, 160000, 420, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- HYB-BAT-002: Enfriamiento Batería Híbrida (90 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'HYB-BAT-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_hybrid, 550000, 110000, 90, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_hybrid, 680000, 120000, 108, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_hybrid, 750000, 125000, 120, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- HYB-SFT-003: Cableado Naranja HV / SMR (72 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'HYB-SFT-003' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_hybrid, 400000, 100000, 72, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_hybrid, 480000, 110000, 84, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_hybrid, 550000, 110000, 96, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- H2O-CEL-001: Pila Combustible H2 (270 min) — Pesado
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'H2O-CEL-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 2800000, 160000, 270, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 3300000, 160000, 320, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 3800000, 160000, 360, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- H2O-TNK-002: Prueba Fuga H2 700bar (150 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'H2O-TNK-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 1200000, 135000, 150, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 1450000, 145000, 180, 'CRITICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 1600000, 160000, 200, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- GLP-LPI-003: Bomba Gas LPI (168 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'GLP-LPI-003' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 1500000, 125000, 168, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 1800000, 135000, 192, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, 2000000, 145000, 216, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- FLX-ETH-004: Sensor Etanol / Inyectores Flex (84 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'FLX-ETH-004' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, 750000, 110000, 84, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, 900000, 110000, 96, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_flex, 1000000, 120000, 108, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- BRK-ABS-001: Pastillas + Rectificado + Purga (72 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'BRK-ABS-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 550000, 100000, 72, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 650000, 110000, 84, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 750000, 120000, 96, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- BRK-EPB-002: Calipers EPB (96 min) — Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'BRK-EPB-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 950000, 110000, 96, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 1100000, 120000, 108, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 1250000, 135000, 120, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- VAC-HVC-001: Recarga Gas A/C (78 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'VAC-HVC-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 450000, 100000, 78, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 550000, 110000, 90, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 600000, 110000, 96, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- VAC-HVC-002: Compresor A/C Scroll Eléctrico (144 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'VAC-HVC-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 1200000, 135000, 144, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 1400000, 145000, 168, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 1500000, 160000, 180, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ADA-SCY-001: Calibración ADAS Radar/Cámaras (120 min) — Mediano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'ADA-SCY-001' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 1500000, 135000, 120, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 1800000, 145000, 144, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 2000000, 160000, 168, 'CRITICO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ADA-SCY-002: Firmware Gateway OTA (60 min) — Súper Liviano
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'ADA-SCY-002' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, precio_costo_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 550000, 100000, 60, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 650000, 110000, 72, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 700000, 110000, 84, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;

-- ═══════════════════════════════════════════════════
--  Summary
-- ═══════════════════════════════════════════════════
-- 14 new service categories
-- 40 new services (20 Tempario + 20 Maestro ERP)
-- ~120 pricing rules (40 services × 3 vehicle types each)
-- Total catalog: 11 existing + 40 new = 51 services
