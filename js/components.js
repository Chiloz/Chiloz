/**
 * Reusable Component Sync Engine
 * Loads and synchronizes Header and Footer across all portfolio pages.
 */

const fallbackHeader = `<a class="nav-logo" href="index.html" aria-label="Josaphat Home">
  <div class="logo-wrapper">
    <img class="josaphat-brand-logo" src="assets/images/Josaphat_Logo.png" alt="Josaphat Logo" />
    <canvas class="logo-drip-canvas"></canvas>
  </div>
</a>
<div class="nav-links">
  <a href="index.html" data-page="index.html">Home</a>
  <a href="about.html" data-page="about.html">About</a>
  <a href="resume.html" data-page="resume.html">Resume</a>
  <a href="projects.html" data-page="projects.html">Projects</a>
  <a href="contact.html" data-page="contact.html">Contact</a>
</div>
<button class="hamburger" aria-label="Toggle Navigation">
  <i class="fa-solid fa-bars"></i>
</button>`;

const fallbackFooter = `<div class="footer-inner">
  <div class="ft-left">
    <div class="ft-name">Josaphat Chilokoto</div>
    <div class="ft-sub">IT Student · Lusaka, Zambia</div>
  </div>
  <div class="ft-links">
    <a href="mailto:josaphatkychiloz@gmail.com" title="Email"><i class="fa-solid fa-envelope"></i></a>
    <a href="https://wa.me/260954030644" target="_blank" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
    <a href="https://github.com/Chiloz" target="_blank" title="GitHub"><i class="fa-brands fa-github"></i></a>
    <a href="https://www.linkedin.com/in/josaphat-chilokoto-009499377/" target="_blank" title="LinkedIn"><i class="fa-brands fa-linkedin"></i></a>
  </div>
  <div class="ft-copy"><a href="admin.html" class="ft-hidden-trigger">© 2026 Josaphat · Zambia 🇿🇲</a></div>
</div>`;

export async function loadComponents() {
  const nav = document.querySelector("nav");
  const footer = document.querySelector("footer");

  // Load Header Component
  if (nav) {
    try {
      const res = await fetch("components/header.html");
      if (res.ok) {
        nav.innerHTML = await res.text();
      } else {
        nav.innerHTML = fallbackHeader;
      }
    } catch (e) {
      nav.innerHTML = fallbackHeader;
    }

    // Highlight Current Page Link
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const navLinks = nav.querySelectorAll(".nav-links a");
    navLinks.forEach((a) => {
      const href = a.getAttribute("href");
      if (href === currentPath || (currentPath === "" && href === "index.html")) {
        a.classList.add("active");
      } else {
        a.classList.remove("active");
      }
    });

    // Handle Hamburger Toggle
    const hamburger = nav.querySelector(".hamburger");
    const linksDiv = nav.querySelector(".nav-links");
    if (hamburger && linksDiv) {
      hamburger.addEventListener("click", () => {
        linksDiv.classList.toggle("open");
      });
    }
  }

  // Load Footer Component
  if (footer) {
    try {
      const res = await fetch("components/footer.html");
      if (res.ok) {
        footer.innerHTML = await res.text();
      } else {
        footer.innerHTML = fallbackFooter;
      }
    } catch (e) {
      footer.innerHTML = fallbackFooter;
    }
  }
}
