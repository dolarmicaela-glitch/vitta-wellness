# VITTA Reset · Mercado Pago

The checkout creates an individual Checkout Pro preference per attempt. The price comes from `content/site.json`; customer-supplied amounts are ignored. Payment status is confirmed server-side with Mercado Pago and tied to a signed purchase session. The programme is delivered manually after Mica verifies the payment; no files are unlocked from redirect parameters.

## Deployment

1. In the existing Netlify project, set `MP_ACCESS_TOKEN` as a private environment variable for Functions. Never commit it or place it in a browser script. `URL` is supplied by Netlify; `CHECKOUT_SITE_URL` may override it with the canonical HTTPS site origin.
2. Set `checkout_api_base_url` in `content/site.json` to that Netlify HTTPS origin if the front end remains on GitHub Pages. The Netlify-hosted checkout works with its own origin when this optional setting is absent.
3. Deploy the project with the functions from this branch. Confirm the hosted checkout can create an ARS 49,870 preference and that pending, rejected, and approved purchases display the appropriate state.
4. The VITTA Reset purchase anchors in this branch open `pagar-vitta.html?v=mp1&start=1`, which starts the checkout immediately. Publish these front-end changes only after the Netlify production function is configured and verified. The other ebooks' payment links are preserved.

Tests: `node --test tests/mercadopago.test.cjs`. Tests use a placeholder token and mocked provider responses. They do not create real transactions.

No production credentials, CVU, alias, or identity-document numbers belong in this repository. This branch is a deployment draft. The live main branch remains unchanged until the private server configuration and provider flow have been verified.
