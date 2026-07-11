# Infraestructura del Servidor — ERP Taller MCA

**Fecha de configuración:** Julio 2026  
**Servidor:** PCSERVER (Core 2 Duo E8400, 4GB RAM, Fedora 44)

---

## 1. Hardware

| Componente | Detalle |
|---|---|
| **CPU** | Intel Core 2 Duo E8400 @ 2.90GHz |
| **RAM** | 4GB DDR2 (3.9GB usable) |
| **Disco** | 466GB SATA (sda) |
| **Red** | WiFi 192.168.18.104/24 |
| **Tailscale** | 100.104.144.92 |

### Particiones (LVM)

| Montaje | Tamaño | Uso | Uso% |
|---|---|---|---|
| `/` (root) | 50GB | SO + aplicaciones | 12% |
| `/data` | 400GB | ERP, backups, archivos | 3% |
| swap | 3GB | zram swap | - |

---

## 2. Red

| Servicio | IP | Puerto | Protocolo |
|---|---|---|---|
| WiFi | 192.168.18.104 | - | DHCP |
| Tailscale | 100.104.144.92 | - | WireGuard |

### Firewall (firewalld)

| Puerto | Servicio | Estado |
|---|---|---|
| 80 | HTTP (Nginx) | ✅ Abierto |
| 3000 | Fastify ERP | ✅ Abierto |
| 389 | LDAP (389 DS) | ✅ Abierto |
| 636 | LDAPS (389 DS) | ✅ Abierto |
| 139 | Samba NetBIOS | ✅ Abierto |
| 445 | Samba SMB | ✅ Abierto |

---

## 3. Servicios

| Servicio | Puerto | Estado | Comando |
|---|---|---|---|
| **Fastify ERP** | 3000 | ✅ Activo | `systemctl status erp-taller` |
| **Nginx** | 80 | ✅ Activo | `systemctl status nginx` |
| **PostgreSQL** | 5432 | ✅ Activo | `systemctl status postgresql` |
| **389 DS** | 389/636 | ✅ Activo | `systemctl status dirsrv@erp-taller` |
| **Samba (smb/nmb)** | 139/445 | ✅ Activo | `systemctl status smb` |
| **Tailscale** | - | ✅ Activo | `tailscale status` |

### Fastify ERP

- **Binary:** `node --import tsx/esm src/app.ts`
- **Working Dir:** `/data/ERP_Taller_Mca`
- **Config:** `/etc/systemd/system/erp-taller.service`
- **Env:** `/data/ERP_Taller_Mca/.env`
- **RAM:** ~155MB RSS

### PostgreSQL

- **Versión:** 18.3
- **Base de datos:** `automotive_os`
- **Usuario:** `erp_user`
- **Autenticación:** Trust (local socket) / md5 (TCP)
- **SSL:** Deshabilitado (`sslmode=disable`)
- **Config:** `/var/lib/pgsql/data/postgresql.conf`
- **HBA:** `/var/lib/pgsql/data/pg_hba.conf`

### 389 Directory Server

- **Versión:** 3.2.2
- **Instancia:** `erp-taller`
- **Suffix:** `dc=taller,dc=mca,dc=py`
- **Config:** `/etc/dirsrv/slapd-erp-taller/`
- **Datos:** `/var/lib/dirsrv/slapd-erp-taller/`
- **Logs:** `/var/log/dirsrv/slapd-erp-taller/`

### Nginx

- **Config:** `/etc/nginx/nginx.conf`
- **Proxy:** Puerto 80 → Fastify:3000
- **Storage:** `/storage/` → `/data/erp-storage/`

---

## 4. Credenciales

### Acceso al Servidor

| Servicio | Usuario | Contraseña | Notas |
|---|---|---|---|
| **SSH** | `jara` | `202360` | sudo con password |
| **Root** | `root` | `202360` | vía sudo |

### Base de Datos

| Servicio | Usuario | Contraseña | Base |
|---|---|---|---|
| **PostgreSQL** | `erp_user` | `erp_prod_password` | `automotive_os` |
| **PostgreSQL** | `postgres` | - | Acceso local trust |

### Directorio LDAP (389 DS)

