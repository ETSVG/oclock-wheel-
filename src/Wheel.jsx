import { useState, useEffect, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";

const API = "/.netlify/functions";

// Chaque case du backend garde son index d'origine (logique inchangée) ;
// on choisit ici un ORDRE VISUEL qui alterne produits / réductions pour
// une roue plus agréable à regarder. slotOrder[position visuelle] = index prix.
const slotOrder = [0, 5, 1, 6, 2, 7, 3, 4];
// 0 mini burgers | 5 10% | 1 burger fondu | 6 5% | 2 tacos fondu
// 7 perdant | 3 chicken fries | 4 big chicken burger

const SEGMENTS_BY_INDEX = {
  0: { label: "4 mini burgers", color: "#e0264b", img: "/prizes/mini-burgers-thumb.png" },
  1: { label: "Burger fondu", color: "#f2994a", img: "/prizes/burger-fondu-thumb.png" },
  2: { label: "Tacos fondu", color: "#e0264b", img: "/prizes/tacos-fondu-thumb.png" },
  3: { label: "Chicken fries", color: "#f2994a", img: "/prizes/chicken-fries-thumb.png" },
  4: { label: "Big chicken burger", color: "#e0264b", img: "/prizes/big-chicken-burger-thumb.png" },
  5: { label: "10%", color: "#1f9d55", img: null },
  6: { label: "5%", color: "#2f855a", img: null },
  7: { label: "Rejoue dimanche", color: "#334155", img: null },
};

const N = 8;
const SEG_ANGLE = 360 / N; // 45°
const R = 140, CX = 150, CY = 150; // roue nettement plus grande
const IMG_RADIUS = 40; // rayon des vignettes produit (plus grandes)
const IMG_CENTER_R = 92; // distance du centre à l'image
const TEXT_R = 128; // texte proche du bord, loin des images

function segmentPath(slot) {
  const start = (slot * SEG_ANGLE - 90) * (Math.PI / 180);
  const end = ((slot + 1) * SEG_ANGLE - 90) * (Math.PI / 180);
  const x1 = CX + R * Math.cos(start);
  const y1 = CY + R * Math.sin(start);
  const x2 = CX + R * Math.cos(end);
  const y2 = CY + R * Math.sin(end);
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
}

function pointAt(slot, radius) {
  const a = (slot * SEG_ANGLE + SEG_ANGLE / 2 - 90) * (Math.PI / 180);
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

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

  if (status && !status.open) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <h1 className="text-3xl font-black mb-2">O'Clock 🍔</h1>
        <p className="text-xl text-amber-400 font-semibold">{status.message}</p>
      </div>
    );
  }

  const won = result && result.prize_index !== 7;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
      <h1 className="text-3xl font-black mb-1">O'Clock 🍔</h1>
      <p className="text-slate-400 mb-6 text-sm">Giveaway du dimanche — tente ta chance !</p>

      <div className="relative mb-8" style={{ width: "min(92vw, 420px)" }}>
        <div className="absolute left-1/2 -top-3 -translate-x-1/2 z-10">
          <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[30px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg" />
        </div>

        <motion.svg
          viewBox="0 0 300 300"
          animate={controls}
          style={{ willChange: "transform", width: "100%", height: "auto" }}
          className="drop-shadow-2xl"
        >
          <defs>
            {slotOrder.map((prizeIndex, slot) => {
              const seg = SEGMENTS_BY_INDEX[prizeIndex];
              if (!seg.img) return null;
              const c = pointAt(slot, IMG_CENTER_R);
              return (
                <clipPath id={`clip-${slot}`} key={slot}>
                  <circle cx={c.x} cy={c.y} r={IMG_RADIUS} />
                </clipPath>
              );
            })}
          </defs>

          {slotOrder.map((prizeIndex, slot) => {
            const seg = SEGMENTS_BY_INDEX[prizeIndex];
            const rot = slot * SEG_ANGLE + SEG_ANGLE / 2;
            const imgC = pointAt(slot, IMG_CENTER_R);
            const textP = pointAt(slot, TEXT_R);
            // Le texte se lit toujours "à l'endroit" (jamais tête en bas).
            let textRot = rot;
            if (textRot > 90 && textRot < 270) textRot += 180;

            return (
              <g key={slot}>
                <path d={segmentPath(slot)} fill={seg.color} stroke="#0f172a" strokeWidth="2" />

                {seg.img ? (
                  <>
                    <image
                      href={seg.img}
                      x={imgC.x - IMG_RADIUS}
                      y={imgC.y - IMG_RADIUS}
                      width={IMG_RADIUS * 2}
                      height={IMG_RADIUS * 2}
                      clipPath={`url(#clip-${slot})`}
                      transform={`rotate(${rot} ${imgC.x} ${imgC.y})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                    <circle cx={imgC.x} cy={imgC.y} r={IMG_RADIUS} fill="none" stroke="#fff" strokeWidth="2.5" />
                  </>
                ) : (
                  <text
                    x={pointAt(slot, 78).x}
                    y={pointAt(slot, 78).y}
                    fill="white"
                    fontSize="19"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${textRot} ${pointAt(slot, 78).x} ${pointAt(slot, 78).y})`}
                  >
                    {seg.label}
                  </text>
                )}

                {seg.img && (
                  <text
                    x={textP.x}
                    y={textP.y}
                    fill="white"
                    fontSize="9"
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${textRot} ${textP.x} ${textP.y})`}
                  >
                    {seg.label}
                  </text>
                )}
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r="20" fill="#0f172a" stroke="#f59e0b" strokeWidth="4" />
        </motion.svg>
      </div>

      <div className="w-full max-w-xs">
        <input
          type="text"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="@ton_pseudo_instagram"
          disabled={spinning}
          className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 mb-3"
        />
        <button
          onClick={handleSpin}
          disabled={spinning}
          className="w-full py-3 rounded-xl bg-amber-400 text-slate-900 font-black text-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          {spinning ? "Ça tourne…" : "Tourner la roue"}
        </button>

        {error && <p className="mt-4 text-center text-rose-400 font-semibold">{error}</p>}
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
