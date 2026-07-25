import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileAvatarCard } from "@/components/dashboard/profile/profile-avatar-card";
import { SessionProvider } from "@/components/providers/session-provider";
import * as React from "react";

// Mock next/navigation for SessionProvider
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

const mockUser = {
  name: "Juan Ángel Jara",
  email: "jaraju01@gmail.com",
  role: "admin",
  id: "usr-123",
};

const roleInfo = {
  label: "Administrador",
  color: "text-orange-500",
  bgColor: "bg-orange-500/10",
};

function renderWithSession(ui: React.ReactElement) {
  return render(<SessionProvider>{ui}</SessionProvider>);
}

describe("ProfileAvatarCard", () => {
  it("renders user name", () => {
    renderWithSession(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("Juan Ángel Jara")).toBeInTheDocument();
  });

  it("renders user email", () => {
    renderWithSession(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("jaraju01@gmail.com")).toBeInTheDocument();
  });

  it("renders role badge", () => {
    renderWithSession(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("renders initials in avatar", () => {
    renderWithSession(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("JÁ")).toBeInTheDocument();
  });

  it("renders sign out button", () => {
    renderWithSession(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
  });
});
