import { Link } from "@tanstack/react-router";
import { eventConfig } from "@/config/event";
import { BrandLogo } from "@/components/metris/BrandLogo";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-warm-white">
      <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-10">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <BrandLogo />

          <nav aria-label="Footer" className="grid gap-3 sm:grid-cols-2 md:gap-x-16">
            <FooterLink to="/#about">About METRIS</FooterLink>
            <FooterLink to="/contact">Contact</FooterLink>
            <FooterLink to="/privacy">Privacy Policy</FooterLink>
            <FooterLink to="/terms">Terms and Conditions</FooterLink>
            <FooterLink to="/refund-policy">Refund / cancellation policy</FooterLink>
            {eventConfig.linkedinUrl && (
              <a
                href={eventConfig.linkedinUrl}
                className="text-[0.9375rem] text-warm-white/70 underline-offset-4 hover:underline"
              >
                LinkedIn
              </a>
            )}
          </nav>
        </div>

        <p className="mt-12 max-w-3xl text-[0.875rem] leading-relaxed text-warm-white/60">
          METRIS provides organizational readiness measurement and evidence. It is not a
          certification, regulatory or legal opinion, technical validation of an AI model, or
          individual employment assessment.
        </p>
        <p className="mt-6 text-[0.875rem] text-warm-white/50">
          © {year} {eventConfig.legalEntityName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-[0.9375rem] text-warm-white/70 underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
