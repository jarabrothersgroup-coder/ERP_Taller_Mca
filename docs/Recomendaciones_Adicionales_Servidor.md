# Recomendaciones Adicionales — Servidor PYME Fedora 44

**Fecha:** Julio 2026  
**Servidor:** PCSERVER (Core 2 Duo, 4GB RAM, Fedora 44)  
**Investigación:** Manuales Fedora, Red Hat, comunidad Linux

---

## Resumen Ejecutivo

El servidor actual funciona bien, pero hay **7 áreas críticas** que la "comunidad recomienda" configurar y que aún no están implementadas:

| Prioridad | Área | Impacto | Esfuerzo |
|---|---|---|---|
| 🔴 Alta | Fail2ban (protección SSH) | Seguridad | 5 min |
| 🔴 Alta | Actualizaciones automáticas | Seguridad | 5 min |
| 🟡 Media | Sysctl tuning (rendimiento) | Rendimiento | 10 min |
| 🟡 Media | Monitoreo ligero | Visibilidad | 10 min |
| 🟡 Media | Logrotate optimizado | Mantenimiento | 5 min |
| 🟢 Baja | AIDE (integridad de archivos) | Seguridad | 10 min |
| 🟢 Baja | NTP/Chrony (sincronización) | Precisión | 5 min |

---

## 1. 🔴 Fail2ban — Protección contra Brute Force

**¿Por qué?** Los bots escanean IPs constantemente. Sin fail2ban, el servidor recibe cientos de intentos de login fallidos por día.

```bash
# Instalar
sudo dnf install -y fail2ban

# Crear configuración local
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
banaction = firewallcmd-rich-rules[actiontype=<multiport>]
banaction_allports = firewallcmd-rich-rules[actiontype=<allports>]

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/secure
maxretry = 3
bantime = 86400
EOF

# Habilitar e iniciar
sudo systemctl enable --now fail2ban

# Verificar
sudo fail2ban-client status sshd
```

**Resultado:** IPs con 3+ intentos fallidos son baneadas 24 horas automáticamente.

---

## 2. 🔴 Actualizaciones Automáticas de Seguridad

**¿Por qué?** Fedora tiene parches de seguridad frecuentes. Sin auto-updates, el servidor queda vulnerable.

```bash
# Instalar dnf-automatic
sudo dnf install -y dnf-automatic

# Configurar para solo seguridad
sudo tee /etc/dnf/automatic.conf << 'EOF'
[commands]
upgrade_type = security
random_sleep = 3600
download_updates = yes
apply_updates = yes

[emitters]
system_name = PCSERVER
emit_via = stdio

[email]
email_from = root@pcserver
email_to = admin@taller-mca.py
email_host = localhost
EOF

# Habilitar timer
sudo systemctl enable --now dnf-automatic.timer

# Verificar
sudo systemctl status dnf-automatic.timer
```

**Resultado:** Parches de seguridad se instalan automáticamente cada día.

---

## 3. 🟡 Sysctl Tuning — Optimización para 4GB RAM

**¿Por qué?** Los defaults del kernel son genéricos. Para un servidor con 4GB RAM, hay que ajustar parámetros de red y memoria.

```bash
# Crear archivo de tuning
sudo tee /etc/sysctl.d/99-erp-tuning.conf << 'EOF'
# === MEMORIA (4GB RAM) ===
# No hacer swap agresivamente (default: 60 es muy alto)
vm.swappiness = 10

# Mantener más cache de directorios/inodos
vm.vfs_cache_pressure = 50

# Limitar páginas sucias (protege contra pérdida de datos)
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# === RED ===
# Cola de conexiones más grande (default: 128)
net.core.somaxconn = 65535

# Backlog SYN más grande
net.ipv4.tcp_max_syn_backlog = 8192

# Reusar sockets TIME_WAIT
net.ipv4.tcp_tw_reuse = 1

# Reducir tiempo FIN_WAIT
net.ipv4.tcp_fin_timeout = 15

# Keepalive más agresivo (detectar conexiones muertas)
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5

# Rango de puertos efímeros más grande
net.ipv4.ip_local_port_range = 1024 65535

# BBR congestion control (mejor que cubic)
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq

# === SEGURIDAD ===
# Restringir punteros del kernel
kernel.kptr_restrict = 2

# Restringir dmesg a root
kernel.dmesg_restrict = 1

# Deshabilitar core dumps
fs.suid_dumpable = 0

# Prevenir IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Deshabilitar redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0

# Proteger symlinks y hardlinks
fs.protected_symlinks = 1
fs.protected_hardlinks = 1
EOF

# Aplicar
sudo sysctl --system

# Verificar
sysctl vm.swappiness net.core.somaxconn net.ipv4.tcp_congestion_control
```

