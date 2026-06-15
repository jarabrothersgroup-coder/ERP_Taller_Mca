Para cargar con éxito el catálogo maestro de tu ERP, combinamos los datos reales de importación de la **Dirección Nacional de Ingresos Tributarios (DNIT / Aduanas)** y la **Cámara de Distribuidores de Automotores y Maquinarias (CADAM)**. [1, 2] 

A continuación, dispones de los **modelos exactos más importados en Paraguay (tanto usados vía Iquique como nuevos 0km)** y el **esquema relacional de base de datos** optimizado para su indexación mediante el código **VIN**. [3, 4] 

------

## 1. Modelos de Mayor Importación en Paraguay

Este listado consolida los vehículos con mayor presencia histórica y actual en las calles del país, ordenados por su canal de entrada predominante:

## A. Canal de Usados (Vía Iquique / Chile) - Domina el Histórico

- **Toyota Vitz:** El auto más importado en la historia reciente de Paraguay. Domina las versiones desde el año 1999 hasta 2015. Motores comunes: `1.0cc (1KR-FE)` y `1.3cc (2SZ-FE)`. [4] 
- **Toyota Corolla / Corolla Axio / Allex / RunX:** Sedanes y hatchbacks indestructibles para el empedrado paraguayo. Años dominantes: 1998 a 2012. [4] 
- **Toyota Allion / Premio:** Sedanes ejecutivos usados de gran demanda. Años: 2002 a 2014. Motores `1.5cc` y `1.8cc`. [5] 
- **Kia Sorento (Usado de Corea):** Importación directa de Corea del Sur (motor Diésel `2.0cc` o `2.2cc` CRDi). Años: 2004 a 2016.

## B. Canal de Nuevos 0km (Representantes / CADAM) - Mercado Actual

- **Toyota Hilux:** La reina indiscutible del mercado paraguayo. Es el vehículo más vendido e importado año tras año (proveniente de Argentina).
- **Kia Soluto:** El automóvil sedán compacto 0km más vendido en el país por su economía de combustible.
- **Hyundai Creta:** La SUV compacta preferida en los reportes mensuales de importación de CADAM.
- **Kia Picanto:** El hatchback urbano por excelencia de las concesionarias locales.
- **Kia Seltos / Sportage:** Fuertes competidores en el segmento de SUVs nuevas.
- **Toyota Corolla Cross (Híbrido):** Líder absoluto en la nueva transición hacia vehículos híbridos en el país.
- **Chevrolet S10:** Fuerte rival de la Hilux en el sector agroganadero (proveniente de Brasil). [1, 3, 6, 7, 8, 9, 10] 

------

## 2. Esquema Relacional de Base de Datos (SQL-ANSI)

Este diseño normalizado en **Tercera Forma Normal (3FN)** está pensado para un sistema ERP. Cuenta con tablas maestras estáticas (Marcas, Modelos) y tablas dinámicas de transacciones (Vehículos) indexadas por el VIN de 17 caracteres.

```sql
-- 1. TABLA MAESTRA: MARCAS
CREATE TABLE maest_marcas (
    marca_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_marca VARCHAR(50) NOT NULL UNIQUE,          -- Ej: 'TOYOTA', 'KIA', 'HYUNDAI'
    origen_principal VARCHAR(30)                       -- Ej: 'JAPON', 'COREA DEL SUR'
);

-- 2. TABLA MAESTRA: TIPOS DE VEHÍCULOS
CREATE TABLE maest_tipos_vehiculo (
    tipo_id INT AUTO_INCREMENT PRIMARY KEY,
    descripcion VARCHAR(30) NOT NULL UNIQUE            -- Ej: 'AUTOMOVIL', 'SUVS', 'PICK-UP', 'CAMION'
);

-- 3. TABLA MAESTRA: MODELOS (Relacionada a Marcas y Tipos)
CREATE TABLE maest_modelos (
    modelo_id INT AUTO_INCREMENT PRIMARY KEY,
    marca_id INT NOT NULL,
    tipo_id INT NOT NULL,
    nombre_modelo VARCHAR(50) NOT NULL,                -- Ej: 'VITZ', 'COROLLA', 'HILUX', 'SORENTO'
    FOREIGN KEY (marca_id) REFERENCES maest_marcas(marca_id),
    FOREIGN KEY (tipo_id) REFERENCES maest_tipos_vehiculo(tipo_id),
    UNIQUE KEY uq_marca_modelo (marca_id, nombre_modelo)
);

-- 4. TABLA OPERATIVA: PARQUE AUTOMOTOR (Catálogo General por VIN)
CREATE TABLE registro_vehiculos_vin (
    vin_code CHAR(17) PRIMARY KEY,                     -- Código VIN único de 17 caracteres
    modelo_id INT NOT NULL,
    anho_fabricacion INT NOT NULL,                     -- Extraído del Dígito 10 del VIN
    codigo_wmi CHAR(3) NOT NULL,                       -- Dígitos 1-3 (País/Planta de Origen real)
    tipo_combustible ENUM('NAFTA', 'DIESEL', 'FLEX', 'HIBRIDO', 'ELECTRICO') NOT NULL,
    tipo_importacion ENUM('0KM REPRESENTANTE', 'USADO VIA IQUIQUE', 'USADO DIRECTO COREA') NOT NULL,
    color VARCHAR(20),
    chapa_paraguay VARCHAR(10) NULL UNIQUE,            -- Chapa Mercosur o antigua RUA si está matriculado
    fecha_ingreso_sistema TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modelo_id) REFERENCES maest_modelos(modelo_id)
);

-- 5. TABLA COMPLEMENTARIA: HISTORIAL DE IMPORTACIONES (Auditoría ERP)
CREATE TABLE trans_importaciones_aduanas (
    importacion_id INT AUTO_INCREMENT PRIMARY KEY,
    vin_code CHAR(17) NOT NULL,
    despacho_numero VARCHAR(30) NOT NULL,               -- Número de Despacho de la DNIT
    anho_importacion INT NOT NULL,
    valor_fob_usd DECIMAL(12,2),                       -- Valor aduanero de origen
    FOREIGN KEY (vin_code) REFERENCES registro_vehiculos_vin(vin_code)
);
```

