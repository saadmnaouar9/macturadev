"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Petit gestionnaire de formulaire : valeurs, erreurs de champ issues du serveur, envoi. */
export function useForm<V extends Record<string, unknown>>(initial: V) {
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const set = useCallback(<K extends keyof V>(key: K, value: V[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  const submit = useCallback(
    <T,>(action: () => Promise<Result<T>>, opts?: { onSuccess?: (data: T) => void; success?: string; silent?: boolean }) => {
      startTransition(async () => {
        const res = await action();
        if (res.ok) {
          setErrors({});
          if (opts?.success ?? res.message) toast.success(opts?.success ?? res.message);
          opts?.onSuccess?.(res.data);
        } else {
          setErrors(res.fieldErrors ?? {});
          if (!opts?.silent || !res.fieldErrors) toast.error(res.error);
        }
      });
    },
    [],
  );

  return { values, setValues, set, errors, setErrors, pending, submit };
}
