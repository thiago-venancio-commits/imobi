import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Cabeçalhos de segurança em todas as respostas.
 *
 * - frame-ancestors / X-Frame-Options: nenhum outro site pode embutir o nosso
 *   num iframe (clickjacking — ex.: um botão "Aprovar" do Master escondido sob
 *   outro conteúdo). Nós continuamos podendo embutir o mapa do OpenStreetMap e
 *   o Turnstile: isto só controla quem nos embute.
 * - nosniff: o navegador não "adivinha" tipo de arquivo (um upload não vira
 *   script).
 * - Referrer-Policy: links para fora não levam a URL completa (que pode ter
 *   ?token_hash= das telas de confirmação).
 * - Permissions-Policy: o site não usa câmera, microfone nem localização.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  images: {
    // Só o bucket público de fotos, e só a cópia limpa que ele guarda. O bucket
    // de documentos/originais é privado e nunca passa pelo otimizador.
    remotePatterns: supabaseUrl
      ? [new URL("/storage/v1/object/public/property-media/**", supabaseUrl)]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
