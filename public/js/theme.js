/* Runs synchronously in <head> so the right theme paints on the first frame (no flash). */
(function () {
  var d = document.documentElement, t = null;
  try { t = localStorage.getItem("theme"); } catch (e) {}
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  d.setAttribute("data-theme", t);
  d.classList.add("js");
})();
