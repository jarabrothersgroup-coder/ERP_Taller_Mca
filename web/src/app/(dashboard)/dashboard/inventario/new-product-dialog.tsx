"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { queryKeys } from "@/hooks/use-data";

interface ProductForm {
  codigo: string;
  descripcion: string;
  marca: string;
  modelo: string;
  categoria: string;
  precioCosto: string;
  precioVenta: string;
  stockActual: string;
  stockMinimo: string;
  ubicacion: string;
  unidadMedida: string;
  proveedor: string;
}

const categorias = ["Frenos", "Motor", "Suspensión", "Eléctrico", "Transmisión", "Filtros", "Aceites", "General"];
const unidades = ["UN", "LT", "KG", "MT", "PAR", "JUEGO"];

export function NewProductDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<ProductForm>({
    codigo: "",
    descripcion: "",
    marca: "",
    modelo: "",
    categoria: "",
    precioCosto: "",
    precioVenta: "",
    stockActual: "0",
    stockMinimo: "0",
    ubicacion: "",
    unidadMedida: "UN",
    proveedor: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof ProductForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (data: ProductForm) => {
      const res = await fetch("/inventory/repuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify({
          codigo: data.codigo,
          descripcion: data.descripcion,
          marca: data.marca || null,
          modelo: data.modelo || null,
          categoria: data.categoria || null,
          precioCosto: data.precioCosto || null,
          precioVenta: data.precioVenta || null,
          stockActual: Number(data.stockActual) || 0,
          stockMinimo: Number(data.stockMinimo) || 0,
          ubicacion: data.ubicacion || null,
          unidadMedida: data.unidadMedida,
          proveedor: data.proveedor || null,
        }),
      });
      if (!res.ok) throw new Error("Error creando producto");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory });
      setForm({
        codigo: "", descripcion: "", marca: "", modelo: "", categoria: "",
        precioCosto: "", precioVenta: "", stockActual: "0", stockMinimo: "0",
        ubicacion: "", unidadMedida: "UN", proveedor: "",
      });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProductForm, string>> = {};
    if (!form.codigo.trim()) newErrors.codigo = "El código es obligatorio";
    if (!form.descripcion.trim()) newErrors.descripcion = "La descripción es obligatoria";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof ProductForm>(field: K, value: ProductForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo Producto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Producto</DialogTitle>
            <DialogDescription>
              Registrá un nuevo repuesto o producto en el inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Código" htmlFor="p-codigo" required error={errors.codigo}>
                <Input
                  id="p-codigo"
                  placeholder="PZ-0001"
                  value={form.codigo}
                  onChange={(e) => updateField("codigo", e.target.value)}
                  hasError={!!errors.codigo}
                />
              </FormField>

              <FormField label="Categoría" htmlFor="p-categoria">
                <Select
                  id="p-categoria"
                  value={form.categoria}
                  onChange={(e) => updateField("categoria", e.target.value)}
                  placeholder="Seleccionar…"
                >
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Descripción" htmlFor="p-descripcion" required error={errors.descripcion}>
              <Input
                id="p-descripcion"
                placeholder="Nombre del producto"
                value={form.descripcion}
                onChange={(e) => updateField("descripcion", e.target.value)}
                hasError={!!errors.descripcion}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Marca" htmlFor="p-marca">
                <Input id="p-marca" placeholder="Marca" value={form.marca} onChange={(e) => updateField("marca", e.target.value)} />
              </FormField>
              <FormField label="Modelo" htmlFor="p-modelo">
                <Input id="p-modelo" placeholder="Modelo" value={form.modelo} onChange={(e) => updateField("modelo", e.target.value)} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Precio Costo (₲)" htmlFor="p-costo">
                <Input id="p-costo" type="number" placeholder="0" value={form.precioCosto} onChange={(e) => updateField("precioCosto", e.target.value)} />
              </FormField>
              <FormField label="Precio Venta (₲)" htmlFor="p-venta">
                <Input id="p-venta" type="number" placeholder="0" value={form.precioVenta} onChange={(e) => updateField("precioVenta", e.target.value)} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Stock Actual" htmlFor="p-stock">
                <Input id="p-stock" type="number" value={form.stockActual} onChange={(e) => updateField("stockActual", e.target.value)} />
              </FormField>
              <FormField label="Stock Mínimo" htmlFor="p-min">
                <Input id="p-min" type="number" value={form.stockMinimo} onChange={(e) => updateField("stockMinimo", e.target.value)} />
              </FormField>
              <FormField label="Unidad" htmlFor="p-unidad">
                <Select id="p-unidad" value={form.unidadMedida} onChange={(e) => updateField("unidadMedida", e.target.value)}>
                  {unidades.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Ubicación" htmlFor="p-ubicacion">
              <Input id="p-ubicacion" placeholder="Estante A-3" value={form.ubicacion} onChange={(e) => updateField("ubicacion", e.target.value)} />
            </FormField>

            <FormField label="Proveedor" htmlFor="p-proveedor">
              <Input id="p-proveedor" placeholder="Nombre del proveedor" value={form.proveedor} onChange={(e) => updateField("proveedor", e.target.value)} />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? "Creando…" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
