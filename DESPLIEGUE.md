# Guía de Despliegue — AutomotiveOS Cloud ERP

## 1. Requisitos del Sistema

- **Node.js** >= 20.0.0 (versión LTS recomendada: 22.x)
- **Sistema operativo**: Linux (probado en Arch Linux, Ubuntu 22.04+, Debian 12)
- **Conexión a Internet**: necesaria para base de datos remota (Supabase/Neon)
- **Red local**: conmutador/switch con puertos libres para conectar TVs del taller

---

## 2. IP Fija Local (para conexión de TVs)

Las TVs del taller (Sala de Espera y Bahía del Mecánico) se conectan al WebSocket del servidor.  
Para que las encuentren siempre en la misma dirección, se debe configurar una **IP fija local**.

### 2.1 Via NetworkManager (Interfaz Gráfica / GNOME / KDE)

```bash
nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses 192.168.1.100/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "8.8.8.8 1.1.1.1"

nmcli connection down "Wired connection 1"
nmcli connection up "Wired connection 1"
```

Verificar:

```bash
ip addr show | grep 192.168.1
```

### 2.2 Via systemd-networkd

Crear `/etc/systemd/network/20-wired.network`:

```ini
[Match]
Name=eth0

[Network]
Address=192.168.1.100/24
Gateway=192.168.1.1
DNS=8.8.8.8
DNS=1.1.1.1
```

Reiniciar:

```bash
sudo systemctl restart systemd-networkd
```

### 2.3 Asignación en el Router (DHCP Reservation)

Alternativamente, acceder al panel del router (generalmente `http://192.168.1.1`) y crear una **reserva DHCP** para la MAC de la notebook. Así la IP nunca cambia aunque se use DHCP.

### Notas

- Elegir una IP fuera del rango DHCP del router para evitar conflictos (ej. `.100` a `.200`)
- La IP elegida debe estar en la **misma subred** que las TVs
- Verificar conectividad: `ping 192.168.1.100` desde otra máquina

---

## 3. Configuración de Producción

### 3.1 Variables de Entorno

Crear `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Ajustar para producción:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=warn
```

El resto de variables (DATABASE_URL, SUPABASE_*) deben completarse con los valores reales.

### 3.2 Compilar

```bash
npm run build
```

Esto genera los archivos compilados en `dist/`.

### 3.3 Iniciar Servidor (Producción)

```bash
npm run start:prod
```

Este comando usa las siguientes optimizaciones de memoria:

| Flag | Efecto |
|---|---|
| `--max-old-space-size=50` | Limita el heap de V8 a 50 MB |
| `--optimize-for-size` | Prioriza baja memoria sobre velocidad |
| `--gc-interval=100` | Recolecta basura cada 100ms en idle |

El servidor arranca en `http://0.0.0.0:3000`.

### 3.4 Verificar

```bash
curl http://localhost:3000/health
# Respuesta esperada:
# {"status":"ok","uptime":...,"database":"connected","version":"0.1.0"}
```

---

## 4. Servicio systemd (Auto-Inicio al Encender)

Para que el servidor arranque automáticamente al iniciar la notebook, crear el servicio:

```bash
sudo nano /etc/systemd/system/automotiveos.service
```

```ini
[Unit]
Description=AutomotiveOS Cloud ERP
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=jara
WorkingDirectory=/home/jara/Projects/ERP_Taller_Mca
ExecStart=/usr/bin/node --max-old-space-size=50 --optimize-for-size --gc-interval=100 dist/app.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=3000
Environment=LOG_LEVEL=warn
# Timeout para shutdown graceful
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
```

> **Nota**: Las variables sensibles (DATABASE_URL, SUPABASE_*) se cargan desde el archivo `.env` automáticamente. Si se prefiere, se pueden pasar como `Environment=` en el servicio.

Habilitar e iniciar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable automotiveos.service
sudo systemctl start automotiveos.service

# Ver logs
journalctl -u automotiveos.service -f
```

---

## 5. Conexión de TVs del Taller

### 5.1 Sala de Espera (Quiosco TV)

En el navegador de la TV (Chromecast, Xiaomi Box, o Smart TV), abrir:

```
http://192.168.1.100:3000/api/v1/visual/tv
```

La TV se conectará automáticamente al WebSocket y mostrará el progreso de los vehículos en tiempo real.

### 5.2 Dashboard desde Notebook / Tablet

```
http://192.168.1.100:3000/dashboard
```

### 5.3 Verificar TVs Conectadas

```bash
curl http://192.168.1.100:3000/api/v1/visual/status
# {"connectedScreens":2,"uptime":1234.56}
```

---

## 6. Mantenimiento

### 6.1 Migraciones de Base de Datos

```bash
npm run db:migrate
```

### 6.2 Seed de Datos de Prueba

```bash
npm run build
npx tsx src/shared/database/seed.ts taller-el-chero
```

### 6.3 Logs

En producción los logs son JSON (sin `pino-pretty`). Ver con `journalctl` si se usa systemd:

```bash
journalctl -u automotiveos.service -f -o cat
```

### 6.4 Actualización

```bash
cd ~/Projects/ERP_Taller_Mca
git pull
npm install
npm run build
sudo systemctl restart automotiveos.service
```

---

## 7. Solución de Problemas

| Síntoma | Causa | Solución |
|---|---|---|
| Las TVs no se conectan | IP cambiada | Verificar IP fija: `ip a` |
| WebSocket desconecta | Firewall bloqueando puerto 3000 | `sudo ufw allow 3000` |
| Error de memoria | Heap excedido | Reducir `--max-old-space-size` |
| DB no conecta | .env sin DATABASE_URL | Verificar `.env` |
| 403 Forbidden | Falta X-Tenant-Slug | Usar header en requests |
