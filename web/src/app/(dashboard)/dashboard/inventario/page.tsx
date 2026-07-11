"use client";

import * as React from "react";
import {
  Plus,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { fetchInventoryItems, type UIMappedInventoryItem } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

type InventoryStatus = "ok" | "low" | "critical";

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  stock: number;
  minStock: number;
  price: number;
  location: string;
  status: InventoryStatus;
}

/* ── Mock Data ──────────────────────────────── */

const categories = [
  "Frenos",
  "Motor",
  "Suspensión",
  "Eléctrico",
  "Transmisión",
  "Carrocería",
  "Lubricantes",
  "Neumáticos",
];

function getMockInventory(): InventoryItem[] {
  return Array.from({ length: 48 }, (_, i) => {
    const stockLevels = [
      { stock: 15, min: 5 },
      { stock: 3, min: 10 },
      { stock: 1, min: 5 },
      { stock: 8, min: 8 },
      { stock: 25, min: 10 },
      { stock: 0, min: 3 },
      { stock: 45, min: 15 },
      { stock: 6, min: 5 },
    ];
    const level = stockLevels[i % stockLevels.length];
    const status: InventoryItem["status"] =
      level.stock === 0 ? "critical" : level.stock <= level.min ? "low" : "ok";
    const cat = categories[i % categories.length];

    return {
      id: `INV-${String(i + 1).padStart(4, "0")}`,
      code: `PZ-${String(100 + i).padStart(4, "0")}`,
      name: [
        "Pastillas de Freno Delanteras",
        "Filtro de Aceite",
        "Amortiguador Trasero",
        "Bujía Iridium",
        "Correa de Distribución",
        "Batería 12V 60Ah",
        "Aceite Motor 5W30 4L",
        "Disco de Freno Trasero",
        "Sensor de Oxígeno",
        "Filtro de Aire",
        "Bomba de Agua",
        "Termostato",
      ][i % 12],
      category: cat,
      brand: ["Bosch", "NGK", "SKF", "Valeo", "Mann", "ACDelco"][i % 6],
      stock: level.stock,
      minStock: level.min,
      price: [85000, 45000, 320000, 120000, 250000, 550000, 135000, 180000, 210000, 95000, 380000, 65000][
        i % 12
      ],
      location: `A${Math.floor(i / 12) + 1}-${String((i % 12) + 1).padStart(2, "0")}`,
      status,
    };
  });
}

const statusColors: Record<InventoryItem["status"], "success" | "warning" | "destructive"> = {
  ok: "success",
  low: "warning",
  critical: "destructive",
};

const statusLabels: Record<InventoryItem["status"], string> = {
  ok: "Normal",
  low: "Stock Bajo",
  critical: "Crítico",
};

/* ── Columns ────────────────────────────────── */

const columns: Column<InventoryItem>[] = [
  {
    header: "Código",
    accessor: "code",
    sortable: true,
    className: "font-mono text-xs",
  },
  {
    header: "Producto",
    accessor: "name",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">{row.brand}</p>
      </div>
    ),
  },
  {
    header: "Categoría",
    accessor: "category",
    sortable: true,
    hideOnMobile: true,
    cell: (_, row) => (
      <Badge variant="secondary" className="font-normal">
        {row.category}
      </Badge>
    ),
  },
  {
    header: "Stock",
    accessor: "stock",
    sortable: true,
    align: "right",
    cell: (value, row) => (
      <div className="flex items-center justify-end gap-2">
        <span className={cn(
          "font-medium tabular-nums",
          row.status === "critical" && "text-destructive",
          row.status === "low" && "text-amber-500"
        )}>
          {row.stock}
        </span>
        {row.stock <= row.minStock && (
          <AlertTriangle
            className={cn(
              "h-3.5 w-3.5",
              row.status === "critical" ? "text-destructive" : "text-amber-500"
            )}
            aria-hidden="true"
          />
        )}
      </div>
    ),
  },
  {
    header: "Stock Mín.",
    accessor: "minStock",
    sortable: true,
    align: "right",
    hideOnMobile: true,
  },
  {
    header: "Precio",
    accessor: "price",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums">
        ₲ {Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Ubicación",
    accessor: "location",
    hideOnMobile: true,
    className: "text-xs text-muted-foreground",
  },
  {
    header: "Estado",
    accessor: "status",
    sortable: true,
    sortKey: "status",
    cell: (_, row) => (
      <Badge variant={statusColors[row.status]}>
        {statusLabels[row.status]}
      </Badge>
    ),
  },
];

/* ── Stats Cards ────────────────────────────── */

function InventoryStats({ items }: { items: InventoryItem[] }) {
  const totalItems = items.length;
  const totalValue = items.reduce((acc, item) => acc + item.stock * item.price, 0);
  const lowStock = items.filter((i) => i.status === "low" || i.status === "critical").length;
  const critical = items.filter((i) => i.status === "critical").length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Productos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalItems}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Valor Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">₲ {(totalValue / 1_000_000).toFixed(1)}M</p>
        </CardContent>
      </Card>
      <Card className={cn(lowStock > 0 && "border-amber-200 dark:border-amber-800")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            Stock Bajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", lowStock > 0 && "text-amber-500")}>
            {lowStock}
          </p>
        </CardContent>
      </Card>
      <Card className={cn(critical > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            Crítico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", critical > 0 && "text-destructive")}>
            {critical}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function InventoryPage() {
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");

  // Fetch from API with mock fallback
  React.useEffect(() => {
    let cancelled = false;
    fetchInventoryItems(getMockInventory).then((data) => {
      if (!cancelled) {
        setAllItems(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // State for all items (from API or mock)
  const [allItems, setAllItems] = React.useState<InventoryItem[]>([]);

  // Filter data
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
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de repuestos y productos del taller
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo Producto
        </Button>
      </div>

      {/* ── Critical Stock Alerts ────────────── */}
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

      {/* ── Stats ──────────────────────────── */}
      {!loading && <InventoryStats items={filtered} />}

      {/* ── Filters + Table ────────────────── */}
      <DataTable<InventoryItem>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || categoryFilter
            ? "No se encontraron productos con esos filtros"
            : "No hay productos registrados. Agregue su primer producto para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar producto o código…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        compact={false}
        stickyHeader
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </Button>
        }
      />
    </div>
  );
}


