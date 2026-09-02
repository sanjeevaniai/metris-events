import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { eventConfig } from "@/config/event";
import { BUSINESS_EMAIL_NOTICE } from "@/components/metris/notices";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const ORG_TYPES = [
  { value: "health_plan", label: "Health plan" },
  { value: "provider", label: "Provider" },
  { value: "health_tech", label: "Health technology or services" },
  { value: "other", label: "Other" },
] as const;

/* Named attendees for the Team Pass. One to five, each with their own name and
   business email, because each one gets their own Zoom registration. */
const attendeeSchema = z.object({
  name: z.string().trim().max(160).optional(),
  email: z.string().trim().max(255).optional(),
});

const schema = z.object({
  passId: z.enum(["executive", "team"], {
    errorMap: () => ({ message: "Choose a pass" }),
  }),
  attendees: z.array(attendeeSchema).optional(),
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().min(1, "Enter your last name").max(80),
  businessEmail: z
    .string()
    .trim()
    .min(1, "Enter your business email")
    .email("Enter a valid email address")
    .max(255),
  jobTitle: z.string().trim().min(1, "Enter your job title").max(120),
  organization: z.string().trim().min(1, "Enter your organization").max(160),
  organizationType: z.enum(["health_plan", "provider", "health_tech", "other"], {
    errorMap: () => ({ message: "Select an organization type" }),
  }),
  country: z.string().trim().min(1, "Enter your country").max(80),
  preliminaryUseCase: z.string().trim().max(600).optional(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Privacy Policy" }),
  }),
  marketingConsent: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  businessEmail: "Business email",
  jobTitle: "Job title",
  organization: "Organization",
  organizationType: "Organization type",
  country: "Country",
  termsAccepted: "Terms and Privacy Policy",
};

const inputClass =
  "min-h-11 w-full rounded-[14px] border border-input bg-card px-4 py-3 text-[1rem] text-foreground placeholder:text-muted-foreground";

