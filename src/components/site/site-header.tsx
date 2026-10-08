import { Heart } from "lucide-react";
import Link from "next/link";

import { AccountLink } from "@/components/site/account-link";
import { Logo } from "@/components/site/logo";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/imoveis", label: "Imóveis" },
  { href: "/anunciar", label: "Anunciar imóvel" },
  { href: "/sobre", label: "Sobre nós" },
  { href: "/duvidas", label: "Dúvidas" },
  { href: "/contato", label: "Fale conosco" },
];

export function SiteHeader() {
  return (
    <header className="bg-navy-950 text-white">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-5 lg:ml-0">
          <Link
            href="/minha-conta/favoritos"
            className="hidden items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white sm:flex"
          >
            <Heart className="size-4" aria-hidden />
            Favoritos
          </Link>
          <AccountLink />
        </div>
      </div>

      {/* Navegação em telas pequenas: a mesma lista, rolando na horizontal. */}
      <nav className="flex gap-6 overflow-x-auto border-t border-white/10 px-4 py-3 text-sm lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap font-medium text-white/80"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
