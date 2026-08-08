// Utilitaires partagés par toutes les fonctions O'Clock.
const { DateTime } = require("luxon");

const MAX_PHYSICAL_PRIZES = 3;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456789";

// index -> { label, isPhysical, imageSlug }
const PRIZES = [
  { label: "4 mini burgers", isPhysical: true, imageSlug: "mini-burgers" },
  { label: "Burger fondu", isPhysical: true, imageSlug: "burger-fondu" },
  { label: "Tacos fondu", isPhysical: true, imageSlug: "tacos-fondu" },
  { label: "Chicken fries", isPhysical: true, imageSlug: "chicken-fries" },
  { label: "Big chicken burger", isPhysical: true, imageSlug: "big-chicken-burger" },
  { label: "10 % sur votre commande", isPhysical: false, imageSlug: null },
  { label: "5 % sur votre commande", isPhysical: false, imageSlug: null },
  { label: "Essaie le prochain dimanche", isPhysical: false, imageSlug: null },
];

const PHYSICAL_INDICES = PRIZES.map((p, i) => (p.isPhysical ? i : null)).filter((i) => i !== null);
const NON_PHYSICAL_INDICES = PRIZES.map((p, i) => (!p.isPhysical ? i : null)).filter((i) => i !== null);

function nowParis() {
  return DateTime.now().setZone("Europe/Paris");
}

// Dimanche 18h00 à 19h00 (borne haute exclue), heure de Paris.
// FORCE_OPEN=true permet de tester la roue en dehors du créneau (à retirer
// avant le vrai lancement).
function isOpen(dt) {
  if (process.env.FORCE_OPEN === "true") return true;
  if (dt.weekday !== 7) return false; // Luxon: 1=lundi ... 7=dimanche
  const minutes = dt.hour * 60 + dt.minute;
  return minutes >= 18 * 60 && minutes < 19 * 60;
}

// Identifie la session dominicale par sa date (YYYY-MM-DD).
function sessionKey(dt) {
  return dt.toISODate();
}

function normalizePseudo(raw) {
  const cleaned = String(raw || "").trim().replace(/^@+/, "").toLowerCase();
  return "@" + cleaned;
}

function validatePseudo(raw) {
  const cleaned = String(raw || "").trim().replace(/^@+/, "");
  if (!cleaned) throw new Error("Le pseudo Instagram est obligatoire.");
  if (cleaned.length > 30 || !/^[a-zA-Z0-9._]+$/.test(cleaned)) {
    throw new Error("Pseudo Instagram invalide.");
  }
  return cleaned;
}

// Tire un index gagnant selon les règles (poids égaux, puis coupe à 3 lots).
function pickPrize(physicalCountSoFar) {
  if (physicalCountSoFar >= MAX_PHYSICAL_PRIZES) {
    return NON_PHYSICAL_INDICES[Math.floor(Math.random() * NON_PHYSICAL_INDICES.length)];
  }
  return Math.floor(Math.random() * PRIZES.length);
}

module.exports = {
  MAX_PHYSICAL_PRIZES,
  ADMIN_PASSWORD,
  PRIZES,
  PHYSICAL_INDICES,
  NON_PHYSICAL_INDICES,
  nowParis,
  isOpen,
  sessionKey,
  normalizePseudo,
  validatePseudo,
  pickPrize,
};
