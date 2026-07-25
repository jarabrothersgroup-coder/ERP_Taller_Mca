"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Package,
  Plus,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  ArrowLeftRight,
  Search,
  Download,
  Filter,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ── Types ──────────────────────────────────── */

interface StockMovement {
  id: string;
  repuestoId: string;
  repuestoNombre?: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE" | "TRANSFERENCIA";
  cantidad: number;
  precioUnitario: number | null;
  stockResultante: number;
  proveedor: string | null;
  ordenTrabajoId: string | null;
  notas: string | null;
  almacenOrigen: string | null;
  almacenDestino: string | null;
  tenantSlug: string;
  createdAt: string;
}

interface Repuesto {
  id: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
}

const TIPO_ICONS: Record<string, React.ElementType> = {
  ENTRADA: ArrowDown,
  SALIDA: ArrowUp,
  AJUSTE: RefreshCw,
  TRANSFERENCIA: ArrowLeftRight,
};

const TIPO_COLORS: Record<string, string> = {
  ENTRADA: "text-green-600 bg-green-100 dark:bg-green-900/30 border-green-300",
  SALIDA: "text-red-600 bg-red-100 dark:bg-red-900/30 border-red-300",
  AJUSTE: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 border-amber-300",
  TRANSFERENCIA: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-300",
};

/* ── Page Component ─────────────────────────── */