| Usuario | DN | Contraseña |
|---|---|---|
| **Directory Manager** | `cn=Directory Manager` | `TallerMCA2026!` |
| **Admin ERP** | `cn=Admin,ou=People,dc=taller,dc=mca,dc=py` | `AdminMCA2026!` |

### Samba (Archivos Compartidos)

| Usuario | Contraseña | Para |
|---|---|---|
| `taller` | `TallerMCA2026!` | Notebook Omarchy Linux |
| `admin` | `AdminMCA2026!` | i3 Windows |
| `jara` | `202360` | Admin general |

### ERP .env

```
DATABASE_URL=postgresql://erp_user:erp_prod_password@127.0.0.1:5432/automotive_os?sslmode=disable
JWT_SECRET=(configured)
NODE_ENV=production
STORAGE_PATH=/data/erp-storage
```

---

## 5. Estructura de Archivos

### Disco /data

```
/data/
├── ERP_Taller_Mca/          # Código fuente del ERP
│   ├── src/                  # Código TypeScript
│   ├── dist/                 # Build (descontinuado, usa tsx)
│   ├── node_modules/         # Dependencias
│   ├── scripts/backup/       # Scripts de backup
│   ├── configs/              # Configs guardadas
│   ├── docs/                 # Documentación
│   ├── storage/              # Archivos del ERP
│   └── .env                  # Variables de entorno
├── backups/                  # Sistema de backups
│   ├── daily/                # Snapshots rsync (hardlink)
│   ├── monthly/              # Archives mensuales tar.gz
│   ├── postgres/             # Dumps PostgreSQL
│   │   ├── daily/            # Dumps diarios
│   │   └── monthly/          # Dumps mensuales
│   └── logs/                 # Logs de backups
├── erp-storage/              # Storage del ERP
│   ├── fotos/                # Fotos de vehículos
│   ├── pdf/                  # PDFs generados
│   ├── backups/              # Backup del storage
│   ├── thinkcar/             # Diagnósticos Thinkcar
│   └── uploads/              # Uploads de usuarios
├── erp-app/                  # (reservado)
├── erp-frontend/             # (reservado)
└── compartido/               # Archivos compartidos (Samba)
    ├── Documentos/
    │   ├── Taller/
    │   ├── Administracion/
    │   ├── Facturas/
    │   └── Recepcion/
    ├── Imagenes/
    │   ├── Vehiculos/
    │   ├── DVI/
    │   └── Logos/
    ├── Videos/
    └── Compartido/
```

### Configs del SO

| Archivo | Descripción |
|---|---|
| `/etc/systemd/system/erp-taller.service` | Servicio Fastify |
| `/etc/nginx/nginx.conf` | Proxy reverso |
| `/var/lib/pgsql/data/postgresql.conf` | PostgreSQL |
| `/var/lib/pgsql/data/pg_hba.conf` | Auth PostgreSQL |
| `/etc/dirsrv/slapd-erp-taller/dse.ldif` | 389 DS |
| `/etc/samba/smb.conf` | Samba |
| `/etc/sudoers.d/erp-backup` | Sudoers para backups |

---

## 6. Backups

### Política

| Frecuencia | Tipo | Hora | Retención |
|---|---|---|---|
| L/M/V | Incremental (rsync) | 02:00 | 7 días |
| Día 1 | Mensual (tar.gz) | 01:00 | 12 meses |

### Qué se backupea

- **PostgreSQL:** `pg_dump` format, compresión gzip6
- **Filesystem:** rsync `--link-dest` (hardlink incrementals)
- **Config:** .env, 389 DS, Nginx, systemd, paquetes
- **LDAP:** Config de 389 DS (tar.gz)

### Comandos

```bash
# Ejecutar backup manual
bash /data/ERP_Taller_Mca/scripts/backup/backup-erp.sh

# Restaurar backup
bash /data/ERP_Taller_Mca/scripts/backup/restore-erp.sh 2026-07-08

# Ver logs de backup
cat /data/backups/logs/backup-2026-07-08-*.log
```

---

## 7. Samba — Archivos Compartidos

### Shares

