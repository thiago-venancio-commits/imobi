import { Home } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  tagline = true,
}: {
  className?: string;
  tagline?: boolean;
}) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white shadow-sm">
        <Home className="size-5" aria-hidden />
      </span>
      <span className="leading-none">
        <span className="block text-xl font-extrabold tracking-tight">
          TSV<span className="text-brand-400">IMÓVEIS</span>
        </span>
        {tagline ? (
          <span className="mt-1 block text-[11px] font-medium opacity-70">
            Conectando pessoas aos melhores imóveis
          </span>
        ) : null}
      </span>
    </Link>
  );
}
