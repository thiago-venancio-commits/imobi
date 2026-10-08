"use client";

import { ArrowDown, ArrowUp, FileText, ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import {
  moveMediaAction,
  registerDocumentAction,
  registerMediaAction,
  removeDocumentAction,
  removeMediaAction,
  setCoverAction,
} from "@/app/(site)/proprietario/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanImage } from "@/lib/media/clean-image";
import { stripMp4Metadata } from "@/lib/media/clean-mp4";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_BYTES = 50 * 1024 * 1024; // teto do bucket (plano gratuito do Supabase)

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

/** Alguns sistemas mandam o arquivo sem tipo; deduz pela extensão. */
function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return (
    { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", pdf: "application/pdf" }[
      ext ?? ""
    ] ?? ""
  );
}

export interface MediaItem {
  id: string;
  kind: "foto" | "video";
  url: string;
  isCover: boolean;
}

/**
 * Fotos e vídeos do anúncio.
 *
 * Cada arquivo sobe DUAS vezes, direto do navegador para o Storage:
 *   1. o ORIGINAL, com GPS, para o bucket privado (property-docs/{id}/originais),
 *      que só o dono e o Master leem — é a prova antifraude de onde foi feito;
 *   2. a cópia LIMPA para o bucket público, sem nenhum metadado: foto
 *      redesenhada em canvas, vídeo com as caixas de localização zeradas.
 * O site só serve a cópia limpa. As policies do Storage recusam pasta de imóvel
 * alheio, então este componente não precisa (nem consegue) garantir isso.
 */
export function MediaManager({ propertyId, items }: { propertyId: string; items: MediaItem[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  async function uploadOne(file: File): Promise<string | null> {
    const mime = mimeOf(file);
    const isVideo = mime.startsWith("video/");
    if (!EXT[mime] || mime === "application/pdf") return `${file.name}: formato não aceito (use JPG, PNG, WEBP, MP4 ou MOV).`;
    if (file.size > MAX_BYTES) return `${file.name}: maior que 50 MB.`;

    const supabase = createClient();
    const id = crypto.randomUUID();
    const originalPath = `${propertyId}/originais/${id}.${EXT[mime]}`;

    let clean: Blob;
    let cleanPath: string;
    try {
      if (isVideo) {
        const bytes = stripMp4Metadata(new Uint8Array(await file.arrayBuffer()));
        clean = new Blob([bytes as BlobPart], { type: mime });
        cleanPath = `${propertyId}/${id}.${EXT[mime]}`;
      } else {
        clean = await cleanImage(file);
        cleanPath = `${propertyId}/${id}.jpg`;
      }
    } catch {
      return `${file.name}: não foi possível processar o arquivo.`;
    }

    const original = await supabase.storage
      .from("property-docs")
      .upload(originalPath, file, { contentType: mime, upsert: false });
    if (original.error) return `${file.name}: falha no envio.`;

    const pub = await supabase.storage
      .from("property-media")
      .upload(cleanPath, clean, { contentType: clean.type || mime, upsert: false });
    if (pub.error) {
      await supabase.storage.from("property-docs").remove([originalPath]);
      return `${file.name}: falha no envio.`;
    }

    const res = await registerMediaAction({
      propertyId,
      path: cleanPath,
      originalPath,
      kind: isVideo ? "video" : "foto",
    });
    if (!res.ok) {
      await supabase.storage.from("property-media").remove([cleanPath]);
      await supabase.storage.from("property-docs").remove([originalPath]);
      return `${file.name}: ${res.error}`;
    }
    return null;
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    const failures: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress(`Enviando ${i + 1} de ${files.length}...`);
      const err = await uploadOne(file);
      if (err) failures.push(err);
    }
    setProgress(null);
    setErrors(failures);
    if (input.current) input.current.value = "";
  }

  const busy = progress !== null || pending;

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
        As fotos publicadas saem <strong>sem a localização do GPS</strong> do celular. A versão original
        fica guardada só com a equipe, para confirmar que as imagens são mesmo deste imóvel.
      </p>

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((m, i) => (
            <li key={m.id} className={cn("overflow-hidden rounded-xl ring-1 ring-border", m.isCover && "ring-2 ring-brand-500")}>
              <div className="relative aspect-[4/3] bg-muted">
                {m.kind === "foto" ? (
                  <Image src={m.url} alt="" fill sizes="(min-width: 640px) 240px, 50vw" className="object-cover" />
                ) : (
                  <video src={m.url} className="size-full object-cover" preload="metadata" muted />
                )}
                {m.isCover ? (
                  <span className="absolute left-2 top-2 rounded-md bg-brand-500 px-2 py-0.5 text-xs font-medium text-white">
                    Capa
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy || i === 0}
                    aria-label="Mover para a esquerda"
                    onClick={() => startTransition(() => moveMediaAction(propertyId, m.id, -1))}
                  >
                    <ArrowUp className="size-4 -rotate-90" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy || i === items.length - 1}
                    aria-label="Mover para a direita"
                    onClick={() => startTransition(() => moveMediaAction(propertyId, m.id, 1))}
                  >
                    <ArrowDown className="size-4 -rotate-90" />
                  </Button>
                </div>
                <div className="flex">
                  {m.kind === "foto" && !m.isCover ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label="Usar como capa"
                      onClick={() => startTransition(() => setCoverAction(propertyId, m.id))}
                    >
                      <Star className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label="Excluir"
                    onClick={() => startTransition(() => removeMediaAction(propertyId, m.id))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
        className="sr-only"
        id={`media-${propertyId}`}
        data-testid="media-input"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        className="h-10 gap-2"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {progress ?? "Adicionar fotos ou vídeos"}
      </Button>
      <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, MP4 ou MOV, até 50 MB cada. A primeira foto vira a capa.</p>
      {errors.length ? (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
export interface DocumentItem {
  id: string;
  label: string;
  url: string | null;
}

/** Escritura, IPTU, matrícula: bucket privado, só dono e Master. */
export function DocumentsManager({ propertyId, items }: { propertyId: string; items: DocumentItem[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const mime = mimeOf(file);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(mime)) {
      setError("Envie PDF, JPG ou PNG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Arquivo maior que 50 MB.");
      return;
    }
    setStatus("Enviando...");
    const supabase = createClient();
    const path = `${propertyId}/documentos/${crypto.randomUUID()}.${EXT[mime]}`;
    const up = await supabase.storage.from("property-docs").upload(path, file, { contentType: mime, upsert: false });
    if (up.error) {
      setStatus(null);
      setError("Falha no envio do documento.");
      return;
    }
    const res = await registerDocumentAction({ propertyId, path, label: label.trim() || file.name });
    if (!res.ok) {
      await supabase.storage.from("property-docs").remove([path]);
      setError(res.error);
    } else {
      setLabel("");
    }
    setStatus(null);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-4">
      {items.length ? (
        <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    {d.label}
                  </a>
                ) : (
                  <span className="truncate">{d.label}</span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`Excluir ${d.label}`}
                onClick={() => startTransition(() => removeDocumentAction(propertyId, d.id))}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome do documento (ex.: IPTU 2026)"
          className="h-10"
          aria-label="Nome do documento"
        />
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="sr-only"
          data-testid="document-input"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 gap-2"
          disabled={status !== null}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {status ?? "Enviar documento"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Matrícula, escritura, IPTU. Ficam só com você e a equipe; nunca aparecem no anúncio.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