**Resultado:** Mejor rendimiento de red, menos swap, más seguridad.

---

## 4. 🟡 Monitoreo Ligero

**¿Por qué?** Sin monitoreo, no sabés qué está pasando hasta que algo se rompe.

### Opción A: Glances (más ligero)

```bash
# Instalar
pip3 install --user glances[docker]

# Ejecutar
glances

# Como servicio
sudo tee /etc/systemd/system/glances.service << 'EOF'
[Unit]
Description=Glances System Monitor
After=network.target

[Service]
Type=simple
User=jara
ExecStart=/home/jara/.local/bin/glances -w -B 127.0.0.1
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now glances
```

**Acceso:** `http://127.0.0.1:61208`

### Opción B: Script de monitoreo manual

```bash
# Crear script
tee ~/bin/system-status.sh << 'SCRIPT'
#!/bin/bash
echo "═══ System Status — $(date) ═══"
echo ""
echo "📊 CPU:"
uptime
echo ""
echo "💾 RAM:"
free -h
echo ""
echo "💿 Disco:"
df -h / /data
echo ""
echo "🔌 Servicios:"
for svc in erp-taller nginx postgresql smb dirsrv@erp-taller; do
    status=$(systemctl is-active $svc 2>/dev/null || echo "inactive")
    printf "  %-20s %s\n" "$svc" "$status"
done
echo ""
echo "🌐 Conexiones:"
ss -s
SCRIPT

chmod +x ~/bin/system-status.sh
```

---

## 5. 🟡 Logrotate Optimizado

**¿Por qué?** Sin rotación, los logs llenan el disco.

```bash
# Configurar logrotate para el ERP
sudo tee /etc/logrotate.d/erp-taller << 'EOF'
/data/backups/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 jara jara
}

/var/log/samba/log.* {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}

/var/lib/pgsql/data/pg_log/postgresql-*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0600 postgres postgres
    sharedscripts
    postrotate
        /usr/bin/pg_ctl reload -D /var/lib/pgsql/data > /dev/null 2>&1 || true
    endscript
}
EOF

# Verificar
sudo logrotate -d /etc/logrotate.d/erp-taller
```

---

## 6. 🟢 AIDE — Integridad de Archivos

**¿Por qué?** Detecta si alguien modificó archivos del sistema (rootkits, backdoors).

```bash
# Instalar
sudo dnf install -y aide

# Inicializar base de datos
sudo aide --init
sudo cp /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz

# Verificar
sudo aide --check

# Timer diario
sudo tee /etc/systemd/system/aide-check.service << 'EOF'
[Unit]
Description=AIDE File Integrity Check
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/sbin/aide --check
User=root
EOF

sudo tee /etc/systemd/system/aide-check.timer << 'EOF'
[Unit]
Description=Daily AIDE Check

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl enable --now aide-check.timer
```

---

## 7. 🟢 Chrony — Sincronización de Hora

**¿Por qué?** La hora incorrecta rompe TLS, logs, y facturación electrónica.

```bash
# Verificar estado
chronyc tracking

# Si no está corriendo
sudo systemctl enable --now chronyd

# Verificar sincronización
chronyc sources -v
```

---

## 8. Servicios Innecesarios a Deshabilitar

**¿Por qué?** Cada servicio corriendo es superficie de ataque.

