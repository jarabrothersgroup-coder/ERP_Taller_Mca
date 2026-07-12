export type InventoryStatus = "ok" | "low" | "critical";

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  stock: number;
  minStock: number;
  price: number;
  location: string;
  status: InventoryStatus;
}

const categories = ["Frenos", "Motor", "Suspensión", "Eléctrico", "Transmisión", "Carrocería", "Lubricantes", "Neumáticos"];

export function getMockInventory(): InventoryItem[] {
  return Array.from({ length: 48 }, (_, i) => {
    const stockLevels = [
      { stock: 15, min: 5 }, { stock: 3, min: 10 }, { stock: 1, min: 5 },
      { stock: 8, min: 8 }, { stock: 25, min: 10 }, { stock: 0, min: 3 },
      { stock: 45, min: 15 }, { stock: 6, min: 5 },
    ];
    const level = stockLevels[i % stockLevels.length];
    const status: InventoryStatus = level.stock === 0 ? "critical" : level.stock <= level.min ? "low" : "ok";

    return {
      id: `INV-${String(i + 1).padStart(4, "0")}`,
      code: `PZ-${String(100 + i).padStart(4, "0")}`,
      name: ["Pastillas de Freno Delanteras", "Filtro de Aceite", "Amortiguador Trasero", "Bujía Iridium", "Correa de Distribución", "Batería 12V 60Ah", "Aceite Motor 5W30 4L", "Disco de Freno Trasero", "Sensor de Oxígeno", "Filtro de Aire", "Bomba de Agua", "Termostato"][i % 12],
      category: categories[i % categories.length],
      brand: ["Bosch", "NGK", "SKF", "Valeo", "Mann", "ACDelco"][i % 6],
      stock: level.stock,
      minStock: level.min,
      price: [85000, 45000, 320000, 120000, 250000, 550000, 135000, 180000, 210000, 95000, 380000, 65000][i % 12],
      location: `A${Math.floor(i / 12) + 1}-${String((i % 12) + 1).padStart(2, "0")}`,
      status,
    };
  });
}
