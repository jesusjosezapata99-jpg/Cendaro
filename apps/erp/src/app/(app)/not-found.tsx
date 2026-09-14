import Link from "next/link";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

/**
 * Cendaro — App Not Found (Cendaro Spec M-NotFound)
 *
 * Rendered when a route or resource inside the app is not found.
 * Conforms to Cendaro design rules:
 * - Title: text-lg font-medium
 * - Description: text-sm text-muted-foreground
 * - Button: outline styling
 */
export default function AppNotFound() {
  return (
    <div className="flex h-[calc(100vh-8rem)] w-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="border-border bg-card mb-6 flex size-12 items-center justify-center border">
          <Icons.Search className="text-muted-foreground size-5" />
        </div>

        <h2 className="text-foreground text-lg font-medium tracking-tight">
          Página no encontrada
        </h2>

        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          La ruta o recurso al que intentas acceder no existe, ha sido movido o
          no tienes permisos para visualizarlo.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/dashboard">
              <Icons.ArrowBack className="size-4" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
