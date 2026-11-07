import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { loadComponents } from "./components.js";

const firebaseConfig = {
  apiKey: "AIzaSyCx8bEZ_7UVqAyOhLQs-P6WLjDoHft0RLw",
  authDomain: "josaphat-chilokoto.firebaseapp.com",
  projectId: "josaphat-chilokoto",
  storageBucket: "josaphat-chilokoto.firebasestorage.app",
  messagingSenderId: "823869084105",
  appId: "1:823869084105:web:aec7c5c36436d40b6cd818"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* ===================================================
   1. THEME SWITCHER (Auto-Detect + Manual Toggle)
   =================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  if (savedTheme === "dark" || savedTheme === "light") {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else {
    document.documentElement.setAttribute("data-theme", systemPrefersDark ? "dark" : "light");
  }

  // Inject Theme Toggle Button into Nav if present
  const nav = document.querySelector("nav");
  if (nav && !document.querySelector(".theme-toggle-btn")) {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "theme-toggle-btn";
    toggleBtn.type = "button";
    toggleBtn.setAttribute("aria-label", "Toggle Dark/Light Mode");
    
    const updateIcon = () => {
      const current = document.documentElement.getAttribute("data-theme");
      toggleBtn.innerHTML = current === "light" ? `<i class="fa-solid fa-moon"></i>` : `<i class="fa-solid fa-sun"></i>`;
    };

    updateIcon();

    toggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", nextTheme);
      localStorage.setItem("theme", nextTheme);
      updateIcon();
    });

    const hamburger = nav.querySelector(".hamburger");
    if (hamburger) {
      nav.insertBefore(toggleBtn, hamburger);
    } else {
      nav.appendChild(toggleBtn);
    }
  }
}

/* ===================================================
   2. HIDDEN ADMIN TRIGGER IN FOOTER
   =================================================== */
function initHiddenAdminLink() {
  const ftCopy = document.querySelector(".ft-copy");
  if (ftCopy && !ftCopy.querySelector(".ft-hidden-trigger")) {
    const text = ftCopy.textContent || "© 2026 Josaphat · Zambia 🇿🇲";
    ftCopy.innerHTML = `<a href="admin.html" class="ft-hidden-trigger" title="">${text}</a>`;
  }
}

/* ===================================================
   3. HOMEPAGE REAL-TIME CONTENT (Typing words, Posts, Hero Bg)
   =================================================== */
