/**
 * FB-2 · ADM-04 — Render del panel por rol.
 *
 * Verifica que `/dashboard` ya no muestra el mismo tablero para todos: el
 * `view` que devuelve `GET /config/dashboard/role` decide qué se renderiza
 * (admin consolidado, gerente sucursal, mecánico sus OTs, usuario stats base).
 *
 * @module web/tests/components/dashboard-role
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";

import DashboardPage from "@/app/(dashboard)/dashboard/page";

/* ── Mocks ───────────────────────────────────── */

const {
  mockRoleDashboard,
  mockConsolidated,
  mockRole,
} = vi.hoisted(() => ({
  mockRoleDashboard: vi.fn(),
  mockConsolidated: vi.fn(),
  mockRole: { current: "admin" as string | undefined },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children),
}));

// Los iconos no aportan al comportamiento bajo prueba
vi.mock("lucide-react", () => {
  const MockIcon = () => null;
  return {
    Activity: MockIcon,
    AlertTriangle: MockIcon,
    Building2: MockIcon,
    CalendarCheck: MockIcon,
    ClipboardList: MockIcon,
    DollarSign: MockIcon,
    Gauge: MockIcon,
    Inbox: MockIcon,
    RefreshCw: MockIcon,
    TrendingUp: MockIcon,
    UserCog: MockIcon,
    Users: MockIcon,
    Wrench: MockIcon,
  };
});

vi.mock("@/components/providers/session-provider", () => ({
  useAuth: () => ({
    user: mockRole.current
      ? { id: "u-1", email: "a@b.c", fullName: "Ana Admin", role: mockRole.current, tenantSlug: "demo", tenantName: "Demo" }
      : null,
  }),
}));

vi.mock("@/hooks/use-data", () => ({
  useRoleDashboard: () => mockRoleDashboard(),
  useConsolidatedDashboard: () => mockConsolidated(),
}));

/* ── Fixtures ────────────────────────────────── */

const BRANCH = {
  sucursalId: "00000000-0000-0000-0000-000000000001",
  sucursalNombre: "Casa Central",
  otActivas: 4,
  otCompletadasMes: 3,
  ingresoMes: 750000,
  eficienciaMecanicos: 90,
  stockBajo: 2,
};

function loaded(data: Record<string, unknown>) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRole.current = "admin";
  mockConsolidated.mockReturnValue({
    data: { totalSucursales: 1, totalOTActivas: 4, totalOTCompletadasMes: 3, totalIngresoMes: 750000, eficienciaPromedio: 88, sucursales: [BRANCH] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe("FB-2 — /dashboard por rol", () => {
  it("renderiza la vista admin con stats, eficiencia promedio y detalle por sucursal", () => {
    mockRoleDashboard.mockReturnValue(
      loaded({
        view: "admin",
        totalOTs: 20,
        otActivas: 7,
        totalSucursales: 1,
        totalIngresoMes: 750000,
        totalOTCompletadasMes: 3,
        branches: [BRANCH],
      }),
    );

    render(<DashboardPage />);

    expect(screen.getByTestId("view-admin")).toBeInTheDocument();
    expect(screen.getByText("Sucursales activas")).toBeInTheDocument();
    expect(screen.getByText("Eficiencia promedio")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByTestId("branch-table")).toBeInTheDocument();
    expect(screen.getByText("Casa Central")).toBeInTheDocument();
  });

  it("renderiza la vista gerente acotada a una sucursal", () => {
    mockRole.current = "manager";
    mockRoleDashboard.mockReturnValue(
      loaded({ view: "manager", totalOTs: 20, otActivas: 7, branch: BRANCH }),
    );

    render(<DashboardPage />);

    expect(screen.getByTestId("view-manager")).toBeInTheDocument();
    expect(screen.getByText("Completadas (mes)")).toBeInTheDocument();
    expect(screen.queryByTestId("view-admin")).not.toBeInTheDocument();
    // No se consulta el consolidado para gerentes
    expect(mockConsolidated).not.toHaveBeenCalled();
  });

  it("renderiza la vista mecánico con 'Mis OTs activas'", () => {
    mockRole.current = "mechanic";
    mockRoleDashboard.mockReturnValue(
      loaded({ view: "mechanic", totalOTs: 20, otActivas: 7, myActiveOTs: 3 }),
    );

    render(<DashboardPage />);

    expect(screen.getByTestId("view-mechanic")).toBeInTheDocument();
    expect(screen.getByText("Mis OTs activas")).toBeInTheDocument();
    expect(screen.getByText("Ir al Hub de Operaciones")).toBeInTheDocument();
  });

  it("renderiza la vista usuario con las stats base", () => {
    mockRole.current = "user";
    mockRoleDashboard.mockReturnValue(
      loaded({ view: "user", totalOTs: 20, otActivas: 7 }),
    );

    render(<DashboardPage />);

    expect(screen.getByTestId("view-user")).toBeInTheDocument();
    expect(screen.getByTestId("role-view-badge")).toHaveTextContent("Usuario");
    // La única vista expuesta es la de usuario: no hay secciones de gerente/admin
    expect(screen.queryByTestId("view-admin")).not.toBeInTheDocument();
    expect(screen.queryByTestId("view-manager")).not.toBeInTheDocument();
    expect(screen.queryByTestId("view-mechanic")).not.toBeInTheDocument();
  });

  it("muestra el estado de error con reintento cuando la query falla", () => {
    mockRoleDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText("No se pudo cargar el panel")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
