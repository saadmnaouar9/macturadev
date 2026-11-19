import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { SpaceBackground } from "@/components/auth/space-background";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getAuth()) redirect("/dashboard");
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-x-hidden py-10 sm:py-14">
      <SpaceBackground />
      <main className="relative z-10 w-full">{children}</main>
    </div>
  );
}