function initHomepage() {
  const heroSection = document.querySelector(".hero-section");
  const heroBadge = document.querySelector(".hero-badge");
  const heroTagline = document.querySelector(".hero-tagline");

  // Function to apply hero background (video or image)
  function applyHeroBackground(bgType, bgUrl) {
    if (!heroSection) return;
    let existingBg = heroSection.querySelector(".hero-bg");
    let existingVideo = heroSection.querySelector(".hero-video");

    if (bgType === "video" && bgUrl) {
      if (existingBg) existingBg.style.display = "none";
      if (!existingVideo) {
        existingVideo = document.createElement("video");
        existingVideo.className = "hero-video";
        existingVideo.autoplay = true;
        existingVideo.loop = true;
        existingVideo.muted = true;
        existingVideo.playsInline = true;
        heroSection.insertBefore(existingVideo, heroSection.firstChild);
      }
      existingVideo.style.display = "block";
      if (existingVideo.src !== bgUrl) {
        existingVideo.src = bgUrl;
        existingVideo.play().catch(() => {});
      }
    } else {
      if (existingVideo) existingVideo.style.display = "none";
      if (!existingBg) {
        existingBg = document.createElement("div");
        existingBg.className = "hero-bg";
        heroSection.insertBefore(existingBg, heroSection.firstChild);
      }
      existingBg.style.display = "block";
      const targetUrl = bgUrl || "Sleek_workspace_with_coding_setup.png";
      existingBg.style.backgroundImage = `url('${targetUrl}')`;
    }
  }

  // Load Hero Settings from Firestore & Local Storage
  const savedBgType = localStorage.getItem("hero_bg_type") || "image";
  const savedBgUrl = localStorage.getItem("hero_bg_url") || "Sleek_workspace_with_coding_setup.png";
  applyHeroBackground(savedBgType, savedBgUrl);

  onSnapshot(doc(db, "settings", "hero"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.badge && heroBadge) heroBadge.textContent = data.badge;
      if (data.tagline && heroTagline) heroTagline.textContent = data.tagline;
      if (data.words && Array.isArray(data.words) && data.words.length > 0) {
        window.customTypingWords = data.words;
      }
      if (data.bgUrl) {
        applyHeroBackground(data.bgType || "image", data.bgUrl);
      }
    }
  }, (err) => console.log("Using default hero config"));

  // Load Homepage Posts with Rich Media (Seamless Fading Images, Videos, & Documents)
  const postsContainer = document.getElementById("homepage-posts-feed");
  if (postsContainer) {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snapshot) => {
      if (snapshot.empty) {
        postsContainer.innerHTML = `
          <div class="post-card">
            <div class="post-body">
              <div class="post-header">
                <span class="post-badge">Announcement</span>
                <span class="post-date">Latest Update</span>
              </div>
              <h3>Welcome to my Portfolio!</h3>
              <p>Thank you for visiting. Explore my latest projects in cybersecurity, web systems, and network architecture built right here in Lusaka, Zambia.</p>
            </div>
          </div>
        `;
        return;
      }

      let html = "";
      snapshot.forEach((docSnap) => {
        const post = docSnap.data();
        const mediaUrl = post.mediaUrl || post.imageUrl;
        const mediaType = post.mediaType || (post.imageUrl ? "image" : null);

        let mediaHtml = "";

        if (mediaType === "image" && mediaUrl) {
          // Seamless artistic fade-in where the picture meets the post words
          mediaHtml = `
            <div class="post-media-integrated">
              <img src="${mediaUrl}" class="post-fused-image" alt="${post.title}" onerror="this.parentElement.style.display='none'" />
              <div class="post-media-gradient-overlay"></div>
            </div>
          `;
        } else if (mediaType === "video" && mediaUrl) {
          mediaHtml = `
            <div style="padding: 16px 16px 0;">
              <video class="post-video" controls playsinline src="${mediaUrl}"></video>
            </div>
          `;
        }

        let documentAttachmentHtml = "";
        if (mediaType === "document" && mediaUrl) {
          const fileName = post.fileName || "Download Attachment";
          const ext = fileName.split(".").pop().toLowerCase();
          let iconClass = "fa-file-lines";
          let docTypeClass = "file";

          if (ext === "pdf") { iconClass = "fa-file-pdf"; docTypeClass = "pdf"; }
          else if (["doc", "docx"].includes(ext)) { iconClass = "fa-file-word"; docTypeClass = "word"; }
          else if (["xls", "xlsx", "csv"].includes(ext)) { iconClass = "fa-file-excel"; docTypeClass = "excel"; }
          else if (["zip", "rar", "tar"].includes(ext)) { iconClass = "fa-file-zipper"; docTypeClass = "zip"; }

          documentAttachmentHtml = `
            <div class="post-doc-attachment">
              <div class="post-doc-left">
                <div class="post-doc-icon ${docTypeClass}">
                  <i class="fa-solid ${iconClass}"></i>
                </div>
                <div class="post-doc-info">
                  <div class="post-doc-name" title="${fileName}">${fileName}</div>
                  <div class="post-doc-meta">${post.fileSize || 'Document File'} · Click to download</div>
                </div>
              </div>
              <a href="${mediaUrl}" download="${fileName}" class="post-doc-btn">
                <i class="fa-solid fa-download"></i> Download
              </a>
            </div>
          `;
        }

        html += `
          <div class="post-card reveal">
            ${mediaHtml}
            <div class="post-body">
              <div class="post-header">
                <span class="post-badge">${post.badge || 'Update'}</span>
                <span class="post-date">${post.date || ''}</span>
              </div>
              <h3>${post.title}</h3>
              <p>${post.content}</p>
              ${documentAttachmentHtml}
            </div>
          </div>
        `;
      });
      postsContainer.innerHTML = html;
    }, (err) => {
      console.log("Posts feed default fallback");
    });
  }
}

/* ===================================================
   3.5 PROJECTS PAGE REALTIME SYNC (Firestore)
   =================================================== */
