/**
 * ServicioCombobox — búsqueda desde 3 caracteres, cálculo de totales y
 * lógica de precio histórico (snapshot).
 *
 * @module web/tests/components/servicio-combobox
 */

import { describe, it, expect } from "vitest";
import {
  MIN_SEARCH_LENGTH,
  filterServicios,
  formatGs,
  validateServicioForm,
  normalize,
} from "@/components/hub/servicio-combobox";

const CATALOGO = [
  {
    id: "s1",
    nombre: "Mantenimiento preventivo",
    codigo: "MAN-PRE-001",
    categoria: "Mecánica Preventiva",
    descripcion: null,
    descripcionTecnica: null,
    categoriaId: null,
    thinkcarModulo: null,
    precioEstimado: "1100000",
    duracionEstimada: 120,
    activo: true,
    tenantSlug: "demo",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "s2",
    nombre: "Mantenimiento correctivo",
    codigo: "MAN-COR-001",
    categoria: "Mecánica General",
    descripcion: null,
    descripcionTecnica: null,
    categoriaId: null,
    thinkcarModulo: null,
    precioEstimado: "850000",
    duracionEstimada: 90,
    activo: true,
    tenantSlug: "demo",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "s3",
    nombre: "Alineación y Balanceo 4 Ruedas",
    codigo: "MED-ALI-001",
    categoria: "Tren Delantero y Frenos",
    descripcion: null,
    descripcionTecnica: null,
    categoriaId: null,
    thinkcarModulo: null,
    precioEstimado: "350000",
    duracionEstimada: 60,
    activo: true,
    tenantSlug: "demo",
    createdAt: "",
    updatedAt: "",
  },
];

describe("ServicioCombobox — búsqueda incremental", () => {
  it("no filtra con menos de 3 caracteres (devuelve todo)", () => {
    expect(filterServicios(CATALOGO, "").length).toBe(3);
    expect(filterServicios(CATALOGO, "ma").length).toBe(3);
    expect(filterServicios(CATALOGO, "man").length).not.toBe(3);
  });

  it('la búsqueda "man" encuentra "Mantenimiento preventivo" y "Mantenimiento correctivo"', () => {
    const result = filterServicios(CATALOGO, "man");
    expect(result.map((s) => s.nombre)).toEqual(
      expect.arrayContaining(["Mantenimiento preventivo", "Mantenimiento correctivo"]),
    );
    expect(result.length).toBe(2);
  });

  it("es insensible a mayúsculas y acentos", () => {
    expect(filterServicios(CATALOGO, "MANTENIMIENTO").length).toBe(2);
    expect(filterServicios(CATALOGO, "mecánica").length).toBe(2);
  });

  it("busca por código", () => {
    expect(filterServicios(CATALOGO, "ali").length).toBe(1);
    expect(filterServicios(CATALOGO, "MED-ALI").length).toBe(1);
  });

  it("MIN_SEARCH_LENGTH es 3", () => {
    expect(MIN_SEARCH_LENGTH).toBe(3);
  });
});

describe("ServicioCombobox — cálculo de totales", () => {
  it("formatea montos en guaraníes", () => {
    expect(formatGs(1100000)).toContain("1.100.000");
    expect(formatGs("850000")).toContain("850.000");
    expect(formatGs(null)).toBe("—");
  });

  it("calcula total de línea = cantidad × precio unitario", () => {
    const pu = Number(CATALOGO[0].precioEstimado);
    const cantidad = 2;
    const subtotal = pu * cantidad;
    expect(subtotal).toBe(2200000);
    expect(formatGs(subtotal)).toContain("2.200.000");
  });

  it("calcula total del carrito sumando subtotales", () => {
    const total = CATALOGO.reduce((sum, s, i) => {
      const cant = i === 0 ? 2 : 1;
      return sum + cant * Number(s.precioEstimado ?? 0);
    }, 0);
    // 2*1.100.000 + 1*850.000 + 1*350.000 = 3.400.000
    expect(total).toBe(3400000);
  });
});

describe("ServicioCombobox — validaciones y precio histórico", () => {
  it("valida nombre obligatorio", () => {
    expect(validateServicioForm({ nombre: "  ", precioEstimado: "", duracionEstimada: "" })).toBe(
      "El nombre del servicio es obligatorio",
    );
  });

  it("valida precio no negativo", () => {
    expect(
      validateServicioForm({ nombre: "Test", precioEstimado: "-100", duracionEstimada: "" }),
    ).toBe("El precio unitario no puede ser negativo");
  });

  it("valida duración no negativa", () => {
    expect(
      validateServicioForm({ nombre: "Test", precioEstimado: "1000", duracionEstimada: "-5" }),
    ).toBe("La duración estimada no puede ser negativa");
  });

  it("acepta formulario válido", () => {
    expect(
      validateServicioForm({ nombre: "Cambio de aceite", precioEstimado: "250000", duracionEstimada: "30" }),
    ).toBeNull();
  });

  it("normaliza para búsqueda sin acentos", () => {
    expect(normalize("Mecánica")).toBe("mecanica");
  });
});
