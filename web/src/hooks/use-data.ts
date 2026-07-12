/**
 * React Query hooks wrapping the data-service layer.
 * Each hook wraps a fetchXxx function with useQuery for automatic caching,
 * loading states, and error handling.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkOrders,
  fetchClients,
  fetchVehicles,
  fetchInventoryItems,
  fetchInvoices,
  fetchAccounts,
  fetchBankAccounts,
  fetchMovements,
  fetchAnalyticsDashboard,
  fetchUsers,
  fetchAppointments,
  fetchConfigSettings,
  fetchWhatsAppMessages,
  fetchFleets,
  fetchAuditLog,
  type UIMappedWorkOrder,
  type UIMappedClient,
  type UIMappedVehicle,
  type UIMappedInventoryItem,
  type UIMappedInvoice,
  type UIMappedAccount,
  type UIMappedBankAccount,
  type UIMappedMovement,
  type UIMappedAnalyticsData,
  type UIMappedUser,
  type UIMappedAppointment,
  type UIMappedConfigSettings,
  type UIMappedWhatsAppMessage,
  type UIMappedFleet,
  type UIMappedAuditEntry,
} from "@/lib/data-service";
import { api } from "@/lib/api";
import type {
  DVIInspection,
  ThinkcarImport,
  ThinkcarHealth,
  ThinkcarStats,
  Presupuesto,
  PresupuestoComparativa,
  PresupuestoAlerta,
  BreakEvenData,
  MarketingCampaign,
  BackupJob,
  SecurityHWStatus,
} from "@/lib/api";

/* ── Query Keys ─────────────────────────────── */

export const queryKeys = {
  workOrders: ["work-orders"] as const,
  clients: ["clients"] as const,
  vehicles: ["vehicles"] as const,
  inventory: ["inventory"] as const,
  invoices: ["invoices"] as const,
  accounts: ["accounts"] as const,
  bankAccounts: ["bank-accounts"] as const,
  movements: ["movements"] as const,
  analytics: ["analytics"] as const,
  users: ["users"] as const,
  appointments: ["appointments"] as const,
  config: ["config"] as const,
  whatsappMessages: ["whatsapp-messages"] as const,
  fleets: ["fleets"] as const,
  auditLog: ["audit-log"] as const,
} as const;

/* ── Workshop Hooks ─────────────────────────── */

export function useWorkOrders(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery<UIMappedWorkOrder[], Error>({
    queryKey: [...queryKeys.workOrders, params],
    queryFn: () => fetchWorkOrders(() => []),
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: ["work-order", id],
    queryFn: () => api.getWorkOrder(id),
    enabled: !!id,
  });
}

export function useUpdateWorkOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateWorkOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workOrders }),
  });
}

/* ── Client Hooks ───────────────────────────── */

export function useClients() {
  return useQuery<UIMappedClient[], Error>({
    queryKey: queryKeys.clients,
    queryFn: () => fetchClients(() => []),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email?: string; phone?: string; ruc?: string; address?: string }) =>
      api.createClient(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clients }),
  });
}

/* ── Vehicle Hooks ──────────────────────────── */

export function useVehicles() {
  return useQuery<UIMappedVehicle[], Error>({
    queryKey: queryKeys.vehicles,
    queryFn: () => fetchVehicles(() => []),
  });
}

/* ── Inventory Hooks ────────────────────────── */

export function useInventory(params?: { search?: string; categoria?: string; page?: number }) {
  return useQuery<UIMappedInventoryItem[], Error>({
    queryKey: [...queryKeys.inventory, params],
    queryFn: () => fetchInventoryItems(() => []),
  });
}

/* ── Invoice Hooks ──────────────────────────── */

export function useInvoices() {
  return useQuery<UIMappedInvoice[], Error>({
    queryKey: queryKeys.invoices,
    queryFn: () => fetchInvoices(() => []),
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      ordenId: string;
      tipoFacturacion: "MANUAL" | "ELECTRONICA";
      numeroFacturaManual?: string;
      ivaExento?: boolean;
    }) => api.issueInvoice(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.invoices }),
  });
}

/* ── Accounting Hooks ───────────────────────── */

export function useAccounts() {
  return useQuery<UIMappedAccount[], Error>({
    queryKey: queryKeys.accounts,
    queryFn: () => fetchAccounts(() => []),
  });
}

/* ── Treasury Hooks ─────────────────────────── */

export function useBankAccounts() {
  return useQuery<UIMappedBankAccount[], Error>({
    queryKey: queryKeys.bankAccounts,
    queryFn: () => fetchBankAccounts(() => []),
  });
}

export function useMovements() {
  return useQuery<UIMappedMovement[], Error>({
    queryKey: queryKeys.movements,
    queryFn: () => fetchMovements(() => []),
  });
}

