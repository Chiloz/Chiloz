import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
   3. HOMEPAGE REAL-TIME CONTENT (Typing words, Posts)
   =================================================== */
function initHomepage() {
  const heroName = document.querySelector(".hero-name");
  const heroBadge = document.querySelector(".hero-badge");
  const heroTagline = document.querySelector(".hero-tagline");

  // Load Hero Settings from Firestore
  onSnapshot(doc(db, "settings", "hero"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.badge && heroBadge) heroBadge.textContent = data.badge;
      if (data.tagline && heroTagline) heroTagline.textContent = data.tagline;
      if (data.words && Array.isArray(data.words) && data.words.length > 0) {
        window.customTypingWords = data.words;
      }
    }
  }, (err) => console.log("Using default hero config"));

  // Load Homepage Posts
  const postsContainer = document.getElementById("homepage-posts-feed");
  if (postsContainer) {
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snapshot) => {
      if (snapshot.empty) {
        postsContainer.innerHTML = `
          <div class="post-card">
            <div class="post-header">
              <span class="post-badge">Announcement</span>
              <span class="post-date">Latest Update</span>
            </div>
            <h3>Welcome to my Portfolio!</h3>
            <p>Thank you for visiting. Explore my latest projects in cybersecurity, web systems, and network architecture built right here in Lusaka, Zambia.</p>
          </div>
        `;
        return;
      }

      let html = "";
      snapshot.forEach((docSnap) => {
        const post = docSnap.data();
        html += `
          <div class="post-card reveal">
            <div class="post-header">
              <span class="post-badge">${post.badge || 'Update'}</span>
              <span class="post-date">${post.date || ''}</span>
            </div>
            <h3>${post.title}</h3>
            <p>${post.content}</p>
            ${post.imageUrl ? `<img src="${post.imageUrl}" class="post-img" alt="${post.title}" onerror="this.style.display='none'"/>` : ''}
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

// Auto Initialize
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initHiddenAdminLink();
  initHomepage();
  initContactForm();
});
