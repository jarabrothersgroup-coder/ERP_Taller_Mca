"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Shield,
  Building2,
  Key,
  LogOut,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/* ── Role Config ────────────────────────────── */

const roleConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  admin: { label: "Administrador", color: "text-orange-500", bgColor: "bg-orange-500/10" },
  manager: { label: "Gerente", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  mechanic: { label: "Mecánico", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  user: { label: "Usuario", color: "text-muted-foreground", bgColor: "bg-muted" },
};

/* ── Skeleton ───────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton variant="text" className="h-8 w-48" />
        <Skeleton variant="text" className="mt-2 h-4 w-64" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <SkeletonCard />
        </div>
        <div className="md:col-span-2 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

/* ── Copy Button ────────────────────────────── */

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono truncate">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-7 w-7"
        onClick={handleCopy}
        aria-label={`Copiar ${label}`}
      >
        {copied ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to sign-in if not authenticated (belt-and-suspenders with middleware)
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in");
    }
  }, [status, router]);

  if (status === "loading") return <ProfileSkeleton />;
  if (!session?.user) return <ProfileSkeleton />;

  const user = session.user;
  const roleInfo = roleConfig[user.role] ?? roleConfig.user;
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Información de tu cuenta y configuración personal
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* ── Avatar & Basic Info ──────────────── */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              {/* Avatar */}
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white text-2xl font-bold shadow-lg shadow-orange-500/20">
                {initials}
              </div>

              <h2 className="text-lg font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>

              {/* Role badge */}
              <Badge
                variant="secondary"
                className={`mt-3 gap-1.5 ${roleInfo.bgColor} ${roleInfo.color} border-0`}
              >
                <Shield className="h-3 w-3" aria-hidden="true" />
                {roleInfo.label}
              </Badge>

              <Separator className="my-4" />

              {/* Quick actions */}
              <div className="flex flex-col gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-muted-foreground justify-start"
                >
                  <Key className="h-3.5 w-3.5" />
                  Cambiar contraseña
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-muted-foreground justify-start hover:text-destructive hover:border-destructive/30"
                  onClick={() => signOut({ callbackUrl: "/sign-in" })}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Right Column ──────────────────── */}
        <div className="md:col-span-2 space-y-4">
          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" aria-hidden="true" />
                Detalles de la Cuenta
              </CardTitle>
              <CardDescription>
                Información de tu perfil y preferencias
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Nombre completo</p>
                  <p className="text-sm font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Correo electrónico</p>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rol</p>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-medium capitalize">{roleInfo.label}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID de usuario</p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {user.id?.slice(0, 8)}...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tenant & Session Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Taller y Sesión
              </CardTitle>
              <CardDescription>
                Información del tenant y estado de la sesión
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <CopyField label="Tenant Slug" value={user.tenantSlug} />
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Expiración de sesión</p>
                  <p className="text-sm font-medium">
                    {session.expires
                      ? new Date(session.expires).toLocaleDateString("es-PY", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "No disponible"}
                  </p>
                </div>
              </div>

              {/* Session status */}
              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Sesión activa</p>
                  <p className="text-xs text-muted-foreground">
                    Autenticado como {user.role} en {user.tenantSlug}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
