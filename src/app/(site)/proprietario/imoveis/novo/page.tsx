import type { Metadata } from "next";

import { NewPropertyForm } from "@/components/owner/new-property-form";

export const metadata: Metadata = { title: "Cadastrar imóvel" };

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Cadastrar imóvel</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Comece pelo básico. Na próxima tela você completa endereço, valores e fotos, e envia para a equipe
        quando estiver pronto. Nada é publicado antes da aprovação.
      </p>
      <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
        <NewPropertyForm />
      </div>
    </div>
  );
}
