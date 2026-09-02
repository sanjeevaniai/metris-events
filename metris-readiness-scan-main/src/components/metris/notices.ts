/* Client-visible copy that must match what the server says.

   src/server/organization.ts holds the authoritative copy of this sentence but
   is server-only — importing it here would pull the domain lists, and the
   import guard would refuse the build. Duplicated deliberately, with this note,
   rather than weakening the boundary. */
export const BUSINESS_EMAIL_NOTICE =
  "Please register with your organization's business email. If your " +
  "organization does not use a corporate email domain, contact us for verification.";
