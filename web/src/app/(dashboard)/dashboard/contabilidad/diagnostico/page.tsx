"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Stethoscope,
  Scale,
  ListChecks,
  ShieldQuestion,
  Zap,
  Calculator,
  History,
  Landmark,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { api, type CuentaContable } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/* ─── Types ──────────────────────────────────── */

interface CuadraturaDetalle {
  asientoId: string;
  numero: number;
  fecha: string;
  concepto: string;
  totalDebe: string;
  totalHaber: string;
  diferencia: string;
  balanceado: boolean;
}

interface CuadraturaReport {
  periodo: { anho: number; mes: number };
  totalAsientos: number;
  asientosBalanceados: number;
  asientosDesbalanceados: number;
  sumaDebe: string;
  sumaHaber: string;
  diferenciaGlobal: string;
  balanceado: boolean;
  detalles: CuadraturaDetalle[];
}

interface CuentaMapping {
  id: string;
  modulo: string;
  tipoEvento: string;
  subTipo: string | null;
  cuentaDebeId: string;
  cuentaHaberId: string;
  descripcion: string | null;
  activo: boolean;
  prioridad: number;
}

interface ValidacionResultado {
  valido: boolean;
  errores: string[];
  advertencias: string[];
  mapping?: {
    cuentaDebeCodigo: string;
    cuentaDebeNombre: string;
    cuentaHaberCodigo: string;
    cuentaHaberNombre: string;
  };
}

interface AuditEntry {
  id: string;
  usuarioId: string | null;
  ip: string | null;
  accion: string;
  entidad: string;
  entidadId: string;
  valorAnterior: unknown;
  valorNuevo: unknown;
  descripcion: string | null;
  createdAt: string;
}

interface AsientoResultado {
  asiento: {
    id: string;
    numero: number;
    fecha: string;
    concepto: string;
    totalDebe: string;
    totalHaber: string;
    estado: string;
  };
  lineas: Array<{
    id: string;
    cuentaCodigo: string;
    cuentaNombre: string;
    debe: string;
    haber: string;
  }>;
}

interface AccrualResult {
  success: boolean;
  asientoId: string | null;
  asientoNumero: number | null;
  totalDebe: string;
  totalHaber: string;
  conceptos: string[];
}

interface ActivoFijoDetalle {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  fechaAdquisicion: string;
  costoAdquisicion: string;
  valorResidual: string;
  vidaUtilAnos: number;
  metodoDepreciacion: string;
  valorActualLibros: string;
  depreciacionAcumulada: string;
  ultimaDepreciacion: string | null;
  estado: string;
  activo: boolean;
  notas: string | null;
}

interface OTProfitability {
  ordenId: string;
  numero?: string;
  clientName: string;
  vehicleInfo: string;
  status: string;
  ingresos: { totalFacturado: number; facturaCount: number };
  costos: { repuestos: number; trabajosTerceros: number; comisiones: number; totalDirectos: number };
  margen?: number;
  margenPorcentaje?: number;
}

interface ClientProfitability {
  clientId: string;
  clientName: string;
  ruc?: string;
  totalOTs: number;
  totalFacturado: number;
  totalCostosDirectos: number;
  margenBruto: number;
  margenPorcentaje: number;
  ultimaOT: string | null;
}

interface MechanicProfitability {
  mechanicProfileId: string;
  mechanicName: string;
  category: string;
  totalComisiones: number;
  totalOTs: number;
  totalLaborGenerado: number;
  comisionPromedio: number;
}

interface PeriodoProfitability {
  anho: number;
  mes: number;
  resumen: {
    totalOTs: number;
    totalFacturado: number;
    totalCostos: number;
    margenBruto: number;
    margenPorcentaje: number;
    totalComisiones: number;
    totalRepuestos: number;
    totalTerceros: number;
  };
  topOTs: OTProfitability[];
  topMecanicos: MechanicProfitability[];
}

interface LibroIVAReport {
  periodo: { anho: number; mes: number };
  totalEntradas: number;
  totalCompras?: string;
  totalVentas?: string;
  totalIVA: string;
  entries: unknown[];
}

/* ─── Page ───────────────────────────────────── */