/* ── Analytics Hooks ────────────────────────── */

export function useAnalytics() {
  return useQuery<UIMappedAnalyticsData, Error>({
    queryKey: queryKeys.analytics,
    queryFn: () => fetchAnalyticsDashboard(() => ({
      totalIngresos: 0,
      totalOrdenes: 0,
      ordenesCompletadas: 0,
      productividad: 0,
      clientesAtendidos: 0,
      margenBruto: 0,
      ticketPromedio: 0,
      mesActual: "",
    })),
  });
}

/* ── Users/Profiles Hooks ───────────────────── */

export function useUsers() {
  return useQuery<UIMappedUser[], Error>({
    queryKey: queryKeys.users,
    queryFn: () => fetchUsers(() => []),
  });
}

/* ── Scheduling Hooks ───────────────────────── */

export function useAppointments() {
  return useQuery<UIMappedAppointment[], Error>({
    queryKey: queryKeys.appointments,
    queryFn: () => fetchAppointments(() => []),
  });
}

/* ── Config Hooks ───────────────────────────── */

export function useConfigSettings() {
  return useQuery<UIMappedConfigSettings, Error>({
    queryKey: queryKeys.config,
    queryFn: () =>
      fetchConfigSettings(() => ({
        companyName: "",
        companyRuc: "",
        companyAddress: "",
        companyPhone: "",
        companyEmail: "",
        fiscalRegimen: "General",
        timbrado: "",
        facturaInicio: "001-001",
      })),
  });
}

/* ── WhatsApp Hooks ─────────────────────────── */

export function useWhatsAppMessages() {
  return useQuery<UIMappedWhatsAppMessage[], Error>({
    queryKey: queryKeys.whatsappMessages,
    queryFn: () => fetchWhatsAppMessages(() => []),
  });
}

/* ── Fleet Hooks ────────────────────────────── */

export function useFleets() {
  return useQuery<UIMappedFleet[], Error>({
    queryKey: queryKeys.fleets,
    queryFn: () => fetchFleets(() => []),
  });
}

/* ── Audit Log Hooks ────────────────────────── */

export function useAuditLog() {
  return useQuery<UIMappedAuditEntry[], Error>({
    queryKey: queryKeys.auditLog,
    queryFn: () => fetchAuditLog(() => []),
  });
}

/* ── DVI Hooks ──────────────────────────────── */

export function useDVIInspections(vehicleId?: string) {
  return useQuery<DVIInspection[], Error>({
    queryKey: ["dvi-inspections", vehicleId],
    queryFn: () => api.listDVInspections({ vehicleId, limit: 50 }),
  });
}

/* ── Thinkcar Hooks ─────────────────────────── */

export function useThinkcarImports() {
  return useQuery<ThinkcarImport[], Error>({
    queryKey: ["thinkcar-imports"],
    queryFn: () => api.listThinkcarImports({ limit: 50 }),
  });
}

export function useThinkcarHealth() {
  return useQuery<ThinkcarHealth, Error>({
    queryKey: ["thinkcar-health"],
    queryFn: () => api.getThinkcarHealth(),
    refetchInterval: 30000,
  });
}

export function useThinkcarStats() {
  return useQuery<ThinkcarStats, Error>({
    queryKey: ["thinkcar-stats"],
    queryFn: () => api.getThinkcarStats(),
  });
}

/* ── Presupuestos Hooks ─────────────────────── */

export function usePresupuestos() {
  return useQuery<Presupuesto[], Error>({
    queryKey: ["presupuestos"],
    queryFn: () => api.listPresupuestos(),
  });
}

export function usePresupuestoAlertas() {
  return useQuery<PresupuestoAlerta[], Error>({
    queryKey: ["presupuesto-alertas"],
    queryFn: () => api.getPresupuestoAlertas(),
  });
}

/* ── Nómina/Payroll Hooks ──────────────────── */

export function useBreakEven() {
  return useQuery<BreakEvenData, Error>({
    queryKey: ["break-even"],
    queryFn: () => api.getBreakEven(),
  });
}

/* ── Marketing Hooks ────────────────────────── */

export function useCampaigns() {
  return useQuery<MarketingCampaign[], Error>({
    queryKey: ["campaigns"],
    queryFn: () => api.listCampaigns(),
  });
}

/* ── Backup Hooks ───────────────────────────── */

export function useBackups() {
  return useQuery<BackupJob[], Error>({
    queryKey: ["backups"],
    queryFn: () => api.listBackups(),
  });
}

export function useExecuteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.executeBackup(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
}

/* ── Security HW Hooks ──────────────────────── */

export function useSecurityHWStatus() {
  return useQuery<SecurityHWStatus, Error>({
    queryKey: ["security-hw"],
    queryFn: () => api.getSecurityHWStatus(),
  });
}
