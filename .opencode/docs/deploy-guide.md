# Guía de Despliegue — AutomotiveOS Cloud ERP

## Tabla de Variables de Entorno

| Variable                     | Obligatoria | Descripción                                          | Ejemplo                                                       |
|------------------------------|-------------|------------------------------------------------------|---------------------------------------------------------------|
| `DATABASE_URL`               | ✅           | Cadena de conexión PostgreSQL (pooler Supabase)      | `postgresql://postgres.proj:pass@aws-1.pooler.supabase.com:5432/postgres?sslmode=require` |
| `SUPABASE_URL`               | ✅           | URL del proyecto Supabase                            | `https://owzezszeeouqwabxtugn.supabase.co`                   |
| `SUPABASE_PUBLISHABLE_KEY`   | ✅           | Anon key de Supabase                                 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`                    |
| `SUPABASE_SERVICE_ROLE_KEY`  | ✅           | Service role key (solo server-side)                  | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`                    |
| `PORT`                       | ❌           | Puerto del servidor (default: 3000)                  | `3000`                                                        |
| `HOST`                       | ❌           | Host (default: 0.0.0.0)                              | `0.0.0.0`                                                     |
| `NODE_ENV`                   | ❌           | Entorno (development/production/test)                | `production`                                                  |
| `LOG_LEVEL`                  | ❌           | Nivel de log (default: info)                         | `warn`                                                        |
| `OPENAI_API_KEY`             | ❌           | API key para embeddings semánticos (RAG)             | `sk-proj-...`                                                 |
| `SIFEN_CERT_PATH`            | ❌           | Ruta al certificado PKCS#12 (.p12)                   | `/etc/ssl/sifen/certificate.p12`                              |
| `SIFEN_CERT_PASS`            | ❌           | Contraseña del certificado SIFEN                     | `password`                                                    |
| `SIFEN_USE_TEST`             | ❌           | Usar entorno de pruebas SIFEN (default: true)        | `true`                                                        |
| `SYNC_INTERVAL_MS`           | ❌           | Intervalo de sincronización offline (default: 30000) | `30000`                                                       |

## Puesta en Marcha Rápida

### En 30 segundos

```bash
# 1. Clonar e instalar
git clone <repo> && cd automotiveos-erp && npm install

# 2. Configurar .env (copiar template y editar)
cp .env.example .env
nano .env   # pegar DATABASE_URL + SUPABASE vars

# 3. Validar conexión y migrar
npm run db:validate && npm run db:migrate

# 4. Iniciar producción
npm run build && npm start
```

### Verificar que funciona

```bash
curl http://localhost:3000/health
# → {"status":"ok","database":"connected","memory":{"rss":"28.15 MB","heapUsed":"6.23 MB"}}
```

## Configuración de TVs (Modo Quiosco)

### Chromecast / Xiaomi Box / Android TV

1. Instalar **Kiosk Browser** o **Fully Kiosk Browser** desde Play Store.
2. Configurar URL de inicio: `http://[IP_DEL_SERVIDOR]:3000/api/v1/visual/tv`
3. Ajustes recomendados:
   - Rotación: forzar landscape
   - Barra de navegación: oculta
   - Timeout de pantalla: nunca apagar
   - Recargar página si hay error de conexión
4. La TV se conectará automáticamente al WebSocket y mostrará las OT en tiempo real.

### PC / Notebook (pruebas)

```bash
# Abrir en navegador
firefox http://localhost:3000/api/v1/visual/tv

# Verificar conexiones activas
curl http://localhost:3000/api/v1/visual/status
```

## Comandos de Mantenimiento

```bash
# Ver estado de la base de datos
curl http://localhost:3000/health

# Tests
npm test

# Type check
npm run check

# Limpiar compilación
npm run clean

# Reconstruir desde cero
npm run clean && npm run build && npm start
```

## Resolución de Problemas

| Síntoma                         | Causa probable                         | Solución                                      |
|---------------------------------|----------------------------------------|-----------------------------------------------|
| `ECONNREFUSED` en startup       | DB remota no accesible                 | Verificar DATABASE_URL, SSL, IP en Supabase   |
| WebSocket TV sin conectar       | Firewall bloqueando puerto 3000        | Permitir en firewall: `ufw allow 3000`        |
| Logo no se muestra en TV        | No se subió logo o ruta incorrecta     | `curl -X POST -F "file=@logo.png" /api/config/upload-logo` |
| RAG query no devuelve resultados| OPENAI_API_KEY faltante + no hay datos | Configurar API key o subir PDFs primero       |
| OT no pasa a "Listo"            | Vehículo HV sin lockout firmado        | Usar `POST /workshop/ordenes/:id/sign-lockout`|
