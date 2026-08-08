// Renvoie la liste des gagnants (physiques + réductions) et le total de
// participants pour la session dominicale en cours, protégé par mot de passe.
const { getStore } = require("@netlify/blobs");
const { ADMIN_PASSWORD, MAX_PHYSICAL_PRIZES, nowParis, sessionKey } = require("../lib/shared.cjs");

exports.handler = async (event) => {
  try {
    return await handleAdmin(event);
  } catch (err) {
    console.error("Erreur dans admin-winners:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail: "Erreur serveur : " + (err && err.message ? err.message : String(err)) }),
    };
  }
};

async function handleAdmin(event) {
  const password = (event.queryStringParameters || {}).password || "";
  if (password !== ADMIN_PASSWORD) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail: "Mot de passe incorrect." }),
    };
  }

  const dt = nowParis();
  const session = sessionKey(dt);
  const store = getStore("participations");

  const indexRaw = await store.get(`${session}:index`);
  const keys = indexRaw ? JSON.parse(indexRaw) : [];

  const entries = await Promise.all(
    keys.map(async (k) => {
      const raw = await store.get(k);
      return raw ? JSON.parse(raw) : null;
    })
  );
  const valid = entries.filter(Boolean);

  const counterRaw = await store.get(`${session}:physical-count`);
  const physicalGiven = counterRaw ? parseInt(counterRaw, 10) : 0;

  const winners = valid
    .filter((e) => e.prizeIndex !== 7) // exclut la case perdante
    .sort((a, b) => (a.time < b.time ? 1 : -1))
    .map((e) => ({
      pseudo: e.pseudo,
      prize_label: e.prizeLabel,
      is_physical: e.isPhysical,
      time: e.time,
    }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_date: session,
      total_participants: valid.length,
      physical_prizes_given: physicalGiven,
      physical_prizes_left: Math.max(0, MAX_PHYSICAL_PRIZES - physicalGiven),
      winners,
    }),
  };
}
