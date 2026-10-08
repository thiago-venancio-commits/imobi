import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/properties";
import type { PropertyStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const TONE: Partial<Record<PropertyStatus, string>> = {
  rascunho: "bg-muted text-muted-foreground",
  aguardando_aprovacao: "bg-amber-100 text-amber-900",
  publicado: "bg-emerald-100 text-emerald-900",
  reservado: "bg-sky-100 text-sky-900",
  em_negociacao: "bg-sky-100 text-sky-900",
  rejeitado: "bg-destructive/10 text-destructive",
  pausado: "bg-muted text-muted-foreground",
  cancelado: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: PropertyStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("border-0", TONE[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
