import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  images: {
    // Só o bucket público de fotos, e só a cópia limpa que ele guarda. O bucket
    // de documentos/originais é privado e nunca passa pelo otimizador.
    remotePatterns: supabaseUrl
      ? [new URL("/storage/v1/object/public/property-media/**", supabaseUrl)]
      : [],
  },
};

export default nextConfig;