export default function StockMovementsPage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [tipoFilter, setTipoFilter] = React.useState("");
  const [search, setSearch] = React.useState("");

  // Register dialog
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [registerTipo, setRegisterTipo] = React.useState<"ENTRADA" | "SALIDA">("ENTRADA");
  const [formRepuestoId, setFormRepuestoId] = React.useState("");
  const [formCantidad, setFormCantidad] = React.useState(1);
  const [formPrecio, setFormPrecio] = React.useState<number>(0);
  const [formProveedor, setFormProveedor] = React.useState("");
  const [formNotas, setFormNotas] = React.useState("");

  // Fetch movements
  const { data: movements, isLoading } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements", tipoFilter],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (tipoFilter) qs.set("tipo", tipoFilter);
      qs.set("limit", "100");
      return api.request<StockMovement[]>(`/inventory/stock-movements?${qs.toString()}`);
    },
  });

  // Fetch repuestos for select
  const { data: repuestos = [] } = useQuery<Repuesto[]>({
    queryKey: ["repuestos-lista"],
    queryFn: () => api.request<any>("/inventory/repuestos?limit=200").then((r: any) => r.items || []),
  });

  // Register movement mutation
  const registerMut = useMutation({
    mutationFn: async () => {
      const body = {
        repuestoId: formRepuestoId,
        cantidad: formCantidad,
        ...(formPrecio > 0 ? { precioUnitario: formPrecio } : {}),
        ...(formProveedor ? { proveedor: formProveedor } : {}),
        ...(formNotas ? { notas: formNotas } : {}),
      };
      if (registerTipo === "ENTRADA") {
        return api.stockEntrada(body);
      } else {
        return api.stockSalida(body);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["repuestos-lista"] });
      setRegisterOpen(false);
      resetForm();
      t.success(`${registerTipo === "ENTRADA" ? "Entrada" : "Salida"} registrada correctamente`);
    },
    onError: (err: any) => {
      t.error(err?.message || "Error al registrar movimiento");
    },
  });

  const resetForm = () => {
    setFormRepuestoId("");
    setFormCantidad(1);
    setFormPrecio(0);
    setFormProveedor("");
    setFormNotas("");
  };

  const filtered = search
    ? (movements || []).filter(
        (m) =>
          (m.repuestoNombre || "").toLowerCase().includes(search.toLowerCase()) ||
          (m.id || "").toLowerCase().includes(search.toLowerCase()),
      )
    : movements || [];

  const columns: Column<StockMovement>[] = [
    {
      header: "Fecha",
      accessor: "createdAt",
      sortable: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString("es-PY", { dateStyle: "short" })}
        </span>
      ),
    },
    {
      header: "Tipo",
      accessor: "tipo",
      sortable: true,
      cell: (_, row) => {
        const Icon = TIPO_ICONS[row.tipo] || History;
        return (
          <Badge className={cn("text-xs gap-1 border", TIPO_COLORS[row.tipo])}>
            <Icon className="h-3 w-3" />
            {row.tipo}
          </Badge>
        );
      },
    },
    {
      header: "Repuesto",
      accessor: "repuestoNombre",
      sortable: true,
      cell: (_, row) => (
        <div>
          <p className="text-sm font-medium">{row.repuestoNombre || row.repuestoId.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      header: "Cantidad",
      accessor: "cantidad",
      sortable: true,
      align: "right",
      cell: (_, row) => (
        <span className={cn("font-mono font-medium", row.tipo === "ENTRADA" ? "text-green-600" : row.tipo === "SALIDA" ? "text-red-600" : "")}>
          {row.tipo === "ENTRADA" ? "+" : row.tipo === "SALIDA" ? "-" : ""}
          {row.cantidad}
        </span>
      ),
    },
    {
      header: "Stock Resultante",
      accessor: "stockResultante",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (_, row) => <span className="font-mono text-xs">{row.stockResultante}</span>,
    },
    {
      header: "Precio Unit.",
      accessor: "precioUnitario",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">
          {row.precioUnitario ? `₲ ${Number(row.precioUnitario).toLocaleString("es-PY")}` : "—"}
        </span>
      ),
    },
    {
      header: "Proveedor/OT",
      accessor: "proveedor",
      hideOnMobile: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">
          {row.proveedor || (row.ordenTrabajoId ? `OT #${row.ordenTrabajoId.slice(0, 8)}` : "—")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-blue-500" />
            Movimientos de Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro de entradas, salidas, ajustes y transferencias de inventario
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setRegisterTipo("ENTRADA"); setRegisterOpen(true); }}>
            <ArrowDown className="h-4 w-4 text-green-500" />
            Registrar Entrada
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setRegisterTipo("SALIDA"); setRegisterOpen(true); }}>
            <ArrowUp className="h-4 w-4 text-red-500" />
            Registrar Salida
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open("/inventory/reports/movements", "_blank")}>
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {["", "ENTRADA", "SALIDA", "AJUSTE", "TRANSFERENCIA"].map((tipo) => (
          <Button
            key={tipo}
            variant={tipoFilter === tipo ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTipoFilter(tipo)}
            role="tab"
          >
            {tipo || "Todos"}
          </Button>
        ))}
      </div>

      {/* Data table */}
      <DataTable<StockMovement>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={isLoading}
        emptyMessage="No hay movimientos registrados"
        paginate
        pageSize={15}
        sortable
        searchPlaceholder="Buscar por repuesto o ID..."
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
      />

      {/* ── Register Dialog ──────────────────── */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {registerTipo === "ENTRADA" ? (
                <ArrowDown className="h-5 w-5 text-green-500" />
              ) : (
                <ArrowUp className="h-5 w-5 text-red-500" />
              )}
              Registrar {registerTipo === "ENTRADA" ? "Entrada" : "Salida"} de Stock
            </DialogTitle>
            <DialogDescription>
              {registerTipo === "ENTRADA"
                ? "Registra la recepción de un repuesto al inventario"
                : "Registra la salida de un repuesto del inventario"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Repuesto" htmlFor="repuesto">
              <select
                id="repuesto"
                value={formRepuestoId}
                onChange={(e) => setFormRepuestoId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Seleccionar repuesto...</option>
                {repuestos.map((r: Repuesto) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo} — {r.descripcion} (stock: {r.stockActual})
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Cantidad" htmlFor="cantidad">
                <Input
                  id="cantidad"
                  type="number"
                  min={1}
                  value={formCantidad}
                  onChange={(e) => setFormCantidad(Number(e.target.value))}
                  required
                />
              </FormField>
              {registerTipo === "ENTRADA" && (
                <FormField label="Precio Unit. (₲)" htmlFor="precio">
                  <Input
                    id="precio"
                    type="number"
                    min={0}
                    value={formPrecio || ""}
                    onChange={(e) => setFormPrecio(Number(e.target.value))}
                  />
                </FormField>
              )}
            </div>

            {registerTipo === "ENTRADA" && (
              <FormField label="Proveedor" htmlFor="proveedor">
                <Input
                  id="proveedor"
                  value={formProveedor}
                  onChange={(e) => setFormProveedor(e.target.value)}
                  placeholder="Nombre del proveedor"
                />
              </FormField>
            )}

            <FormField label="Notas" htmlFor="notas">
              <textarea
                id="notas"
                value={formNotas}
                onChange={(e) => setFormNotas(e.target.value)}
                placeholder="Observaciones..."
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setRegisterOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => registerMut.mutate()}
              disabled={!formRepuestoId || formCantidad < 1 || registerMut.isPending}
              loading={registerMut.isPending}
            >
              {registerTipo === "ENTRADA" ? "Registrar Entrada" : "Registrar Salida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ToastContainer}
    </div>
  );
}
