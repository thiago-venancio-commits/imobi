import type { Metadata } from "next";

import { LegalPlaceholder } from "@/components/site/legal-placeholder";

export const metadata: Metadata = { title: "Termos de uso", robots: { index: false } };

export default function TermsPage() {
  return <LegalPlaceholder title="Termos de uso" />;
}
