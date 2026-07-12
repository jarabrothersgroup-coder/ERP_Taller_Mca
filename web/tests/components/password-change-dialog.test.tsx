import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordChangeDialog } from "@/components/dashboard/profile/password-change-dialog";

describe("PasswordChangeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button", () => {
    render(<PasswordChangeDialog />);
    expect(screen.getByRole("button", { name: /cambiar contraseña/i })).toBeInTheDocument();
  });

  it("opens dialog when trigger clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeDialog />);

    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Cambiar Contraseña")).toBeInTheDocument();
  });

  it("shows password fields in dialog", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeDialog />);

    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(screen.getByText("Contraseña actual")).toBeInTheDocument();
    expect(screen.getByText("Nueva contraseña")).toBeInTheDocument();
    expect(screen.getByText("Confirmar nueva contraseña")).toBeInTheDocument();
  });

  it("has password input fields", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeDialog />);

    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    // Password inputs use placeholder text
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Mínimo 6 caracteres")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Repetí la nueva contraseña")).toBeInTheDocument();
  });

  it("can close dialog via cancel", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeDialog />);

    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    await user.click(cancelBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
