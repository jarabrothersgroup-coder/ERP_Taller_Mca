/**
 * React Query hooks for the mobile app.
 */

import { useQuery } from "@tanstack/react-query";
import { api, type WorkOrder, type Client, type Vehicle, type DashboardStats, type Appointment } from "../api/client";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  workOrders: ["work-orders"] as const,
  clients: ["clients"] as const,
  vehicles: ["vehicles"] as const,
  appointments: ["appointments"] as const,
};

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

export function useClients() {
  return useQuery<Client[], Error>({
    queryKey: queryKeys.clients,
    queryFn: () => api.listClients(),
  });
}

export function useVehicles() {
  return useQuery<Vehicle[], Error>({
    queryKey: queryKeys.vehicles,
    queryFn: () => api.listVehicles(),
  });
}

export function useAppointments() {
  return useQuery<Appointment[], Error>({
    queryKey: queryKeys.appointments,
    queryFn: () => api.listAppointments(),
  });
}
