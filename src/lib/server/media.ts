import "server-only";

import type { Caller } from "@/lib/server/caller";

/**
 * Troca a foto de capa do imóvel. Usada pelo proprietário e pelo Master.
 *
 * Roda com o cliente de quem chama: a RLS de property_media só deixa o dono do
 * imóvel ou o Master alterar, então um id de imóvel alheio simplesmente não
 * atualiza nada. Trocar a capa não devolve o anúncio para aprovação — a foto
 * já foi aprovada; muda só qual delas aparece primeiro.
 */
export async function setCover(supabase: Caller["supabase"], propertyId: string, mediaId: string): Promise<boolean> {
  const { data: target } = await supabase
    .from("property_media")
    .select("id")
    .eq("id", mediaId)
    .eq("property_id", propertyId)
    .eq("kind", "foto")
    .maybeSingle();
  if (!target) return false;

  // Índice único de uma capa por imóvel: tira a atual antes de marcar a nova.
  await supabase
    .from("property_media")
    .update({ is_cover: false })
    .eq("property_id", propertyId)
    .eq("is_cover", true);
  const { error } = await supabase.from("property_media").update({ is_cover: true }).eq("id", mediaId);
  return !error;
}
