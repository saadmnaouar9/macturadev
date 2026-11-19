import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo officiel (PNG fourni) */
export function Logo({ className, priority, adaptive }: { className?: string; priority?: boolean; adaptive?: boolean }) {
  const light = <Image src="/brand/mactura-logo-light.png" alt="Mactura" width={2138} height={282} priority={priority} className={cn("h-6 w-auto", adaptive && "[[data-theme=light]_&]:hidden", className)} />;
  if (!adaptive) return light;
  // Pages publiques : la version bleu nuit est utilisée en mode clair
  return (
    <>
      {light}
      <Image src="/brand/mactura-logo.png" alt="Mactura" width={2138} height={282} className={cn("hidden h-6 w-auto [[data-theme=light]_&]:block", className)} />
    </>
  );
}

/** Icône officielle « a. » — barre latérale repliée, favicon, écrans d'authentification */
export function LogoMark({ className }: { className?: string }) {
  return <Image src="/brand/a-mark.png" alt="Mactura" width={768} height={768} className={cn("h-8 w-8 object-contain", className)} />;
}
