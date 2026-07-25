"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Search,
  Package,
  Car,
  Wrench,
  ExternalLink,
  Info,
  BookOpen,
} from "lucide-react";

/* ─── Types ──────────────────────────────────── */

interface TecDocPart {
  articleNumber: string;
  description: string;
  brand: string;
  price: number;
  currency: string;
  availability: string;
  imageUrl?: string;
}

interface TecDocStatus {
  configured: boolean;
  provider: string;
}

/* ─── View Modes ──────────────────────────────── */

type SearchMode = "vin" | "brand";

const PRICE_LABELS: Record<string, string> = {
  Gs: "₲",
  USD: "$",
  EUR: "€",
};

/* ─── Main Page ────────────────────────────────── */

export default function TecDocPage() {
  const { toast: t, ToastContainer } = useToast();
  const [activeTab, setActiveTab] = React.useState<SearchMode>("vin");
  const [vinQuery, setVinQuery] = React.useState("");
  const [vinSearch, setVinSearch] = React.useState("");
  const [vinPartQuery, setVinPartQuery] = React.useState("");

  const [brand, setBrand] = React.useState("");
  const [model, setModel] = React.useState("");
  const [year, setYear] = React.useState("");
  const [brandPartQuery, setBrandPartQuery] = React.useState("");
  const [brandSearch, setBrandSearch] = React.useState<{ brand: string; model: string; year: string; q: string } | null>(null);

  // Status
  const { data: status } = useQuery<TecDocStatus>({
    queryKey: ["tecdoc-status"],
    queryFn: () => api.request("/inventory/tecdoc/status"),
  });

  // VIN search
  const vinSearchQuery = useQuery<{ parts: TecDocPart[]; total: number; source: string }>({
    queryKey: ["tecdoc-vin", vinSearch, vinPartQuery],
    queryFn: () => api.request(`/inventory/tecdoc/search/vin?vin=${encodeURIComponent(vinSearch)}&q=${encodeURIComponent(vinPartQuery || "parts")}`),
    enabled: vinSearch.length === 17 && vinPartQuery.length > 0,
  });

  // Brand search
  const brandSearchQuery = useQuery<{ parts: TecDocPart[]; total: number; source: string }>({
    queryKey: ["tecdoc-brand", brandSearch],
    queryFn: () => api.request(`/inventory/tecdoc/search/brand?brand=${encodeURIComponent(brandSearch!.brand)}&model=${encodeURIComponent(brandSearch!.model)}&year=${brandSearch!.year}&q=${encodeURIComponent(brandSearch!.q)}`),
    enabled: !!brandSearch,
  });

  const handleVinSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (vinQuery.length === 17) {
      setVinSearch(vinQuery);
    } else {
      t.error("El VIN debe tener 17 caracteres");
    }
  };

  const handleBrandSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (brand && model && year && brandPartQuery) {
      setBrandSearch({ brand, model, year, q: brandPartQuery });
    } else {
      t.error("Completá marca, modelo, año y descripción");
    }
  };

  const partsColumns: Column<TecDocPart>[] = [
    {
      header: "Artículo",
      accessor: "articleNumber",
      cell: (_, row) => <span className="font-mono text-xs font-medium">{row.articleNumber}</span>,
    },
    {
      header: "Descripción",
      accessor: "description",
      cell: (_, row) => <span className="text-sm font-medium">{row.description}</span>,
    },
    {
      header: "Marca",
      accessor: "brand",
      cell: (_, row) => <Badge variant="outline" className="text-xs">{row.brand}</Badge>,
      hideOnMobile: true,
    },
    {
      header: "Precio",
      accessor: "price",
      align: "right",
      cell: (_, row) => (
        <span className="font-medium">
          {PRICE_LABELS[row.currency] || row.currency} {row.price.toLocaleString()}
        </span>
      ),
    },
    {
      header: "Disponibilidad",
      accessor: "availability",
      cell: (_, row) => (
        <Badge variant={row.availability === "IN_STOCK" ? "success" : "secondary"} className="text-xs">
          {row.availability === "IN_STOCK" ? "En stock" : row.availability === "ORDERABLE" ? "Disponible" : "Bajo pedido"}
        </Badge>
      ),
      hideOnMobile: true,
    },
    {
      header: "",
      accessor: "imageUrl",
      cell: (_, row) => row.imageUrl ? (
        <a href={row.imageUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </a>
      ) : null,
    },
  ];

  const currentParts = activeTab === "vin" ? vinSearchQuery.data?.parts : brandSearchQuery.data?.parts;
  const currentLoading = activeTab === "vin" ? vinSearchQuery.isLoading : brandSearchQuery.isLoading;
  const currentTotal = activeTab === "vin" ? vinSearchQuery.data?.total : brandSearchQuery.data?.total;
  const currentSource = activeTab === "vin" ? vinSearchQuery.data?.source : brandSearchQuery.data?.source;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {ToastContainer}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-500" />
            Catálogo TecDoc
          </h1>
          <p className="text-sm text-muted-foreground">
            Búsqueda de repuestos por VIN o marca/modelo — {status?.configured ? "Conectado" : "Sin conexión"}
          </p>
        </div>
        {!status?.configured && (
          <Badge variant="secondary" className="gap-1.5">
            <Info className="h-3 w-3" />
            API no configurada
          </Badge>
        )}
      </div>

      {/* Search Mode Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SearchMode)}>
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="vin" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Búsqueda por VIN
          </TabsTrigger>
          <TabsTrigger value="brand" className="gap-1.5">
            <Car className="h-3.5 w-3.5" />
            Marca / Modelo
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════ */}
        {/* TAB: VIN Search */}
        {/* ════════════════════════════════════════ */}
        <TabsContent value="vin" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleVinSearch} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                      VIN del Vehículo (17 caracteres)
                    </label>
                    <Input
                      value={vinQuery}
                      onChange={(e) => setVinQuery(e.target.value.toUpperCase())}
                      placeholder="Ej: 8AGCM19T0XY123456"
                      maxLength={17}
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                      Parte a buscar
                    </label>
                    <Input
                      value={vinPartQuery}
                      onChange={(e) => setVinPartQuery(e.target.value)}
                      placeholder="Ej: filtro aceite, pastillas freno..."
                    />
                  </div>
                </div>
                <Button type="submit" disabled={vinQuery.length !== 17 || !vinPartQuery}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Partes
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {currentLoading ? (
            <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : currentParts && currentParts.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  Resultados: {currentTotal} parte{currentTotal !== 1 ? "s" : ""}
                </CardTitle>
                <CardDescription>Fuente: {currentSource}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable<TecDocPart>
                  columns={partsColumns}
                  data={currentParts}
                  rowKey="articleNumber"
                  paginate
                  pageSize={10}
                  className="border-0"
                />
              </CardContent>
            </Card>
          ) : vinSearchQuery.isFetched ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No se encontraron partes para este VIN</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Probá con otro término de búsqueda</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Car className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ingresá un VIN para buscar partes</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════ */}
        {/* TAB: Brand/Model Search */}
        {/* ════════════════════════════════════════ */}
        <TabsContent value="brand" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleBrandSearch} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Marca</label>
                    <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej: Toyota" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Modelo</label>
                    <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej: Corolla" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Año</label>
                    <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Ej: 2020" type="number" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Parte a buscar</label>
                    <Input value={brandPartQuery} onChange={(e) => setBrandPartQuery(e.target.value)} placeholder="Ej: filtro aceite, pastillas freno..." />
                  </div>
                  <Button type="submit" className="self-end" disabled={!brand || !model || !year || !brandPartQuery}>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {brandSearchQuery.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : brandSearchQuery.data?.parts && brandSearchQuery.data.parts.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  Resultados: {brandSearchQuery.data.total} parte{brandSearchQuery.data.total !== 1 ? "s" : ""}
                </CardTitle>
                <CardDescription>
                  {brandSearch?.brand} {brandSearch?.model} {brandSearch?.year} — Fuente: {brandSearchQuery.data.source}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable<TecDocPart>
                  columns={partsColumns}
                  data={brandSearchQuery.data.parts}
                  rowKey="articleNumber"
                  paginate
                  pageSize={10}
                  className="border-0"
                />
              </CardContent>
            </Card>
          ) : brandSearchQuery.isFetched ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No se encontraron partes para esta combinación</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Probá con otros parámetros de búsqueda</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Car className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ingresá marca, modelo, año y parte a buscar</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
