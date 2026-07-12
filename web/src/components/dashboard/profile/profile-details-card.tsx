"use client";

import { User, Mail, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ProfileDetailsCard({
  user,
  roleInfo,
  editing,
  editName,
  editEmail,
  onEditNameChange,
  onEditEmailChange,
}: {
  user: { name: string; email: string; role: string; id?: string };
  roleInfo: { label: string };
  editing: boolean;
  editName: string;
  editEmail: string;
  onEditNameChange: (v: string) => void;
  onEditEmailChange: (v: string) => void;
}) {
  return (
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
                onChange={(e) => onEditNameChange(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Correo electrónico</label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => onEditEmailChange(e.target.value)}
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
  );
}
