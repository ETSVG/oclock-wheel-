# O'Clock — Roue de la fortune dominicale

Giveaway du dimanche (18h-19h, fuseau Europe/Paris) pour le fast-food O'Clock.

## Structure

```
oclock-wheel/
├── backend/
│   ├── main.py            # API FastAPI (logique + anti-fraude + tirage serveur)
│   └── pyproject.toml     # dépendances (uv)
├── frontend/
│   ├── src/
│   │   ├── Wheel.jsx      # composant principal (roue + Framer Motion)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
└── README.md
```

## Backend (uv)

```bash
cd backend
uv venv
uv pip install -e .
uv run uvicorn main:app --reload --port 8000
```

La base SQLite `oclock.db` est créée automatiquement au démarrage.

## Frontend

```bash
cd frontend
cp .env.example .env        # ajuste VITE_API_URL vers ton backend public
npm install
npm run dev                 # ou: npm run build  ->  dossier dist/ à héberger
```

Le `dist/` produit par `npm run build` est un site statique : héberge-le
(Netlify, Vercel, GitHub Pages…) et mets le lien sur ta page. Le frontend
appelle le backend via `VITE_API_URL`.

## Page admin (gagnants en direct)

Accessible sur `ton-site/?admin` (ou `/admin`). Demande le mot de passe
(variable d'env `ADMIN_PASSWORD`, défaut `123456789`). Affiche en direct
(rafraîchi toutes les 5 s) : nombre total de participants, lots physiques
donnés/restants, et la liste des gagnants (physiques + réductions, la case
perdante est exclue). Les lots physiques sont surlignés en vert.

Définis le mot de passe au lancement du backend :

```bash
ADMIN_PASSWORD="ton_mot_de_passe" uv run uvicorn main:app --port 8000
```

## Images produits

Les 5 photos sont dans `frontend/public/prizes/` :
- `<slug>.jpg` : grand format, affiché sur l'écran de résultat.
- `<slug>-thumb.png` : vignette ronde affichée dans la roue.

Écran de résultat : sur un gain, la photo s'affiche en grand avec le message
« 📸 Fais une capture d'écran… montre-la nous à la caisse ». Le screenshot est
la preuve côté client ; l'enregistrement en base (visible dans l'admin) est le
registre côté commerçant.

## Logique clé

- **Créneau** : `/api/spin` refuse tout en dehors du dimanche 18h-19h Paris.
- **Anti-fraude** : contrainte SQL `UNIQUE(session_date, pseudo)` → 1 essai
  par pseudo et par session dominicale.
- **Tirage serveur** : `pick_prize()` décide l'index AVANT l'animation.
  Poids égaux (1/8) tant que < 3 lots physiques distribués ; ensuite les
  cases 1-5 passent à 0 % et seules 6/7/8 sortent.
- **Notification** : un lot physique gagné logge en console
  `🎉 Gagnant validé : @pseudo a gagné [Lot]`.
- **Reset** : automatique — chaque dimanche a sa propre `session_date`, donc
  le compteur et l'anti-fraude repartent à zéro naturellement.

## Sécurité (prod)

- Restreins `allow_origins` dans `main.py` à ton domaine réel.
- Sers l'API en HTTPS derrière un reverse proxy.
