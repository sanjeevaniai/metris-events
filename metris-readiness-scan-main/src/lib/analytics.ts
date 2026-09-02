import { eventConfig } from "@/config/event";

/**
 * Analytics shim.
 *
 * No provider is configured yet, so this no-ops (dev builds log to console).
 * NEVER pass names, emails, free-text use cases, or any personal data here.
 */
export type AnalyticsEvent =
  | "cta_register_click"
  | "cta_choose_pass"
  | "registration_form_started"
  | "registration_form_error"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_cancelled"
  | "faq_opened"
  | "use_case_card_viewed"
  | "use_case_detail_opened";

type Primitive = string | number | boolean;

export function track(event: AnalyticsEvent, props: Record<string, Primitive> = {}) {
  if (typeof window === "undefined") return;
  if (!eventConfig.analyticsProvider) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[analytics:noop]", event, props);
    }
    return;
  }
  // Wire the approved provider here once supplied.
}
