import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyField } from "@/components/dashboard/profile/copy-field";

describe("CopyField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders label and value", () => {
    render(<CopyField label="Email" value="test@example.com" />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("calls clipboard.writeText when copy button clicked", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<CopyField label="RUC" value="80012345-6" />);

    const copyBtn = screen.getByRole("button", { name: /copiar/i });
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("80012345-6");
  });

  it("has accessible copy button", () => {
    render(<CopyField label="RUC" value="1234567-8" />);
    const copyBtn = screen.getByRole("button", { name: /copiar ruc/i });
    expect(copyBtn).toBeInTheDocument();
  });
});
