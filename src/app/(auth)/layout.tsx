import { Logo } from "@/components/site/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-navy-950">
      <header className="mx-auto w-full max-w-md px-4 pt-10 text-white sm:px-0">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-0">
        <div className="rounded-2xl bg-card p-6 text-card-foreground shadow-xl sm:p-8">{children}</div>
      </main>
    </div>
  );
}
