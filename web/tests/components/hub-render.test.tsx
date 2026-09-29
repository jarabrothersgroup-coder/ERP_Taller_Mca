/**
 * Operations Hub Render Test — Sprint 96
 *
 * Tests that the Hub de Operaciones page renders correctly
 * with mocked API data, verifying the Kanban sidebar, detail panel,
 * header stats, and empty state.
 *
 * @module web/tests/components/hub-render
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

// Static import avoids Vitest module caching issues with React.lazy
import HubPage from "@/app/(dashboard)/dashboard/hub/page";

// ─── Mocks ─────────────────────────────────────

// Use vi.hoisted to define mock fns before vi.mock hoisting (avoids TDZ errors)
// Note: React.createElement is NOT available inside vi.hoisted (runs before imports)
const { mockListWorkOrders, mockGetHubBoard, mockRequest, MockIcon } = vi.hoisted(() => ({
  mockListWorkOrders: vi.fn(),
  mockGetHubBoard: vi.fn(),
  mockRequest: vi.fn(),
  MockIcon: () => null as any,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/hub",
  useParams: () => ({}),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));

// Board SSE subscription is browser-network behavior — not under test here
vi.mock("@/hooks/use-hub-board-sse", () => ({
  useHubBoardSse: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  LayoutDashboard: MockIcon,
  Wrench: MockIcon,
  Package: MockIcon,
  Clock: MockIcon,
  CheckCircle2: MockIcon,
  AlertTriangle: MockIcon,
  FileText: MockIcon,
  Receipt: MockIcon,
  MessageCircle: MockIcon,
  Send: MockIcon,
  DollarSign: MockIcon,
  ArrowRight: MockIcon,
  Car: MockIcon,
  User: MockIcon,
  Phone: MockIcon,
  ExternalLink: MockIcon,
  Star: MockIcon,
  ChevronRight: MockIcon,
  ChevronDown: MockIcon,
  Camera: MockIcon,
  ClipboardCheck: MockIcon,
  Printer: MockIcon,
  Search: MockIcon,
  Zap: MockIcon,
  X: MockIcon,
  Building2: MockIcon,
  Filter: MockIcon,
  Plus: MockIcon,
  Timer: MockIcon,
  TrendingUp: MockIcon,
  Users: MockIcon,
  Calendar: MockIcon,
  GitBranch: MockIcon,
  GripVertical: MockIcon,
  Inbox: MockIcon,
  RefreshCw: MockIcon,
}));

vi.mock("@/lib/api", () => ({
  api: {
    request: mockRequest,
    listWorkOrders: mockListWorkOrders,
    getHubBoard: mockGetHubBoard,
    getWorkOrder: vi.fn(),
    createWorkOrder: vi.fn(),
    createClient: vi.fn(),
    createVehicle: vi.fn(),
    updateWorkOrderStatus: vi.fn(),
    assignWorkOrder: vi.fn(),
    issueInvoice: vi.fn(),
    sendWhatsAppMessage: vi.fn(),
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// Mock child components to simplify render test (we already have integration tests)
vi.mock("@/components/hub/hub-sidebar", () => ({
  HubSidebar: ({ ordenes, selectedId, onSelect }: any) =>
    React.createElement("div", { "data-testid": "hub-sidebar" },
      React.createElement("span", null, `Sidebar: ${ordenes.length} OTs, selected: ${selectedId || "none"}`),
      ordenes.length > 0 && React.createElement(
        "button",
        { "data-testid": "select-ot", onClick: () => onSelect?.(ordenes[0]) },
        "select"
      )
    ),
}));

vi.mock("@/components/hub/ot-detail-panel", () => ({
  OTDetailPanel: ({ orden }: any) =>
    React.createElement("div", { "data-testid": "ot-detail-panel" },
      React.createElement("span", null, orden ? `Detail: OT #${orden.id}` : "No OT selected")
    ),
}));

vi.mock("@/components/hub/quick-create-modal", () => ({
  QuickCreateModal: ({ open }: any) =>
    open ? React.createElement("div", { "data-testid": "quick-create-modal" }, "Quick Create Modal") : null,
}));

function renderHub() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(HubPage)
    )
  );
}

// ─── Tests ─────────────────────────────────────

describe("Operations Hub — Render Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: empty board (no OTs, no technicians)
    mockGetHubBoard.mockResolvedValue({ ordenes: [], tecnicos: [], generatedAt: new Date().toISOString() });
    mockRequest.mockResolvedValue([]);
  });

  it("renders the Hub page title and create button", async () => {
    renderHub();
    await waitFor(() => {
      expect(screen.getByText("Hub de Operaciones")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Nueva OT/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the HubSidebar component", async () => {
    mockGetHubBoard.mockResolvedValue({
      ordenes: [
        { id: "ot-1", vehicleId: "v1", clientId: "c1", status: "En_Proceso", description: "Test", totalCost: "100000", createdAt: new Date().toISOString() },
      ],
      tecnicos: [],
      generatedAt: new Date().toISOString(),
    });
    renderHub();
    await waitFor(() => {
      expect(screen.getByTestId("hub-sidebar")).toBeInTheDocument();
    });
  });

  it("renders the OTDetailPanel with empty state", async () => {
    renderHub();
    await waitFor(() => {
      expect(screen.getByTestId("ot-detail-panel")).toBeInTheDocument();
    });
    expect(screen.getByText("No OT selected")).toBeInTheDocument();
  });

  it("shows active order count badge", async () => {
    mockGetHubBoard.mockResolvedValue({
      ordenes: [
        { id: "ot-1", vehicleId: "v1", clientId: "c1", status: "En_Proceso", description: "Test", totalCost: "500000", createdAt: new Date().toISOString() },
        { id: "ot-2", vehicleId: "v1", clientId: "c1", status: "Listo", description: "Test 2", totalCost: "300000", createdAt: new Date().toISOString() },
      ],
      tecnicos: [],
      generatedAt: new Date().toISOString(),
    });
    mockRequest
      .mockResolvedValueOnce([{ id: "v1", brand: "Toyota", model: "Hilux", plate: "ABC 1234" }]) // vehicles
      .mockResolvedValueOnce([{ id: "c1", name: "Juan Pérez", phone: "0981123456" }]); // clients

    renderHub();
    await waitFor(() => {
      expect(screen.getByText(/2 total/)).toBeInTheDocument();
    });
  });

  it("counts OTs by status correctly", async () => {
    mockGetHubBoard.mockResolvedValue({
      ordenes: [
        { id: "ot-1", vehicleId: "v1", clientId: "c1", status: "Presupuestado", description: "Test", totalCost: "100000", createdAt: new Date().toISOString() },
        { id: "ot-2", vehicleId: "v1", clientId: "c1", status: "En_Proceso", description: "Test", totalCost: "200000", createdAt: new Date().toISOString() },
        { id: "ot-3", vehicleId: "v1", clientId: "c1", status: "En_Proceso", description: "Test", totalCost: "300000", createdAt: new Date().toISOString() },
        { id: "ot-4", vehicleId: "v1", clientId: "c1", status: "Listo", description: "Test", totalCost: "400000", createdAt: new Date().toISOString() },
      ],
      tecnicos: [],
      generatedAt: new Date().toISOString(),
    });
    mockRequest
      .mockResolvedValueOnce([{ id: "v1", brand: "Toyota", model: "Hilux", plate: "ABC-1" }]) // vehicles
      .mockResolvedValueOnce([{ id: "c1", name: "Juan", phone: "0981" }]); // clients

    renderHub();
    await waitFor(() => {
      expect(screen.getByText(/1 presup/)).toBeInTheDocument();
      expect(screen.getByText(/2 en proceso/)).toBeInTheDocument();
      expect(screen.getByText(/1 listos/)).toBeInTheDocument();
    });
  });

  it("calls getHubBoard API on mount", async () => {
    renderHub();
    await waitFor(() => {
      expect(mockGetHubBoard).toHaveBeenCalled();
    });
  });

  it("renders sidebar with OT count", async () => {
    mockGetHubBoard.mockResolvedValue({
      ordenes: [
        { id: "ot-1", vehicleId: "v1", clientId: "c1", status: "Presupuestado", description: "Test", totalCost: "100000", createdAt: new Date().toISOString() },
      ],
      tecnicos: [],
      generatedAt: new Date().toISOString(),
    });
    mockRequest
      .mockResolvedValueOnce([{ id: "v1", brand: "Toyota", model: "Hilux", plate: "ABC 1234" }])
      .mockResolvedValueOnce([{ id: "c1", name: "Juan Pérez", phone: "0981123456" }]);

    renderHub();
    await waitFor(() => {
      expect(screen.getByText(/Sidebar:/)).toBeInTheDocument();
    });
  });

  it("T-52: seleccionar una OT NO la asigna automáticamente", async () => {
    mockGetHubBoard.mockResolvedValue({
      ordenes: [
        // Asignada a m1 para que sea visible bajo el filtro de técnico
        { id: "ot-1", vehicleId: "v1", clientId: "c1", status: "En_Proceso", description: "Test", totalCost: "100000", assignedTo: "m1", createdAt: new Date().toISOString() },
      ],
      tecnicos: [{ id: "m1", nombre: "Mecánico 1", activo: true }],
      generatedAt: new Date().toISOString(),
    });

    const { api } = await import("@/lib/api");
    renderHub();
    await waitFor(() => {
      expect(screen.getByTestId("select-ot")).toBeInTheDocument();
    });

    // Filtrar por técnico m1 (dispara el viejo auto-assign si regresara)
    const filterSelect = screen.getByRole("combobox");
    fireEvent.change(filterSelect, { target: { value: "m1" } });

    fireEvent.click(screen.getByTestId("select-ot"));
    await waitFor(() => {
      expect(screen.getByTestId("ot-detail-panel")).toBeInTheDocument();
    });

    // Criterio T-52: 0 asignaciones fantasma al seleccionar
    expect(api.assignWorkOrder).not.toHaveBeenCalled();
  });

  it("handles empty OT list gracefully", async () => {
    renderHub();
    await waitFor(() => {
      // T-52: estado vacío explícito en la columna de OTs (no skeleton, no sidebar)
      expect(screen.getByText("Sin órdenes abiertas")).toBeInTheDocument();
    });
  });
});
