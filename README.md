# 📦 Lycée Professionnel Jules Verne – Site Interactif par Gestes

## Structure du projet

```
/
├── pages.json          ← CONFIGURATION CENTRALE de toutes les pages
├── style.css           ← Styles globaux
├── gesture-engine.js   ← Moteur de détection MediaPipe Hands
├── page-engine.js      ← Moteur de rendu dynamique
├── template.html       ← Template HTML de base (référence)
│
├── index.html          ← Page d'accueil (10s → formations)
├── formations.html     ← Grille 3×3 des formations
│
├── f1.html             ← Électricité (vidéo)
├── f2.html             ← Menuiserie (sous-grille 2×2)
├── f21.html            ← CAP Menuisier Installateur
├── f22.html            ← CAP Menuiserie Aluminium Verre
├── f23.html            ← BAC PRO Menuisier Agenceur
├── f24.html            ← BAC PRO Menuisier Agenceur 2
│
├── f3.html             ← Maçonnerie/Peinture (sous-grille 2×2)
├── f31.html            ← CAP Maçon
├── f32.html            ← CAP Peintre applicateur
├── f33.html            ← BAC PRO Aménagement et finition
├── f34.html            ← Titre Pro Peintre façadier
│
├── f4.html             ← 3e Prépa-métiers (vidéo)
├── f5.html             ← CAP Maintenance Bâtiment (vidéo)
├── f6.html             ← CDI (image cliquable vers URL externe)
├── f7.html – f9.html   ← Formations supplémentaires
│
└── images/             ← Placez ici toutes vos images .png
```

---

## 🖼 Images à fournir

Placez ces fichiers `.png` dans le même dossier que les fichiers HTML :

| Fichier       | Usage                          |
|---------------|--------------------------------|
| `home.png`    | Fond page d'accueil            |
| `1.png`–`9.png` | Grille des 9 formations      |
| `f11.png`     | Électricité                    |
| `f21.png`–`f24.png` | Menuiserie (4 sous-formations) |
| `f31.png`–`f34.png` | Maçonnerie/Peinture      |
| `f41.png`     | Prépa-métiers                  |
| `f51.png`     | Maintenance Bâtiment + CDI     |

---

## 🎬 Remplacer les vidéos YouTube

Dans `pages.json`, modifiez le champ `"video"` de chaque page :

```json
"video": "https://www.youtube.com/embed/VOTRE_ID_VIDEO"
```

Exemple : pour `https://www.youtube.com/watch?v=abc123`, mettez `"video": "https://www.youtube.com/embed/abc123"`

---

## 🤚 Gestes supportés (MediaPipe Hands)

| Geste | Action |
|-------|--------|
| **Pinch main droite** (pouce + index) sur une image | Ouvrir le lien de l'image |
| **Double pinch** (deux mains) + **écarter** | Zoom avant proportionnel |
| **Double pinch** + **rapprocher** | Zoom arrière (retour à 100%) |
| **Poing fermé** | Retour page précédente |

### Activer la détection
Cliquez sur le bouton **📷 Activer gestes** en bas à droite.
→ Le navigateur demande l'accès à la caméra.
→ Un aperçu miniature montre ce que la caméra voit avec les mains détectées.

---

## 🛠 Modifier la configuration

Tout le site est piloté par **`pages.json`**. Pour ajouter une page :

```json
{
  "id": "ma_page",
  "file": "ma_page.html",
  "title": "Mon titre",
  "type": "detail_video",
  "image": { "src": "mon_image.png", "alt": "Description" },
  "video": "https://www.youtube.com/embed/ID",
  "back": "formations.html"
}
```

Types de pages disponibles :
- `"home"` – Page d'accueil avec fond, texte, compte à rebours
- `"grid"` – Grille N×N d'images cliquables
- `"detail_video"` – Image gauche + vidéo YouTube droite
- `"link_image"` – Image centrée qui ouvre une URL externe

---

## 🚀 Déploiement

### Option 1 : Serveur local simple (Python)
```bash
cd /dossier/du/projet
python3 -m http.server 8080
# Ouvrir http://localhost:8080/index.html
```

### Option 2 : Live Server (VS Code)
Installez l'extension **Live Server**, clic droit sur `index.html` → "Open with Live Server"

### Option 3 : Serveur web (Apache/Nginx)
Copiez tous les fichiers dans le répertoire web (`/var/www/html/` ou équivalent).

> ⚠️ **Important** : Les gestes nécessitent HTTPS en production (ou localhost en développement).
> MediaPipe et l'accès caméra refusent les connexions HTTP non-sécurisées.

---

## 📚 Bibliothèques utilisées

- **MediaPipe Hands** v0.4 – Google – Détection temps réel, 21 points par main, GPU-accelerated via WebGL
- **Camera Utils** – MediaPipe – Capture webcam optimisée
- **Polices** – Barlow Condensed + Barlow (Google Fonts)

MediaPipe Hands a été choisi car il est :
- ✅ Le plus rapide en navigateur (WebAssembly + WebGL)
- ✅ Précis : 21 landmarks 3D par main
- ✅ Support 2 mains simultanées
- ✅ Aucune installation serveur, tout en client
- ✅ Gratuit et open source (Google)
