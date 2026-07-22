/**
 * React Query hooks for the mobile app.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type WorkOrder, type Client, type Vehicle, type DashboardStats, type Appointment, type BalanceGeneral, type EstadoResultados, type RG90Report } from "../api/client";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  workOrders: ["work-orders"] as const,
  workOrderDetail: (id: string) => ["work-orders", id] as const,
  clients: ["clients"] as const,
  clientDetail: (id: string) => ["clients", id] as const,
  vehicles: ["vehicles"] as const,
  vehicleDetail: (id: string) => ["vehicles", id] as const,
  appointments: ["appointments"] as const,
  balanceGeneral: ["balance-general"] as const,
  estadoResultados: ["estado-resultados"] as const,
  rg90: ["rg90"] as const,
};

/* ── Query Hooks ─────────────────────────────── */

export function useDashboard() {
  return useQuery<DashboardStats, Error>({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.getDashboard(),
  });
}

export function useWorkOrders(params?: { status?: string }) {
  return useQuery<WorkOrder[], Error>({
    queryKey: [...queryKeys.workOrders, params],
    queryFn: () => api.listWorkOrders(params),
  });
}

export function useWorkOrder(id: string) {
  return useQuery<WorkOrder, Error>({
    queryKey: queryKeys.workOrderDetail(id),
    queryFn: () => api.getWorkOrder(id),
    enabled: !!id,
  });
}

export function useClients() {
  return useQuery<Client[], Error>({
    queryKey: queryKeys.clients,
    queryFn: () => api.listClients(),
  });
}

export function useClient(id: string) {
  return useQuery<Client, Error>({
    queryKey: queryKeys.clientDetail(id),
    queryFn: () => api.getClient(id),
    enabled: !!id,
  });
}

export function useVehicles() {
  return useQuery<Vehicle[], Error>({
    queryKey: queryKeys.vehicles,
    queryFn: () => api.listVehicles(),
  });
}

export function useVehicle(id: string) {
  return useQuery<Vehicle, Error>({
    queryKey: queryKeys.vehicleDetail(id),
    queryFn: () => api.getVehicle(id),
    enabled: !!id,
  });
}

export function useAppointments() {
  return useQuery<Appointment[], Error>({
    queryKey: queryKeys.appointments,
    queryFn: () => api.listAppointments(),
  });
}

/* ── Accounting Report Hooks ─────────────────────────────── */

export function useBalanceGeneral(fecha: string) {
  return useQuery<BalanceGeneral, Error>({
    queryKey: [...queryKeys.balanceGeneral, fecha],
    queryFn: () => api.getBalanceGeneral(fecha),
    enabled: !!fecha,
  });
}

export function useEstadoResultados(anho: number, mes: number, acumulado?: boolean) {
  return useQuery<EstadoResultados, Error>({
    queryKey: [...queryKeys.estadoResultados, anho, mes, acumulado],
    queryFn: () => api.getEstadoResultados(anho, mes, acumulado),
    enabled: !!anho && !!mes,
  });
}

export function useRG90Report(tipo: "VENTAS" | "COMPRAS" | "RETENCIONES", anho: number, mes: number, formato?: "JSON" | "TXT" | "CSV") {
  return useQuery<RG90Report, Error>({
    queryKey: [...queryKeys.rg90, tipo, anho, mes, formato],
    queryFn: () => api.getRG90Report(tipo, anho, mes, formato),
    enabled: !!tipo && !!anho && !!mes,
  });
}

/* ── Mutation Hooks ──────────────────────────── */

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createWorkOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
    },
  });
}

export function useUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateWorkOrderStatus(id, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrderDetail(variables.id) });
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    },
  });
}

export function useSignHvLockout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mechanicId }: { id: string; mechanicId: string }) =>
      api.signHvLockout(id, mechanicId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrderDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
    },
  });
}
