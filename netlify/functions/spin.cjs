// Tire un lot pour le joueur, avec anti-fraude et règle des 3 lots physiques.
// Le résultat est calculé ICI, côté serveur, avant tout affichage.
const { getStore } = require("@netlify/blobs");
const {
  PRIZES,
  isOpen,
  nowParis,
  sessionKey,
  normalizePseudo,
  validatePseudo,
  pickPrize,
} = require("../lib/shared.cjs");

// Certains environnements Netlify n'injectent pas le contexte Blobs
// automatiquement : on fournit alors siteID + token en secours.
function getParticipationsStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "participations", siteID, token });
  }
  return getStore("participations");
}

exports.handler = async (event) => {
  try {
    return await handleSpin(event);
  } catch (err) {
    console.error("Erreur dans spin:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail: "Erreur serveur : " + (err && err.message ? err.message : String(err)) }),
    };
  }
};

async function handleSpin(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const dt = nowParis();

  if (!isOpen(dt)) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail: "Roue fermée, reviens dimanche 18h-19h" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ detail: "Requête invalide." }) };
  }

  let cleaned;
  try {
    cleaned = validatePseudo(body.pseudo);
  } catch (e) {
    return { statusCode: 422, body: JSON.stringify({ detail: e.message }) };
  }
  const pseudo = normalizePseudo(cleaned);

  const session = sessionKey(dt);
  const store = getParticipationsStore();
  const playerKey = `${session}:${pseudo}`;

  // Anti-fraude : un pseudo ne peut jouer qu'une fois par session dominicale.
  const already = await store.get(playerKey);
  if (already) {
    return {
      statusCode: 409,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail: "Tu as déjà tenté ta chance ce dimanche !" }),
    };
  }

  // Compteur de lots physiques déjà distribués cette session.
  const counterKey = `${session}:physical-count`;
  const currentCountRaw = await store.get(counterKey);
  const currentCount = currentCountRaw ? parseInt(currentCountRaw, 10) : 0;

  const index = pickPrize(currentCount);
  const prize = PRIZES[index];

  // Enregistre la participation (bloque les futures tentatives de ce pseudo).
  await store.set(
    playerKey,
    JSON.stringify({
      pseudo,
      prizeIndex: index,
      prizeLabel: prize.label,
      isPhysical: prize.isPhysical,
      time: dt.toISO(),
    })
  );

  // Met à jour le compteur de lots physiques si besoin.
  if (prize.isPhysical) {
    await store.set(counterKey, String(currentCount + 1));
    // Notification (visible dans les logs Netlify > Functions > spin).
    console.log(`🎉 Gagnant validé : ${pseudo} a gagné ${prize.label}`);
  }

  // Ajoute le pseudo à l'index des participants de la session (pour l'admin).
  const indexKey = `${session}:index`;
  const indexRaw = await store.get(indexKey);
  const list = indexRaw ? JSON.parse(indexRaw) : [];
  list.push(playerKey);
  await store.set(indexKey, JSON.stringify(list));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prize_index: index,
      prize_label: prize.label,
      is_physical: prize.isPhysical,
      image_slug: prize.imageSlug,
    }),
  };
}
