import { Link } from "@tanstack/react-router";
import { eventConfig } from "@/config/event";
import { SiteFooter } from "@/components/metris/SiteFooter";
import { BrandLogo } from "@/components/metris/BrandLogo";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center px-5 md:px-10">
          <Link to="/">
            <BrandLogo wordmarkClassName="text-foreground" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-20 md:px-10 md:py-28">
        <p
          role="note"
          className="mb-10 inline-flex rounded-full border border-hairline bg-paper px-5 py-2.5 text-[0.875rem] font-medium text-foreground"
        >
          Draft — pending founder approval. Not legal advice and not yet published policy.
        </p>
        <h1 className="max-w-[20ch] text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] font-light tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        <p className="mt-8 max-w-[52rem] text-[1.0625rem] leading-relaxed text-muted-foreground md:text-[1.1875rem]">
          {intro}
        </p>
        <div className="mt-10 max-w-[52rem] space-y-5 text-[1.0625rem] leading-relaxed text-muted-foreground">
          {children}
        </div>
        <p className="mt-14 text-[0.9375rem] text-muted-foreground">
          Questions: {eventConfig.supportEmail} · Legal entity: {eventConfig.legalEntityName}
        </p>
        <Link
          to="/"
          className="mt-10 inline-flex min-h-12 items-center rounded-full border border-input px-6 text-[1rem] font-medium text-foreground"
        >
          Return to event page
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