```bash
# Deshabilitar servicios innecesarios
sudo systemctl disable --now avahi-daemon 2>/dev/null
sudo systemctl disable --now cups 2>/dev/null
sudo systemctl mask --now bluetooth 2>/dev/null

# Verificar servicios activos
systemctl list-units --type=service --state=running
```

---

## 9. Configuración SSH Segura

```bash
# Crear drop-in (sobrevive actualizaciones de paquetes)
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf << 'EOF'
# No login como root
PermitRootLogin no

# Solo autenticación por clave
PasswordAuthentication no
PubkeyAuthentication yes

# Limitar intentos
MaxAuthTries 3
MaxSessions 3
LoginGraceTime 30

# Logging verbose
LogLevel VERBOSE

# Banner
Banner /etc/ssh/banner

# Timeout
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Crear banner
sudo tee /etc/ssh/banner << 'EOF'
*********************************************
* ACCESO RESTRINGIDO — ERP Taller MCA      *
* Solo usuarios autorizados                *
* Todas las sesiones son monitoreadas      *
*********************************************
EOF

# Reiniciar SSH (⚠️ verificar que tengas otra terminal abierta)
sudo systemctl restart sshd
```

---

## 10. ClamAV — Antivirus

**¿Por qué?** Los talleres reciben archivos de clientes (DTCs, fotos, PDFs). Un antivirus ligero protege contra malware.

```bash
# Instalar
sudo dnf install -y clamav clamav-update

# Actualizar bases de datos
sudo freshclam

# Escaneo manual
sudo clamscan -r /data/erp-storage/

# Timer semanal
sudo tee /etc/systemd/system/clamscan.service << 'EOF'
[Unit]
Description=ClamAV Antivirus Scan

[Service]
Type=oneshot
ExecStart=/usr/bin/clamscan -r --bell --move=/tmp/clamscan-quarantine /data/erp-storage/
EOF

sudo tee /etc/systemd/system/clamscan.timer << 'EOF'
[Unit]
Description=Weekly ClamAV Scan

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl enable --now clamscan.timer
```

---

## Resumen de Implementación

| # | Tarea | Comando rápido | Tiempo |
|---|---|---|---|
| 1 | Fail2ban | `sudo dnf install -y fail2ban && sudo systemctl enable --now fail2ban` | 5 min |
| 2 | Auto-updates | `sudo dnf install -y dnf-automatic && sudo systemctl enable --now dnf-automatic.timer` | 5 min |
| 3 | Sysctl tuning | `sudo tee /etc/sysctl.d/99-erp-tuning.conf ...` | 10 min |
| 4 | Monitoreo | `pip3 install --user glances` | 10 min |
| 5 | Logrotate | `sudo tee /etc/logrotate.d/erp-taller ...` | 5 min |
| 6 | AIDE | `sudo dnf install -y aide && sudo aide --init` | 10 min |
| 7 | Chrony | `sudo systemctl enable --now chronyd` | 2 min |
| 8 | Servicios | `sudo systemctl disable --now avahi-daemon cups` | 3 min |
| 9 | SSH hardening | `sudo tee /etc/ssh/sshd_config.d/99-hardening.conf ...` | 5 min |
| 10 | ClamAV | `sudo dnf install -y clamav && sudo freshclam` | 10 min |

**Tiempo total estimado: ~65 minutos**

---

## Referencias

- Fedora Server Hardening: https://fedorafaq.com/en/how-to-harden-a-fedora-server-complete-security-checklist/
- Fedora Hardening Guide (27 docs): https://github.com/NexusOne23/linux-fedora-hardening-guide
- ComputingForGeeks Fedora 44: https://computingforgeeks.com/security-hardening-fedora/
- sysctl Tuning: https://sumguy.com/sysctl-linux-performance-tuning/
- OpenSCAP Security Guide: https://complianceascode.github.io/content-pages/guides/ssg-fedora-guide-cis_server_l1.html

---

*Documento generado por investigación — ERP Taller MCA v1.0*
