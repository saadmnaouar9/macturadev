import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo officiel (PNG fourni) */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return <Image src="/brand/mactura-logo-light.png" alt="Mactura" width={2138} height={282} priority={priority} className={cn("h-6 w-auto", className)} />;
}

/** Icône officielle « a. » — barre latérale repliée, favicon, écrans d'authentification */
export function LogoMark({ className }: { className?: string }) {
  return <Image src="/brand/a-mark.png" alt="Mactura" width={768} height={768} className={cn("h-8 w-8 object-contain", className)} />;
}
