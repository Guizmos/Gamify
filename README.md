# 🎮 Gamify

**Gamify** est une application web auto-hébergée permettant de **scanner, organiser et notifier** automatiquement l’ajout de jeux vidéo présents sur un ou plusieurs dossiers locaux (NAS, serveur, PC).

L’application s’inspire de l’expérience Plex / Tautulli, mais appliquée aux **jeux**, avec :
- une interface moderne
- des notifications Telegram
- un enrichissement automatique via **IGDB**
- une gestion fine des utilisateurs et des droits

---

## ✨ Fonctionnalités

### 📂 Gestion des jeux
- Scan automatique ou manuel de dossiers surveillés
- Détection des nouveaux jeux
- Calcul automatique de la taille des dossiers
- Archivage / désarchivage des jeux
- Recherche instantanée
- Filtre par plateforme (PC, Switch, etc.)
- Tri alphabétique A→Z / Z→A

### 🖼 Enrichissement IGDB
- Recherche automatique des jeux sur IGDB
- Association manuelle si nécessaire
- Téléchargement des pochettes
- Lien IGDB stocké
- Statut de matching visible (IGDB: matched / missing)

### 🔔 Notifications Telegram
- Notifications automatiques lors de l’ajout d’un jeu
- Bouton manuel pour renvoyer une notification
- Message **100 % personnalisable** via template
- Test d’envoi directement depuis l’interface
- Activation / désactivation indépendante

### 👥 Gestion des utilisateurs
- Authentification sécurisée
- Rôles :
  - **admin** : accès complet
  - **user** : lecture seule
- Création / suppression de comptes
- Changement de mot de passe
- Interface dédiée pour les admins

### ⚙️ Paramètres
- Interface settings centralisée
- UI cohérente entre toutes les cartes
- Actions toujours positionnées en bas des cartes
- Feedback utilisateur intégré directement dans les boutons

---

## 🧱 Stack technique

### Backend
- **Node.js**
- **Express**
- **SQLite** (better-sqlite3)
- Authentification par **JWT + cookies**
- API REST sécurisée

### Frontend
- HTML / CSS / JavaScript vanilla
- UI moderne (glass / blur / dark theme)
- Responsive desktop / mobile
- Aucun framework frontend (léger & rapide)

### Services externes
- **IGDB API** (enrichissement jeux)
- **Telegram Bot API** (notifications)

---

## 🚀 Installation

### 1️⃣ Prérequis
- Node.js ≥ 18
- npm
- Accès à l’API IGDB
- Un bot Telegram (optionnel mais recommandé)

---

### 2️⃣ Installation

```bash
git clone https://github.com/TON_USER/gamify.git
cd gamify
npm install
