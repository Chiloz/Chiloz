// Regenerates the no-JavaScript / pre-load fallback cards in projects.html and index.html from js/projects-data.js.
// Run:  node tools/build-static.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_PROJECTS } from "../public/js/projects-data.js";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LABEL = { live: "Online", delivered: "Delivered", building: "In progress" };
const ic = (n) => `<svg class="icon" aria-hidden="true"><use href="assets/icons/sprite.svg#i-${n}"/></svg>`;
const card = (p) => `<article class="card card-hover proj reveal${p.status === "building" ? " unfinished" : ""}" data-status="${p.status}">
  <div class="cover tone-slate"><img class="cover-img" src="${esc(p.imageUrl)}" alt="${esc(p.title)} preview" width="800" height="450" loading="lazy"><span class="status ${p.status}">${LABEL[p.status]}</span></div>
  <div class="proj-body"><div class="proj-kind">${esc(p.category)}</div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>
  <div class="tags">${p.tech.split(",").map((t) => `<span class="tag">${esc(t.trim())}</span>`).join("")}</div>
  <div class="proj-foot">${p.link ? `<a class="btn btn-primary btn-sm" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">Visit site ${ic("arrow-up-right-from-square")}</a>` : p.status === "building" ? `<span class="note">${ic("hammer")}Unfinished: still being built</span>` : `<span class="note">${ic("lock")}Private work · no public link</span>`}</div></div>
</article>`;
const sorted = [...DEFAULT_PROJECTS].sort((a, b) => a.order - b.order);
const swap = (file, marker, html) => {
  const s = readFileSync(file, "utf8"), re = new RegExp(`(<!--${marker}-->)[\\s\\S]*?(<!--/${marker}-->)`);
  if (!re.test(s)) throw new Error(`marker ${marker} missing in ${file}`);
  writeFileSync(file, s.replace(re, `$1${html.replaceAll("$", "$$$$")}$2`));
};
swap("public/projects.html", "grid", sorted.map(card).join(""));
swap("public/index.html", "featured", sorted.slice(0, 3).map(card).join(""));
const count = (st) => sorted.filter((p) => p.status === st).length;
let s = readFileSync("public/projects.html", "utf8");
s = s.replace(/(data-filter="all"[^>]*>All <small>)\d+/, `$1${sorted.length}`).replace(/(data-filter="live"[^>]*>Online <small>)\d+/, `$1${count("live")}`)
  .replace(/(data-filter="delivered"[^>]*>Delivered <small>)\d+/, `$1${count("delivered")}`).replace(/(data-filter="building"[^>]*>In progress <small>)\d+/, `$1${count("building")}`);
writeFileSync("public/projects.html", s);
console.log("static cards rebuilt:", sorted.length);
