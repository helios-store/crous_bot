# 🤖 Bot Discord — Guide de déploiement

## 📋 Fonctionnalités

| Commande | Description | Accès |
|---|---|---|
| `!aide` | Liste toutes les commandes | Tous |
| `!pubmed` | Affiche la dernière étude définie | Tous |
| `!def-etude <titre> \| <url> \| <description>` | Définit une nouvelle étude | Admin |
| `!cope` | Liste complète Cope / Intéressants | Tous |
| `!add-cope <nom>` | Ajoute un complément dans la liste Cope | Admin |
| `!add-interesting <nom>` | Ajoute un complément Intéressant | Admin |
| `!remove-cope <nom>` | Retire un complément Cope | Admin |
| `!remove-interesting <nom>` | Retire un complément Intéressant | Admin |
| `!regles` | Affiche toutes les règles | Tous |
| `!regle<N>` | Affiche la règle numéro N (ex: `!regle3`) | Tous |
| `!set-regle <N> \| <texte>` | Modifie une règle | Admin |
| `!ban @user [raison]` | Banni un utilisateur | Permission Ban Discord |
| 🔴 Auto | Alerte live TikTok automatique | — |

---

## ⚙️ Étape 1 — Configurer le bot

Ouvre `bot.js` et modifie la section `CONFIG` en haut du fichier :

```js
const CONFIG = {
  // 👇 Tes IDs Discord (clic droit sur ton profil > Copier l'ID)
  ADMIN_IDS: [
    '123456789012345678',  // Ton ID Discord
  ],

  // 👇 Username TikTok à surveiller (sans le @)
  TIKTOK_USERNAME: 'nom_du_compte',

  // 👇 ID du channel Discord pour les alertes live
  LIVE_CHANNEL_ID: '111222333444555666',

  // Intervalle de vérification (2 min par défaut)
  LIVE_CHECK_INTERVAL: 2 * 60 * 1000,
};
```

> **Comment trouver ton ID Discord ?**
> Paramètres → Avancé → Active le mode développeur → Clic droit sur ton pseudo → "Copier l'identifiant"

---

## 🔑 Étape 2 — Créer le bot Discord

1. Va sur [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clique **"New Application"** → Donne un nom
3. Onglet **"Bot"** → Clique **"Add Bot"** → Confirme
4. Sous le token, clique **"Reset Token"** → Copie le token (⚠️ ne le partage jamais !)
5. Descends dans **"Privileged Gateway Intents"** et active :
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
6. Onglet **"OAuth2 > URL Generator"** :
   - Scopes : `bot`
   - Bot Permissions : `Send Messages`, `Read Message History`, `Ban Members`, `Embed Links`, `Mention Everyone`
7. Copie l'URL générée → Ouvre-la → Ajoute le bot à ton serveur

---

## 🚀 Étape 3 — Déploiement sur Railway via GitHub

### 3a. Préparer GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/TON_REPO.git
git push -u origin main
```

### 3b. Déployer sur Railway
1. Va sur [railway.app](https://railway.app) → Connecte-toi avec GitHub
2. **"New Project"** → **"Deploy from GitHub repo"** → Sélectionne ton repo
3. Railway va détecter automatiquement le fichier `railway.toml`

### 3c. Ajouter le token (IMPORTANT)
1. Dans Railway, clique sur ton service → Onglet **"Variables"**
2. Clique **"+ New Variable"**
3. Nom : `DISCORD_TOKEN`  
   Valeur : le token copié à l'étape 2
4. Railway redémarre automatiquement le bot ✅

---

## 📝 Exemples d'utilisation

### Définir une étude
```
!def-etude Effects of Creatine on Performance | https://pubmed.ncbi.nlm.nih.gov/12345678 | Étude montrant +8% de force sur 8 semaines
```

### Ajouter des compléments
```
!add-cope BCAA en post-workout
!add-interesting Créatine Monohydrate
!remove-cope BCAA en post-workout
```

### Modifier les règles
```
!set-regle 5 | Respectez les décisions des admins et modérateurs sans discussion publique.
!regle5
```

### Ban
```
!ban @Utilisateur Spam répété malgré avertissement
```

---

## 🔴 Système de détection Live TikTok

Le bot vérifie toutes les **2 minutes** si `@TIKTOK_USERNAME` est en live.  
Quand un live démarre → message automatique avec `@everyone` dans le channel défini.  
Le statut est sauvegardé dans `data/live_status.json` pour éviter les doubles notifications.

> ⚠️ **Note** : TikTok peut modifier son HTML, ce qui peut rendre la détection temporairement inopérante. Si la détection ne fonctionne plus, ouvre une issue.

---

## 📁 Structure du projet

```
discord-bot/
├── bot.js              ← Code principal
├── package.json
├── railway.toml        ← Config Railway
├── .gitignore
├── README.md
└── data/               ← Créé automatiquement (ignoré par git)
    ├── study.json      ← Étude courante
    ├── copes.json      ← Listes compléments
    ├── rules.json      ← Règles du serveur
    └── live_status.json
```

> ⚠️ Le dossier `data/` est dans `.gitignore`. Les données sont **persistées sur Railway** tant que le service tourne. Pour une persistance garantie, connecte un volume Railway ou une base de données.
