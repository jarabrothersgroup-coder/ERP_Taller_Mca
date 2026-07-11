# Referencia Rápida — ERP Taller MCA

## Atajos de Teclado

| Acción | Atajo |
|---|---|
| Buscar | `Ctrl + K` |
| Nueva OT | `Ctrl + N` |
| Guardar | `Ctrl + S` |
| Imprimir | `Ctrl + P` |
| Volver | `Esc` |

## Flujo de Trabajo Diario

### Mañana (8:00 AM)
1. Revisar **Citas del día**
2. Verificar **OTs activas**
3. Revisar **Inventario** (alertas de stock)

### Durante el día
1. **Ingresar** nuevos vehículos
2. **Diagnosticar** y generar presupuestos
3. **Actualizar** estado de OTs
4. **Facturar** trabajos finalizados

### Cierre (5:00 PM)
1. Revisar **Ingresos del día**
2. Verificar **Pagos pendientes**
3. Programar **Citas del día siguiente**

## Estados de OT

```
INGRESADO → EN_DIAGNOSTICO → PRESUPUESTADO → APROBADO → EN_REPARACION → FINALIZADO → RETIRADO
```

## Contactos de Soporte

- **Email:** soporte@taller-mca.py
- **WhatsApp:** +595 XXX XXX XXX
- **Horario:** L-V 8:00 - 17:00

## URLs Importantes

| Recurso | URL |
|---|---|
| ERP Principal | http://192.168.18.104 |
| Dashboard | http://192.168.18.104/dashboard |
| Portal Clientes | http://192.168.18.104/portal |
| API Health | http://192.168.18.104/health |

## Credenciales de Servidor

| Servicio | Usuario | Contraseña |
|---|---|---|
| SSH | jara | 202360 |
| Samba (Taller) | taller | TallerMCA2026! |
| Samba (Admin) | admin | AdminMCA2026! |
| PostgreSQL | erp_user | erp_prod_password |
| LDAP | cn=Directory Manager | TallerMCA2026! |

---

*Referencia rápida — ERP Taller MCA v1.0*
