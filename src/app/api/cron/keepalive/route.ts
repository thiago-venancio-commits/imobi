import { NextResponse } from "next/server";

import { HttpError } from "@/lib/server/caller";
import { requireInternal } from "@/lib/server/internal";
import { createAnonClient } from "@/lib/supabase/server";

/**
 * Mantém o projeto Supabase do plano gratuito acordado.
 *
 * O plano gratuito pausa o projeto depois de 7 dias sem tráfego na API. Um
 * pg_cron dentro do banco não conta como tráfego, então o "ping" precisa vir
 * de fora: a Vercel chama esta rota uma vez por dia (vercel.json), e ela faz
 * uma leitura pública mínima pela API REST.
 *
 * Quando o projeto for para o plano Pro, esta rota e o cron podem sair.
 */
export async function GET(req: Request) {
  try {
    // A Vercel manda `Authorization: Bearer $CRON_SECRET`. Sem o segredo
    // configurado, a guarda falha fechada.
    requireInternal(req);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ ok: false }, { status });
  }

  const { error } = await createAnonClient().from("site_settings").select("id").limit(1);
  if (error) return NextResponse.json({ ok: false, error: "supabase" }, { status: 502 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