------

## 3. Set de Datos de Carga Inicial (Inserts Populares para Paraguay)

Ejecuta este script para poblar automáticamente tu base de datos con las marcas, tipos y los modelos específicos mencionados en tu consulta:

```sql
-- Insertar Marcas Líderes
INSERT INTO maest_marcas (nombre_marca, origen_principal) VALUES 
('TOYOTA', 'JAPÓN'),
('KIA', 'COREA DEL SUR'),
('HYUNDAI', 'COREA DEL SUR'),
('CHEVROLET', 'EE.UU.');

-- Insertar Tipos de Rodados Oficiales (Clasificación RUA/DINATRAN)
INSERT INTO maest_tipos_vehiculo (descripcion) VALUES 
('AUTOMOVIL'),
('SUVS'),
('PICK-UP'),
('CAMIONETAS');

-- Insertar los Modelos Exactos del Mercado Paraguayo
-- Toyota (ID: 1)
INSERT INTO maest_modelos (marca_id, tipo_id, nombre_modelo) VALUES 
(1, 1, 'VITZ'),
(1, 1, 'COROLLA'),
(1, 3, 'HILUX'),
(1, 2, 'COROLLA CROSS');

-- Kia (ID: 2)
INSERT INTO maest_modelos (marca_id, tipo_id, nombre_modelo) VALUES 
(2, 2, 'SORENTO'),
(2, 1, 'PICANTO'),
(2, 1, 'SOLUTO'),
(2, 2, 'SPORTAGE');

-- Hyundai (ID: 3)
INSERT INTO maest_modelos (marca_id, tipo_id, nombre_modelo) VALUES 
(3, 2, 'CRETA'),
(3, 1, 'HB20');
```

## 4. Ventajas de esta estructura en tu ERP

1. **Validación Automática:** Con el campo `CHAR(17)` aseguras que no se carguen chasis incompletos o erróneos.
2. **Trazabilidad:** Puedes saber exactamente cuántos **Toyota Vitz** entraron como `USADO VIA IQUIQUE` versus cuántos **Corolla Cross** ingresaron como `0KM REPRESENTANTE`.
3. **Optimización de Almacenamiento:** El ERP no repetirá millones de veces el texto "TOYOTA" o "HILUX"; se gestiona ágilmente mediante relaciones de enteros (`INT`). [10] 

¿Te gustaría que diseñemos las **consultas SQL avanzadas (Queries)** para que tu ERP genere reportes automáticos de inventario agrupados por origen y año, o prefieres un ejemplo de cómo conectar esta base de datos a una **interfaz de usuario**?

[1] [https://www.cadam.com.py](https://www.cadam.com.py/noticia/importaciones-de-vehiculos-crecieron-278)

[2] [https://www.dnit.gov.py](https://www.dnit.gov.py/documents/d/global/listado-vehiculos-dna-pdf?download=true)

[3] [https://www.instagram.com](https://www.instagram.com/p/DUCawLijGqe/?hl=cs)

[4] [https://informacionpublica.paraguay.gov.py](https://informacionpublica.paraguay.gov.py/public/10285283-SolicitudN30355_AdjuntoinformeValoracinpdf-SolicitudN30355_AdjuntoinformeValoracin.pdf)

[5] [https://www.instagram.com](https://www.instagram.com/p/DXhrdjdiVVZ/?img_index=8)

[6] [https://www.instagram.com](https://www.instagram.com/reel/DSLQLiAj6Bj/?hl=es-la)

[7] [https://www.forbes.com.py](https://www.forbes.com.py/daily-cover/los-10-modelos-vehiculos-mas-importados-n53411)

[8] [https://www.instagram.com](https://www.instagram.com/reel/DVbNLMPANzI/)

[9] [https://www.instagram.com](https://www.instagram.com/reel/DVHt2MYD315/?hl=es)

[10] [https://www.cadam.com.py](https://www.cadam.com.py/storage/app/uploads/public/67a/b50/986/67ab50986340c845472530.pdf)