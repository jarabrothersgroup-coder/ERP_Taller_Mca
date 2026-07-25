"use client";

import * as React from "react";
import Link from "next/link";
import { Download, AlertTriangle, RefreshCw, ShoppingCart, Wrench, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
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

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/inventario/movimientos">
          <Card className="transition-all duration-200 hover:shadow-md hover:border-foreground/20 group h-full cursor-pointer">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2.5 transition-transform group-hover:scale-110">
                <RefreshCw className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Movimientos de Stock</p>
                <p className="text-xs text-muted-foreground">Entradas, salidas y ajustes</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/inventario/ordenes-compra">
          <Card className="transition-all duration-200 hover:shadow-md hover:border-foreground/20 group h-full cursor-pointer">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-2.5 transition-transform group-hover:scale-110">
                <ShoppingCart className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Órdenes de Compra</p>
                <p className="text-xs text-muted-foreground">Compras a proveedores</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/inventario/herramientas">
          <Card className="transition-all duration-200 hover:shadow-md hover:border-foreground/20 group h-full cursor-pointer">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-2.5 transition-transform group-hover:scale-110">
                <Wrench className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Herramientas</p>
                <p className="text-xs text-muted-foreground">Catálogo, préstamos y mantenimiento</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
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
        actions={
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open("/inventory/reports/stock", "_blank")}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />Stock
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open("/inventory/reports/valuation", "_blank")}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />Valorización
            </Button>
          </div>
        }
      />
    </div>
  );
}