| Share | Ruta | Permisos | Descripción |
|---|---|---|---|
| `Compartido` | `/data/compartido/Compartido` | Lectura/Escritura | Archivos compartidos |
| `Documentos` | `/data/compartido/Documentos` | Lectura/Escritura | Docs administrativos |
| `Imagenes` | `/data/compartido/Imagenes` | Lectura/Escritura | Fotos vehículos/DVI |
| `Videos` | `/data/compartido/Videos` | Lectura/Escritura | Videos inspección |
| `ERP-Storage` | `/data/erp-storage` | Solo Lectura | Storage del ERP |

### Conexión desde clientes

**Linux (Omarchy):**
```bash
# Explorar shares
smbclient -L //192.168.18.104 -U taller

# Conectar a un share
smbclient //192.168.18.104/Compartido -U taller

# Montar como unidad
sudo mount -t cifs //192.168.18.104/Documentos /mnt/documentos \
  -o username=taller,password=TallerMCA2026!,uid=$(id -u),gid=$(id -g)
```

**Windows:**
```
\\192.168.18.104\Compartido
\\192.168.18.104\Documentos
\\192.168.18.104\Imagenes
\\192.168.18.104\Videos
```
Usuario: `admin` / Contraseña: `AdminMCA2026!`

### SELinux

Los directorios `/data/compartido` y `/data/erp-storage` tienen contexto `samba_share_t`.

---

## 8. 389 Directory Server

### Estructura LDAP

```
dc=taller,dc=mca,dc=py
├── ou=People          # Usuarios del sistema
│   └── cn=Admin       # Administrador (admin@taller-mca.py)
├── ou=Groups          # Grupos del sistema
│   ├── cn=Mecanicos
│   ├── cn=Administrativos
│   └── cn=Clientes
├── ou=Vehicles        # Vehículos registrados
├── ou=Inventory       # Inventario de repuestos
└── ou=Services        # Servicios del taller
```

### Comandos útiles

```bash
# Estado
dsctl erp-taller status

# Buscar
ldapsearch -x -H ldap://127.0.0.1 -b 'dc=taller,dc=mca,dc=py' \
  -D 'cn=Directory Manager' -w 'TallerMCA2026!'

# Agregar usuario
ldapadd -x -H ldap://127.0.0.1 -D 'cn=Directory Manager' \
  -w 'TallerMCA2026!' -f usuario.ldif

# Backup
dsctl erp-taller db2bak
```

---

## 9. Comandos de Administración

### Estado del Sistema

```bash
# Verificar servicios
systemctl status erp-taller nginx postgresql smb nmb dirsrv@erp-taller

# Health check
curl http://127.0.0.1:3000/health

# Logs del ERP
journalctl -u erp-taller -f

# Uso de disco
df -h / /data

# Uso de RAM
free -h
ps aux --sort=-%mem | head -10
```

### Mantenimiento

```bash
# Actualizar ERP
cd /data/ERP_Taller_Mca && git pull origin main
sudo systemctl restart erp-taller

# Reiniciar todos los servicios
sudo systemctl restart erp-taller nginx postgresql smb nmb

# Backup manual
bash /data/ERP_Taller_Mca/scripts/backup/backup-erp.sh

# Limpiar logs viejos
journalctl --vacuum-time=30d
```

### Monitoreo

```bash
# Conexiones activas
ss -tlnp

# Procesos del ERP
ps aux | grep -E 'node|tsx' | grep -v grep

# Logs de errores
journalctl -u erp-taller -p err -n 50

# Audit log (SELinux)
sudo ausearch -m avc -ts recent
```

---

## 10. Troubleshooting

### ERP no responde

```bash
systemctl status erp-taller
journalctl -u erp-taller -n 20
sudo systemctl restart erp-taller
```

### PostgreSQL no conecta

```bash
systemctl status postgresql
sudo -u postgres psql -c "SELECT 1;"
# Verificar pg_hba.conf para auth
```

### Samba no funciona

```bash
systemctl status smb nmb
# Verificar SELinux
sudo ausearch -m avc -ts recent
# Reiniciar
sudo systemctl restart smb nmb
```

### LDAP no responde

```bash
dsctl erp-taller status
dsctl erp-taller restart
# Verificar logs
cat /var/log/dirsrv/slapd-erp-taller/errors
```

### Disco lleno

```bash
df -h / /data
du -sh /data/* | sort -rh | head -10
# Limpiar backups viejos
find /data/backups/daily -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
```

---

*Infraestructura documentada — ERP Taller MCA v1.0 — Julio 2026*
