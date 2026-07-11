import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <span className="text-3xl font-bold text-muted-foreground">404</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          La página que buscas no existe o ha sido movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Volver al Panel
        </Link>
      </div>
    </div>
  );
}
