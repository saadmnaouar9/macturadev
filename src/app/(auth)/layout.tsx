import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { SpaceBackground } from "@/components/auth/space-background";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getAuth()) redirect("/dashboard");
  return (
    <div data-auth className="relative flex min-h-dvh items-center justify-center overflow-x-hidden py-10 sm:py-14">
      <SpaceBackground />
      {/* Bouton mode clair / sombre : même cookie que l'application, le choix est conservé après la connexion */}
      <div className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-white/10 p-0.5 text-white backdrop-blur-md sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <main className="relative z-10 w-full">{children}</main>
    </div>
  );
}