export function RegistrationForm({
  selectedPass = "executive",
}: {
  selectedPass?: "executive" | "team";
}) {
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "error" | "manual_review" | "sold_out"
  >("idle");
  const [reviewNotice, setReviewNotice] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  /* our registration id, minted by /api/register and reused on a retry */
  const regId = useRef<string>("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    // Values are never cleared on error, so entries survive recoverable failures.
    defaultValues: {
      passId: selectedPass,
      attendees: [{ name: "", email: "" }],
      firstName: "",
      lastName: "",
      businessEmail: "",
      jobTitle: "",
      organization: "",
      country: "",
      preliminaryUseCase: "",
      marketingConsent: false,
    },
  });

  const passId = watch("passId");
  const isTeam = passId === "team";

  /* Choosing a pass in the pricing section above updates the form. */
  useEffect(() => {
    setValue("passId", selectedPass);
  }, [selectedPass, setValue]);

  const onStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    track("registration_form_started");
  };

  const onInvalid = () => {
    // No personal values are ever sent — field names only.
    track("registration_form_error", { fields: Object.keys(errors).join(",") });
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const onValid = async (values: FormValues) => {
    if (isSubmitting || submitState === "submitting") return;
    setSubmitState("submitting");
    setServerError(null);
    track("checkout_started", { location: "registration_form" });

    // No card data is ever collected or stored by this application: payment
    // happens by redirect to Stripe Checkout and nowhere else. Payment status
    // is never set from the redirect back either — the confirmation card asks
    // /api/session, which asks Stripe.
    /* Only a pass ID goes to the server — never a price, a currency or a seat
       count. The server resolves all three from configuration, so a tampered
       client can pick between two fixed products and nothing more. */
    const attendees =
      values.passId === "team"
        ? (values.attendees ?? [])
            .map((a) => ({ name: (a.name ?? "").trim(), email: (a.email ?? "").trim() }))
            .filter((a) => a.name || a.email)
        : [];

    const payload = {
      registrationId: regId.current || undefined,
      passId: values.passId,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      businessEmail: values.businessEmail.trim(),
      jobTitle: values.jobTitle.trim(),
      organization: values.organization.trim(),
      organizationType: values.organizationType,
      country: values.country.trim(),
      preliminaryUseCase: (values.preliminaryUseCase ?? "").trim(),
      termsAccepted: values.termsAccepted === true,
      marketingConsent: values.marketingConsent === true,
      attendees,
    };

    try {
      // The registration is written BEFORE payment, so an abandoned checkout
      // still leaves the lead behind. Do not reverse this order.
      const reg = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (!reg?.ok) {
        setServerError(reg?.error ?? "We could not record your registration.");
        setSubmitState("error");
        return;
      }
      // Held so a second attempt after a failed checkout fills the same row in
      // rather than adding a duplicate.
      regId.current = reg.registrationId;

      /* A mailbox that cannot establish organizational identity is CAPTURED,
         not turned away. The details are recorded; a person reviews it. */
      if (reg.verificationState === "manual_review") {
        setReviewNotice(reg.reviewNotice ?? "");
        setSubmitState("manual_review");
        return;
      }

      const checkout = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: reg.registrationId,
          passId: values.passId,
          email: payload.businessEmail,
          name: `${payload.firstName} ${payload.lastName}`.trim(),
          jobTitle: payload.jobTitle,
          company: payload.organization,
          country: payload.country,
        }),
      }).then((r) => r.json());

      if (checkout?.soldOut) {
        setServerError(checkout.error ?? "This session is fully booked.");
        setSubmitState("sold_out");
        return;
      }
      if (checkout?.needsReview) {
        setReviewNotice(checkout.error ?? "");
        setSubmitState("manual_review");
        return;
      }
      if (!checkout?.ok || !checkout.url) {
        setServerError(checkout?.error ?? "We could not start the payment.");
        setSubmitState("error");
        return;
      }
      window.location.href = checkout.url;
    } catch {
      setServerError("We could not reach the server. Please try again.");
      setSubmitState("error");
    }
  };

  const errorList = Object.entries(errors);
  const busy = submitState === "submitting" || isSubmitting;

  return (
    <form
      noValidate
      onChange={onStart}
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="rounded-[26px] border border-hairline bg-card p-6 md:p-9"
    >
      <h3 className="text-[1.5rem] font-medium text-foreground">Reserve your registration</h3>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {eventConfig.passes[passId ?? "executive"].priceLabel}{" "}
        {eventConfig.passes[passId ?? "executive"].currency}. Refund and cancellation terms are
        shown on the{" "}
        <a className="underline underline-offset-4" href={eventConfig.refundPolicyUrl}>
          refund policy
        </a>{" "}
        page before payment.
      </p>

      {errorList.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 rounded-[16px] border border-destructive/40 bg-destructive/5 p-4"
        >
          <p className="text-[0.9375rem] font-medium text-destructive">
            Please fix {errorList.length} {errorList.length === 1 ? "field" : "fields"}:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.9375rem] text-destructive">
            {errorList.map(([name, err]) => (
              <li key={name}>
                <a href={`#field-${name}`} className="underline underline-offset-2">
                  {FIELD_LABELS[name] ?? name}: {String(err?.message ?? "Invalid")}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Which pass. The price and the number of places both follow from this,
          and both are resolved on the server. */}
      <fieldset className="mt-7">
        <legend className="mb-3 text-[0.875rem] font-medium text-foreground">Your pass</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["executive", "team"] as const).map((id) => {
            const p = eventConfig.passes[id];
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-[16px] border p-4 transition-colors",
                  passId === id ? "border-lime-measure bg-paper" : "border-input",
                )}
              >
                <input type="radio" value={id} className="mt-1 size-4" {...register("passId")} />
                <span>
                  <span className="block text-[0.9375rem] font-medium text-foreground">
                    {p.name} — {p.priceLabel}
                  </span>
                  <span className="mt-1 block text-[0.875rem] text-muted-foreground">
                    {p.tagline}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-[0.8125rem] text-muted-foreground">
          {eventConfig.moreThanFiveLine}
        </p>
      </fieldset>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field id="firstName" label="First name" error={errors.firstName?.message}>
          <input
            id="field-firstName"
            autoComplete="given-name"
            className={inputClass}
            {...register("firstName")}
          />
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName?.message}>
          <input
            id="field-lastName"
            autoComplete="family-name"
            className={inputClass}
            {...register("lastName")}
          />
        </Field>
        <Field
          id="businessEmail"
          label="Business email"
          error={errors.businessEmail?.message}
          className="sm:col-span-2"
        >
          <input
            id="field-businessEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputClass}
            {...register("businessEmail")}
          />
        </Field>
        <Field id="jobTitle" label="Job title" error={errors.jobTitle?.message}>
          <input
            id="field-jobTitle"
            autoComplete="organization-title"
            className={inputClass}
            {...register("jobTitle")}
          />
        </Field>
        <Field id="organization" label="Organization" error={errors.organization?.message}>
          <input
            id="field-organization"
            autoComplete="organization"
            className={inputClass}
            {...register("organization")}
          />
        </Field>
        <Field
          id="organizationType"
          label="Organization type"
          error={errors.organizationType?.message}
        >
          <select
            id="field-organizationType"
            defaultValue=""
            className={inputClass}
            {...register("organizationType")}
          >
            <option value="" disabled>
              Select one
            </option>
            {ORG_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="country" label="Country" error={errors.country?.message}>
          <input
            id="field-country"
            autoComplete="country-name"
            className={inputClass}
            {...register("country")}
          />
        </Field>

        <Field
          id="preliminaryUseCase"
          label="What healthcare AI use case are you considering?"
          optional
          error={errors.preliminaryUseCase?.message}
          className="sm:col-span-2"
          hint="Preliminary only — this does not determine eligibility or assessment scope. Do not enter patient information, member information, PHI, medical records, or confidential organizational data. A brief non-sensitive description is sufficient."
        >
          <textarea
            id="field-preliminaryUseCase"
            rows={3}
            className={cn(inputClass, "min-h-24 resize-y")}
            {...register("preliminaryUseCase")}
          />
        </Field>
      </div>

      {isTeam && (
        <fieldset className="mt-8 rounded-[20px] border border-hairline bg-paper p-5 md:p-6">
          <legend className="px-2 text-[0.875rem] font-medium text-foreground">
            Named attendees
          </legend>
          <p className="text-[0.875rem] leading-relaxed text-muted-foreground">
            Up to {eventConfig.passes.team.places}. Every attendee is registered individually and
            receives their own joining credentials, so each one needs their own business email. Five
            places are reserved whether you name one person now or five — you can supply the
            remaining names later.
          </p>
          <div className="mt-5 space-y-4">
            {Array.from({ length: eventConfig.passes.team.places }).map((_, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-2">
                <input
                  aria-label={`Attendee ${i + 1} name`}
                  placeholder={i === 0 ? "Attendee 1 name" : `Attendee ${i + 1} name (optional)`}
                  className={inputClass}
                  {...register(`attendees.${i}.name` as const)}
                />
                <input
                  aria-label={`Attendee ${i + 1} business email`}
                  type="email"
                  inputMode="email"
                  placeholder={i === 0 ? "Attendee 1 business email" : "Business email (optional)"}
                  className={inputClass}
                  {...register(`attendees.${i}.email` as const)}
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-7 space-y-4">
        <label className="flex gap-3 text-[0.9375rem] text-foreground">
          <input
            id="field-termsAccepted"
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-[var(--lime-measure)]"
            {...register("termsAccepted")}
          />
          <span>
            I accept the{" "}
            <a className="underline underline-offset-4" href={eventConfig.termsUrl}>
              Terms and Conditions
            </a>{" "}
            and{" "}
            <a className="underline underline-offset-4" href={eventConfig.privacyUrl}>
              Privacy Policy
            </a>
            . <span aria-hidden>*</span>
          </span>
        </label>
        {errors.termsAccepted && (
          <p className="text-[0.875rem] text-destructive">{errors.termsAccepted.message}</p>
        )}

        <label className="flex gap-3 text-[0.9375rem] text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-[var(--lime-measure)]"
            {...register("marketingConsent")}
          />
          <span>
            Optional: send me occasional METRIS updates about readiness measurement and future
            sessions. This is separate from my registration and I can unsubscribe at any time.
          </span>
        </label>
      </div>

      {submitState === "manual_review" && (
        <div
          role="status"
          className="mt-7 flex gap-3 rounded-[16px] border border-hairline bg-paper p-4 text-[0.9375rem] text-foreground"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">We have your details — one check first.</p>
            <p className="mt-1 text-muted-foreground">{reviewNotice || BUSINESS_EMAIL_NOTICE}</p>
            <p className="mt-2 text-muted-foreground">
              Nothing has been charged and no place is held yet. We will be in touch at the address
              you gave.
            </p>
          </div>
        </div>
      )}

      {submitState === "sold_out" && (
        <div
          role="status"
          className="mt-7 rounded-[16px] border border-hairline bg-paper p-4 text-[0.9375rem]"
        >
          <p className="font-medium text-foreground">Sold out</p>
          <p className="mt-1 text-muted-foreground">
            {serverError} Contact {eventConfig.supportEmail} about future sessions.
          </p>
        </div>
      )}

      {submitState === "error" && serverError && (
        <div
          role="alert"
          className="mt-7 flex gap-3 rounded-[16px] border border-hairline bg-paper p-4 text-[0.9375rem] text-foreground"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">We could not start your checkout.</p>
            {/* the server's own words: it names the missing key or the
                misconfigured price rather than saying "something went wrong" */}
            <p className="mt-1 text-muted-foreground">{serverError}</p>
            <p className="mt-2 text-muted-foreground">
              Nothing has been charged. Your details are still here — press the button again, or
              email {eventConfig.supportEmail} if it keeps failing.
            </p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-[1rem] font-medium text-primary-foreground transition-colors hover:bg-lime-measure hover:text-ink focus-visible:bg-lime-measure focus-visible:text-ink disabled:opacity-60"
      >
        {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
        {busy
          ? "Preparing secure checkout…"
          : `Continue to secure payment — ${eventConfig.passes[passId ?? "executive"].priceLabel}`}
      </button>

      <p className="mt-4 text-[0.875rem] leading-relaxed text-muted-foreground">
        Payment is handled by a PCI-compliant hosted provider. METRIS never receives or stores card
        details. A place is confirmed only after payment succeeds.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  children,
  error,
  hint,
  optional,
  className,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  optional?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={`field-${id}`}
        className="mb-2 block text-[0.875rem] font-medium text-foreground"
      >
        {label}
        {optional ? (
          <span className="ml-2 font-normal text-muted-foreground">Optional</span>
        ) : (
          <span aria-hidden className="ml-1 text-muted-foreground">
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="mt-2 text-[0.8125rem] text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-2 text-[0.875rem] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
