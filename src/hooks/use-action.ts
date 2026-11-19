"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; error: string };

/** Exécute une action serveur avec retour visuel (toast) et rafraîchissement des données. */
export function useServerAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<Result<T>>, opts?: { redirect?: (data: T) => string; silent?: boolean }) => {
      if (pending) return null;
      setPending(key);
      try {
        const res = await fn();
        if (res.ok) {
          if (!opts?.silent && res.message) toast.success(res.message);
          if (opts?.redirect) router.push(opts.redirect(res.data));
          return res.data;
        }
        toast.error(res.error);
        return null;
      } finally {
        setPending(null);
      }
    },
    [pending, router],
  );
  return { run, pending };
}
