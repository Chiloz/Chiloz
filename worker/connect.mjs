#!/usr/bin/env node
/* Points the site's chat widget at your deployed Worker.
   Usage (from the worker/ folder):  npm run connect -- https://chiloz-chat.<your-subdomain>.workers.dev */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WIDGET = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "js", "chatbot.js");
const API_LINE = /^const API = ".*";.*$/m;

export function normalizeUrl(input) {
  let u;
  try {
    u = new URL(String(input || "").trim());
  } catch (e) {
    throw new Error("That is not a valid URL. Expected something like https://chiloz-chat.your-name.workers.dev");
  }
  if (u.protocol !== "https:" || !u.hostname.endsWith(".workers.dev")) {
    throw new Error("The URL must be an https://….workers.dev address (the one `npm run deploy` printed).");
  }
  return u.origin;
}

export function patchWidget(source, url) {
  if (!API_LINE.test(source)) throw new Error('Could not find the `const API = "...";` line in public/js/chatbot.js');
  return source.replace(API_LINE, () => `const API = "${url}"; // set by worker/connect.mjs`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const url = normalizeUrl(process.argv[2]);
    writeFileSync(WIDGET, patchWidget(readFileSync(WIDGET, "utf8"), url));
    console.log(`Widget now talks to ${url}\nNext: from the site root run  firebase deploy --only hosting`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
