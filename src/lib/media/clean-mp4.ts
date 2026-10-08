/**
 * Metadados de vídeo MP4/MOV: remover a localização e lê-la.
 *
 * Celulares gravam onde o vídeo foi feito dentro do próprio arquivo — Android
 * em `moov/udta/©xyz`, iPhone também em `moov/meta` (chave
 * com.apple.quicktime.location.ISO6709). No anúncio público isso entregaria o
 * endereço exato do imóvel; no original guardado em privado é a prova
 * antifraude que o Master confere.
 *
 * A limpeza troca o tipo das caixas `udta` e `meta` (de `moov` e de cada
 * `trak`) para `free` e ZERA o conteúdo delas. O tamanho do arquivo não muda,
 * então os offsets de `stco`/`co64` continuam válidos e o vídeo toca igual —
 * players pulam caixas `free`. Só renomear não bastaria: os bytes da
 * coordenada continuariam lá para quem abrisse o arquivo num editor.
 *
 * Sem dependências e sem APIs de navegador: roda no browser e no Node (o teste
 * em scripts/media-test.mjs importa este arquivo direto).
 */

interface Box {
  type: string;
  start: number;
  headerSize: number;
  end: number;
}

const STRIP = new Set(["udta", "meta"]);

function* boxes(buf: Uint8Array, start: number, end: number): Generator<Box> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = start;
  while (pos + 8 <= end) {
    let size = view.getUint32(pos);
    const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    let headerSize = 8;
    if (size === 1) {
      if (pos + 16 > end) return;
      size = view.getUint32(pos + 8) * 2 ** 32 + view.getUint32(pos + 12);
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    // Caixa malformada: para de andar em vez de escrever fora do lugar.
    if (size < headerSize || pos + size > end) return;
    yield { type, start: pos, headerSize, end: pos + size };
    pos += size;
  }
}

/** As caixas de metadados (udta/meta) do vídeo, onde a localização mora. */
function metadataBoxes(buf: Uint8Array): Box[] {
  const found: Box[] = [];
  let sawMoov = false;
  for (const top of boxes(buf, 0, buf.length)) {
    if (STRIP.has(top.type)) found.push(top);
    if (top.type !== "moov") continue;
    sawMoov = true;
    for (const child of boxes(buf, top.start + top.headerSize, top.end)) {
      if (STRIP.has(child.type)) found.push(child);
      if (child.type !== "trak") continue;
      for (const sub of boxes(buf, child.start + child.headerSize, child.end)) {
        if (STRIP.has(sub.type)) found.push(sub);
      }
    }
  }
  if (!sawMoov) throw new Error("Arquivo de vídeo não reconhecido (MP4/MOV sem moov).");
  return found;
}

/** Devolve uma CÓPIA do vídeo sem os metadados de localização. */
export function stripMp4Metadata(input: Uint8Array): Uint8Array {
  const out = new Uint8Array(input);
  for (const box of metadataBoxes(out)) {
    out.set([0x66, 0x72, 0x65, 0x65], box.start + 4); // "free"
    out.fill(0, box.start + box.headerSize, box.end);
  }
  return out;
}

/**
 * Coordenada gravada no vídeo, ou null. Procura o formato ISO 6709
 * ("+48.8584+002.2945/"), que é como Android e iPhone escrevem.
 */
export function readMp4Location(input: Uint8Array): { lat: number; lng: number } | null {
  let list: Box[];
  try {
    list = metadataBoxes(input);
  } catch {
    return null;
  }
  for (const box of list) {
    let text = "";
    for (let i = box.start + box.headerSize; i < box.end; i++) text += String.fromCharCode(input[i]);
    const m = /([+-]\d{1,2}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)/.exec(text);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}
