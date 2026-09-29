/**
 * T-51 — Sidebar en cascada (TRN-06)
 *
 * Criterios de la auditoría 2026-09-25:
 *  - Grupos abren/cierran y recuerdan estado (localStorage)
 *  - Auto-expandir la sección de la ruta activa
 *  - 0 badges falsos ("Nuevo", WhatsApp "3" hardcodeado)
 *  - Badge WhatsApp con el contador real de /whatsapp/queue/stats
 *  - Menú = permisos: items filtrados por rol (ocultar, no deshabilitar)
 *
 * @module web/tests/components/sidebar
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { DashboardSidebar } from "@/components/dashboard/sidebar";

// ─── Mocks ─────────────────────────────────────

const { mockPathname, mockGetStats, mockRole } = vi.hoisted(() => ({
  mockPathname: { current: "/dashboard/hub" },
  mockGetStats: vi.fn(),
  mockRole: { current: "admin" as string | undefined },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement(
      "a",
      { href: typeof href === "string" ? href : "#", ...rest },
      children,
    ),
}));

vi.mock("@/components/providers/session-provider", () => ({
  useAuth: () => ({
    user: mockRole.current
      ? { role: mockRole.current, tenantSlug: "test" }
      : undefined,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: { getWhatsAppQueueStats: mockGetStats },
}));

// lucide-react: lista de iconos que importa el sidebar (MockIcon = null)
vi.mock("lucide-react", () => {
  const MockIcon = () => null;
  const names = [
    "LayoutDashboard", "Wrench", "Package", "DollarSign", "Settings",
    "Calendar", "MessageSquare", "BarChart3", "FileText", "Receipt",
    "CreditCard", "Shield", "Truck", "Users", "User", "ChevronLeft",
    "ChevronRight", "ChevronDown", "Car", "Building2", "GitBranch",
    "ClipboardCheck", "Scan", "Calculator", "PieChart", "Megaphone",
    "Printer", "Database", "Fingerprint", "TrendingUp", "Landmark",
    "ScrollText", "RefreshCw", "RotateCcw", "ShoppingCart", "Timer",
    "UserCheck", "Brain", "Warehouse", "Search", "Zap", "Plus",
  ];
  return Object.fromEntries(names.map((n) => [n, MockIcon]));
});

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(DashboardSidebar, {
        collapsed: false,
        onToggle: () => {},
      }),
    ),
  );
}

// ─── Tests ─────────────────────────────────────

describe("T-51 — Sidebar en cascada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockPathname.current = "/dashboard/hub";
    mockRole.current = "admin";
    mockGetStats.mockResolvedValue({
      pending: 0,
      sent: 0,
      failed: 0,
      totalRetries: 0,
    });
  });

  it("0 badges falsos: sin 'Nuevo' ni el '3' de WhatsApp hardcodeado", async () => {
    renderSidebar();
    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalled();
    });
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    // los ítems siguen visibles (solo cambian los badges)
    expect(screen.getByText("Hub de Operaciones")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
  });

  it("badge WhatsApp muestra el contador real de la cola", async () => {
    mockGetStats.mockResolvedValue({
      pending: 7,
      sent: 12,
      failed: 1,
      totalRetries: 3,
    });
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
  });

  it("secciones colapsables: cerrar recuerda el estado en localStorage", async () => {
    const { unmount } = renderSidebar();
    expect(screen.getByText("Stock General")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Inventario" }));
    expect(screen.queryByText("Stock General")).not.toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("so:sidebar:sections") || "[]"),
    ).toContain("Inventario");

    // nueva sesión (remount) → la sección sigue cerrada
    unmount();
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inventario" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Stock General")).not.toBeInTheDocument();
  });

  it("auto-expandir la sección de la ruta activa", async () => {
    window.localStorage.setItem(
      "so:sidebar:sections",
      JSON.stringify(["Inventario", "Finanzas"]),
    );
    mockPathname.current = "/dashboard/inventario/movimientos";

    renderSidebar();
    // la sección activa se abre aunque esté persistida como cerrada
    await waitFor(() => {
      expect(screen.getByText("Stock General")).toBeInTheDocument();
    });
    expect(
      JSON.parse(window.localStorage.getItem("so:sidebar:sections") || "[]"),
    ).not.toContain("Inventario");
    // las demás secciones cerradas permanecen cerradas
    expect(screen.queryByText("Facturación")).not.toBeInTheDocument();
  });

  it("menú = permisos: mechanic no ve items manager/admin", async () => {
    mockRole.current = "mechanic";
    renderSidebar();

    expect(screen.getByText("Hub de Operaciones")).toBeInTheDocument();
    expect(screen.getByText("Recepción")).toBeInTheDocument();
    // admin-only (requireAdmin en backend)
    expect(screen.queryByText("Backup")).not.toBeInTheDocument();
    expect(screen.queryByText("Enterprise")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("Seguridad")).not.toBeInTheDocument();
    // manager-only (requireManager en backend)
    expect(screen.queryByText("Contabilidad")).not.toBeInTheDocument();
    expect(screen.queryByText("SIFEN")).not.toBeInTheDocument();
    expect(screen.queryByText("Tesorería")).not.toBeInTheDocument();
    expect(screen.queryByText("Flotas")).not.toBeInTheDocument();
    expect(screen.queryByText("Marketing")).not.toBeInTheDocument();
    expect(screen.queryByText("Mecánicos")).not.toBeInTheDocument();
    expect(screen.queryByText("Almacenes")).not.toBeInTheDocument();
    expect(screen.queryByText("Nómina")).not.toBeInTheDocument();
  });

  it("menú = permisos: manager ve items manager pero no admin", async () => {
    mockRole.current = "manager";
    renderSidebar();

    expect(screen.getByText("Contabilidad")).toBeInTheDocument();
    expect(screen.getByText("SIFEN")).toBeInTheDocument();
    expect(screen.getByText("Flotas")).toBeInTheDocument();
    expect(screen.queryByText("Backup")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("Enterprise")).not.toBeInTheDocument();
  });

  it("menú = permisos: admin ve todo", async () => {
    mockRole.current = "admin";
    renderSidebar();

    expect(screen.getByText("Backup")).toBeInTheDocument();
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Contabilidad")).toBeInTheDocument();
    expect(screen.getByText("SIFEN")).toBeInTheDocument();
  });

  it("rol desconocido (supervisor) no supera ningún minRole — igual que el backend", async () => {
    mockRole.current = "supervisor";
    renderSidebar();

    expect(screen.getByText("Hub de Operaciones")).toBeInTheDocument();
    expect(screen.queryByText("Contabilidad")).not.toBeInTheDocument();
    expect(screen.queryByText("Backup")).not.toBeInTheDocument();
  });
});
