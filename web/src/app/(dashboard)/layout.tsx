import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/shell";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel — AutomotiveOS",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <DashboardShell>{children}</DashboardShell>
    </ErrorBoundary>
  );
}
