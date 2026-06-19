---
aliases: ["Inicio", "Home", "Dashboard del Vault"]
tags:
  - moc
  - central
cssclass: centrar-moc
---

# 🎯 AutomotiveOS — Knowledge Graph

> *El grafo de conocimiento del ERP Automotriz más completo de Paraguay.*

---

## 🗺️ Mapas de Contenido

### Desarrollo
| MOC | Descripción | Estado |
|:---|:---|:---|
| [[MOC_Desarrollo_Core]] | Arquitectura, Backend, BD, API | 🟢 Activo |
| [[MOC_Integraciones]] | SIFEN, WhatsApp, CRM, Thinkcar | 🟢 Activo |
| [[MOC_Seguridad]] | Kill-Switch, Encriptación, Auditorías | 🟢 Activo |

### Operaciones
| MOC | Descripción | Estado |
|:---|:---|:---|
| [[MOC_Planificacion]] | Roadmap, Historias de Usuario, Sprints | 🟢 Activo |
| [[MOC_Manuales]] | Guías de usuario y flujos de trabajo | 🟢 Activo |
| [[MOC_Suite_Pruebas_QA]] | QA, Pentesting, Smoke Test E2E | 🟢 Activo |

### Fiscal
| MOC | Descripción | Estado |
|:---|:---|:---|
| [[MOC_Cumplimiento_Fiscal_SIFEN]] | DNIT V150, IVA, CDC, Contingencia | 🟢 Activo |
| [[MOC_Seguridad_Hardware]] | USB Token, Fingerprint, AES-256 | 🟢 Activo |

---

## 📊 Dashboard Dataview

### Componentes en Desarrollo o Bloqueados
```dataview
TABLE estado AS "Estado", capa AS "Capa", sprint AS "Sprint", responsable AS "Responsable"
FROM "200_Arquitectura_&_Core"
WHERE tipo = "modulo" OR tipo = "endpoint"
WHERE estado = "desarrollo" OR estado = "bloqueado"
SORT estado ASC, prioridad ASC
```

### Últimos Bugs Críticos
```dataview
TABLE severidad AS "Severidad", modulo_afectado AS "Módulo", estado_ticket AS "Estado", fecha_deteccion AS "Detectado"
FROM "600_QA_Calidad_&_Auditorias"
WHERE tipo = "bug" AND severidad = "critica"
SORT fecha_deteccion DESC
LIMIT 10
```

### Sprints Completados
```dataview
TABLE fase AS "Fase", tests_despues AS "Tests", hallazgos_seguridad AS "Hallazgos"
FROM "600_QA_Calidad_&_Auditorias"
WHERE tipo = "sprint" AND estado = "completado"
SORT id DESC
LIMIT 5
```

---

## 🔗 Navegación Rápida

- **¿Eres nuevo?** → Empieza por [[MOC_Planificacion]]
- **¿Desarrollas código?** → Ve a [[MOC_Desarrollo_Core]]
- **¿Configuras hardware?** → Revisa [[MOC_Seguridad_Hardware]]
- **¿Facturas?** → Consulta [[MOC_Cumplimiento_Fiscal_SIFEN]]
- **¿Eres mecánico?** → Ve a [[👨‍🔧_Guia_Mecanico]]
- **¿Eres cajero?** → Ve a [[💰_Guia_Cajero]]

---

## 📈 Métricas del Vault

| Métrica | Valor |
|:---|:---|
| **Sprints completados** | 59 |
| **Tests passing** | 1398 |
| **Archivos de código** | 63 |
| **Módulos del sistema** | 20+ |
| **Integraciones** | 5 (SIFEN, WhatsApp, CRM, Thinkcar, Backup) |
| **Última actualización** | 2026-06-19 |
