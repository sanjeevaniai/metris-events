# metris-events

Static event pages for SANJEEVANI AI, served at https://events.sanjeevaniai.com

- `index.html` is the live event page. Everything editable (title, abstract, date, speaker, form links) lives in the `window.CONFIG` block near the top of the file.
- No build step. Vercel serves the repo root as static files; a push to `main` deploys.