export default function ContabilidadDiagnosticoPage() {
  const { toast: t, ToastContainer } = useToast();

  // ── 1. Cuadratura ──
  const now = new Date();
  const [cuadAnho, setCuadAnho] = React.useState(now.getFullYear());
  const [cuadMes, setCuadMes] = React.useState(now.getMonth() + 1);
  const cuadraturaQuery = useQuery<CuadraturaReport>({
    queryKey: ["contab-cuadratura", cuadAnho, cuadMes],
    queryFn: () => api.request(`/finance/contabilidad/cuadratura/${cuadAnho}/${cuadMes}`),
  });

  // ── 2. Mappings ──
  const [moduloFilter, setModuloFilter] = React.useState("");
  const mappingsQuery = useQuery<CuentaMapping[]>({
    queryKey: ["contab-mappings", moduloFilter],
    queryFn: () =>
      api.request<CuentaMapping[]>(
        moduloFilter
          ? `/finance/contabilidad/mappings?modulo=${encodeURIComponent(moduloFilter)}`
          : "/finance/contabilidad/mappings",
      ),
  });

  // ── 3. Validar pre-transacción ──
  const [valForm, setValForm] = React.useState({
    modulo: "workshop",
    tipoEvento: "",
    subTipo: "",
    monto: "",
  });
  const validarResult = useQuery<ValidacionResultado>({
    queryKey: ["contab-validar", valForm.modulo, valForm.tipoEvento, valForm.monto],
    enabled: false,
    queryFn: async () =>
      api.request("/finance/contabilidad/validar", {
        method: "POST",
        body: JSON.stringify({
          modulo: valForm.modulo,
          tipoEvento: valForm.tipoEvento,
          subTipo: valForm.subTipo || undefined,
          monto: Number(valForm.monto),
        }),
      }),
  });

  // ── 4. Audit log ──
  const [auditForm, setAuditForm] = React.useState({ entidad: "", entidadId: "" });
  const auditQuery = useQuery<{ total: number; entries: AuditEntry[] }>({
    queryKey: ["contab-audit", auditForm.entidad, auditForm.entidadId],
    enabled: false,
    queryFn: () =>
      api.request(
        `/finance/contabilidad/audit-log/${auditForm.entidad}/${auditForm.entidadId}?limit=20`,
      ),
  });

  // ── 5. Asiento automático ──
  const [autoForm, setAutoForm] = React.useState({ ordenTrabajoId: "", concepto: "" });
  const autoMut = useMutation({
    mutationFn: () =>
      api.request<AsientoResultado>("/finance/contabilidad/asientos/automatico", {
        method: "POST",
        body: JSON.stringify({
          ordenTrabajoId: autoForm.ordenTrabajoId,
          fecha: new Date().toISOString(),
          concepto: autoForm.concepto || undefined,
        }),
      }),
    onSuccess: (d) => {
      t.success(`Asiento #${d.asiento.numero} generado (₲${Number(d.asiento.totalDebe).toLocaleString("es-PY")})`);
      setAutoForm({ ordenTrabajoId: "", concepto: "" });
    },
    onError: (err: any) => t.error(err?.message || "No se pudo generar el asiento"),
  });

  // ── 6. Ajustes de devengamiento ──
  const cuentasQuery = useQuery<CuentaContable[]>({
    queryKey: ["cuentas-contables-select"],
    queryFn: () => api.listCuentasContables(),
  });
  const [ajusteConcepto, setAjusteConcepto] = React.useState("");
  const [ajusteLineas, setAjusteLineas] = React.useState([
    { cuentaId: "", debe: "", haber: "", descripcion: "" },
    { cuentaId: "", debe: "", haber: "", descripcion: "" },
  ]);
  const ajustesMut = useMutation({
    mutationFn: () =>
      api.request<AccrualResult>("/finance/contabilidad/devengamiento/ajustes", {
        method: "POST",
        body: JSON.stringify({
          ajustes: [
            {
              concepto: ajusteConcepto,
              lineas: ajusteLineas.map((l) => ({
                cuentaId: l.cuentaId,
                debe: l.debe || undefined,
                haber: l.haber || undefined,
                descripcion: l.descripcion || undefined,
              })),
            },
          ],
        }),
      }),
    onSuccess: (d) => {
      t.success(`Ajuste registrado — asiento #${d.asientoNumero ?? "—"}`);
    },
    onError: (err: any) => t.error(err?.message || "No se pudo registrar el ajuste"),
  });

  // ── 7. Depreciación de activo ──
  const [activoId, setActivoId] = React.useState("");
  const activoQuery = useQuery<ActivoFijoDetalle>({
    queryKey: ["contab-activo", activoId],
    enabled: false,
    queryFn: () => api.request(`/finance/contabilidad/depreciacion/activos/${activoId}`),
  });

  // ── 8. Rentabilidad ──
  type RentabTab = "periodo" | "ot" | "cliente" | "mecanico";
  const [rentabTab, setRentabTab] = React.useState<RentabTab>("periodo");
  const [rentabAnho, setRentabAnho] = React.useState(now.getFullYear());
  const [rentabMes, setRentabMes] = React.useState(now.getMonth() + 1);
  const [rentabOtId, setRentabOtId] = React.useState("");
  const [rentabClienteId, setRentabClienteId] = React.useState("");
  const [rentabMecanicoId, setRentabMecanicoId] = React.useState("");

  const rentabPeriodoQuery = useQuery<PeriodoProfitability>({
    queryKey: ["rentab-periodo", rentabAnho, rentabMes],
    enabled: false,
    queryFn: () =>
      api.request(`/finance/contabilidad/rentabilidad/dashboard/${rentabAnho}/${rentabMes}`),
  });
  const rentabOtQuery = useQuery<OTProfitability>({
    queryKey: ["rentab-ot", rentabOtId],
    enabled: rentabTab === "ot" && !!rentabOtId.trim(),
    queryFn: () => api.request(`/finance/contabilidad/rentabilidad/ot/${rentabOtId}`),
  });
  const rentabClienteQuery = useQuery<ClientProfitability>({
    queryKey: ["rentab-cliente", rentabClienteId],
    enabled: rentabTab === "cliente" && !!rentabClienteId.trim(),
    queryFn: () => api.request(`/finance/contabilidad/rentabilidad/cliente/${rentabClienteId}`),
  });
  const rentabMecanicoQuery = useQuery<MechanicProfitability>({
    queryKey: ["rentab-mecanico", rentabMecanicoId],
    enabled: rentabTab === "mecanico" && !!rentabMecanicoId.trim(),
    queryFn: () => api.request(`/finance/contabilidad/rentabilidad/mecanico/${rentabMecanicoId}`),
  });

  // ── 9. Libros IVA ──
  const [libroTipo, setLibroTipo] = React.useState<"compras" | "ventas">("compras");
  const [libroAnho, setLibroAnho] = React.useState(now.getFullYear());
  const [libroMes, setLibroMes] = React.useState(now.getMonth() + 1);
  const libroQuery = useQuery<LibroIVAReport>({
    queryKey: ["libro-iva", libroTipo, libroAnho, libroMes],
    enabled: false,
    queryFn: () =>
      api.request<LibroIVAReport>(
        libroTipo === "compras"
          ? `/finance/contabilidad/libro-compras-iva/${libroAnho}/${libroMes}?formato=JSON`
          : `/finance/contabilidad/libro-ventas-iva/${libroAnho}/${libroMes}?formato=JSON`,
      ),
  });

  const setAjusteLinea = (idx: number, patch: Partial<(typeof ajusteLineas)[number]>) => {
    setAjusteLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {ToastContainer}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-blue-500" />
          Diagnóstico Contable
        </h1>
        <p className="text-sm text-muted-foreground">
          Cuadratura, mappings, validación pre-transacción, asientos automáticos y auditoría
        </p>
      </div>

      {/* ── 1. Cuadratura ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4" /> Cuadratura de Asientos
          </CardTitle>
          <CardDescription>Verificación de balance Debe/Haber del período</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Año</label>
              <Input type="number" value={cuadAnho} onChange={(e) => setCuadAnho(Number(e.target.value))} className="h-8 w-24 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Mes</label>
              <Input type="number" min={1} max={12} value={cuadMes} onChange={(e) => setCuadMes(Number(e.target.value))} className="h-8 w-20 text-xs" />
            </div>
          </div>
          {cuadraturaQuery.isLoading ? (
            <Skeleton className="h-24" />
          ) : cuadraturaQuery.isError ? (
            <p className="text-sm text-red-600">No se pudo ejecutar la cuadratura</p>
          ) : cuadraturaQuery.data ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant={cuadraturaQuery.data.balanceado ? "success" : "destructive"}>
                  {cuadraturaQuery.data.balanceado ? "Balanceado" : "CON DIFERENCIAS"}
                </Badge>
                <span>{cuadraturaQuery.data.totalAsientos} asientos</span>
                <span className="text-muted-foreground">
                  Debe ₲{Number(cuadraturaQuery.data.sumaDebe).toLocaleString("es-PY")} · Haber ₲
                  {Number(cuadraturaQuery.data.sumaHaber).toLocaleString("es-PY")}
                </span>
                {!cuadraturaQuery.data.balanceado && (
                  <span className="font-mono text-red-600">
                    Δ ₲{Number(cuadraturaQuery.data.diferenciaGlobal).toLocaleString("es-PY")}
                  </span>
                )}
              </div>
              {cuadraturaQuery.data.asientosDesbalanceados > 0 && (
                <div className="space-y-1.5">
                  {cuadraturaQuery.data.detalles
                    .filter((d) => !d.balanceado)
                    .slice(0, 10)
                    .map((d) => (
                      <div key={d.asientoId} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs">
                        <span>#{d.numero} — {d.concepto}</span>
                        <span className="font-mono text-red-600">
                          Δ ₲{Number(d.diferencia).toLocaleString("es-PY")}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── 2. Validar pre-transacción ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4" /> Validar Pre-Transacción
          </CardTitle>
          <CardDescription>Verificá el mapping contable antes de confirmar una operación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Módulo</label>
              <Input value={valForm.modulo} onChange={(e) => setValForm({ ...valForm, modulo: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Tipo de evento</label>
              <Input value={valForm.tipoEvento} onChange={(e) => setValForm({ ...valForm, tipoEvento: e.target.value })} placeholder="Ej: FACTURA_EMISION" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Subtipo (opcional)</label>
              <Input value={valForm.subTipo} onChange={(e) => setValForm({ ...valForm, subTipo: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Monto</label>
              <Input type="number" min={0} value={valForm.monto} onChange={(e) => setValForm({ ...valForm, monto: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!valForm.tipoEvento.trim() || !valForm.monto}
            loading={validarResult.isFetching}
            onClick={() => validarResult.refetch()}
          >
            Validar
          </Button>
          {validarResult.data && (
            <div className="space-y-2 rounded-lg border p-3 text-xs">
              <Badge variant={validarResult.data.valido ? "success" : "destructive"}>
                {validarResult.data.valido ? "Válido" : "Inválido"}
              </Badge>
              {validarResult.data.errores.length > 0 && (
                <ul className="list-disc pl-4 text-red-600">
                  {validarResult.data.errores.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {validarResult.data.advertencias.length > 0 && (
                <ul className="list-disc pl-4 text-amber-600">
                  {validarResult.data.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
              {validarResult.data.mapping && (
                <p className="font-mono text-muted-foreground">
                  Debe {validarResult.data.mapping.cuentaDebeCodigo} ({validarResult.data.mapping.cuentaDebeNombre}) ·
                  Haber {validarResult.data.mapping.cuentaHaberCodigo} ({validarResult.data.mapping.cuentaHaberNombre})
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Mappings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Mappings de Cuentas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={moduloFilter}
              onChange={(e) => setModuloFilter(e.target.value)}
              placeholder="Filtrar por módulo (ej: workshop)…"
              className="h-8 w-56 text-xs"
            />
          </div>
          {mappingsQuery.isLoading ? (
            <Skeleton className="h-20" />
          ) : mappingsQuery.isError ? (
            <p className="text-sm text-red-600">No se pudieron cargar los mappings</p>
          ) : (mappingsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin mappings configurados</p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {(mappingsQuery.data ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium">{m.modulo} · {m.tipoEvento}{m.subTipo ? ` · ${m.subTipo}` : ""}</p>
                    <p className="truncate text-muted-foreground">{m.descripcion || "—"}</p>
                  </div>
                  <Badge variant={m.activo ? "success" : "secondary"} className="shrink-0 text-[10px]">
                    {m.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Asiento automático ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" /> Generar Asiento Automático
          </CardTitle>
          <CardDescription>Genera el asiento de una OT con las mappings configuradas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">ID de Orden de Trabajo</label>
              <Input value={autoForm.ordenTrabajoId} onChange={(e) => setAutoForm({ ...autoForm, ordenTrabajoId: e.target.value })} placeholder="UUID de la OT…" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Concepto (opcional)</label>
              <Input value={autoForm.concepto} onChange={(e) => setAutoForm({ ...autoForm, concepto: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1"
            disabled={!autoForm.ordenTrabajoId.trim()}
            loading={autoMut.isPending}
            onClick={() => autoMut.mutate()}
          >
            <Zap className="h-3 w-3" /> Generar asiento
          </Button>
        </CardContent>
      </Card>

      {/* ── 5. Audit log ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> Auditoría de Entidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Entidad</label>
              <Input value={auditForm.entidad} onChange={(e) => setAuditForm({ ...auditForm, entidad: e.target.value })} placeholder="Ej: asiento_contable" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">ID de entidad</label>
              <Input value={auditForm.entidadId} onChange={(e) => setAuditForm({ ...auditForm, entidadId: e.target.value })} placeholder="UUID…" className="h-8 text-xs" />
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!auditForm.entidad.trim() || !auditForm.entidadId.trim()}
            loading={auditQuery.isFetching}
            onClick={() => auditQuery.refetch()}
          >
            Consultar
          </Button>
          {auditQuery.data && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{auditQuery.data.total} entrada(s)</p>
              {auditQuery.data.entries.map((e) => (
                <div key={e.id} className="rounded border px-2.5 py-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.accion}</span>
                    <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleString("es-PY")}</span>
                  </div>
                  {e.descripcion && <p className="text-muted-foreground">{e.descripcion}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 6. Ajustes de devengamiento ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Ajustes de Devengamiento
          </CardTitle>
          <CardDescription>Asiento de ajuste con mínimo dos líneas (debe/haber)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Concepto *</label>
            <Input value={ajusteConcepto} onChange={(e) => setAjusteConcepto(e.target.value)} placeholder="Ej: Devengamiento de ingresos del período" className="h-8 text-xs" />
          </div>
          {ajusteLineas.map((linea, idx) => (
            <div key={idx} className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-4">
              <select
                value={linea.cuentaId}
                onChange={(e) => setAjusteLinea(idx, { cuentaId: e.target.value })}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label={`Cuenta línea ${idx + 1}`}
              >
                <option value="">Cuenta…</option>
                {(cuentasQuery.data ?? []).filter((c) => c.aceptaMovimientos).map((c) => (
                  <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                ))}
              </select>
              <Input type="number" min={0} placeholder="Debe" value={linea.debe} onChange={(e) => setAjusteLinea(idx, { debe: e.target.value })} className="h-8 text-xs" />
              <Input type="number" min={0} placeholder="Haber" value={linea.haber} onChange={(e) => setAjusteLinea(idx, { haber: e.target.value })} className="h-8 text-xs" />
              <Input placeholder="Descripción" value={linea.descripcion} onChange={(e) => setAjusteLinea(idx, { descripcion: e.target.value })} className="h-8 text-xs" />
            </div>
          ))}
          <Button
            size="sm"
            className="h-8 text-xs"
            loading={ajustesMut.isPending}
            disabled={
              !ajusteConcepto.trim() ||
              ajusteLineas.some((l) => !l.cuentaId) ||
              ajusteLineas.every((l) => !l.debe && !l.haber)
            }
            onClick={() => ajustesMut.mutate()}
          >
            Registrar ajuste
          </Button>
        </CardContent>
      </Card>

      {/* ── 7. Depreciación de activo ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Depreciación — Activo Fijo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">ID del activo</label>
              <Input value={activoId} onChange={(e) => setActivoId(e.target.value)} placeholder="UUID del activo…" className="h-8 w-72 text-xs" />
            </div>
            <Button size="sm" className="h-8 text-xs" disabled={!activoId.trim()} loading={activoQuery.isFetching} onClick={() => activoQuery.refetch()}>
              Consultar
            </Button>
          </div>
          {activoQuery.data && (
            <div className="grid gap-2 text-xs sm:grid-cols-4">
              <div className="rounded border p-2"><p className="text-muted-foreground">Código</p><p className="font-mono">{activoQuery.data.codigo}</p></div>
              <div className="rounded border p-2"><p className="text-muted-foreground">Nombre</p><p>{activoQuery.data.nombre}</p></div>
              <div className="rounded border p-2"><p className="text-muted-foreground">Tipo</p><p>{activoQuery.data.tipo}</p></div>
              <div className="rounded border p-2"><p className="text-muted-foreground">Estado</p><Badge variant={activoQuery.data.activo ? "success" : "secondary"}>{activoQuery.data.estado}</Badge></div>
              <div className="rounded border p-2"><p className="text-muted-foreground">Costo adquisición</p><p className="font-mono">₲{Number(activoQuery.data.costoAdquisicion).toLocaleString("es-PY")}</p></div>
              <div className="rounded border p-2"><p className="text-muted-foreground">Valor en libros</p><p className="font-mono">₲{Number(activoQuery.data.valorActualLibros).toLocaleString("es-PY")}</p></div>
              <div className="rounded border p-2"><p className="text-muted-foreground">Dep. acumulada</p><p className="font-mono">₲{Number(activoQuery.data.depreciacionAcumulada).toLocaleString("es-PY")}</p></div>
              <div className="rounded border p-2"><p className="text-muted-foreground">Vida útil</p><p>{activoQuery.data.vidaUtilAnos} años · {activoQuery.data.metodoDepreciacion}</p></div>
            </div>
          )}
          {activoQuery.isError && (
            <p className="text-sm text-red-600">Activo no encontrado</p>
          )}
        </CardContent>
      </Card>

      {/* ── 8. Rentabilidad ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Rentabilidad
          </CardTitle>
          <CardDescription>Dashboard del período o por OT, cliente o mecánico</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {([
              ["periodo", "Período"],
              ["ot", "Orden de Trabajo"],
              ["cliente", "Cliente"],
              ["mecanico", "Mecánico"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={rentabTab === key ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setRentabTab(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          {rentabTab === "periodo" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Año</label>
                  <Input type="number" value={rentabAnho} onChange={(e) => setRentabAnho(Number(e.target.value))} className="h-8 w-24 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Mes</label>
                  <Input type="number" min={1} max={12} value={rentabMes} onChange={(e) => setRentabMes(Number(e.target.value))} className="h-8 w-20 text-xs" />
                </div>
                <Button size="sm" className="h-8 text-xs" loading={rentabPeriodoQuery.isFetching} onClick={() => rentabPeriodoQuery.refetch()}>
                  Consultar
                </Button>
              </div>
              {rentabPeriodoQuery.data && (
                <>
                  <div className="grid gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded border p-2"><p className="text-muted-foreground">OTs</p><p className="font-bold">{rentabPeriodoQuery.data.resumen.totalOTs}</p></div>
                    <div className="rounded border p-2"><p className="text-muted-foreground">Facturado</p><p className="font-mono">₲{rentabPeriodoQuery.data.resumen.totalFacturado.toLocaleString("es-PY")}</p></div>
                    <div className="rounded border p-2"><p className="text-muted-foreground">Costos</p><p className="font-mono">₲{rentabPeriodoQuery.data.resumen.totalCostos.toLocaleString("es-PY")}</p></div>
                    <div className="rounded border p-2"><p className="text-muted-foreground">Margen</p><p className="font-mono font-bold">₲{rentabPeriodoQuery.data.resumen.margenBruto.toLocaleString("es-PY")} ({rentabPeriodoQuery.data.resumen.margenPorcentaje}%)</p></div>
                  </div>
                  {rentabPeriodoQuery.data.topMecanicos.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Top mecánicos</p>
                      {rentabPeriodoQuery.data.topMecanicos.slice(0, 5).map((m) => (
                        <div key={m.mechanicProfileId} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs">
                          <span>{m.mechanicName} · {m.totalOTs} OTs</span>
                          <span className="font-mono">₲{m.totalComisiones.toLocaleString("es-PY")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {rentabTab === "ot" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">ID de la OT</label>
                  <Input value={rentabOtId} onChange={(e) => setRentabOtId(e.target.value)} placeholder="UUID…" className="h-8 w-72 text-xs" />
                </div>
              </div>
              {rentabOtQuery.data && (
                <div className="grid gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded border p-2"><p className="text-muted-foreground">Cliente</p><p>{rentabOtQuery.data.clientName}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">Facturado</p><p className="font-mono">₲{rentabOtQuery.data.ingresos.totalFacturado.toLocaleString("es-PY")}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">Costos directos</p><p className="font-mono">₲{rentabOtQuery.data.costos.totalDirectos.toLocaleString("es-PY")}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">Estado</p><p>{rentabOtQuery.data.status}</p></div>
                </div>
              )}
              {rentabOtQuery.isError && <p className="text-sm text-red-600">OT no encontrada</p>}
            </div>
          )}

          {rentabTab === "cliente" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">ID del cliente</label>
                <Input value={rentabClienteId} onChange={(e) => setRentabClienteId(e.target.value)} placeholder="UUID…" className="h-8 w-72 text-xs" />
              </div>
              {rentabClienteQuery.data && (
                <div className="grid gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded border p-2"><p className="text-muted-foreground">Cliente</p><p>{rentabClienteQuery.data.clientName}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">OTs</p><p className="font-bold">{rentabClienteQuery.data.totalOTs}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">Facturado</p><p className="font-mono">₲{rentabClienteQuery.data.totalFacturado.toLocaleString("es-PY")}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">Margen</p><p className="font-mono font-bold">₲{rentabClienteQuery.data.margenBruto.toLocaleString("es-PY")} ({rentabClienteQuery.data.margenPorcentaje}%)</p></div>
                </div>
              )}
              {rentabClienteQuery.isError && <p className="text-sm text-red-600">Cliente no encontrado</p>}
            </div>
          )}

          {rentabTab === "mecanico" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">ID del perfil del mecánico</label>
                <Input value={rentabMecanicoId} onChange={(e) => setRentabMecanicoId(e.target.value)} placeholder="UUID…" className="h-8 w-72 text-xs" />
              </div>
              {rentabMecanicoQuery.data && (
                <div className="grid gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded border p-2"><p className="text-muted-foreground">Mecánico</p><p>{rentabMecanicoQuery.data.mechanicName}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">OTs</p><p className="font-bold">{rentabMecanicoQuery.data.totalOTs}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">Labor generado</p><p className="font-mono">₲{rentabMecanicoQuery.data.totalLaborGenerado.toLocaleString("es-PY")}</p></div>
                  <div className="rounded border p-2"><p className="text-muted-foreground">Comisiones</p><p className="font-mono font-bold">₲{rentabMecanicoQuery.data.totalComisiones.toLocaleString("es-PY")}</p></div>
                </div>
              )}
              {rentabMecanicoQuery.isError && <p className="text-sm text-red-600">Mecánico no encontrado</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 9. Libros IVA ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Libros de IVA
          </CardTitle>
          <CardDescription>Libro de compras y ventas del IVA — período mensual</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Libro</label>
              <div className="flex gap-1.5">
                <Button size="sm" variant={libroTipo === "compras" ? "default" : "outline"} className="h-8 text-xs" onClick={() => setLibroTipo("compras")}>
                  Compras
                </Button>
                <Button size="sm" variant={libroTipo === "ventas" ? "default" : "outline"} className="h-8 text-xs" onClick={() => setLibroTipo("ventas")}>
                  Ventas
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Año</label>
              <Input type="number" value={libroAnho} onChange={(e) => setLibroAnho(Number(e.target.value))} className="h-8 w-24 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Mes</label>
              <Input type="number" min={1} max={12} value={libroMes} onChange={(e) => setLibroMes(Number(e.target.value))} className="h-8 w-20 text-xs" />
            </div>
            <Button size="sm" className="h-8 text-xs" loading={libroQuery.isFetching} onClick={() => libroQuery.refetch()}>
              Generar
            </Button>
          </div>
          {libroQuery.data && (
            <div className="space-y-3">
              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded border p-2"><p className="text-muted-foreground">Entradas</p><p className="font-bold">{libroQuery.data.totalEntradas}</p></div>
                <div className="rounded border p-2"><p className="text-muted-foreground">Total {libroTipo}</p><p className="font-mono">₲{Number(libroQuery.data.totalCompras ?? libroQuery.data.totalVentas ?? 0).toLocaleString("es-PY")}</p></div>
                <div className="rounded border p-2"><p className="text-muted-foreground">Total IVA</p><p className="font-mono">₲{Number(libroQuery.data.totalIVA).toLocaleString("es-PY")}</p></div>
                <div className="rounded border p-2"><p className="text-muted-foreground">Formato</p><p>{libroQuery.data.periodo.anho}-{String(libroQuery.data.periodo.mes).padStart(2, "0")}</p></div>
              </div>
              {libroQuery.data.entries.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {libroQuery.data.entries.length} comprobante(s) en el libro. Use{" "}
                  <span className="font-mono">?formato=CSV</span> para exportar.
                </p>
              )}
            </div>
          )}
          {libroQuery.isError && <p className="text-sm text-red-600">No se pudo generar el libro</p>}
        </CardContent>
      </Card>
    </div>
  );
}
