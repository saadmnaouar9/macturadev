"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>
      <h1 className="mt-5 text-lg font-semibold text-ink">Une erreur est survenue</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">Vos données sont intactes. Réessayez ; si le problème persiste, rechargez la page.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-faint">Réf. {error.digest}</p>}
      <Button className="mt-5" onClick={reset}><RotateCcw className="h-4 w-4" /> Réessayer</Button>
    </div>
  );
}
