"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, type DevengamientoGasto, type ActivoFijo } from "@/lib/api";
import { useAccounts } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

/* ── Shared props ────────────────────────────── */

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/* ── Devengar Gastos ─────────────────────────── */

/** POST /finance/contabilidad/devengamiento/gastos */
export function DevengarGastosDialog({ open, onOpenChange, onSuccess }: DialogProps) {
  const { toast: t } = useToast();
  const { data: accounts = [] } = useAccounts();
  const [rows, setRows] = React.useState<
    { concepto: string; monto: string; cuentaGastoId: string }[]
  >([{ concepto: "", monto: "", cuentaGastoId: "" }]);

  const mut = useMutation({
    mutationFn: () => {
      const gastos: DevengamientoGasto[] = rows
        .filter((r) => r.concepto && Number(r.monto) > 0 && r.cuentaGastoId)
        .map((r) => ({
          concepto: r.concepto,
          monto: Number(r.monto),
          cuentaGastoId: r.cuentaGastoId,
        }));
      return api.contabilidadDevengarGastos({ gastos });
    },
    onSuccess: (res) => {
      t.success(res.message || "Devengamiento de gastos registrado");
      onOpenChange(false);
      setRows([{ concepto: "", monto: "", cuentaGastoId: "" }]);
      onSuccess?.();
    },
    onError: (err: any) => t.error(err?.message || "Error al devengar gastos"),
  });

  const valid = rows.some((r) => r.concepto && Number(r.monto) > 0 && r.cuentaGastoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Devengar Gastos</DialogTitle>
          <DialogDescription>
            Registra gastos devengados del período con su contrapartida de pasivo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_120px_1fr_32px] items-end gap-2">
              <FormField label={idx === 0 ? "Concepto" : ""} htmlFor={`dg-concepto-${idx}`}>
                <Input
                  id={`dg-concepto-${idx}`}
                  value={row.concepto}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, concepto: e.target.value } : r)),
                    )
                  }
                  placeholder="Ej: Alquiler diciembre"
                />
              </FormField>
              <FormField label={idx === 0 ? "Monto (₲)" : ""} htmlFor={`dg-monto-${idx}`}>
                <Input
                  id={`dg-monto-${idx}`}
                  type="number"
                  min={0}
                  value={row.monto}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, monto: e.target.value } : r)),
                    )
                  }
                />
              </FormField>
              <FormField label={idx === 0 ? "Cuenta gasto" : ""} htmlFor={`dg-cuenta-${idx}`}>
                <select
                  id={`dg-cuenta-${idx}`}
                  value={row.cuentaGastoId}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, cuentaGastoId: e.target.value } : r)),
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {accounts
                    .filter((a) => a.activo && (a.tipo === "GASTO" || a.tipo === "COSTO"))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} — {a.nombre}
                      </option>
                    ))}
                </select>
              </FormField>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                disabled={rows.length === 1}
                aria-label="Quitar fila"
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() =>
              setRows((prev) => [...prev, { concepto: "", monto: "", cuentaGastoId: "" }])
            }
          >
            + Agregar gasto
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!valid || mut.isPending} loading={mut.isPending}>
            Devengar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Revaluo de Activo Fijo ──────────────────── */

