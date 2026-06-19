# Guía de Instalación — AutomotiveOS Cloud ERP

## Requisitos Previos

- [Docker](https://docs.docker.com/get-docker/) v24+ y Docker Compose v2
- [Node.js](https://nodejs.org/) v22+ (solo para desarrollo local sin Docker)
- [Git](https://git-scm.com/)

## Opción 1: Docker (Recomendado)

### Paso 1: Clonar y configurar

```bash
git clone <repository-url>
cd ERP_Taller_Mca

# Crear archivo .env desde la plantilla
cp .env.example .env

# Editar .env con tus valores reales
# Minimum required changes:
#   - POSTGRES_PASSWORD (cambiar por contraseña segura)
#   - WHATSAPP_API_KEY (generar una clave aleatoria)
#   - TWENTY_API_KEY (obtener de Twenty CRM después del primer levantamiento)
```

### Paso 2: Levantar el ecosistema

```bash
# Levantar todo (PostgreSQL + Twenty CRM + Evolution API + ERP)
docker compose up -d

# Verificar que todos los contenedores estén corriendo
docker compose ps

# Ver logs en tiempo real
docker compose logs -f
```

### Paso 3: Configurar Twenty CRM

1. Abrir **http://localhost:3001** en el navegador
2. Seguir el wizard de configuración inicial de Twenty
3. Crear un usuario administrador
4. Ir a **Settings → API Keys** y generar una API key
5. Copiar la API key al archivo `.env` en `TWENTY_API_KEY`
6. Reiniciar el ERP: `docker compose restart erp`

### Paso 4: Conectar WhatsApp

1. Abrir el ERP en **http://localhost:3000**
2. Ir a **Configuración → WhatsApp**
3. Hacer clic en **"Conectar Dispositivo"**
4. Escanear el código QR con WhatsApp (Menú → Dispositivos vinculados)
5. Verificar que el estado cambie a "Conectado"

### Paso 5: Verificar

```bash
# Health check del ERP
curl http://localhost:3000/api/v1/health

# Verificar conexión a Twenty CRM
curl -X GET http://localhost:3000/api/v1/crm/status \
  -H "X-Tenant-Slug: taller-el-chero"

# Verificar estado de WhatsApp
curl -X GET http://localhost:3000/api/v1/whatsapp/status \
  -H "X-Tenant-Slug: taller-el-chero"
```

## Opción 2: Desarrollo Local (sin Docker)

### Paso 1: Instalar dependencias

```bash
npm install
```

### Paso 2: Configurar base de datos

```bash
# Necesitas una base de datos PostgreSQL remota (Neon/Supabase)
# Configurar DATABASE_URL en .env

# Ejecutar migraciones
npm run db:migrate
```

### Paso 3: Configurar servicios externos

Editar `.env` con las URLs de tus servicios:

```env
# Si Twenty CRM está corriendo localmente
TWENTY_API_URL=http://localhost:3001
TWENTY_API_KEY=tu-api-key-de-twenty

# Si Evolution API está corriendo localmente
WHATSAPP_API_URL=http://localhost:8080
WHATSAPP_API_KEY=tu-api-key-de-evolution
```

### Paso 4: Iniciar el servidor

```bash
# Desarrollo con hot-reload
npm run dev

# Producción
npm run build
npm start
```

## Estructura de Servicios

```
┌─────────────────────────────────────────────────────┐
│                   Docker Network                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ PostgreSQL│  │  Redis   │  │  Evolution API   │  │
│  │  :5432   │  │  :6379   │  │     :8080        │  │
│  └────┬─────┘  └──────────┘  └────────┬─────────┘  │
│       │                                │            │
│  ┌────┴────────────────────────────────┴─────────┐  │
│  │              ERP Backend (Fastify)             │  │
│  │                    :3000                       │  │
│  └────┬──────────────────────────────────────────┘  │
│       │                                             │
│  ┌────┴─────────────┐                               │
│  │   Twenty CRM     │                               │
│  │     :3001        │                               │
│  └──────────────────┘                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## URLs de Servicio

| Servicio        | URL                          | Descripción               |
|-----------------|------------------------------|---------------------------|
| ERP             | http://localhost:3000         | API + Frontend            |
| Twenty CRM      | http://localhost:3001         | CRM UI                   |
| Evolution API   | http://localhost:8080         | WhatsApp Gateway          |
| PostgreSQL      | localhost:5432               | Base de datos             |
| Redis           | localhost:6379               | Cache (Twenty)            |

## Comandos Útiles

```bash
# Ver estado de contenedores
docker compose ps

# Ver logs de un servicio específico
docker compose logs -f erp
docker compose logs -f evolution-api
docker compose logs -f twenty-crm

# Reiniciar un servicio
docker compose restart erp

# Parar todo
docker compose down

# Parar y eliminar volúmenes (⚠️ borra datos)
docker compose down -v

# Reconstruir el ERP después de cambios
docker compose build erp
docker compose up -d erp
```

## Solución de Problemas

### WhatsApp no conecta
1. Verificar que Evolution API esté corriendo: `docker compose logs evolution-api`
2. Verificar que `WHATSAPP_API_KEY` coincida entre ERP y Evolution API
3. Verificar que el puerto 8080 no esté bloqueado

### Twenty CRM no responde
1. Verificar que Twenty esté corriendo: `docker compose logs twenty-crm`
2. Verificar que Redis esté corriendo: `docker compose logs redis`
3. Verificar la API key en Settings → API Keys de Twenty

### ERP no inicia
1. Verificar que PostgreSQL esté listo: `docker compose logs postgres`
2. Verificar `DATABASE_URL` en `.env`
3. Verificar que el puerto 3000 no esté en uso

### Errores de integración
Los errores de WhatsApp/CRM se registran en `whatsapp_errors_log` sin bloquear el ERP.
Verificar errores: `GET /api/v1/whatsapp/errors` con header `X-Tenant-Slug`.
