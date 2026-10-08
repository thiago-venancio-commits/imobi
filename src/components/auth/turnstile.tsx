"use client";

import { useEffect, useRef } from "react";

import { publicEnv } from "@/lib/env";

/**
 * Cloudflare Turnstile (captcha) nos formulários de autenticação.
 *
 * O widget só GERA o token: ele entra no formulário como `cf-turnstile-response`
 * e a Server Action repassa ao Supabase (`captchaToken`). Quem VALIDA é o
 * Supabase Auth, no servidor dele, com a chave secreta — e vale também para quem
 * chama a API de auth direto, sem passar por este site.
 *
 * O token é de uso único: depois de cada envio (`resetKey` muda) o widget gera
 * outro, senão a segunda tentativa de login falharia sempre.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function Turnstile({ resetKey, action }: { resetKey?: unknown; action?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = publicEnv.turnstileSiteKey;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          action,
          language: "pt-br",
          size: "flexible",
          // O token entra no FormData por este campo oculto.
          "response-field-name": "cf-turnstile-response",
        });
      })
      .catch(() => {
        // Sem o script (bloqueador, rede): o envio segue e o Supabase recusa
        // com uma mensagem clara, em vez de o formulário travar em silêncio.
      });
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetKey !== undefined && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
