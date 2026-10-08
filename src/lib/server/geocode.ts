import "server-only";

/**
 * Coordenada do endereço exato, para o mapa aproximado do anúncio.
 *
 * O resultado vai para `property_private.exact_lat/lng`. O site nunca mostra
 * esse ponto: um trigger do banco desloca ~450 m e publica só o deslocado
 * (0002_offer.sql).
 *
 * Nominatim (OpenStreetMap), gratuito e com política de uso: no máximo uma
 * requisição por segundo e User-Agent identificado. Aqui roda só quando o dono
 * salva o endereço. Melhor esforço: se falhar, o imóvel fica sem mapa — nunca
 * bloqueia o cadastro.
 */
export async function geocodeAddress(a: {
  street: string;
  number: string;
  city: string;
  state: string;
  cep: string;
}): Promise<{ lat: number; lng: number } | null> {
  const attempts: Record<string, string>[] = [
    { street: `${a.number} ${a.street}`.trim(), city: a.city, state: a.state, postalcode: a.cep },
    // Sem o número/rua, ao menos o CEP e a cidade: o mapa é aproximado mesmo.
    { city: a.city, state: a.state, postalcode: a.cep },
  ];

  for (const params of attempts) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "TSVImoveis/1.0 (https://www.tsvimoveis.com.br)" },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const [hit] = (await res.json()) as { lat?: string; lon?: string }[];
      const lat = Number(hit?.lat);
      const lng = Number(hit?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    } catch {
      // timeout ou rede: tenta a próxima forma, depois desiste em silêncio
    }
  }
  return null;
}
