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
