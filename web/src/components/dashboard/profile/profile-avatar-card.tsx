"use client";

import { Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PasswordChangeDialog } from "./password-change-dialog";
import { useAuth } from "@clerk/nextjs";

export function ProfileAvatarCard({
  user,
  roleInfo,
}: {
  user: { name: string; email: string; role: string; id?: string };
  roleInfo: { label: string; color: string; bgColor: string };
}) {
  const { signOut } = useAuth();
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  return (
    <Card className="md:col-span-1">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white text-2xl font-bold shadow-lg shadow-orange-500/20">
            {initials}
          </div>

          <h2 className="text-lg font-semibold">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>

          <Badge
            variant="secondary"
            className={`mt-3 gap-1.5 ${roleInfo.bgColor} ${roleInfo.color} border-0`}
          >
            <Shield className="h-3 w-3" aria-hidden="true" />
            {roleInfo.label}
          </Badge>

          <Separator className="my-4" />

          <div className="flex flex-col gap-2 w-full">
            <PasswordChangeDialog />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground justify-start hover:text-destructive hover:border-destructive/30"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
