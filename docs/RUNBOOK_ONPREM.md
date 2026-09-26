# Runbook On-Prem — ERP Taller MCA

Guía operativa para el servidor on-prem del taller (backend Fastify + PostgreSQL,
SPA en `/dashboard`). El web Next.js administrativo se despliega en la nube
(Vercel/Railway) y NO se sirve desde este servidor.

## Visión general

- **Backend**: Fastify + TypeScript, corre como `erp-taller.service` (systemd), puerto 3000.
- **BD**: PostgreSQL 18, base `automotive_os`, usuario `erp_user`. pgvector instalado.
- **Auth on-prem**: login propio (`/api/auth/login`) → JWT HS256. Aislamiento multi-tenant
  por `tenant_slug` en app + Row Level Security (RLS) en la BD como defensa en profundidad.
- **LDAP/SSSD** (389 Directory Server): presente en el server original pero el código NO lo
  usa para auth de tenants. Se puede deshabilitar en el i3 (`--no-ldap`) para ahorrar RAM.
- **Red**: Tailscale para acceso remoto. Recomendado Ethernet cableado (no solo WiFi).

## Hardware objetivo (PC nuevo)

- Intel i3 / 8 GB RAM: suficiente (el server actual usa <1 GB; `MemoryMax=350M` en el service).
- SSD recomendado para `/data` (400 GB en el actual).
- Conectar `enp0s25` por cable; WiFi (`wlp*`) como respaldo.

## Instalación nueva (PC i3)

```bash
sudo ./scripts/provision-i3.sh --no-ldap
# o, para restaurar desde un dump previo:
sudo ./scripts/provision-i3.sh --no-ldap --restore /ruta/db-YYYY-MM-DD.dump
```

El script: instala node/postgres/nginx, crea la BD + extensión vector, clona el repo,
`npm ci`, `db:migrate`, aplica RLS, instala systemd (backend + backup + healthcheck),
nginx + TLS self-signed. Al final indica la password de BD generada.

## Actualización (server existente)

```bash
cd /data/ERP_Taller_Mca
git pull --ff-only
npm ci
npm run db:migrate
sudo -u postgres psql -d automotive_os -f scripts/apply-rls.sql
systemctl restart erp-taller
```

## Backup y restore

- Timer diario `erp-backup.timer` (03:00) corre `scripts/backup.sh`:
  dump `-Fc` en `/data/backups/daily/db-<fecha>.dump` + tar de storage/configs.
  Rotación: 30 diarios, 12 mensuales. Offsite si `OFFSITE_TARGET` está seteado.
- Restore:
  ```bash
  sudo -u postgres pg_restore -c -d automotive_os /data/backups/daily/db-<fecha>.dump
  ```

## TLS

