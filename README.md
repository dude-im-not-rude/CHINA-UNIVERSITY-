# China University Tracker

Next.js starter for a China university, scholarship and CSCA discovery platform.

Includes responsive Bachelor + Master directory, university details, scholarship hub, CSCA hub and contact API shell.

Run: `npm install` then `npm run dev`.

Important: dates, fees, quotas, contacts and eligibility are intentionally marked for verification rather than invented.


## Brevo contact form

The contact form now sends transactional email through Brevo's API.

Add these Vercel Environment Variables:

- `BREVO_API_KEY` — your Brevo API key
- `BREVO_SENDER_EMAIL` — a sender address verified in Brevo
- `BREVO_RECIPIENT_EMAIL` — the inbox where contact messages should arrive
- `BREVO_SENDER_NAME` — optional, defaults to `ChinaUniTracker`

Do not put the API key in source code or commit it to GitHub.

After adding/changing environment variables, redeploy the Vercel project.

The API endpoint is `/api/contact`. It accepts the normal HTML form used by the Contact page and also accepts JSON requests.

Brevo's transactional email endpoint requires a verified sender and authenticates with the `api-key` header.


## Web3Forms contact form + hCaptcha

Brevo is no longer used by the contact form.

Add this Vercel Environment Variable:

- `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` — your Web3Forms Access Key

The Web3Forms access key is designed to be public, but keeping it in an environment variable makes deployment easier to manage.

The contact form uses Web3Forms' hCaptcha integration. Web3Forms documents a zero-config hCaptcha setup and provides the free-plan site key used by the React/Next.js example.

After adding the variable, redeploy the Vercel project.