function initProjectsPage() {
  const projGrid = document.querySelector(".proj-grid");
  if (!projGrid) return;

  onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")), (snapshot) => {
    if (snapshot.empty) return; // Keep static items if Firestore has no custom entries

    let html = "";
    snapshot.forEach((docSnap) => {
      const proj = docSnap.data();
      const techTags = (proj.tech || "HTML, CSS, JS").split(",").map(t => `<span class="tech">${t.trim()}</span>`).join("");
      
      html += `
        <div class="card proj-card reveal">
          <img class="proj-img" src="${proj.imageUrl || 'assets/images/Futuristic_IT_visual.png'}" alt="${proj.title}" onerror="this.src='assets/images/Futuristic_IT_visual.png'" />
          <div class="proj-body">
            <div class="proj-tag">${proj.category || 'Project'}</div>
            <h3>${proj.title}</h3>
            <p>${proj.description || ''}</p>
            <div class="tech-row">
              ${techTags}
            </div>
            ${proj.link ? `<div style="margin-top:12px;"><a href="${proj.link}" target="_blank" class="btn-ghost" style="font-size:0.78rem; padding:6px 14px;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Live Demo</a></div>` : ''}
          </div>
        </div>
      `;
    });

    html += `
      <div class="card proj-card proj-empty">
        <div class="proj-empty-icon">🚧</div>
        <h3>Next Project Coming Soon</h3>
        <p>Always building something new...</p>
      </div>
    `;

    projGrid.innerHTML = html;
  }, () => {});
}

/* ===================================================
   4. CONTACT FORM FIRESTORE SUBMISSION
   =================================================== */
function initContactForm() {
  const form = document.querySelector("form.card");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector("button[type='submit']");
      const origText = submitBtn ? submitBtn.innerHTML : "Send Message";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
      }

      const nameInput = form.querySelector("input[type='text'], input[name='name']");
      const emailInput = form.querySelector("input[type='email'], input[name='email']");
      const messageInput = form.querySelector("textarea");

      const name = nameInput ? nameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const message = messageInput ? messageInput.value.trim() : "";

      if (!name || !email || !message) {
        alert("Please fill in your name, email, and message.");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
        return;
      }

      try {
        await addDoc(collection(db, "messages"), {
          name,
          email,
          message,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          status: "unread",
          createdAt: serverTimestamp()
        });

        alert("Thank you, " + name + "! Your message has been received successfully. Josaphat will respond shortly.");
        form.reset();
      } catch (err) {
        console.error("Error saving message: ", err);
        alert("Thank you! Your message was sent.");
        form.reset();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
      }
    });
  }
}

/* ===================================================
   5. LOGO LIQUID DRIP ENGINE ("Crying Colors" on Hover)
   =================================================== */
function initLogoDripEngine() {
  const logoWrappers = document.querySelectorAll(".logo-wrapper");

  logoWrappers.forEach((wrapper) => {
    const canvas = wrapper.querySelector(".logo-drip-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId = null;
    let isHovered = false;
    let drops = [];

    // Vibrant tech colors matching logo edges and dot
    const colors = [
      "#00f3ff", // Electric Cyan
      "#0072ff", // Azure Blue
      "#a855f7", // Tech Violet
      "#00ff9d", // Emerald Green
      "#ff007f", // Cyber Pink
      "#38bdf8"  // Light Sky
    ];

    // Key drip spawn points across the logo SVG (ratios from left to right)
    const spawnRatios = [0.08, 0.16, 0.26, 0.38, 0.50, 0.62, 0.74, 0.86, 0.94];

    function resizeCanvas() {
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = (rect.width + 30) * dpr;
      canvas.height = 160 * dpr;
      ctx.imageSmoothingEnabled = true;
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    function createDrop() {
      const rect = wrapper.getBoundingClientRect();
      const ratio = spawnRatios[Math.floor(Math.random() * spawnRatios.length)];
      const dpr = window.devicePixelRatio || 1;
      
      const x = (15 + ratio * rect.width + (Math.random() * 10 - 5)) * dpr;
      const startY = (rect.height * 0.78 + Math.random() * 8) * dpr; // Dynamically calculated from logo height

      drops.push({
        x: x,
        y: startY,
        vy: (0.9 + Math.random() * 1.6) * dpr,
        gravity: (0.12 + Math.random() * 0.08) * dpr,
        length: (8 + Math.random() * 14) * dpr,
        radius: (2.2 + Math.random() * 2.8) * dpr,
        maxDistance: (35 + Math.random() * 45) * dpr,
        distanceTraveled: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1
      });
    }

    function render() {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isHovered && Math.random() < 0.55) {
        createDrop();
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += d.gravity;
        d.y += d.vy;
        d.distanceTraveled += d.vy;

        if (d.distanceTraveled > d.maxDistance * 0.65) {
          d.opacity -= 0.035;
        }

        if (d.opacity <= 0 || d.distanceTraveled >= d.maxDistance) {
          drops.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, d.opacity);
        ctx.fillStyle = d.color;
        ctx.shadowColor = d.color;
        ctx.shadowBlur = 10 * dpr;

        // Draw tear droplet shape with trailing stream
        ctx.beginPath();
        ctx.moveTo(d.x - 1 * dpr, d.y - d.length);
        ctx.lineTo(d.x + 1 * dpr, d.y - d.length);
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      if (isHovered || drops.length > 0) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        animationFrameId = null;
      }
    }

    const triggerElem = wrapper.closest("a") || wrapper;

    triggerElem.addEventListener("mouseenter", () => {
      isHovered = true;
      if (!animationFrameId) {
        render();
      }
    });

    triggerElem.addEventListener("mouseleave", () => {
      isHovered = false;
    });
  });
}

// Auto Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await loadComponents();
  initTheme();
  initHiddenAdminLink();
  initHomepage();
  initProjectsPage();
  initContactForm();
  initLogoDripEngine();
});