/** POST /finance/contabilidad/revaluo */
export function RevaluoDialog({ open, onOpenChange, onSuccess }: DialogProps) {
  const { toast: t } = useToast();
  const [activoFijoId, setActivoFijoId] = React.useState("");
  const [nuevoValor, setNuevoValor] = React.useState("");
  const [fecha, setFecha] = React.useState("");
  const [motivo, setMotivo] = React.useState("");

  const { data: activos = [] } = useQueryActivos(open);

  const mut = useMutation({
    mutationFn: () =>
      api.contabilidadRevaluo({
        activoFijoId,
        nuevoValor: Number(nuevoValor),
        fecha,
        ...(motivo ? { motivo } : {}),
      }),
    onSuccess: (res) => {
      t.success(res.message || "Revaluo contabilizado");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => t.error(err?.message || "Error al revaluar el activo"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revaluo de Activo Fijo</DialogTitle>
          <DialogDescription>Ajusta el valor en libros de un activo fijo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Activo fijo" htmlFor="revaluo-activo">
            <select
              id="revaluo-activo"
              value={activoFijoId}
              onChange={(e) => setActivoFijoId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">Seleccionar...</option>
              {activos.map((a: ActivoFijo) => (
                <option key={a.id} value={a.id}>
                  {a.codigo ? `${a.codigo} — ` : ""}
                  {a.descripcion || a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nuevo valor (₲)" htmlFor="revaluo-valor">
              <Input
                id="revaluo-valor"
                type="number"
                min={0}
                value={nuevoValor}
                onChange={(e) => setNuevoValor(e.target.value)}
              />
            </FormField>
            <FormField label="Fecha" htmlFor="revaluo-fecha">
              <Input
                id="revaluo-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Motivo" htmlFor="revaluo-motivo">
            <Input
              id="revaluo-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Revalorización por mercado"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!activoFijoId || !nuevoValor || !fecha || mut.isPending}
            loading={mut.isPending}
          >
            Revaluar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Query interna de activos fijos (solo mientras el dialog está abierto). */
function useQueryActivos(enabled: boolean) {
  return useQuery<ActivoFijo[]>({
    queryKey: ["activos-fijos"],
    queryFn: () => api.listActivosFijos(),
    enabled,
  });
}

/* ── Refundir Asientos ───────────────────────── */

/** POST /finance/contabilidad/refundir */
export function RefundirDialog({ open, onOpenChange, onSuccess }: DialogProps) {
  const { toast: t } = useToast();
  const [asientoIdsRaw, setAsientoIdsRaw] = React.useState("");
  const [fecha, setFecha] = React.useState("");
  const [concepto, setConcepto] = React.useState("");

  const asientoIds = asientoIdsRaw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const mut = useMutation({
    mutationFn: () =>
      api.contabilidadRefundir({
        asientoIds,
        ...(fecha ? { fecha } : {}),
        ...(concepto ? { concepto } : {}),
      }),
    onSuccess: (res) => {
      t.success(res.message || "Asientos refundidos");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => t.error(err?.message || "Error al refundir asientos"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refundir Asientos</DialogTitle>
          <DialogDescription>
            Combina 2 o más asientos en uno solo (UUIDs separados por coma).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="IDs de asientos (mín. 2)" htmlFor="refundir-ids">
            <textarea
              id="refundir-ids"
              value={asientoIdsRaw}
              onChange={(e) => setAsientoIdsRaw(e.target.value)}
              placeholder="uuid1, uuid2, ..."
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha (opcional)" htmlFor="refundir-fecha">
              <Input
                id="refundir-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </FormField>
            <FormField label="Concepto" htmlFor="refundir-concepto">
              <Input
                id="refundir-concepto"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Refundición mensual"
              />
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={asientoIds.length < 2 || mut.isPending}
            loading={mut.isPending}
          >
            Refundir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Reversar Asiento / Operación ────────────── */

/** POST /finance/contabilidad/reversar */
export function ReversarDialog({ open, onOpenChange, onSuccess }: DialogProps) {
  const { toast: t } = useToast();
  const [referenciaId, setReferenciaId] = React.useState("");
  const [referenciaTipo, setReferenciaTipo] = React.useState("");
  const [motivo, setMotivo] = React.useState("");

  const mut = useMutation({
    mutationFn: () =>
      api.contabilidadReversar({ referenciaId, referenciaTipo, motivo }),
    onSuccess: (res) => {
      t.success(res.message || "Reversión contabilizada");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => t.error(err?.message || "Error al reversar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reversar Operación</DialogTitle>
          <DialogDescription>
            Genera el asiento inverso de una operación previa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="ID de referencia" htmlFor="reversar-id">
            <Input
              id="reversar-id"
              value={referenciaId}
              onChange={(e) => setReferenciaId(e.target.value)}
              placeholder="UUID del asiento u operación"
              className="font-mono"
            />
          </FormField>
          <FormField label="Tipo de referencia" htmlFor="reversar-tipo">
            <Input
              id="reversar-tipo"
              value={referenciaTipo}
              onChange={(e) => setReferenciaTipo(e.target.value)}
              placeholder="Ej: asiento, devengamiento, centralizacion"
            />
          </FormField>
          <FormField label="Motivo" htmlFor="reversar-motivo">
            <textarea
              id="reversar-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Error de registro"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mut.mutate()}
            disabled={!referenciaId || !referenciaTipo || !motivo.trim() || mut.isPending}
            loading={mut.isPending}
          >
            Reversar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Nota Crédito / Débito Contable ──────────── */

/** POST /finance/contabilidad/nota-credito-debito */
export function NotaCreditoDebitoDialog({ open, onOpenChange, onSuccess }: DialogProps) {
  const { toast: t } = useToast();
  const [facturaOriginalId, setFacturaOriginalId] = React.useState("");
  const [tipo, setTipo] = React.useState<"CREDITO" | "DEBITO">("CREDITO");
  const [motivo, setMotivo] = React.useState("");
  const [monto, setMonto] = React.useState("");

  const mut = useMutation({
    mutationFn: () =>
      api.contabilidadNotaCreditoDebito({
        facturaOriginalId,
        tipo,
        motivo,
        ...(monto ? { monto: Number(monto) } : {}),
      }),
    onSuccess: (res) => {
      if (res.error) {
        t.error(res.error);
        return;
      }
      t.success(`Nota de ${tipo === "CREDITO" ? "crédito" : "débito"} contabilizada`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => t.error(err?.message || "Error al emitir la nota"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nota Contable Crédito / Débito</DialogTitle>
          <DialogDescription>
            Asiento contable derivado de una nota fiscal sobre una factura original.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Factura original (UUID)" htmlFor="nc-factura">
            <Input
              id="nc-factura"
              value={facturaOriginalId}
              onChange={(e) => setFacturaOriginalId(e.target.value)}
              className="font-mono"
            />
          </FormField>
          <FormField label="Tipo" htmlFor="nc-tipo">
            <select
              id="nc-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "CREDITO" | "DEBITO")}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="CREDITO">Nota de Crédito</option>
              <option value="DEBITO">Nota de Débito</option>
            </select>
          </FormField>
          <FormField label="Motivo" htmlFor="nc-motivo">
            <Input
              id="nc-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Devolución parcial de mercadería"
            />
          </FormField>
          <FormField label="Monto (opcional — usa el de la nota fiscal)" htmlFor="nc-monto">
            <Input
              id="nc-monto"
              type="number"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!facturaOriginalId || !motivo.trim() || mut.isPending}
            loading={mut.isPending}
          >
            Contabilizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Registrar Tipo de Cambio ────────────────── */

/** POST /finance/contabilidad/tipos-cambio */
export function TipoCambioDialog({ open, onOpenChange, onSuccess }: DialogProps) {
  const { toast: t } = useToast();
  const [moneda, setMoneda] = React.useState("USD");
  const [fecha, setFecha] = React.useState("");
  const [compra, setCompra] = React.useState("");
  const [venta, setVenta] = React.useState("");
  const [fuente, setFuente] = React.useState("");

  const mut = useMutation({
    mutationFn: () =>
      api.createTipoCambio({
        moneda,
        fecha,
        compra: Number(compra),
        venta: Number(venta),
        ...(fuente ? { fuente } : {}),
      }),
    onSuccess: () => {
      t.success(`Tipo de cambio ${moneda} registrado`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => t.error(err?.message || "Error al registrar el tipo de cambio"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Tipo de Cambio</DialogTitle>
          <DialogDescription>Cotización BCV-style para una fecha dada.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Moneda" htmlFor="tc-moneda">
              <select
                id="tc-moneda"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {["USD", "EUR", "BRL", "ARS"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Fecha" htmlFor="tc-fecha">
              <Input
                id="tc-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Compra (₲)" htmlFor="tc-compra">
              <Input
                id="tc-compra"
                type="number"
                min={0}
                step="0.01"
                value={compra}
                onChange={(e) => setCompra(e.target.value)}
              />
            </FormField>
            <FormField label="Venta (₲)" htmlFor="tc-venta">
              <Input
                id="tc-venta"
                type="number"
                min={0}
                step="0.01"
                value={venta}
                onChange={(e) => setVenta(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Fuente (opcional)" htmlFor="tc-fuente">
            <Input
              id="tc-fuente"
              value={fuente}
              onChange={(e) => setFuente(e.target.value)}
              placeholder="Ej: BCV"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!fecha || !compra || !venta || mut.isPending}
            loading={mut.isPending}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
