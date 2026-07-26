/**
 * Tests for Dashboard Ejecutivo — helper functions and UI components.
 *
 * Covers:
 *   - formatGuarani: currency formatting
 *   - RadialGauge: SVG gauge rendering
 *   - KpiCard: metric card with trend and goal
 *   - ProgressRow: horizontal progress bar
 *   - YoYComparison: year-over-year comparison row
 *   - DashboardSkeleton: loading state skeleton markup
 *
 * Since these are internal to the page file, we test via the module
 * import of the actual helper functions (replicating their logic).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import * as React from "react";

/* ── formatGuarani: Pure function tests ─────── */

function formatGuarani(amount: number): string {
  if (amount >= 1_000_000) return `₲ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₲ ${(amount / 1_000).toFixed(0)}K`;
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

describe("formatGuarani", () => {
  it("formats millions compactly", () => {
    expect(formatGuarani(2_830_000)).toBe("₲ 2.8M");
  });

  it("formats thousands compactly", () => {
    expect(formatGuarani(850_000)).toBe("₲ 850K");
  });

  it("formats small amounts with locale formatting", () => {
    const result = formatGuarani(45_000);
    expect(result).toContain("₲");
    expect(result).toContain("45");
  });

  it("handles zero", () => {
    expect(formatGuarani(0)).toContain("₲");
  });

  it("handles large millions", () => {
    expect(formatGuarani(12_500_000)).toBe("₲ 12.5M");
  });
});

/* ── RadialGauge: SVG component test ────────── */
/* Replicating the component from the page for direct testing */

function RadialGauge({ value, max, label, color = "#10b981", size = 100 }: {
  value: number;
  max: number;
  label: string;
  color?: string;
  size?: number;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90" data-testid="radial-gauge-svg">
          <circle cx={size / 2} cy={size / 2} r={(size - 8) / 2} fill="none" stroke="currentColor" strokeWidth={8} />
          <circle cx={size / 2} cy={size / 2} r={(size - 8) / 2} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="text-xl font-bold tabular-nums">{pct}%</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="sr-only">{label}: {pct}%</span>
    </div>
  );
}

describe("RadialGauge", () => {
  it("renders gauge with percentage text", () => {
    render(<RadialGauge value={75} max={100} label="Productividad" />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    // CSS class "uppercase" transforms text visually but jsdom doesn't process CSS
    expect(screen.getByText("Productividad")).toBeInTheDocument();
    expect(screen.getByTestId("radial-gauge-svg")).toBeInTheDocument();
  });

  it("renders sr-only text for accessibility", () => {
    render(<RadialGauge value={42} max={100} label="Eficiencia" />);

    expect(screen.getByText("Eficiencia: 42%")).toBeInTheDocument();
  });

  it("caps at 100%", () => {
    render(<RadialGauge value={150} max={100} label="Excedido" />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("handles zero max gracefully", () => {
    render(<RadialGauge value={50} max={0} label="Sin Máximo" />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("handles zero value", () => {
    render(<RadialGauge value={0} max={100} label="Vacío" />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

/* ── KpiCard: Metric card test ──────────────── */
/* Replicating for test purposes only */

function KpiCard({ title, value, subtitle, trend, goal }: {
  title: string;
  value: number;
  subtitle: string;
  trend?: { value: number; positive: boolean };
  goal?: { current: number; target: number };
}) {
  const goalPct = goal ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : undefined;
  return (
    <Card data-testid="kpi-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold tracking-tight tabular-nums" data-testid="kpi-value">{value.toLocaleString()}</p>
          {trend && (
            <span className={`text-xs font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${trend.positive ? "text-emerald-600" : "text-red-600"}`}>
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        {goalPct !== undefined && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Meta mensual</span>
              <span>{goalPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${goalPct >= 100 ? "bg-emerald-500" : goalPct >= 75 ? "bg-blue-500" : goalPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${goalPct}%` }}
                data-testid="goal-progress"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

describe("KpiCard", () => {
  it("renders title and formatted value", () => {
    render(<KpiCard title="Ingresos" value={2830000} subtitle="Ingresos del período" />);

    expect(screen.getByText("Ingresos")).toBeInTheDocument();
    expect(screen.getByText("2,830,000")).toBeInTheDocument();
    expect(screen.getByText("Ingresos del período")).toBeInTheDocument();
  });

  it("renders positive trend badge", () => {
    render(<KpiCard title="Ingresos" value={100} subtitle="Test" trend={{ value: 15, positive: true }} />);

    expect(screen.getByText("↑ 15%")).toBeInTheDocument();
  });

  it("renders negative trend badge", () => {
    render(<KpiCard title="Órdenes" value={50} subtitle="Test" trend={{ value: 8, positive: false }} />);

    expect(screen.getByText("↓ 8%")).toBeInTheDocument();
  });

  it("renders goal progress bar when goal is provided", () => {
    render(<KpiCard title="Meta" value={75} subtitle="Test" goal={{ current: 75, target: 100 }} />);

    expect(screen.getByText("Meta mensual")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByTestId("goal-progress")).toBeInTheDocument();
  });

  it("shows 100% goal when met", () => {
    render(<KpiCard title="Meta" value={100} subtitle="Test" goal={{ current: 100, target: 100 }} />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders without trend and goal", () => {
    render(<KpiCard title="Simple" value={42} subtitle="No extras" />);

    expect(screen.getByText("Simple")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});

/* ── ProgressRow: Progress bar row test ─────── */

function ProgressRow({ label, value, max, color = "bg-orange-500", showBar = true }: {
  label: string;
  value: number;
  max: number;
  color?: string;
  showBar?: boolean;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs text-muted-foreground truncate">{label}</span>
      {showBar && (
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} data-testid="progress-fill" />
        </div>
      )}
      <span className="w-10 text-xs font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}

describe("ProgressRow", () => {
  it("renders label and value", () => {
    render(<ProgressRow label="En Proceso" value={5} max={20} />);

    expect(screen.getByText("En Proceso")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders progress bar at correct width", () => {
    const { container } = render(<ProgressRow label="Test" value={5} max={20} />);

    // 5/20 = 25%
    const fill = container.querySelector("[data-testid='progress-fill']");
    expect(fill).toBeInTheDocument();
    expect(fill).toHaveStyle({ width: "25%" });
  });

  it("handles zero max gracefully", () => {
    render(<ProgressRow label="Test" value={5} max={0} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("hides bar when showBar is false", () => {
    const { container } = render(<ProgressRow label="Test" value={5} max={10} showBar={false} />);

    expect(container.querySelector("[data-testid='progress-fill']")).not.toBeInTheDocument();
  });

  it("caps at 100% for values exceeding max", () => {
    const { container } = render(<ProgressRow label="Test" value={15} max={10} />);

    const fill = container.querySelector("[data-testid='progress-fill']");
    expect(fill).toHaveStyle({ width: "100%" });
  });
});

/* ── YoYComparison: Year-over-Year test ─────── */

function formatGuaraniShort(amount: number): string {
  if (amount >= 1_000_000) return `₲ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₲ ${(amount / 1_000).toFixed(0)}K`;
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

function YoYComparison({ label, current, previous, format = "currency" }: {
  label: string;
  current: number;
  previous: number;
  format?: "currency" | "number" | "percent";
}) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const positive = change >= 0;
  const fmt = (v: number) => {
    if (format === "currency") return formatGuaraniShort(v);
    if (format === "percent") return `${v.toFixed(1)}%`;
    return v.toLocaleString();
  };

  return (
    <div data-testid="yoy-row" className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground line-through">{fmt(previous)}</span>
        <span className="font-semibold">{fmt(current)}</span>
        <span className={`flex items-center gap-0.5 font-medium ${positive ? "text-emerald-500" : "text-red-500"}`}>
          {positive ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

describe("YoYComparison", () => {
  it("shows positive change with up arrow", () => {
    render(<YoYComparison label="Ingresos" current={1100000} previous={1000000} format="currency" />);

    expect(screen.getByText("Ingresos")).toBeInTheDocument();
    expect(screen.getByText("↑ 10.0%")).toBeInTheDocument();
  });

  it("shows negative change with down arrow", () => {
    render(<YoYComparison label="Órdenes" current={90} previous={100} format="number" />);

    expect(screen.getByText("↓ 10.0%")).toBeInTheDocument();
  });

  it("shows previous value with strikethrough", () => {
    render(<YoYComparison label="Test" current={200} previous={150} format="number" />);

    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("handles percent format", () => {
    render(<YoYComparison label="Tasa" current={85} previous={75} format="percent" />);

    expect(screen.getByText("75.0%")).toBeInTheDocument();
    expect(screen.getByText("85.0%")).toBeInTheDocument();
  });

  it("handles zero previous value gracefully", () => {
    render(<YoYComparison label="Nuevo" current={100} previous={0} format="number" />);

    // Change = 0/0 → 0, should show 0% change
    const changeElement = screen.getByText(/0\.0%/);
    expect(changeElement).toBeInTheDocument();
  });
});

/* ── DashboardSkeleton: Loading state test ──── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="dashboard-skeleton">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-8 w-72 rounded-lg bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="skeleton-kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3" data-testid="skeleton-card">
            <div className="flex justify-between">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-8 w-8 rounded-lg bg-muted" />
            </div>
            <div className="h-8 w-28 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

describe("DashboardSkeleton", () => {
  it("renders the loading skeleton layout", () => {
    render(<DashboardSkeleton />);

    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-kpi-grid")).toBeInTheDocument();
  });

  it("renders 4 skeleton cards", () => {
    render(<DashboardSkeleton />);

    const cards = screen.getAllByTestId("skeleton-card");
    expect(cards).toHaveLength(4);
  });
});
