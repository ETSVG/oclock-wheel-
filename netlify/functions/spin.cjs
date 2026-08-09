// Tire un lot pour le joueur, avec anti-fraude et gains déclenchés par
// horaires (checkpoints). Le résultat est calculé ICI, côté serveur.
const { getStore } = require("@netlify/blobs");
const {
  PRIZES,
  isOpen,
  nowParis,
  sessionKey,
  normalizePseudo,
  validatePseudo,
  pickPrize,
  notifyWinner,
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
      body: JSON.stringify({ detail: "Roue fermée, reviens dimanche !" }),
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

  // Nombre de checkpoints (12h/16h/21h) déjà consommés cette session.
  const checkpointsKey = `${session}:checkpoints-consumed`;
  const checkpointsRaw = await store.get(checkpointsKey);
  const checkpointsConsumed = checkpointsRaw ? parseInt(checkpointsRaw, 10) : 0;

  const { index, isCheckpointWin } = pickPrize(dt, checkpointsConsumed);
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

  if (isCheckpointWin) {
    await store.set(checkpointsKey, String(checkpointsConsumed + 1));
    console.log(`🎉 Gagnant validé : ${pseudo} a gagné ${prize.label}`);
    // Notification email au restaurant (Web3Forms) — asynchrone, ne bloque
    // pas la réponse au joueur.
    notifyWinner({
      pseudo,
      prizeLabel: prize.label,
      isPhysical: prize.isPhysical,
      time: dt.toISO(),
    });
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
