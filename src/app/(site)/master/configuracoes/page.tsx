import type { Metadata } from "next";

import { SettingsForm } from "@/components/master/settings-form";
import { requireMasterPage } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Configurações" };

export default async function MasterSettingsPage() {
  const caller = await requireMasterPage("/master/configuracoes");
  const { data } = await caller.supabase.from("site_settings").select("master_whatsapp, master_email").maybeSingle();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        O botão TENHO INTERESSE de todos os anúncios leva para este WhatsApp, nunca para o do proprietário.
      </p>
      <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
        <SettingsForm initial={{ masterWhatsapp: data?.master_whatsapp ?? "", masterEmail: data?.master_email ?? "" }} />
      </div>
    </div>
  );
}