- `scripts/setup-tls.sh` genera un cert self-signed en `/etc/erp-taller/tls/`.
- En producción reemplazalo por un cert real (CA interna del taller o Let's Encrypt).
  nginx lo lee de `/etc/erp-taller/tls/fullchain.pem` + `privkey.pem`.
- **SELinux (Fedora):** nginx (`httpd_t`) no puede conectar al backend en :3000 por
  defecto → 502 Bad Gateway. Habilitar: `setsebool -P httpd_can_network_connect on`
  (el script `provision-i3.sh` lo hace automáticamente).

## Monitoreo

- `erp-healthcheck.timer` cada 5 min hace `curl /health` y reinicia el backend si falla.
- Logs: `journalctl -u erp-taller -f`.
- Logrotate: `scripts/erp-app.logrotate` (placeholder si escribís a archivo).

## Seguridad multi-tenant (RLS)

- `scripts/apply-rls.sql` crea `public.current_tenant()` y habilita `FORCE ROW LEVEL SECURITY`
  en todas las tablas con `tenant_slug`/`tenant_id`, con política que permite fila si
  `app.current_tenant` coincide o está vacío (`''`). El `''` evita regresiones en rutas
  públicas/migraciones.
- Verificar: `SELECT count(*) FROM pg_policies WHERE schemaname='public';` (debe ser > 0).
- **Activación real por request**: el middleware `src/shared/middleware/rls.ts` hace
  `SET app.current_tenant` por request. Con el pool de `postgres` (autocommit), `SET LOCAL`
  se pierde antes de la query del tenant. Para aislamiento estricto, envolver el trabajo de
  BD del request en `sql.begin()` (transacción por request) o usar una conexión dedicada.
  Hasta entonces, el filtrado por `tenant_slug` en la app sigue siendo la capa principal.

## Migraciones de BD — aplicar y hacer rollback

- Las migraciones viven en `src/shared/database/migrations/` y se aplican con
  `npm run db:migrate` (`drizzle-kit migrate`). Los `.sql` son **forward-only**
  (no existe `down.sql` en drizzle-kit).
- **Orden**: `meta/_journal.json` define el orden de aplicación (`idx`). Si editás
  migraciones a mano, reordenalas ahí. Desde 2026-09 `0024_ingreso_checklist`
  está al final (se generó fuera de orden, entre `0012` y `0013`).
- **Estado aplicado**: se guarda por hash en `drizzle.__drizzle_migrations`.
  Reordenar el journal NO re-ejecuta nada en DBs ya migradas (el hash no cambia).
- **Rollback de una migración ya aplicada** (forward-only):
  1. Identificar los DDL del `.sql` objetivo y generar el SQL inverso a mano
     (p. ej. `ALTER TABLE ... DROP COLUMN`, `DROP TABLE ...`).
  2. Preferir restaurar desde backup si el cambio ya tocó datos:
     `pg_restore`/`psql` con el dump previo (ver `scripts/backup-*.sh`).
  3. ⚠️ No borrar la fila de `drizzle.__drizzle_migrations` sin re-aplicar el
     `.sql` luego, o el check de pendientes quedará inconsistente.
- **Migración falla en producción**: la transacción de drizzle-kit revierte ese
  paso; corregir el `.sql`, no editar el journal; re-correr `npm run db:migrate`.
- Antes de desplegar: `npm run db:generate` local contra la misma versión de
  schema y revisar que `db:check` pase con la BD disponible.

## Secretos obligatorios en `.env`

- `JWT_SECRET` — fuerte, obligatorio en producción (el arranque falla si falta).
- `TOKEN_SECRET` — fuerte, obligatorio en producción (firma tokens de hardware-lock;
  si falta usa un fallback inseguro y lo avisa en logs).
- `SIFEN_CERT_PATH` + `SIFEN_CERT_PASS` — cert .p12 de DNIT.
- Password de BD (`DATABASE_URL`).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — solo para el web en la nube.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — solo si se activa billing real.

## SIFEN (facturación electrónica Paraguay)

1. Obtener certificado `.p12` de DNIT (persona jurídica/RUC del taller).
2. Colocarlo en `/etc/sifen/cert.p12` y setear `SIFEN_CERT_PATH` + `SIFEN_CERT_PASS`.
3. `SIFEN_USE_TEST=true` para homologar en el entorno TEST de SIFEN; luego `false` en prod.
4. El firmado (`sifen-crypto.service`) y el SOAP (`sifen-soap.service`) ya están implementados;
   validar el ciclo completo (emitir → enviar → consultar → anular) en TEST antes de PROD.

## Red

- Conectar Ethernet cableado; verificar con `ip link show enp0s25`.
- Tailscale ya corre (`tailscaled.service`); confirmar `tailscale ip`.

## Troubleshooting

- **Servicio no arranca**: `journalctl -u erp-taller -n 50`; revisar `.env` y `DATABASE_URL`.
- **BD no conecta**: `systemctl status postgresql`; verificar que `postgresql` arrancó antes.
- **RLS bloquea consultas**: si una query legítima falla por RLS, confirmar que el middleware
  seteó `app.current_tenant`; para debug temporal podés correr `scripts/remove-rls.sql`.
- **Poco espacio**: `/data` es grande; los backups rotan solos. Limpiar `dist.bak/` si sobra.

## Checklist de producción

### P0 (crítico)
- [ ] Cert SIFEN real instalado + homologación en TEST y PROD.
- [ ] Red cableada (no solo WiFi) + Tailscale operativo.
- [ ] Backups automatizados verificados + copia offsite.
- [ ] Secretos (JWT_SECRET fuerte, password BD) configurados y fuera de git.

### P1 (alto)
- [ ] RLS activado por request (transacción por request) para aislamiento estricto.
- [ ] Suite de tests en verde + CI.
- [ ] TLS real (no self-signed) en nginx.
- [ ] Web Next.js desplegado en la nube con sus env vars.
- [ ] Resiliencia offline probada bajo red realmente mala.

### P2 (medio)
- [ ] Billing real (Stripe) si aplica.
- [ ] Contabilidad Ley 1034/83 completa (libro compras/ventas, retenciones).
- [ ] Integración Thinkcar/Launch con hardware real.
- [ ] Entrega real de portal cliente (SMTP/SMS).
- [ ] Monitoreo/observabilidad (logs estructurados, alertas).
- [ ] Deshabilitar 389/SSSD si no se usan (ahorra RAM en i3).
