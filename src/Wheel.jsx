import { useState, useEffect, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";

const API = "/.netlify/functions";

// Ordre VISUEL des cases sur l'image fournie par le client (roue déjà
// dessinée), en partant du haut (sous la flèche) et en tournant dans le
// sens horaire : 8,1,2,3,4,5,6,7 -> mappés vers les index du backend.
// slotOrder[position visuelle] = index prix (backend)
const slotOrder = [0, 4, 3, 6, 1, 2, 7, 5];
// slot0 (haut)      = 8 "4 mini burgers"      -> index 0
// slot1 (45°)       = 1 "Chicken fries"        -> index 4
// slot2 (90°)       = 2 "Big chicken burger"   -> index 3
// slot3 (135°)      = 3 "Coupon 10%"           -> index 6
// slot4 (180°, bas) = 4 "Burger fondu"         -> index 1
// slot5 (225°)      = 5 "Salade O'Clock"       -> index 2
// slot6 (270°)      = 6 "Rejouer / Bad luck"   -> index 7
// slot7 (315°)      = 7 "Plat Strips"          -> index 5

const N = 8;
const SEG_ANGLE = 360 / N;

// Lien vers le post/profil Instagram du giveaway (à remplacer par le lien
// exact du post une fois publié).
const IG_LINK = "https://www.instagram.com/p/Db0s5EYImqT/?igsh=MTU3a3hxNWV6MmZ2cA==";
const IG_HANDLE = "@oclock.59";

export default function Wheel() {
  const [pseudo, setPseudo] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [status, setStatus] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [alreadyPlayed, setAlreadyPlayed] = useState(null); // { prize_label } ou null
  const controls = useAnimationControls();
  const rotationRef = useRef(0);

  function lockKey(sessionDate) {
    return `oclock_played_${sessionDate}`;
  }

  useEffect(() => {
    fetch(`${API}/status`)
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.session_date) {
          try {
            const saved = localStorage.getItem(lockKey(data.session_date));
            if (saved) setAlreadyPlayed(JSON.parse(saved));
          } catch {
            // stockage indisponible : on ignore, le serveur reste garant
          }
        }
      })
      .catch(() => setStatus({ open: false, message: "Service indisponible." }));
  }, []);

  async function animateTo(prizeIndex) {
    const slot = slotOrder.indexOf(prizeIndex);
    const targetCenter = slot * SEG_ANGLE + SEG_ANGLE / 2;
    const extraTurns = 6 + Math.floor(Math.random() * 3);
    const jitter = (Math.random() - 0.5) * (SEG_ANGLE * 0.5);
    const final =
      Math.ceil(rotationRef.current / 360) * 360 +
      extraTurns * 360 +
      (360 - targetCenter) +
      jitter;
    rotationRef.current = final;
    await controls.start({
      rotate: final,
      transition: { duration: 5, ease: [0.15, 0.6, 0.25, 1] },
    });
  }

  async function handleSpin() {
    setError("");
    setResult(null);
    if (!pseudo.trim()) {
      setError("Entre ton @pseudo Instagram.");
      return;
    }
    if (!rulesAccepted) {
      setError("Coche la case pour confirmer que tu remplis les conditions.");
      return;
    }
    setSpinning(true);
    try {
      const res = await fetch(`${API}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Une erreur est survenue.");
        setSpinning(false);
        return;
      }
      await animateTo(data.prize_index);
      setResult(data);
      if (status && status.session_date) {
        try {
          localStorage.setItem(
            lockKey(status.session_date),
            JSON.stringify({ prize_label: data.prize_label, is_physical: data.is_physical })
          );
        } catch {
          // stockage indisponible : le serveur reste garant de l'anti-fraude
        }
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSpinning(false);
    }
  }

  const bgStyle = {
    backgroundImage: "url('/wheel-background.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundColor: "#1230a8",
  };

  if (status && !status.open) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={bgStyle}>
        <p className="text-xl text-amber-300 font-semibold drop-shadow-lg bg-slate-900/60 px-4 py-2 rounded-xl mt-32">
          {status.message}
        </p>
      </div>
    );
  }

  if (alreadyPlayed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={bgStyle}>
        <div className="bg-slate-900/70 rounded-2xl px-6 py-8 max-w-sm mt-32">
          <p className="text-3xl mb-2">✋</p>
          <p className="text-xl text-white font-bold mb-2">
            Tu as déjà tenté ta chance ce dimanche !
          </p>
          <p className="text-amber-300 font-semibold">{alreadyPlayed.prize_label}</p>
          <p className="text-slate-300 text-sm mt-3">
            Rendez-vous dimanche prochain pour un nouveau tour 💚
          </p>
        </div>
      </div>
    );
  }

  const won = result && result.prize_index !== 7;

  return (
    <div className="min-h-screen flex flex-col items-center p-4" style={bgStyle}>
      <div style={{ height: "34vh" }} />

      {/* Roue : image fournie par le client, pivotée telle quelle */}
      <div className="relative mb-6" style={{ width: "min(88vw, 420px)", overflow: "visible" }}>
        <motion.img
          src="/wheel-disc.png"
          alt="Roue O'Clock"
          animate={controls}
          style={{ willChange: "transform", width: "100%", height: "auto", display: "block", position: "relative", zIndex: 1 }}
        />
        <img
          src="/wheel-arrow.png"
          alt=""
          className="absolute left-1/2"
          style={{
            top: "-6%",
            width: "18%",
            transform: "translateX(-50%)",
            zIndex: 50,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
          }}
        />
      </div>

      <div className="w-full max-w-xs">
        <input
          type="text"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="@ton_pseudo_instagram"
          disabled={spinning}
          className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 mb-3"
        />

        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3 mb-3">
          <p className="text-slate-200 text-xs mb-2">
            Conditions de participation : suis{" "}
            <a
              href={IG_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 underline font-semibold"
            >
              {IG_HANDLE}
            </a>
            , aime la publication du giveaway et identifie 2 amis en
            commentaire.
          </p>
          <label className="flex items-start gap-2 text-sm text-white cursor-pointer">
            <input
              type="checkbox"
              checked={rulesAccepted}
              onChange={(e) => setRulesAccepted(e.target.checked)}
              disabled={spinning}
              className="mt-1 w-4 h-4 accent-amber-400 shrink-0"
            />
            <span>Je confirme avoir rempli ces conditions.</span>
          </label>
        </div>

        <button
          onClick={handleSpin}
          disabled={spinning}
          className="w-full py-3 rounded-xl bg-amber-400 text-slate-900 font-black text-lg active:scale-95 transition-transform disabled:opacity-50 shadow-lg"
        >
          {spinning ? "Ça tourne…" : "Tourner la roue"}
        </button>

        {error && (
          <p className="mt-4 text-center text-rose-300 font-semibold bg-slate-900/60 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {result && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-6 z-20">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center border border-slate-700">
            {won ? (
              <>
                <p className="text-amber-400 text-sm font-semibold mb-1">🎉 Bravo, tu as gagné !</p>
                {result.image_slug && (
                  <img
                    src={`/prizes/${result.image_slug}.png`}
                    alt={result.prize_label}
                    className="w-56 h-56 object-contain mx-auto mb-2"
                  />
                )}
                <p className="text-2xl font-black text-white mb-4">{result.prize_label}</p>
                <div className="bg-amber-400/10 border border-amber-400/40 rounded-xl p-4">
                  <p className="text-amber-300 font-bold">
                    📸 Fais une capture d'écran de ton résultat
                  </p>
                  <p className="text-slate-300 text-sm mt-1">
                    et montre-la nous à la caisse pour récupérer ton gain !
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-4xl mb-2">😅</p>
                <p className="text-xl font-black text-white mb-1">Pas de chance cette fois</p>
                <p className="text-slate-400">{result.prize_label} !</p>
              </>
            )}
            <p className="mt-4 text-emerald-400 font-semibold">
              Merci de ta visite chez O'Clock 💚
            </p>
            <p className="text-slate-400 text-xs mt-1">
              À très vite pour de nouvelles surprises !
            </p>
            <button
              onClick={() => setResult(null)}
              className="mt-5 w-full py-2 rounded-xl bg-slate-700 text-white font-semibold active:scale-95 transition-transform"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
