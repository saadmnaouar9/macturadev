import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "bcryptjs", "@electric-sql/pglite"],
  // Mode Démo : les fichiers WebAssembly/données de PGlite doivent être embarqués dans les fonctions Vercel
  outputFileTracingIncludes: { "/**": ["./node_modules/@electric-sql/pglite/dist/**"] },
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // Cache du routeur côté client : revenir sur une page vue il y a < 30 s est instantané.
    // Les actions serveur (revalidatePath) et router.refresh() invalident ce cache : aucune donnée périmée après une modification.
    staleTimes: { dynamic: 30, static: 60 },
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
