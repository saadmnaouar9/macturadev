"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { formatMAD } from "@/lib/money";

const FORMATS = {
  mad: (n: number) => formatMAD(n),
  int: (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f|\u00a0/g, " "),
  percent: (n: number) => `${(n / 100).toFixed(1).replace(".", ",")} %`,
};

/** Compteur animé — la valeur finale est toujours exacte (formatée par `format`). */
export function AnimatedNumber({ value, kind = "int", duration = 1.1 }: { value: number; kind?: keyof typeof FORMATS; duration?: number }) {
  const format = FORMATS[kind];
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) {
      el.textContent = format(value);
      if (reduce) prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(Math.round(v));
      },
      onComplete: () => {
        el.textContent = format(value);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, format, duration]);

  return (
    <span ref={ref} className="tabular">
      {format(reduce ? value : 0)}
    </span>
  );
}
