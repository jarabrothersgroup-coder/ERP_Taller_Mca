import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileAvatarCard } from "@/components/dashboard/profile/profile-avatar-card";

// Mock Clerk hooks
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    signOut: vi.fn(),
  }),
  useUser: () => ({
    user: null,
    isLoaded: true,
  }),
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

describe("ProfileAvatarCard", () => {
  it("renders user name", () => {
    render(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("Juan Ángel Jara")).toBeInTheDocument();
  });

  it("renders user email", () => {
    render(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("jaraju01@gmail.com")).toBeInTheDocument();
  });

  it("renders role badge", () => {
    render(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("renders initials in avatar", () => {
    render(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    // "Juan Ángel Jara" → split → ["Juan","Ángel","Jara"] → first letters → "JÁJ" → slice(0,2) → "JÁ"
    expect(screen.getByText("JÁ")).toBeInTheDocument();
  });

  it("renders sign out button", () => {
    render(<ProfileAvatarCard user={mockUser} roleInfo={roleInfo} />);
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
  });
});
