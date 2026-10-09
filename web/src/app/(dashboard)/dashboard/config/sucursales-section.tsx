"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { api, type Sucursal } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const departamentosPy = [
  "Asunción", "Central", "Cordillera", "Guairá", "Caaguazú", "Canindeyú", "San Pedro",
  "Amambay", "Concepción", "Alto Paraná", "Itapúa", "Misiones", "Paraguarí",
  "Alto Paraguay", "Boquerón", "Ñeembucú",
];

interface SucursalForm {
  nombre: string;
  codigo: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  telefono: string;
  email: string;
  gerente: string;
  esPrincipal: boolean;
}

const emptyForm: SucursalForm = {
  nombre: "",
  codigo: "",
  direccion: "",
  ciudad: "",
  departamento: "",
  telefono: "",
  email: "",
  gerente: "",
  esPrincipal: false,
};

/* ── Create/Edit Dialog ─────────────────────────── */

function SucursalDialog({
  sucursal,
  open,
  onOpenChange,
}: {
  sucursal: Sucursal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!sucursal;
  const [form, setForm] = React.useState<SucursalForm>(emptyForm);
  const [errors, setErrors] = React.useState<Partial<Record<keyof SucursalForm, string>>>({});

  React.useEffect(() => {
    if (!open) return;
    if (sucursal) {
      setForm({
        nombre: sucursal.nombre,
        codigo: sucursal.codigo,
        direccion: sucursal.direccion ?? "",
        ciudad: sucursal.ciudad ?? "",
        departamento: sucursal.departamento ?? "",
        telefono: sucursal.telefono ?? "",
        email: sucursal.email ?? "",
        gerente: sucursal.gerente ?? "",
        esPrincipal: sucursal.esPrincipal,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [open, sucursal]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isEdit && sucursal) {
        return api.updateSucursal(sucursal.id, {
          nombre: form.nombre,
          direccion: form.direccion || null,
          ciudad: form.ciudad,
          departamento: form.departamento,
          telefono: form.telefono,
          email: form.email,
          gerente: form.gerente,
          esPrincipal: form.esPrincipal,
        });
      }
      return api.createSucursal({
        nombre: form.nombre,
        codigo: form.codigo,
        direccion: form.direccion || undefined,
        ciudad: form.ciudad || undefined,
        departamento: form.departamento || undefined,
        telefono: form.telefono || undefined,
        email: form.email || undefined,
        gerente: form.gerente || undefined,
        esPrincipal: form.esPrincipal,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucursales"] });
      toast.success(isEdit ? "Sucursal actualizada" : "Sucursal creada");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar la sucursal");
    },
  });

  const updateField = <K extends keyof SucursalForm>(field: K, value: SucursalForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof SucursalForm, string>> = {};
    if (!form.nombre.trim()) next.nombre = "El nombre es obligatorio";
    if (!isEdit && !form.codigo.trim()) next.codigo = "El código es obligatorio";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Ingresa un correo válido";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              {isEdit ? "Editar Sucursal" : "Nueva Sucursal"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Modificá los datos de la sucursal."
                : "Registrá una sucursal o sede del taller."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nombre" htmlFor="suc-nombre" required error={errors.nombre}>
                <Input
                  id="suc-nombre"
                  value={form.nombre}
                  onChange={(e) => updateField("nombre", e.target.value)}
                  hasError={!!errors.nombre}
                  placeholder="Sucursal Centro"
                />
              </FormField>

              <FormField
                label="Código"
                htmlFor="suc-codigo"
                required={!isEdit}
                error={errors.codigo}
                helperText={isEdit ? "El código no se puede modificar" : undefined}
              >
                <Input
                  id="suc-codigo"
                  value={form.codigo}
                  onChange={(e) => updateField("codigo", e.target.value)}
                  hasError={!!errors.codigo}
                  disabled={isEdit}
                  className="font-mono"
                  placeholder="SC-01"
                />
              </FormField>
            </div>

            <FormField label="Dirección" htmlFor="suc-direccion">
              <Input
                id="suc-direccion"
                value={form.direccion}
                onChange={(e) => updateField("direccion", e.target.value)}
                placeholder="Av. Mariscal López 1234"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Ciudad" htmlFor="suc-ciudad">
                <Input
                  id="suc-ciudad"
                  value={form.ciudad}
                  onChange={(e) => updateField("ciudad", e.target.value)}
                  placeholder="Coronel Oviedo"
                />
              </FormField>

              <FormField label="Departamento" htmlFor="suc-departamento">
                <Select
                  id="suc-departamento"
                  value={form.departamento}
                  onChange={(e) => updateField("departamento", e.target.value)}
                  placeholder="Seleccionar…"
                >
                  {departamentosPy.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Teléfono" htmlFor="suc-telefono">
                <Input
                  id="suc-telefono"
                  value={form.telefono}
                  onChange={(e) => updateField("telefono", e.target.value)}
                  placeholder="+595 981 234 567"
                />
              </FormField>

              <FormField label="Correo" htmlFor="suc-email" error={errors.email}>
                <Input
                  id="suc-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  hasError={!!errors.email}
                  placeholder="sucursal@taller.com.py"
                />
              </FormField>
            </div>

            <FormField label="Gerente" htmlFor="suc-gerente">
              <Input
                id="suc-gerente"
                value={form.gerente}
                onChange={(e) => updateField("gerente", e.target.value)}
                placeholder="Nombre del gerente"
              />
            </FormField>

            <FormField
              label="Sucursal Principal"
              htmlFor="suc-principal"
              helperText="Solo una sucursal puede ser la principal"
            >
              <Select
                id="suc-principal"
                value={form.esPrincipal ? "true" : "false"}
                onChange={(e) => updateField("esPrincipal", e.target.value === "true")}
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </Select>
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={saveMutation.isPending}>
              {isEdit ? "Guardar Cambios" : "Crear Sucursal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete Confirmation ────────────────────────── */

function DeleteSucursalDialog({
  sucursal,
  onOpenChange,
}: {
  sucursal: Sucursal | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!sucursal) throw new Error("No hay sucursal seleccionada");
      return api.deleteSucursal(sucursal.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucursales"] });
      toast.success("Sucursal eliminada");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al eliminar la sucursal");
    },
  });

  return (
    <Dialog open={!!sucursal} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar Sucursal</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar &quot;{sucursal?.nombre}&quot;? Esta acción desactiva la
            sucursal.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Section ────────────────────────────────────── */

export function SucursalesSection() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Sucursal | null>(null);
  const [deleting, setDeleting] = React.useState<Sucursal | null>(null);

  const {
    data: sucursales = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Sucursal[], Error>({
    queryKey: ["sucursales"],
    queryFn: () => api.listSucursales(),
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (s: Sucursal) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const columns: Column<Sucursal>[] = [
    {
      header: "Código",
      accessor: "codigo",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      header: "Sucursal",
      accessor: "nombre",
      sortable: true,
      cell: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-medium flex items-center gap-1">
              {row.nombre}
              {row.esPrincipal && (
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" aria-label="Principal" />
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {[row.ciudad, row.departamento].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Gerente",
      accessor: "gerente",
      sortable: true,
      hideOnMobile: true,
      cell: (value) => (value as string) || <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Teléfono",
      accessor: "telefono",
      hideOnMobile: true,
      className: "text-xs",
      cell: (value) => (value as string) || <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Estado",
      accessor: "activa",
      sortable: true,
      cell: (_, row) => (
        <Badge variant={row.activa ? "success" : "secondary"}>
          {row.activa ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      header: "Acciones",
      accessor: "id",
      cell: (_, row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => openEdit(row)}>
            <Pencil className="h-3 w-3" aria-hidden="true" /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 text-destructive hover:text-destructive"
            onClick={() => setDeleting(row)}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" /> Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" aria-hidden="true" /> Sucursales
            </CardTitle>
            <CardDescription>
              Sedes del taller — CRUD conectado a <code className="text-xs">/config/sucursales</code>
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Nueva Sucursal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "No se pudieron cargar las sucursales"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
          </div>
        ) : (
          <DataTable<Sucursal>
            columns={columns}
            data={sucursales}
            rowKey="id"
            loading={isLoading}
            emptyMessage="No hay sucursales registradas"
            paginate
            pageSize={10}
            sortable
            searchPlaceholder="Buscar sucursal, ciudad o código…"
            className="shadow-sm"
          />
        )}
      </CardContent>

      <SucursalDialog
        sucursal={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <DeleteSucursalDialog
        sucursal={deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
      />
    </Card>
  );
}
