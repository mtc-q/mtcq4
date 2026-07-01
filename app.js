// ============================================================
// mtcq — shared Firebase module (loaded by every page)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  collection, query, where, runTransaction, increment, serverTimestamp,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- your Firebase project ----
const firebaseConfig = {
  apiKey: "AIzaSyBiOf_fpdJsrY6IDUEClGmhAWkjcbt9Xdo",
  authDomain: "mtcq-v4.firebaseapp.com",
  projectId: "mtcq-v4",
  storageBucket: "mtcq-v4.firebasestorage.app",
  messagingSenderId: "369741427936",
  appId: "1:369741427936:web:1dfb1e9871185d89a7cc85",
  measurementId: "G-SVQ1N8KRGX"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ---- platform constants ----
export const ADMIN_EMAIL = "r45t6er7@gmail.com";
export const SITE_HOST   = "mtcq.org"; // used for display + QR codes

export const DEFAULT_CONFIG = {
  maintenanceMode: false,
  maxTreesPerUser: 1,
  maxLinksPerTree: 20
};

// Wallpaper presets available to every tree
export const WALLPAPERS = {
  ink:      { label: "Ink",      css: "#0a0a0a",                                              text: "#ffffff" },
  paper:    { label: "Paper",    css: "#f5f5f2",                                              text: "#0a0a0a" },
  carbon:   { label: "Carbon",   css: "linear-gradient(180deg,#0a0a0a 0%,#232323 100%)",      text: "#ffffff" },
  slate:    { label: "Slate",    css: "linear-gradient(160deg,#0f172a 0%,#1e293b 100%)",      text: "#f1f5f9" },
  forest:   { label: "Forest",   css: "linear-gradient(160deg,#08130c 0%,#14361f 100%)",      text: "#eafbef" },
  midnight: { label: "Midnight", css: "linear-gradient(160deg,#0b1026 0%,#26356b 100%)",      text: "#eef1ff" },
  ember:    { label: "Ember",    css: "linear-gradient(160deg,#1a0705 0%,#5c1a0e 100%)",      text: "#ffece6" },
  custom:   { label: "Custom color", css: null, text: null }
};

// ---- re-export the Firestore verbs pages need ----
export {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  runTransaction, increment, serverTimestamp, arrayUnion, arrayRemove
};

// ---- helpers ----

/** Fetch config/platform, falling back to defaults if it doesn't exist yet. */
export async function getPlatformConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "platform"));
    return snap.exists() ? { ...DEFAULT_CONFIG, ...snap.data() } : { ...DEFAULT_CONFIG };
  } catch (e) {
    console.warn("config read failed, using defaults", e);
    return { ...DEFAULT_CONFIG };
  }
}

export function isAdmin(user) {
  return !!user && (user.email || "").toLowerCase() === ADMIN_EMAIL;
}

/**
 * Maintenance kill-switch. If enabled and the viewer isn't the admin,
 * show the full-screen shutdown overlay (element with id="maintenance-overlay").
 * Returns true when the page should stop rendering.
 */
export function enforceMaintenance(config, user) {
  if (config.maintenanceMode && !isAdmin(user)) {
    const ov = document.getElementById("maintenance-overlay");
    if (ov) ov.classList.add("show");
    return true;
  }
  return false;
}

/** Usernames: 3–20 chars, a–z 0–9 and dashes, can't collide with app pages. */
const RESERVED = new Set(["admin", "dashboard", "index", "login", "signup", "tree", "api",
  "www", "mtcq", "assets", "js", "css", "u", "config", "users", "stats", "trees"]);

export function validUsername(name) {
  const n = (name || "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9]$/.test(n)) return null;
  if (RESERVED.has(n)) return null;
  return n;
}

/** Public URL for a tree — path-style on real hosting, query-style elsewhere. */
export function treeUrl(username) {
  const { origin, protocol, hostname } = window.location;
  const pretty = hostname === SITE_HOST || hostname.endsWith(".web.app")
    || hostname.endsWith(".firebaseapp.com") || hostname.endsWith(".github.io");
  if (protocol === "https:" && pretty) {
    // works on GitHub Pages too — 404.html redirects /name to the tree page
    return `${origin}${window.location.pathname.replace(/[^/]*$/, "")}${username}`;
  }
  return `${origin}${window.location.pathname.replace(/[^/]*$/, "")}tree.html?u=${username}`;
}

/** The pretty link shown to users regardless of where the app is hosted. */
export function displayUrl(username) {
  return `${SITE_HOST}/${username}`;
}

/** Resize an uploaded PNG to a small square thumbnail data-URL (keeps Firestore docs tiny). */
export function pngToThumb(file, size = 128) {
  return new Promise((resolve, reject) => {
    if (!file.type.includes("png")) return reject(new Error("Only .png images are allowed."));
    if (file.size > 2 * 1024 * 1024) return reject(new Error("PNG must be under 2 MB."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d");
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that PNG.")); };
    img.src = url;
  });
}

export function qrCodeUrl(data, px = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&bgcolor=0a0a0a&color=ffffff&data=${encodeURIComponent(data)}`;
}

/** Tiny toast/inline message helper. */
export function say(el, text, ok = true) {
  el.textContent = text;
  el.style.borderLeftColor = ok ? "#ffffff" : "#8a8a8a";
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 6000);
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Friendly auth error messages. */
export function authError(e) {
  const map = {
    "auth/email-already-in-use": "That email already has an account. Log in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password needs at least 6 characters.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/user-not-found": "No account with that email.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again."
  };
  return map[e.code] || e.message || "Something went wrong.";
}
