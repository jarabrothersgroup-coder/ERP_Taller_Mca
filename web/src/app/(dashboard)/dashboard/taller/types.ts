export type OrderStatus = "pending" | "budgeted" | "in_progress" | "quality" | "ready" | "completed" | "cancelled";

export interface WorkOrder {
  id: string;
  client: string;
  vehicle: string;
  plate: string;
  year: number;
  service: string;
  status: OrderStatus;
  technician: string;
  deadline: string;
  estimatedCost: number;
  createdAt: string;
  notes?: string;
}

export interface NewOrderForm {
  client: string;
  vehicle: string;
  plate: string;
  service: string;
  technician: string;
  notes: string;
}
