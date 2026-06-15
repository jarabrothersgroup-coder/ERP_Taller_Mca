# Módulo Core del Taller — Workshop Core Module

Módulo central de gestión del taller automotriz para AutomotiveOS Cloud ERP.
Implementa el registro de vehículos, órdenes de trabajo, ingresos al taller y
trabajos de terceros, cumpliendo con la normativa paraguaya (Ley 1034/83,
DNIT SIFEN V150) y estándares de seguridad para vehículos eléctricos (EV/HEV).

## Arquitectura

```
src/modules/workshop/
├── schema/
│   ├── index.ts                 # Barrel export
│   ├── vehiculos.ts             # Drizzle schema — vehículos
│   ├── ordenes-trabajo.ts       # Drizzle schema — órdenes de trabajo
│   ├── ingresos.ts              # Drizzle schema — ingresos al taller
│   ├── trabajos-terceros.ts     # Drizzle schema — trabajos de terceros
│   └── relations.ts             # Relaciones centralizadas (evita imports circulares)
├── routes/
│   ├── index.ts                 # Route registration barrel
│   ├── ingresos.ts              # POST/GET /workshop/ingresos
│   └── trabajos-terceros.ts     # POST/GET /workshop/ordenes/:id/trabajos-terceros
├── services/
│   ├── ingreso.service.ts       # Check-in business logic
│   └── trabajo-tercero.service.ts  # Third-party work business logic
├── types.ts                     # Request/response DTOs
├── plugin.ts                    # Fastify plugin entry point
└── README.md                    # Esta documentación
```

## Tablas (Drizzle ORM + PostgreSQL)

### `vehiculos`

Registro maestro de vehículos del taller.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `UUID PK` | Primary key |
| `client_id` | `UUID FK → clients` | Propietario del vehículo |
| `plate` | `TEXT` | Chapa/patente |
| `vin` | `TEXT` | Número de chasis (VIN) |
| `brand` | `TEXT NOT NULL` | Marca (ej. Toyota, Volkswagen) |
| `model` | `TEXT NOT NULL` | Modelo (ej. Corolla, Amarok) |
| `year` | `SMALLINT` | Año de fabricación |
| `engine_type` | `ENUM` | **Nafta**, **Diésel**, **HEV**, **BEV** |
| `kilometraje` | `INTEGER` | Odómetro (km) |
| `hv_battery_voltage` | `REAL` | Voltaje nominal batería alto voltaje (HEV/BEV) |
| `hv_safety_disabled` | `BOOLEAN` | True si se realizó desconexión HV |
| `dtc_codes` | `TEXT[]` | Códigos de diagnóstico (DTC) |
| `notes` | `TEXT` | Observaciones |

### `ordenes_trabajo`

Órdenes de trabajo del taller.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `UUID PK` | Primary key |
| `vehicle_id` | `UUID FK → vehiculos` | Vehículo en servicio |
| `client_id` | `UUID FK → clients` | Cliente (desnormalizado para performance) |
| `status` | `ENUM` | **Presupuestado**, **Aprobado**, **En_Proceso**, **Control_Calidad**, **Listo** |
| `description` | `TEXT` | Descripción del trabajo |
| `diagnosis` | `TEXT` | Diagnóstico (LLM-asistido o mecánico) |
| `dtc_codes` | `TEXT[]` | Códigos DTC escaneados |
| `hv_alert` | `BOOLEAN` | Alerta de alto voltaje (HEV/BEV) |
| `total_cost` | `NUMERIC(10,2)` | Costo total estimado/final |

### `ingresos`

Registro de ingreso de vehículos al taller.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `UUID PK` | Primary key |
| `vehicle_id` | `UUID FK → vehiculos` | Vehículo que ingresa |
| `orden_trabajo_id` | `UUID FK → ordenes_trabajo` | OT asociada (opcional) |
| `fecha_ingreso` | `TIMESTAMPTZ` | Fecha/hora de ingreso |
| `kilometraje` | `INTEGER` | Odómetro al ingreso |
| `nivel_combustible` | `TEXT` | Nivel de combustible (ej. "1/4", "1/2") |
| `estado_exterior` | `TEXT` | Condición exterior (rayones, abolladuras) |
| `observaciones` | `TEXT` | Observaciones adicionales |

