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

export default function Wheel() {
  const [pseudo, setPseudo] = useState("");
  const [status, setStatus] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const controls = useAnimationControls();
  const rotationRef = useRef(0);

  useEffect(() => {
    fetch(`${API}/status`)
      .then((r) => r.json())
      .then(setStatus)
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

  const won = result && result.prize_index !== 7;

  return (
    <div className="min-h-screen flex flex-col items-center p-4" style={bgStyle}>
      <div style={{ height: "34vh" }} />

      {/* Roue : image fournie par le client, pivotée telle quelle */}
      <div className="relative mb-6" style={{ width: "min(88vw, 420px)" }}>
        <img
          src="/wheel-arrow.png"
          alt=""
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ top: "-4%", width: "20%" }}
        />
        <motion.img
          src="/wheel-disc.png"
          alt="Roue O'Clock"
          animate={controls}
          style={{ willChange: "transform", width: "100%", height: "auto", display: "block" }}
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
