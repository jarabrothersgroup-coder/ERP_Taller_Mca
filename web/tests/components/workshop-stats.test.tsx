import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkshopStats } from "@/app/(dashboard)/dashboard/taller/stats";
import type { WorkOrder } from "@/app/(dashboard)/dashboard/taller/types";

const mockOrders: WorkOrder[] = [
  { id: "OT-001", client: "Juan Pérez", vehicle: "Toyota Corolla", plate: "ABC 123", year: 2024, service: "Cambio de aceite", status: "in_progress", technician: "Mec. Carlos", deadline: "", estimatedCost: 350000, createdAt: "2026-07-11" },
  { id: "OT-002", client: "María López", vehicle: "Honda Civic", plate: "DEF 456", year: 2023, service: "Service mayor", status: "pending", technician: "", deadline: "", estimatedCost: 1200000, createdAt: "2026-07-11" },
  { id: "OT-003", client: "Carlos Ruiz", vehicle: "Suzuki Swift", plate: "GHI 789", year: 2022, service: "Reparación frenos", status: "completed", technician: "Mec. Roberto", deadline: "", estimatedCost: 480000, createdAt: "2026-07-10" },
  { id: "OT-004", client: "Ana García", vehicle: "Hyundai Tucson", plate: "JKL 012", year: 2024, service: "Diagnóstico EV", status: "quality", technician: "Mec. Luis", deadline: "", estimatedCost: 800000, createdAt: "2026-07-11" },
];

describe("WorkshopStats", () => {
  it("renders stat cards with correct labels", () => {
    render(<WorkshopStats orders={mockOrders} />);

    expect(screen.getByText("En Progreso")).toBeInTheDocument();
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    expect(screen.getByText("Completadas")).toBeInTheDocument();
    expect(screen.getByText("Fact. Estimada")).toBeInTheDocument();
  });

  it("counts active orders (in_progress + quality)", () => {
    render(<WorkshopStats orders={mockOrders} />);
    // OT-001 (in_progress) + OT-004 (quality) = 2
    // The "2" appears under "En Progreso" card
    const cards = screen.getAllByText("2");
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it("counts pending orders", () => {
    render(<WorkshopStats orders={mockOrders} />);
    // OT-002 (pending) = 1
    const cards = screen.getAllByText("1");
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it("shows estimated total facturación", () => {
    render(<WorkshopStats orders={mockOrders} />);
    // 350000 + 1200000 + 480000 + 800000 = 2,830,000 → "₲ 2.8M"
    expect(screen.getByText(/2\.8M/)).toBeInTheDocument();
  });

  it("shows zero with no orders", () => {
    render(<WorkshopStats orders={[]} />);
    // All zeros
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBe(3); // active, pending, completed
  });
});
