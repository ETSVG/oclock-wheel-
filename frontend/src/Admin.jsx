import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const timer = useRef(null);

  async function load(pwd) {
    try {
      const res = await fetch(
        `${API}/api/admin/winners?password=${encodeURIComponent(pwd)}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail || "Erreur");
        setAuthed(false);
        return false;
      }
      setData(json);
      setError("");
      setAuthed(true);
      return true;
    } catch {
      setError("Serveur injoignable.");
      return false;
    }
  }

  // Rafraîchissement auto toutes les 5s une fois connecté.
  useEffect(() => {
    if (!authed) return;
    timer.current = setInterval(() => load(password), 5000);
    return () => clearInterval(timer.current);
  }, [authed, password]);

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <h1 className="text-2xl font-black mb-4">O'Clock — Admin</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className="w-full max-w-xs px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 mb-3 focus:outline-none focus:border-amber-400"
        />
        <button
          onClick={() => load(password)}
          className="w-full max-w-xs py-3 rounded-xl bg-amber-400 text-slate-900 font-black active:scale-95 transition-transform"
        >
          Se connecter
        </button>
        {error && <p className="mt-4 text-rose-400 font-semibold">{error}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-5">
      <div className="max-w-lg mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-2xl font-black">Gagnants en direct</h1>
          <span className="text-xs text-slate-500">auto ⟳ 5s</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Participants" value={data.total_participants} />
          <Stat label="Lots donnés" value={`${data.physical_prizes_given}/3`} />
          <Stat label="Lots restants" value={data.physical_prizes_left} />
        </div>

        <p className="text-slate-400 text-sm mb-2">Session : {data.session_date}</p>

        {data.winners.length === 0 ? (
          <p className="text-slate-500 mt-8 text-center">Aucun gagnant pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {data.winners.map((w, i) => (
              <li
                key={i}
                className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                  w.is_physical
                    ? "bg-emerald-500/10 border-emerald-500/40"
                    : "bg-slate-800 border-slate-700"
                }`}
              >
                <div>
                  <p className="font-bold">{w.pseudo}</p>
                  <p className="text-sm text-slate-400">{w.prize_label}</p>
                </div>
                {w.is_physical && <span className="text-emerald-400 text-xl">🎁</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-800 rounded-xl p-3 text-center border border-slate-700">
      <p className="text-2xl font-black text-amber-400">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
