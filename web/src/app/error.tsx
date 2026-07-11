"use client";

export const dynamic = "force-dynamic";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <span className="text-3xl font-bold text-destructive">!</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Error del servidor</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ocurrió un error inesperado. Nuestro equipo ha sido notificado.
        </p>
        <button
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
