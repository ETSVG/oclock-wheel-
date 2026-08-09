// Utilitaires partagés par toutes les fonctions O'Clock.
const { DateTime } = require("luxon");

const MAX_PHYSICAL_PRIZES = 3;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456789";
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY || "";
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "oclockcrispy@gmail.com";

// index -> { label, isPhysical, imageSlug }
const PRIZES = [
  { label: "4 mini burgers", isPhysical: true, imageSlug: "mini-burgers" },
  { label: "Burger fondu", isPhysical: true, imageSlug: "burger-fondu" },
  { label: "Salade O'Clock", isPhysical: true, imageSlug: "salade-oclock" },
  { label: "Big chicken burger", isPhysical: true, imageSlug: "big-chicken-burger" },
  { label: "Chicken fries", isPhysical: true, imageSlug: "chicken-fries" },
  { label: "Plat Strips", isPhysical: true, imageSlug: "plat-strips" },
  { label: "10 % sur votre commande", isPhysical: false, imageSlug: null },
  { label: "Rejoue la semaine prochaine", isPhysical: false, imageSlug: null },
];

const PHYSICAL_INDICES = PRIZES.map((p, i) => (p.isPhysical ? i : null)).filter((i) => i !== null);
// Toutes les issues "gagnantes" (lots physiques + réduction), hors case perdante.
const WINNING_INDICES = [0, 1, 2, 3, 4, 5, 6];
const LOSING_INDEX = 7;

// Horaires de déclenchement (heure de Paris) : le PREMIER spin après chaque
// horaire est un gagnant garanti (lot physique ou réduction, au hasard).
// Tous les autres spins de la journée tombent sur la case perdante.
const CHECKPOINTS = [
  { hour: 12, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 21, minute: 0 },
];

function nowParis() {
  return DateTime.now().setZone("Europe/Paris");
}

// Ouverte toute la journée du dimanche (Europe/Paris).
// FORCE_OPEN=true permet de tester en dehors du dimanche (à retirer avant
// le vrai lancement).
function isOpen(dt) {
  if (process.env.FORCE_OPEN === "true") return true;
  return dt.weekday === 7; // Luxon: 1=lundi ... 7=dimanche
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

// Nombre de checkpoints déjà "passés" (atteints) à l'instant dt.
function checkpointsPassedCount(dt) {
  const nowMinutes = dt.hour * 60 + dt.minute;
  return CHECKPOINTS.filter((c) => nowMinutes >= c.hour * 60 + c.minute).length;
}

// Détermine si CE spin doit être un gagnant garanti (premier spin après un
// checkpoint non encore consommé), et tire le prix en conséquence.
// checkpointsConsumed = nombre de checkpoints déjà utilisés cette session.
function pickPrize(dt, checkpointsConsumed) {
  const passed = checkpointsPassedCount(dt);
  const isCheckpointWin = checkpointsConsumed < passed && checkpointsConsumed < CHECKPOINTS.length;
  if (isCheckpointWin) {
    const idx = WINNING_INDICES[Math.floor(Math.random() * WINNING_INDICES.length)];
    return { index: idx, isCheckpointWin: true };
  }
  return { index: LOSING_INDEX, isCheckpointWin: false };
}

// Envoie une notification email au restaurant à chaque gain (checkpoint).
// Utilise Web3Forms (gratuit) ; si la clé n'est pas configurée, ne fait rien
// (le site continue de fonctionner normalement).
async function notifyWinner({ pseudo, prizeLabel, isPhysical, time }) {
  if (!WEB3FORMS_ACCESS_KEY) return;
  try {
    await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `🎉 O'Clock Wheel — Gagnant : ${prizeLabel}`,
        from_name: "O'Clock Wheel",
        email: NOTIFY_EMAIL,
        message:
          `Pseudo : ${pseudo}\n` +
          `Lot : ${prizeLabel}\n` +
          `Type : ${isPhysical ? "Lot physique" : "Réduction"}\n` +
          `Heure : ${time}`,
      }),
    });
  } catch (err) {
    console.error("Échec notification email:", err);
  }
}

module.exports = {
  MAX_PHYSICAL_PRIZES,
  ADMIN_PASSWORD,
  PRIZES,
  PHYSICAL_INDICES,
  WINNING_INDICES,
  LOSING_INDEX,
  CHECKPOINTS,
  nowParis,
  isOpen,
  sessionKey,
  normalizePseudo,
  validatePseudo,
  pickPrize,
  checkpointsPassedCount,
  notifyWinner,
};