### `trabajos_terceros`

Trabajos subcontratados a terceros (pintura, AC, tornería, etc.).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `UUID PK` | Primary key |
| `orden_trabajo_id` | `UUID FK → ordenes_trabajo` | OT padre |
| `proveedor` | `TEXT NOT NULL` | Nombre del proveedor/taller externo |
| `descripcion` | `TEXT NOT NULL` | Descripción del trabajo |
| `costo` | `NUMERIC(10,2)` | Costo del tercero |
| `fecha_inicio` | `TIMESTAMPTZ` | Fecha de inicio |
| `fecha_fin` | `TIMESTAMPTZ` | Fecha de finalización |
| `estado` | `ENUM` | **Pendiente**, **En_Proceso**, **Completado** |

## Endpoints

### `POST /workshop/ingresos`

Registra el ingreso de un vehículo al taller. Opcionalmente crea una orden de trabajo.

**Body:**
```json
{
  "vehicleId": "uuid",
  "kilometraje": 50000,
  "nivelCombustible": "1/2",
  "estadoExterior": "Rayón en puerta trasera izquierda",
  "observaciones": "Cliente solicita revisión de frenos",
  "crearOrden": true,
  "descripcionTrabajo": "Revisión general + cambio de pastillas de freno"
}
```

**Response (201):**
```json
{
  "ingreso": { "id": "uuid", "vehicleId": "uuid", ... },
  "ordenTrabajo": { "id": "uuid", "status": "Presupuestado" }
}
```

### `GET /workshop/ingresos?vehicleId=<uuid>`

Lista los ingresos de un vehículo con la orden de trabajo asociada (JOIN).

### `POST /workshop/ordenes/:id/trabajos-terceros`

Asocia un trabajo de tercero a una orden de trabajo existente.

**Body:**
```json
{
  "proveedor": "Taller de Pintura El Chero",
  "descripcion": "Pintura completa de puerta delantera derecha",
  "costo": 450000,
  "fechaInicio": "2026-06-01T08:00:00Z",
  "fechaFin": "2026-06-03T17:00:00Z"
}
```

### `GET /workshop/ordenes/:id/trabajos-terceros`

Lista los trabajos de terceros asociados a una orden de trabajo.

## Prevención de N+1

Todas las consultas en los servicios utilizan una de las siguientes estrategias
para garantizar que **no existan queries N+1**:

- **JOINs explícitos** con `leftJoin` / `innerJoin` de Drizzle ORM
- **Eager loading** via Drizzle relations (`.with`)
- **PK-index lookups** para validación de existencia (O(1))
- **RETURNING** clauses que devuelven el row insertado en un solo viaje

## Impacto en RAM

- Las definiciones de rutas y schemas agregan ~15 KB al heap
- No se crean pools de conexión adicionales (se reutiliza el singleton lazy)
- Los services retornan DTOs planos (no árboles de entidades ORM completos)
- Límite de <50MB RAM se mantiene

## Instalación y Migración

```bash
# 1. Generar migración (ya ejecutado — archivo en src/shared/database/migrations/)
DATABASE_URL="postgresql://..." npx drizzle-kit generate

# 2. Aplicar migración a la base de datos
DATABASE_URL="postgresql://..." npx drizzle-kit push

# 3. (Opcional) Ver estado de la migración
DATABASE_URL="postgresql://..." npx drizzle-kit check
```

## Dependencias del Módulo

- `clients` — tabla compartida en `src/shared/database/schema/clients.ts`
- `postgres` — cliente PostgreSQL ligero (~3KB)
- `drizzle-orm` — ORM con tipado estricto
- `fastify-plugin` — encapsulación de plugins Fastify

## Tenant Isolation

El módulo utiliza el middleware `resolveTenant` (vía header `X-Tenant-Slug`)
para aislar los datos por taller. Cada tenant tiene su propio esquema
PostgreSQL (`tenant_<slug>`) con sus tablas de vehículos, órdenes, etc.
