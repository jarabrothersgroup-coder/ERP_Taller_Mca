"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Shield,
  Pencil,
  Save,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { ProfileAvatarCard } from "@/components/dashboard/profile/profile-avatar-card";
import { ProfileDetailsCard } from "@/components/dashboard/profile/profile-details-card";
import { ProfilePreferencesCard } from "@/components/dashboard/profile/profile-preferences-card";
import { ProfileSessionCard } from "@/components/dashboard/profile/profile-session-card";
import { RecentActivity } from "@/components/dashboard/profile/recent-activity";

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

/* ── Main Page ──────────────────────────────── */

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  React.useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) return <ProfileSkeleton />;
  if (!user) return <ProfileSkeleton />;

  const displayName = user.fullName || user.primaryEmailAddress?.emailAddress || "";
  const email = user.primaryEmailAddress?.emailAddress || "";
  const role = (user.publicMetadata?.role as string) || "user";
  const roleInfo = roleConfig[role] ?? roleConfig.user;

  const startEditing = () => {
    setEditName(displayName);
    setEditEmail(email);
    setEditing(true);
    setSaved(false);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaved(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    // Clerk handles profile updates via its own API
    // For now, we just simulate a save
    await new Promise((r) => setTimeout(r, 800));
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
        <ProfileAvatarCard user={{ name: displayName, email, role, id: user.id }} roleInfo={roleInfo} />

        {/* ── Right Column ──────────────────── */}
        <div className="md:col-span-2 space-y-4">
          <ProfileDetailsCard
            user={{ name: displayName, email, role, id: user.id }}
            roleInfo={roleInfo}
            editing={editing}
            editName={editName}
            editEmail={editEmail}
            onEditNameChange={setEditName}
            onEditEmailChange={setEditEmail}
          />

          <ProfilePreferencesCard
            notificationsEnabled={notificationsEnabled}
            onNotificationsToggle={() => setNotificationsEnabled(!notificationsEnabled)}
          />

          <ProfileSessionCard
            tenantSlug={user.organizationMemberships?.[0]?.organization?.name || "demo"}
            sessionExpires={new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()}
          />

          {/* Recent Activity */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 pb-2">
              <div className="text-base font-semibold flex items-center gap-2">
                Actividad Reciente
              </div>
              <p className="text-sm text-muted-foreground">
                Últimas acciones registradas en el sistema
              </p>
            </div>
            <div className="px-6 pb-6">
              <RecentActivity />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
