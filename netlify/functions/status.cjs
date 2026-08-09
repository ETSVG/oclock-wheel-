// Vérifie si la roue est ouverte (dimanche 18h-19h, Europe/Paris).
const { isOpen, nowParis, sessionKey } = require("../lib/shared.cjs");

exports.handler = async () => {
  const dt = nowParis();
  const open = isOpen(dt);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      open,
      session_date: sessionKey(dt),
      server_time: dt.toISO(),
      message: open ? "Roue ouverte !" : "Roue fermée, reviens dimanche 18h-19h",
    }),
  };
};
