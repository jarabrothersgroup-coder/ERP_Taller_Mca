import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TecDocPage from "@/app/(dashboard)/dashboard/inventario/tecdoc/page";

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

// Mock lucide-react icons (only those used by TecDoc page)
vi.mock("lucide-react", () => ({
  Search: "search",
  Package: "package",
  Car: "car",
  Wrench: "wrench",
  ExternalLink: "external-link",
  Info: "info",
  BookOpen: "book-open",
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("TecDocPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header", () => {
    renderWithQuery(<TecDocPage />);
    expect(screen.getByText("Catálogo TecDoc")).toBeInTheDocument();
  });

  it("renders both search mode tabs", () => {
    renderWithQuery(<TecDocPage />);
    expect(screen.getByText("Búsqueda por VIN")).toBeInTheDocument();
    expect(screen.getByText("Marca / Modelo")).toBeInTheDocument();
  });

  it("renders VIN search form by default", () => {
    renderWithQuery(<TecDocPage />);
    expect(screen.getByPlaceholderText("Ej: 8AGCM19T0XY123456")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ej: filtro aceite, pastillas freno...")).toBeInTheDocument();
  });

  it("renders the empty state message for VIN search", () => {
    renderWithQuery(<TecDocPage />);
    expect(screen.getByText("Ingresá un VIN para buscar partes")).toBeInTheDocument();
  });

  it("renders the search button", () => {
    renderWithQuery(<TecDocPage />);
    const btn = screen.getByText("Buscar Partes");
    expect(btn).toBeInTheDocument();
  });
});
