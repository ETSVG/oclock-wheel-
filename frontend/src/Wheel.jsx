import { useState, useEffect, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Ordre visuel des 8 cases (index 0 = case 1). Doit correspondre au backend.
const SEGMENTS = [
  { label: "4 mini burgers", color: "#e11d48", img: "/prizes/mini-burgers-thumb.png" },
  { label: "Burger fondu", color: "#f59e0b", img: "/prizes/burger-fondu-thumb.png" },
  { label: "Tacos fondu", color: "#e11d48", img: "/prizes/tacos-fondu-thumb.png" },
  { label: "Chicken fries", color: "#f59e0b", img: "/prizes/chicken-fries-thumb.png" },
  { label: "Big chicken", color: "#e11d48", img: "/prizes/big-chicken-burger-thumb.png" },
  { label: "10 %", color: "#0ea5e9", img: null },
  { label: "5 %", color: "#38bdf8", img: null },
  { label: "Prochain dimanche", color: "#475569", img: null },
];

const N = SEGMENTS.length;
const SEG_ANGLE = 360 / N; // 45°
const R = 100, CX = 110, CY = 110;

function segmentPath(i) {
  const start = (i * SEG_ANGLE - 90) * (Math.PI / 180);
  const end = ((i + 1) * SEG_ANGLE - 90) * (Math.PI / 180);
  const x1 = CX + R * Math.cos(start);
  const y1 = CY + R * Math.sin(start);
  const x2 = CX + R * Math.cos(end);
  const y2 = CY + R * Math.sin(end);
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
}

// position au milieu du rayon d'un secteur
function midPoint(i, radius) {
  const a = (i * SEG_ANGLE + SEG_ANGLE / 2 - 90) * (Math.PI / 180);
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
    fetch(`${API}/api/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ open: false, message: "Service indisponible." }));
  }, []);

  async function animateTo(prizeIndex) {
    const targetCenter = prizeIndex * SEG_ANGLE + SEG_ANGLE / 2;
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
      const res = await fetch(`${API}/api/spin`, {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
      <h1 className="text-3xl font-black mb-1">O'Clock 🍔</h1>
      <p className="text-slate-400 mb-6 text-sm">Giveaway du dimanche — tente ta chance !</p>

      <div className="relative mb-8">
        <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-10">
          <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow" />
        </div>

        <motion.svg
          width="300"
          height="300"
          viewBox="0 0 220 220"
          animate={controls}
          style={{ willChange: "transform" }}
          className="drop-shadow-2xl"
        >
          <defs>
            {SEGMENTS.map((seg, i) =>
              seg.img ? (
                <clipPath id={`clip-${i}`} key={i}>
                  <circle cx={midPoint(i, 68).x} cy={midPoint(i, 68).y} r="17" />
                </clipPath>
              ) : null
            )}
          </defs>

          {SEGMENTS.map((seg, i) => {
            const label = midPoint(i, 44);
            const rot = i * SEG_ANGLE + SEG_ANGLE / 2;
            const imgC = midPoint(i, 68);
            return (
              <g key={i}>
                <path d={segmentPath(i)} fill={seg.color} stroke="#0f172a" strokeWidth="1.5" />
                {seg.img && (
                  <>
                    <image
                      href={seg.img}
                      x={imgC.x - 17}
                      y={imgC.y - 17}
                      width="34"
                      height="34"
                      clipPath={`url(#clip-${i})`}
                      transform={`rotate(${rot} ${imgC.x} ${imgC.y})`}
                    />
                    <circle cx={imgC.x} cy={imgC.y} r="17" fill="none" stroke="#fff" strokeWidth="1.5" />
                  </>
                )}
                <text
                  x={label.x}
                  y={label.y}
                  fill="white"
                  fontSize="7"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rot} ${label.x} ${label.y})`}
                >
                  {seg.label}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r="14" fill="#0f172a" stroke="#f59e0b" strokeWidth="3" />
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

      {/* Écran de résultat */}
      {result && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-6 z-20">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center border border-slate-700">
            {won ? (
              <>
                <p className="text-amber-400 text-sm font-semibold mb-1">🎉 Bravo, tu as gagné !</p>
                {result.image_slug && (
                  <img
                    src={`/prizes/${result.image_slug}.jpg`}
                    alt={result.prize_label}
                    className="w-48 h-48 object-contain mx-auto mb-2"
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
