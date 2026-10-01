import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

/**
 * T-62 — regresión del `Slot` de Radix en `Button asChild`.
 *
 * `Slot` exige exactamente un hijo y valida con `React.Children.count`, que
 * cuenta también `null` y `false`. La versión anterior interpolaba dos
 * expresiones (`{loading && <Loader2/>}` + `{... && children}`), de modo que
 * cualquier `<Button asChild>` le entregaba 2 hijos y reventaba en SSR con
 * "Slot failed to slot onto its children" — `/offline` devolvía HTTP 500.
 *
 * Estos asserts son sobre el DOM renderizado, no sobre la forma del JSX: un
 * test que sólo mirara `children` passaría aunque el `Slot` siguiera tirando.
 */
describe("Button asChild", () => {
  it("renderiza el hijo único sin lanzar y le aplica las clases del botón", () => {
    expect(() =>
      render(
        <Button asChild size="lg">
          <a href="/dashboard">Ir al Dashboard</a>
        </Button>,
      ),
    ).not.toThrow();

    const link = screen.getByRole("link", { name: "Ir al Dashboard" });
    // El Slot clona al hijo, así que las clases de `buttonVariants` deben
    // aterrizar en el `<a>`, no en un `<button>` envolvente.
    expect(link.className).toContain("inline-flex");
    expect(link.getAttribute("href")).toBe("/dashboard");
  });

  it("no rompe con `loading` activo (misma causa: un hijo más en el Slot)", () => {
    expect(() =>
      render(
        <Button asChild loading>
          <a href="/dashboard">Ir al Dashboard</a>
        </Button>,
      ),
    ).not.toThrow();

    expect(screen.getByRole("link", { name: "Ir al Dashboard" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("sigue mostrando el spinner cuando NO es asChild", () => {
    const { container } = render(<Button loading>Agendar</Button>);

    expect(screen.getByRole("button", { name: /agendar/i })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});
