import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PredictiveMLPage from "@/app/(dashboard)/dashboard/taller/predictive-ml/page";

// Mock the api module
vi.mock("@/lib/api", () => ({
  api: {
    request: vi.fn(),
  },
  getTenantSlug: () => "demo",
  setTenantSlug: vi.fn(),
}));

// Mock useToast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    ToastContainer: <div data-testid="toast-container" />,
  }),
}));

// Mock lucide-react icons (only those used by Predictive ML page)
vi.mock("lucide-react", () => ({
  Brain: "brain",
  AlertTriangle: "alert-triangle",
  CheckCircle2: "check-circle-2",
  TrendingUp: "trending-up",
  Car: "car",
  Search: "search",
  Gauge: "gauge",
  Calendar: "calendar",
  DollarSign: "dollar-sign",
  Shield: "shield",
  Zap: "zap",
  Activity: "activity",
  BarChart3: "bar-chart-3",
  FileText: "file-text",
  RefreshCw: "refresh-cw",
  Sparkles: "sparkles",
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("PredictiveMLPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header and search input", () => {
    renderWithQuery(<PredictiveMLPage />);
    expect(screen.getByText("Mantenimiento Predictivo ML")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("UUID del vehículo...")).toBeInTheDocument();
  });

  it("renders all 3 tabs", () => {
    renderWithQuery(<PredictiveMLPage />);
    expect(screen.getByText("Por Vehículo")).toBeInTheDocument();
    expect(screen.getByText("Flota")).toBeInTheDocument();
    expect(screen.getByText("Estadísticas ML")).toBeInTheDocument();
  });

  it("shows empty state when no vehicle ID is entered", () => {
    renderWithQuery(<PredictiveMLPage />);
    expect(screen.getByText("Ingresá un ID de vehículo")).toBeInTheDocument();
  });

  it("renders the refresh button", () => {
    renderWithQuery(<PredictiveMLPage />);
    expect(screen.getByText("Refrescar")).toBeInTheDocument();
  });

  it("renders the 'Analizar' button (disabled initially)", () => {
    renderWithQuery(<PredictiveMLPage />);
    const btn = screen.getByText("Analizar").closest("button");
    expect(btn).toBeDisabled();
  });
});
