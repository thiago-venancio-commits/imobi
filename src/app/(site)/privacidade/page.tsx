import type { Metadata } from "next";

import { LegalPlaceholder } from "@/components/site/legal-placeholder";

export const metadata: Metadata = { title: "Política de privacidade", robots: { index: false } };

export default function PrivacyPage() {
  return <LegalPlaceholder title="Política de privacidade" />;
}
