"use client";

import { Loader2, MapPin } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { readMp4Location } from "@/lib/media/clean-mp4";
import { cn } from "@/lib/utils";

export interface OriginalItem {
  id: string;
  kind: "foto" | "video";
  label: string;
  /** URL assinada e temporária do ORIGINAL (bucket privado). */
  url: string | null;
}

type Result =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "nogps" }
  | { state: "error" }
  | { state: "ok"; lat: number; lng: number; km: number | null };

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Prova antifraude: a foto foi tirada no endereço declarado?
 *
 * Lê o GPS do ORIGINAL (o público não tem mais) e compara com a coordenada do
 * endereço que o proprietário informou. Só o Master chega aqui: a URL assinada
 * do original é gerada no servidor com a sessão dele, e o bucket é privado.
 *
 * Roda sob demanda porque baixa os originais (vídeos de até 50 MB).
 */
export function LocationCheck({
  items,
  address,
}: {
  items: OriginalItem[];
  address: { lat: number; lng: number } | null;
}) {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const { default: exifr } = await import("exifr");
    for (const item of items) {
      if (!item.url) {
        setResults((r) => ({ ...r, [item.id]: { state: "error" } }));
        continue;
      }
      setResults((r) => ({ ...r, [item.id]: { state: "loading" } }));
      try {
        const buf = await (await fetch(item.url)).arrayBuffer();
        let point: { lat: number; lng: number } | null = null;
        if (item.kind === "video") {
          point = readMp4Location(new Uint8Array(buf));
        } else {
          const gps = await exifr.gps(buf).catch(() => undefined);
          if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
            point = { lat: gps.latitude, lng: gps.longitude };
          }
        }
        setResults((r) => ({
          ...r,
          [item.id]: point
            ? { state: "ok", ...point, km: address ? distanceKm(address, point) : null }
            : { state: "nogps" },
        }));
      } catch {
        setResults((r) => ({ ...r, [item.id]: { state: "error" } }));
      }
    }
    setRunning(false);
  }

  if (!items.length) return <p className="text-sm text-muted-foreground">Nenhuma mídia enviada.</p>;

  return (
    <div className="space-y-3">
      {!address ? (
        <p className="text-xs text-amber-700">
          O endereço deste imóvel não foi localizado no mapa; dá para ver o GPS das fotos, mas não a distância.
        </p>
      ) : null}
      <Button type="button" variant="outline" className="h-9 gap-2" onClick={run} disabled={running}>
        {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
        Conferir localização das mídias
      </Button>
      <ul className="space-y-1 text-sm">
        {items.map((item) => {
          const r = results[item.id] ?? { state: "idle" };
          let text = "";
          let tone = "text-muted-foreground";
          if (r.state === "loading") text = "lendo...";
          else if (r.state === "error") text = "não foi possível ler o original";
          else if (r.state === "nogps") text = "sem GPS no arquivo";
          else if (r.state === "ok") {
            const map = `https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`;
            if (r.km === null) {
              text = `GPS ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`;
            } else {
              text = `capturada a ${r.km < 1 ? `${Math.round(r.km * 1000)} m` : `${r.km.toFixed(1)} km`} do endereço informado`;
              tone = r.km < 0.5 ? "text-emerald-700" : r.km < 5 ? "text-amber-700" : "text-destructive font-medium";
            }
            return (
              <li key={item.id} className="flex flex-wrap gap-x-2">
                <span>{item.label}:</span>
                <span className={tone}>{text}</span>
                <a href={map} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                  ver no mapa
                </a>
              </li>
            );
          }
          return (
            <li key={item.id} className="flex flex-wrap gap-x-2">
              <span>{item.label}:</span>
              <span className={cn(tone)}>{text || "—"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
