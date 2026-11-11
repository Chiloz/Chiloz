# Chat assistant Worker: deploy guide

The widget on the site sends questions to this Cloudflare Worker. The Worker holds your Gemini API key, checks the request came from your site, rate-limits it, and asks Gemini. Cloudflare's free plan needs **no credit card**, and Firebase stays on the free Spark plan.

```
browser (chatbot.js) --POST--> Cloudflare Worker --key in header--> Gemini API
   josaphatchilokoto.space        chiloz-chat.<you>.workers.dev
```

## One-time setup

1. **Cloudflare account.** Sign up free at https://dash.cloudflare.com/sign-up and verify your email.
2. **Gemini key.** Create one at https://aistudio.google.com/apikey. Use a project **without billing attached**, so the key can never charge anyone; the worst abuse can do is use up the free quota.
3. **Install and log in** (from this `worker/` folder):
   ```
   npm install
   npx wrangler login
   ```
4. **Deploy the Worker:**
   ```
   npm run deploy
   ```
   It prints a URL like `https://chiloz-chat.<your-subdomain>.workers.dev`. Copy it.
5. **Store the key as a secret** (paste it when asked; it is never written to a file or the repo):
   ```
   npx wrangler secret put GEMINI_API_KEY
   ```
6. **Check it:**
   ```
   curl https://chiloz-chat.<your-subdomain>.workers.dev/health
   ```
   You should see `{"ok":true,"configured":true}`. `configured:false` means step 5 did not take.
7. **Point the widget at the Worker** (it edits `public/js/chatbot.js` for you):
   ```
   npm run connect -- https://chiloz-chat.<your-subdomain>.workers.dev
   ```
8. **Publish the site** from the site root (the folder with `firebase.json`):
   ```
   firebase deploy --only hosting
   ```
9. Open https://josaphatchilokoto.space, open the chat bubble and ask something the quick answers don't cover, like "Does he know any Python?".

## Everyday use

| Task | How |
| --- | --- |
| Run the tests (no network, no key needed) | `npm test` |
| Change the model | edit `GEMINI_MODELS` in `wrangler.toml`, then `npm run deploy` |
| Add another site that may use the bot | add it to `ALLOWED_ORIGINS` in `wrangler.toml`, then `npm run deploy` |
| Rotate the key | `npx wrangler secret put GEMINI_API_KEY` again |
| Watch live logs | `npx wrangler tail` |
| Change what the bot knows | edit `SYSTEM_PROMPT` in `src/index.js`, then `npm run deploy` |

## When something is off

| Symptom | Cause and fix |
| --- | --- |
| Chat says "I couldn't reach the assistant" and the browser console shows a CSP error | `firebase.json` was not redeployed. It must contain `https://*.workers.dev` in `connect-src`. Run step 8 again. |
| Chat only answers the quick questions and says to message Josaphat | `const API = ""` in `chatbot.js` is still empty. Run step 7, then step 8. |
| `403 Forbidden` from the Worker | The page's origin is not in `ALLOWED_ORIGINS`. `curl` without an `Origin` header is also refused on purpose. |
| `503` | The secret is missing (`/health` shows `configured:false`). |
| `502` | Gemini rejected the key (check it in AI Studio) or both models are down. `npx wrangler tail` shows the upstream status. |
| `429` "busy" | Free Gemini quota used up for now. It resets daily; the bot still shows the WhatsApp link. |

## Notes

- **Models.** Google is retiring `gemini-2.5-flash` on 1 December 2026 (requests get rerouted to another model), so this Worker defaults to `gemini-3.5-flash-lite` and falls back to `gemini-2.5-flash-lite`. If Google changes names again, only `GEMINI_MODELS` needs editing.
- **Rate limiting.** The built-in limiter (8 requests a minute and 40 an hour per IP) lives in each Worker instance's memory, so it is best-effort. For a stronger limit, enable the optional `[[ratelimits]]` block in `wrangler.toml` and redeploy.
- **Old Firebase Function.** The `functions/` folder is no longer used or referenced by `firebase.json`, so you can delete it. Without it, `firebase deploy` no longer asks for the Blaze plan.
