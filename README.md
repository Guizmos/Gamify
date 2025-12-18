# 🎮 Gamify

**Gamify** est une application self-hosted permettant de **centraliser, visualiser et notifier** les jeux disponibles sur un serveur (NAS, serveur dédié, PC), à partir de **dossiers de jeux installables**.

> ⚠️ Gamify **ne détecte pas les jeux installés sur un PC**  
> Il référence uniquement les **dossiers de jeux prêts à être installés** (backup, dump, ISO, ROM, répertoires d’émulateur, etc.).

---

## ✨ Fonctionnalités principales

- 📂 Scan automatique ou manuel de dossiers surveillés
- 🎮 Organisation par plateforme (PC, Switch, etc.)
- 🖼️ Enrichissement IGDB (pochette, métadonnées)
- 🔔 Notifications Telegram lors des nouveaux ajouts
- 🗂️ Système d’archives (automatique + manuel)
- 👥 Gestion des utilisateurs (admin / user)
- 🌐 Interface web moderne, responsive, auto-hébergée
- 🐳 Déploiement simple via Docker / Portainer

---

## 🧠 Concept clé

Gamify **n’est pas un launcher** et **n’analyse pas les jeux installés** sur une machine.

Il fonctionne selon le principe suivant :

- Un ou plusieurs **dossiers sont surveillés**
- Chaque **sous-dossier représente un jeu installable**
- Exemple :
/Games/
├── Cyberpunk 2077/
├── Baldur's Gate 3/
├── Zelda BOTW/

yaml
Copier le code

Gamify :
- liste ces dossiers
- calcule leur taille
- les enrichit via IGDB
- permet de les notifier, archiver ou masquer

Idéal pour :
- bibliothèques de jeux sur NAS
- backups / dumps de jeux
- ROMs / émulateurs
- serveurs de jeux partagés
- médiathèques de jeux à installer plus tard

---

## 🐳 Installation (Docker / docker-compose)

### Pré-requis
- Docker
- Docker Compose ou Portainer
- Un dossier pour les données persistantes

---

### Exemple de `docker-compose.yml`

```yaml
version: "3.8"

services:
  gamify:
    image: guizmos/gamify:latest
    container_name: GAMIFY
    environment:
      - GAMES_ROOT=/games
      - DATA_DIR=/data

      - DB_PATH=/data/gamify.sqlite

      - JWT_SECRET=${JWT_SECRET:-change_me_dev_only}

      - ADMIN_BOOTSTRAP_USER=${ADMIN_BOOTSTRAP_USER:-admin}
      - ADMIN_BOOTSTRAP_PASS=${ADMIN_BOOTSTRAP_PASS:-changeme}

      - IGDB_CLIENT_ID=IGDBCLIENTID
      - IGDB_CLIENT_SECRET=IGDBCLIENTSECRET

    ports:
      - "7071:8080"

    volumes:
      - /volume1/Docker/Gamify/data:/data
      - /volume1/Jeux:/games:ro
      
    restart: unless-stopped

```

## Démarrage
- bash
- Copier le code
- docker compose up -d

Puis accéder à l’interface :
- http://localhost:8080

## ⚙️ Configuration

La configuration se fait via :

- les variables d’environnement Docker
- l’interface web (paramètres)

Aucun fichier .env n’est requis côté serveur.
Un .env.example est fourni à titre indicatif dans le dépôt.

## 🔐 Comptes & rôles
admin

- scan des dossiers
- gestion des utilisateurs
- paramètres
- notifications

user

- consultation uniquement

## 📦 Données persistantes
Toutes les données sont stockées dans le volume /data :

- base SQLite
- cache des pochettes IGDB
- paramètres
- historique des scans

Un simple backup de ce dossier suffit.

## 🛠️ Stack technique

- Node.js
- Express
- SQLite
- Docker
- IGDB API
- Telegram Bot API
- HTML / CSS / JavaScript (vanilla)
