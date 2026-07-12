"use client";

import * as React from "react";
import { Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useInventory } from "@/hooks/use-data";
import { NewProductDialog } from "./new-product-dialog";
import { InventoryStats } from "./stats";
import { columns } from "./columns";

export default function InventoryPage() {
  const { data: allItems = [], isLoading: loading } = useInventory();
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");

  const filtered = React.useMemo(() => {
    let result = allItems;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      result = result.filter((item) => item.category === categoryFilter);
    }
    return result;
  }, [allItems, search, categoryFilter]);

  const criticalItems = filtered.filter((i) => i.status === "critical");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">Gestión de repuestos y productos del taller</p>
        </div>
        <NewProductDialog />
      </div>

      {criticalItems.length > 0 && !loading && (
        <Alert variant="error">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Productos sin stock</AlertTitle>
          <AlertDescription>
            {criticalItems.length} producto{criticalItems.length !== 1 ? "s" : ""} con stock en cero.
            Se recomienda realizar pedido urgente.
          </AlertDescription>
        </Alert>
      )}

      {!loading && <InventoryStats items={filtered} />}

      <DataTable
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={search || categoryFilter ? "No se encontraron productos con esos filtros" : "No hay productos registrados. Agregue su primer producto para comenzar."}
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar producto o código…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        actions={<Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" aria-hidden="true" />Exportar</Button>}
      />
    </div>
  );
}
