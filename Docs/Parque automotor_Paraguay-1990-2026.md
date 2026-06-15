Esta investigación exhaustiva del **parque automotor del Paraguay (1990-2026)** recopila datos de los entes oficiales como la **Dirección Nacional de Ingresos Tributarios (DNIT / ex-Aduanas)**, la **Dirección del Registro de Automotores (RUA)** y la **Cámara de Distribuidores de Automotores y Maquinarias (CADAM)**. Está diseñada estructuralmente con la lógica técnica necesaria para alimentar las tablas maestras de tu sistema **ERP**. [[1](https://www.datos.gov.py/dataset/compendio-estadístico-ambiental-del-paraguay-2019-tema-parque-automotor/resource/a5702c59), [2](https://marketdata.com.py/noticias/nacionales/mapa-del-parque-automotor-donde-se-concentran-los-vehiculos-en-paraguay-147902/), [3](https://www.lanacion.com.py/negocios/2017/06/05/paraguay-unico-en-sudamerica-que-importa-vehiculos-con-mas-de-10-anos/), [4](https://www.cadam.com.py/)]

------

1. Estado Actual y Evolución Histórica (1990 - 2026)

El parque automotor de Paraguay ha experimentado un crecimiento exponencial, pasando de ser un mercado pequeño en los años 90 a superar los **3.3 millones de vehículos activos**. [[1](https://marketdata.com.py/noticias/nacionales/mapa-del-parque-automotor-donde-se-concentran-los-vehiculos-en-paraguay-147902/)]

Indicadores Clave del Mercado

- **Volumen Total:** Alrededor de **3,314,115 vehículos matriculados**. [[1](https://marketdata.com.py/noticias/nacionales/mapa-del-parque-automotor-donde-se-concentran-los-vehiculos-en-paraguay-147902/)]
- **Composición del Parque:**
  - Automóviles, SUVs y Camionetas: **59.5%**
  - Motocicletas: **38.1%**
  - Maquinarias Agrícolas/Viales y Camiones: **2.3%** [[1](https://marketdata.com.py/noticias/nacionales/mapa-del-parque-automotor-donde-se-concentran-los-vehiculos-en-paraguay-147902/)]
- **Distribución Geográfica:** La mayor densidad se concentra en el **Departamento Central (895,879)**, **Asunción (506,685)** y **Alto Paraná (505,558)**. [[1](https://www.pj.gov.py/notas/25748-registro-de-automotores-con-mas-de-3007435-matriculados)]

Cronología de Importación y la Distorsión del Mercado

- **Década de 1990 a 2001:** Mercado dominado por vehículos importados nuevos (0km) y camiones de carga.
- **Año 2002 (Ley N° 2018):** Se autoriza la **libre importación de vehículos usados**. Esto dio origen al masivo mercado de los autos usados conocidos popularmente como **"Vía Iquique"** (ingresados por Chile desde Japón, Corea y EE. UU.). [[1](https://www.youtube.com/watch?v=0c9ie6Rel30&t=134), [2](http://sedici.unlp.edu.ar/bitstream/handle/10915/158092/Documento_completo.pdf-PDFA.pdf?sequence=1&isAllowed=y)]
- **Año 2011 al Presente (Ley 4333):** Se intentó regular limitando la antigüedad a un máximo de 10 años. Sin embargo, mediante **recursos de inconstitucionalidad**, el mercado continuó absorbiendo vehículos de más de 10 a 15 años de antigüedad de manera regular. [[1](https://www.abc.com.py/nacionales/mas-de-170-autos-usados-son-importados-al-dia-1266493.html), [2](https://www.lanacion.com.py/negocios/2017/06/05/paraguay-unico-en-sudamerica-que-importa-vehiculos-con-mas-de-10-anos/)]
- **Relación de Importación Actual (CADAM):** Históricamente, de cada 10 vehículos que ingresan al país, aproximadamente el **60%-65% son usados** y el **35%-40% son 0km**. En el último año cerrado, las importaciones de vehículos nuevos (0km) alcanzaron **38,611 unidades**. [[1](https://www.abc.com.py/nacionales/paraguay-lider-en-importar-vehiculos-usados-1755720.html), [2](http://www.movilidadelectrica.org.py/taller/cadam.pdf), [3](https://amigocamionero.com.py/el-mercado-automotor-cerro-2025-con-crecimiento-sostenido/)]

------

2. Matriz de Origen y Marcas Líderes (Para Base de Datos del ERP)

Para mapear los orígenes de importación y marcas dominantes en el territorio paraguayo, consolida la siguiente tabla en los clasificadores de tu ERP:

| País de Origen / Procedencia [[1](https://www.lanacion.com.py/negocios/2026/01/20/destacan-2025-positivo-para-el-sector-automotor-con-mas-de-38000-vehiculos-importados/), [2](https://www.threads.com/@santiagasu/post/DSSdGPnCJmj/las-marcas-de-autos-mas-matriculadas-en-paraguay-a-noviembre-kia-toyota-hyundai)] | Participación | Marcas Predominantes en Paraguay          | Tipo de Vehículo Común                      |
| ------------------------------------------------------------ | ------------- | ----------------------------------------- | ------------------------------------------- |
| **Brasil**                                                   | 36%           | Volkswagen, Fiat, Chevrolet, Ford, Toyota | Compactos, Pick-ups, Comerciales            |
| **China**                                                    | 21%           | Geely, BYD, Changan, Chery, Jac           | SUVs, Eléctricos, Utilitarios               |
| **Argentina**                                                | 11%           | Toyota (Hilux), Ford (Ranger), Volkswagen | Pick-ups Medianas, Sedanes                  |
| **India**                                                    | 9%            | Hyundai, Suzuki, Mahindra, Tata           | Compactos Económicos, SUVs pequeños         |
| **Corea del Sur**                                            | 7%            | Kia, Hyundai                              | SUVs, Sedanes, Camionetas (Nuevos y Usados) |
| **Japón**                                                    | 4%            | Toyota, Nissan, Mitsubishi, Isuzu         | SUVs, Pick-ups, Usados de Volante Cambiado  |
| **Otros (EE.UU., México, Europa)**                           | 12%           | Jeep, Chevrolet, BMW, Mercedes-Benz       | Premium, Pick-ups Americanas, Salvamentos   |

------

3. Ingeniería del VIN (Vehicle Identification Number) para el ERP

El VIN consta de **17 caracteres alfanuméricos** estandarizados bajo la norma **ISO 3779**. No utiliza las letras *I, O, Q, Ñ* para evitar errores de lectura. Para automatizar la carga en tu sistema, debes programar funciones que segmenten el código de la siguiente manera: [[1](https://www.youtube.com/watch?v=kXwPZitBEJQ), [2](https://www.mapfre.com.py/autos/articulos/que-es-el-vin-en-un-auto/)]

```
 1 2 3   4 5 6 7 8   9   10  11  12 13 14 15 16 17
[ W M I ] [   V D S   ] [√] [Año] [Plt] [   Vis / Secuencial   ]
```

A. Sección WMI (Dígitos 1 al 3) - Identificador Mundial del Fabricante [[1](https://www.gob.mx/segob/documentos/glosario-de-terminos-del-registro-publico-vehicular), [2](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

El **Dígito 1 y 2** determinan inequívocamente la **región geográfica y el país de origen de fabricación de la planta**. Carga este diccionario en tu ERP: [[1](https://www.motorpasion.com.mx/industria/como-saber-que-pais-se-fabrico-mi-auto), [2](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

- **América del Sur (Fabricación Mercosur):**
  - `8A` a `8E`: Argentina
  - `9A` a `9E` / `93`: Brasil
  - `8F` a `8J`: Chile
  - `7A` a `7E`: Paraguay (Ensamblaje local de motocicletas y utilitarios como *Leopard, Kenton, Reimpex*)
- **Asia (Mayor volumen de usados y nuevos):**
  - `J`: Japón (Crucial para auditar vehículos vía Iquique)
  - `K`: Corea del Sur
  - `M`: India
  - `L`: China
- **América del Norte:**
  - `1`, `4`, `5`: Estados Unidos
  - `2`: Canadá
  - `3`: México
- **Europa:**
  - `W`: Alemania
  - `V`: Francia / España
  - `Z`: Italia

B. Sección VDS (Dígitos 4 al 8) - Descripción de Componentes del Vehículo [[1](https://www.gob.mx/segob/documentos/glosario-de-terminos-del-registro-publico-vehicular), [2](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

Especifica las características físicas registradas por la fábrica. Debe mapearse contra la base de datos de homologación de cada marca: [[1](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

- **Dígito 4:** Tipo de carrocería (Sedan, SUV, Hatchback, Pick-up).
- **Dígito 5 y 6:** Tipo de motor, cilindrada y tipo de combustible (Nafta, Diésel, Flex, Híbrido, Eléctrico).
- **Dígito 7 y 8:** Tipo de transmisión y sistemas de seguridad (Airbags/Frenos). [[1](https://epicvin.com/es/blog/vin-country-codes-of-the-vehicles), [2](https://marketdata.com.py/noticias/nacionales/parque-automotor-casi-se-duplico-en-una-decada-y-supera-los-468-vehiculos-por-cada-mil-habitantes-148910/), [3](https://www.lanacion.com.py/negocios/2026/01/20/destacan-2025-positivo-para-el-sector-automotor-con-mas-de-38000-vehiculos-importados/), [4](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

C. Dígito Verificador (Dígito 9) [[1](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

Es un algoritmo matemático de validación (`0-9` o `X`) que utiliza pesos asignados a cada posición para **detectar si el VIN es falso o está adulterado**. Tu ERP debe correr esta validación antes de registrar el alta de cualquier unidad. [[1](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

D. Año de Fabricación / Modelo (Dígito 10) [[1](https://www.gob.mx/segob/documentos/glosario-de-terminos-del-registro-publico-vehicular), [2](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

Este dígito es crítico para cumplir con los controles de la Ley de Importación en Paraguay. El estándar internacional cicla letras y números de la siguiente forma: [[1](https://www.abc.com.py/nacionales/mas-de-170-autos-usados-son-importados-al-dia-1266493.html), [2](https://www.lanacion.com.py/negocios/2017/06/05/paraguay-unico-en-sudamerica-que-importa-vehiculos-con-mas-de-10-anos/)]

- `L` = 1990
- `M` = 1991
- `N` = 1992
- `P` = 1993
- `R` = 1994
- `S` = 1995
- `T` = 1996
- `V` = 1997
- `W` = 1998
- `X` = 1999
- `Y` = 2000
- `1` = 2001
- `2` = 2002
- `3` = 2003
- `4` = 2004
- `5` = 2005
- `6` = 2006
- `7` = 2007
- `8` = 2008
- `9` = 2009
- `A` = 2010
- `B` = 2011
- `C` = 2012
- `D` = 2013
- `E` = 2014
- `F` = 2015
- `G` = 2016
- `H` = 2017
- `J` = 2018
- `K` = 2019
- `L` = 2020
- `M` = 2021
- `N` = 2022
- `P` = 2023
- `R` = 2024
- `S` = 2025
- `T` = 2026

E. Planta de Ensamblaje y Secuencial (Dígitos 11 al 17) [[1](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

- **Dígito 11:** Identifica la planta exacta del fabricante.
- **Dígitos 12 al 17 (VIS):** Número de serie lineal y único de la unidad saliendo de producción. [[1](https://www.gob.mx/segob/documentos/glosario-de-terminos-del-registro-publico-vehicular), [2](https://www.youtube.com/shorts/TXHGLkr2M3Y)]

------

4. Estructura de Datos Sugerida para las Tablas del ERP

Para estructurar tu base de datos relacional (ej. SQL), implementa los siguientes campos clave asociados al VIN:

1. `vin_id` (VARCHAR 17, Primary Key) -> Código completo validado.
2. `wmi_region` (VARCHAR 2) -> Extraído de dígitos 1-2 (País de origen).
3. `marca_id` (INT, Foreign Key) -> Cruzado mediante el dígito 2 y 3.
4. `tipo_vehiculo` (ENUM) -> Urbano, SUV, Pick-up, Camión, Maquinaria, Moto.
5. `combustible_tipo` (ENUM) -> Nafta, Diésel, Flex, Híbrido, Eléctrico.
6. `ano_modelo` (INT) -> Decodificado desde el dígito 10.
7. `origen_importacion` (ENUM) -> "0km Representante" o "Usado Importación Directa / Vía Iquique".
8. `chapa_paraguay` (VARCHAR 7, Nullable) -> Formato Mercosur actual o formato antiguo de la RUA.