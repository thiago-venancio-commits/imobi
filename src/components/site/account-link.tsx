"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * "Entrar / Cadastrar" ou "Minha conta", conforme a sessão.
 *
 * Fica no cliente de propósito. Se o cabeçalho lesse o cookie no servidor,
 * toda página pública viraria dinâmica e perderia o cache — inclusive a
 * vitrine, que é igual para todos. Aqui a página continua estática e só este
 * link muda depois de carregar.
 *
 * É só exibição: a sessão lida aqui não autoriza nada. As páginas da conta
 * conferem o usuário no servidor (getUser), e o banco confere de novo.
 */
export function AccountLink() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <Link
      href={signedIn ? "/minha-conta" : "/entrar"}
      className="flex items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
    >
      <UserRound className="size-4" aria-hidden />
      {signedIn ? "Minha conta" : "Entrar / Cadastrar"}
    </Link>
  );
}
