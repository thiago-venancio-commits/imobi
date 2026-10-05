import Link from "next/link";

import { Logo } from "@/components/site/logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-navy-950 text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm">
            Intermediação completa: nosso time acompanha cada negociação do
            primeiro contato até a assinatura.
          </p>
        </div>

        <div className="text-sm">
          <h2 className="mb-3 font-semibold text-white">Para você</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/imoveis" className="hover:text-white">
                Ver imóveis
              </Link>
            </li>
            <li>
              <Link href="/procuro-imovel" className="hover:text-white">
                Cadastrar o que procuro
              </Link>
            </li>
            <li>
              <Link href="/anunciar" className="hover:text-white">
                Anunciar meu imóvel
              </Link>
            </li>
            <li>
              <Link href="/seja-corretor" className="hover:text-white">
                Seja um corretor parceiro
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <h2 className="mb-3 font-semibold text-white">Atendimento</h2>
          <p>
            Todo contato entre comprador e proprietário passa pela nossa equipe.
            É assim que protegemos os dois lados da negociação.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 py-6 text-center text-xs">
        © {new Date().getFullYear()} TSV Imóveis. Todos os direitos reservados.
      </div>
    </footer>
  );
}
