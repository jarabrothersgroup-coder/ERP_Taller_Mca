import { MessageSquare, Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function WhatsAppPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center py-12">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">WhatsApp</h1>
          <Badge variant="secondary" className="mb-4 gap-1.5">
            <Construction className="h-3.5 w-3.5" />
            Próximamente
          </Badge>
          <p className="text-sm text-muted-foreground max-w-sm">
            Integración con WhatsApp Business para notificaciones, recordatorios y comunicación con clientes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
