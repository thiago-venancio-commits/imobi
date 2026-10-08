// Testa a limpeza de localização dos vídeos (src/lib/media/clean-mp4.ts).
//
// Monta um MP4 sintético com a coordenada nos três lugares onde celulares a
// gravam (moov/udta/©xyz, moov/meta e trak/udta) e confere que a cópia limpa
// não tem mais o texto da coordenada em byte nenhum, mantém o tamanho e não
// mexe no conteúdo do vídeo (mdat).
import { readMp4Location, stripMp4Metadata } from "../src/lib/media/clean-mp4.ts";

const enc = new TextEncoder();
function box(type, ...children) {
  const body = children.map((c) => (typeof c === "string" ? enc.encode(c) : c));
  const size = 8 + body.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i) & 0xff;
  let pos = 8;
  for (const b of body) {
    out.set(b, pos);
    pos += b.length;
  }
  return out;
}

const COORD = "+48.8584+002.2945/";
const VIDEO = "conteudo-do-video-intocado";
const mp4 = box(
  "ftyp", "isom\0\0\0\0isomavc1",
);
const moov = box(
  "moov",
  box("mvhd", "\0".repeat(20)),
  box("udta", box("©xyz", "\0\u0012\u0015Ç" + COORD)),
  box("trak", box("tkhd", "\0".repeat(20)), box("udta", "loc " + COORD)),
  box("meta", "com.apple.quicktime.location.ISO6709 " + COORD),
);
const mdat = box("mdat", VIDEO);
const file = new Uint8Array(mp4.length + moov.length + mdat.length);
file.set(mp4, 0);
file.set(moov, mp4.length);
file.set(mdat, mp4.length + moov.length);

let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
};
const latin1 = (u8) => Array.from(u8, (c) => String.fromCharCode(c)).join("");

const found = readMp4Location(file);
check(found && found.lat === 48.8584 && found.lng === 2.2945, "lê a coordenada do original");

const clean = stripMp4Metadata(file);
check(clean.length === file.length, "tamanho preservado (offsets do vídeo continuam válidos)");
check(readMp4Location(clean) === null, "cópia limpa não tem coordenada legível");
check(!latin1(clean).includes("48.8584"), "nenhum byte da coordenada sobrou no arquivo");
check(latin1(clean).includes(VIDEO), "conteúdo do vídeo (mdat) intacto");
check(readMp4Location(file) !== null, "o original não foi alterado (a limpeza trabalha numa cópia)");

let threw = false;
try {
  stripMp4Metadata(enc.encode("isto nao e um video"));
} catch {
  threw = true;
}
check(threw, "arquivo que não é MP4 é recusado em vez de passar sem limpeza");

process.exitCode = failed ? 1 : 0;
console.log(failed ? `\n${failed} falhando` : "\ntudo verde");
