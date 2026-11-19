# Mactura — gestion commerciale & CRM

Next.js 15 · React 19 · TypeScript · Tailwind 4 · Framer Motion · Recharts · PostgreSQL · Prisma · @react-pdf/renderer

## Démarrage

```bash
npm install
npm run db:start      # PostgreSQL local (port 5433) — laisser ce terminal ouvert
npx prisma migrate deploy && npm run db:seed
npm run dev           # http://localhost:3000
```

Compte de démonstration : `demo@mactura.ma` / `Demo1234`.
Pour utiliser votre propre PostgreSQL, modifiez `DATABASE_URL` dans `.env`.

## Modules

Tableau de bord · Prospects · Clients · Devis · Factures · Paiements · Contrats · Fournisseurs · Achats ·
Trésorerie · Caisse · Rapports (ventes, TVA, créances, achats, export CSV) · Projets · Tâches · Calendrier ·
Employés · Journal d'activité · Paramètres (entreprise, documents, TVA, équipe, profil).

## Performance

- **Pour une vitesse maximale, utilisez la version de production** : `npm run start:prod` (build + serveur).
  Le mode `npm run dev` compile chaque page à sa première visite (1 à 4 s) et exécute du code non optimisé ; ce n'est pas représentatif.
  `npm run dev` utilise Turbopack ; `npm run dev:webpack` reste disponible.
- Navigation : cache du routeur client (30 s, invalidé par les modifications), aucun écran de chargement intermédiaire
  (React retient le contenu 300 ms après un écran de chargement) mais une barre de progression fine, liens de téléchargement
  (PDF, exports) en HTML simple pour éviter un préchargement qui génère le PDF en arrière-plan.
- Graphiques (Recharts) chargés à la demande ; lignes de documents mémoïsées ; plus de double rafraîchissement après une modification.
- Diagnostic SQL : `LOG_QUERIES=1 npm start` journalise chaque requête avec sa durée.

## Design system « Midnight » — modes sombre et clair

Bascule soleil/lune dans la barre supérieure ; le choix est mémorisé (cookie lu côté serveur, aucun flash au chargement).
**La barre latérale a exactement les mêmes couleurs dans les deux modes** (elle porte `data-theme="dark"` et un fond opaque) ;
seule la zone de contenu change (fond, cartes, tableaux, formulaires, dialogues, menus, graphiques). Les pages
d'authentification restent sombres. Les jetons clairs sont dans `html[data-theme="light"]` (`src/app/globals.css`).

Thème sombre unique (bleu nuit, fibres/particules bleues, verre dépoli, accents bleu · cyan · violet).
Tout est piloté par les jetons de `src/app/globals.css` (`@theme`) : couleurs, ombres, rayons, palette d'états.
Surfaces en verre : classe `.glass` (cartes) ; menus, dialogues et tiroirs utilisent `bg-popover` (opaque, lisible).
Le contraste des textes sur fond sombre et des couleurs de graphiques a été vérifié (≥ 4,5:1 pour le texte).
Les aperçus de documents restent des feuilles blanches, comme à l'impression ; les PDF ne sont pas affectés.

## Règles métier

- Montants en centimes (BigInt), quantités en millièmes, taux en points de base : aucun calcul flottant.
- Facture : cycle de vie (`DRAFT → ISSUED → SENT`, `CANCELLED`) distinct de la situation de règlement
  (`UNPAID / PARTIAL / PAID`, recalculée depuis les paiements actifs). « En retard » est calculé, jamais stocké.
- Paiements : verrou de ligne, montant ≤ reste dû, clé d'idempotence unique en base, annulation (jamais de suppression)
  avec motif et piste d'audit. Même logique pour les règlements fournisseurs.
- Numérotation continue par année attribuée à l'émission. Isolation stricte des données par entreprise.

## Tests

```bash
npm test                  # calculs financiers (unitaires)
npm run test:integration  # cycle de vie, paiements, achats, trésorerie, rapports (base PostgreSQL *_test)
```

## Limites connues

- Pas d'envoi d'e-mails : « Mot de passe oublié » et l'envoi de documents (ouvre votre client mail) sont limités.
- Interface en français ; le texte arabe est pris en charge dans les champs, pas d'interface traduite.
- Pas d'intégrations externes (Google Drive, assistant IA, rapprochement bancaire automatique).
