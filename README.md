# O'Clock — Roue de la fortune (version Netlify uniquement)

Cette version regroupe TOUT sur Netlify : le site (la roue, l'admin) et la
logique serveur (tirage, anti-fraude, admin) via les fonctions Netlify.
Aucune carte bancaire n'est nécessaire, et il n'y a qu'un seul service à
déployer (contrairement à la version précédente avec un backend séparé).

## Ce qui a changé par rapport à la version FastAPI

- Le dossier `backend/` (Python) est remplacé par `netlify/functions/`
  (JavaScript), qui fait exactement la même chose : tirage serveur, règle
  des 3 lots physiques, anti-fraude par pseudo/session, page admin.
- La base de données SQLite est remplacée par **Netlify Blobs**, un
  stockage clé-valeur intégré à Netlify (gratuit, aucune config à faire).
- Le frontend (React) est identique, seules les adresses appelées ont
  changé (`/.netlify/functions/...` au lieu d'un serveur séparé).

## Déploiement (résumé)

1. Mets ce dossier sur GitHub (comme précédemment).
2. Sur netlify.com, "Add new site" → "Import an existing project" → GitHub
   → sélectionne le dépôt.
3. Build command : `npm run build` — Publish directory : `dist` — ces
   valeurs sont déjà dans `netlify.toml`, Netlify les détecte seul.
4. Dans "Site settings" → "Environment variables", ajoute
   `ADMIN_PASSWORD` avec ta valeur (sinon `123456789` par défaut).
5. Déploie. Le site et les fonctions serveur se déploient ensemble,
   automatiquement.

## Adresses

- Roue : `https://ton-site.netlify.app/`
- Admin : `https://ton-site.netlify.app/admin`
- Fonctions (usage interne, appelées par le site) :
  `/.netlify/functions/status`, `/spin`, `/admin-winners`

## Logique clé (inchangée)

- Ouverte uniquement le dimanche 18h-19h (Europe/Paris).
- Un pseudo = une participation par session dominicale.
- Poids égaux sur les 8 cases tant que < 3 lots physiques distribués,
  puis coupe automatique sur les cases 6/7/8 (réductions + perdant).
- Log `🎉 Gagnant validé : @pseudo a gagné [Lot]` visible dans
  Netlify → Functions → spin → Logs, sur chaque lot physique.
- Écran de résultat avec photo + message "fais une capture d'écran" +
  mot de remerciement O'Clock.
- Page admin : total participants, lots donnés/restants, liste des
  gagnants — rafraîchie automatiquement toutes les 5 secondes.
