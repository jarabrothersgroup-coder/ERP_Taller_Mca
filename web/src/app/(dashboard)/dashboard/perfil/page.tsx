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
  Pencil,
  Save,
  X,
  Bell,
  Sun,
  Moon,
  Activity,
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
import { Input } from "@/components/ui/input";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { fetchAuditLog, type UIMappedAuditEntry } from "@/lib/data-service";

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

/* ── Password Change Dialog ─────────────────── */

function PasswordChangeDialog() {
  const [open, setOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const resetState = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000));
    setSuccess(true);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); setOpen(o); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground justify-start"
        >
          <Key className="h-3.5 w-3.5" />
          Cambiar contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresá tu contraseña actual y la nueva contraseña
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Contraseña actualizada exitosamente
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Contraseña actual</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading || success}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Nueva contraseña</label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading || success}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirmar nueva contraseña</label>
              <Input
                type="password"
                placeholder="Repetí la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || success}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={loading} disabled={success}>
              {loading ? "Guardando…" : success ? "Actualizada" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Recent Activity ────────────────────────── */

interface ActivityEntry {
  id: string;
  accion: string;
  entidad: string;
  descripcion: string;
  createdAt: string;
}

const actionIcons: Record<string, string> = {
  CREAR: "➕",
  MODIFICAR: "✏️",
  ANULAR: "🚫",
  PAGAR: "💰",
  EMITIR: "📄",
};

function RecentActivity() {
  const [activities, setActivities] = React.useState<ActivityEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const mockActivity = (): ActivityEntry[] =>
      Array.from({ length: 6 }, (_, i) => {
        const acciones = ["CREAR", "MODIFICAR", "PAGAR", "EMITIR", "MODIFICAR", "CREAR"];
        const entidades = ["OT", "CLIENTE", "FACTURA", "FACTURA", "REPUESTO", "CLIENTE"];
        const descripciones = [
          "Orden de trabajo #124 creada",
          "Datos de Pedro López actualizados",
          "Pago de factura #156 registrado",
          "Factura electrónica #157 emitida",
          "Stock de pastillas de freno actualizado",
          "Nuevo cliente: Transporte Norte",
        ];
        const date = new Date();
        date.setHours(date.getHours() - (i * 2 + 1));
        return {
          id: `act-${i}`,
          accion: acciones[i],
          entidad: entidades[i],
          descripcion: descripciones[i],
          createdAt: date.toLocaleDateString("es-PY") + " " + `${9 + i}:${String(i * 13 % 60).padStart(2, "0")}`,
        };
      });

    // Try API, fall back to mock
    fetchAuditLog(() => mockActivity() as unknown as UIMappedAuditEntry[]).then((data) => {
      if (!cancelled) {
        setActivities((data as unknown as ActivityEntry[]).slice(0, 6));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton variant="circle" className="h-8 w-8 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((act) => (
        <div
          key={act.id}
          className="flex items-start gap-3 rounded-lg border border-border/50 p-3 hover:bg-accent/30 transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm shrink-0">
            {actionIcons[act.accion] || "📋"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{act.descripcion}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{act.createdAt}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

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
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const startEditing = () => {
    setEditName(user.name || "");
    setEditEmail(user.email || "");
    setEditing(true);
    setSaved(false);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaved(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    // Simulate updating the session
    await update({ name: editName, email: editEmail });
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Información de tu cuenta, preferencias y actividad reciente
          </p>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5" />
            Editar Perfil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={cancelEditing}>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSaveProfile} loading={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Save Success Toast ──────────────── */}
      {saved && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          Perfil actualizado exitosamente
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* ── Avatar & Basic Info ──────────────── */}
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
                {editing ? "Editá tu información personal" : "Información de tu perfil"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nombre completo</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Correo electrónico</label>
                    <Input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>
              ) : (
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
              )}
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" aria-hidden="true" />
                Preferencias
              </CardTitle>
              <CardDescription>
                Configuración de notificaciones y apariencia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Notificaciones</p>
                    <p className="text-xs text-muted-foreground">Alertas de órdenes y mensajes</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsEnabled}
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    notificationsEnabled ? "bg-orange-500" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notificationsEnabled ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sun className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Tema oscuro</p>
                    <p className="text-xs text-muted-foreground">Alternar entre modo claro y oscuro</p>
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Moon className="h-3 w-3" />
                  Oscuro
                </Badge>
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

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Actividad Reciente
              </CardTitle>
              <CardDescription>
                Últimas acciones registradas en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentActivity />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
