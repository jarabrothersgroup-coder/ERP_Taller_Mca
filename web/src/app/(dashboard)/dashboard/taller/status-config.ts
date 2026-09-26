// Status configuration consolidated in web/src/lib/status.ts
// This file re-exports for backward compatibility with existing imports

export const technicians = ["Carlos M.", "Ana R.", "Luis M.", "Pedro G.", "Sofía L."];

export { statusConfig, statusColors } from "@/lib/status";

export type { ORDER_STATUS as OrderStatus } from "@/lib/status";
