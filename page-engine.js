/**
 * page-engine.js
 * Moteur de rendu dynamique pour le Lycée Jules Verne
 * Lit pages.json et génère l'affichage selon le type de page
 */

class PageEngine {
  constructor() {
    this.pageData = null;
    this.pagesConfig = null;
    this.gestureEngine = null;
    this.zoomedImage = null;
    this.currentZoom = 1.0;
    this.autoRedirectTimer = null;

    // Déterminer la page courante depuis l'URL
    this.currentFile = window.location.pathname.split('/').pop() || 'index.html';
    if (!this.currentFile.endsWith('.html')) this.currentFile = 'index.html';
  }

  async init() {
    try {
      const resp = await fetch('pages.json');
      this.pagesConfig = await resp.json();

      this.pageData = this.pagesConfig.pages.find(p => p.file === this.currentFile);
      if (!this.pageData) {
        document.body.innerHTML = `<h1>Page non trouvée: ${this.currentFile}</h1>`;
        return;
      }

      document.title = this.pageData.title;
      this._render();
      this._initGestures();
    } catch (err) {
      console.error('[PageEngine] Erreur:', err);
    }
  }

  _render() {
    const { type } = this.pageData;
    const main = document.getElementById('page-content');

    switch (type) {
      case 'home':      this._renderHome(main); break;
      case 'grid':      this._renderGrid(main); break;
      case 'detail_video': this._renderDetailVideo(main); break;
      case 'link_image':   this._renderLinkImage(main); break;
      default: main.innerHTML = `<p>Type inconnu: ${type}</p>`;
    }
  }

  _renderHome(container) {
    const { background, text, title, autoRedirect } = this.pageData;

    container.innerHTML = `
      <div class="home-wrapper" style="background-image: url('${background}')">
        <div class="home-overlay"></div>
        <div class="home-content">
          <h1 class="home-title">${title}</h1>
          <p class="home-text">${text.replace(/\n\n/g, '</p><p class="home-text">')}</p>
          ${autoRedirect ? `
            <div class="countdown-bar">
              <div class="countdown-fill" id="countdown-fill"></div>
            </div>
            <p class="countdown-text">Redirection dans <span id="countdown-num">${autoRedirect.delay/1000}</span>s</p>
          ` : ''}
        </div>
      </div>
    `;

    if (autoRedirect) {
      let remaining = autoRedirect.delay / 1000;
      const numEl = document.getElementById('countdown-num');
      const fillEl = document.getElementById('countdown-fill');

      const interval = setInterval(() => {
        remaining--;
        if (numEl) numEl.textContent = remaining;
        if (fillEl) fillEl.style.width = ((autoRedirect.delay/1000 - remaining) / (autoRedirect.delay/1000) * 100) + '%';
        if (remaining <= 0) {
          clearInterval(interval);
          window.location.href = autoRedirect.target;
        }
      }, 1000);

      this.autoRedirectTimer = interval;
    }
  }

  _renderGrid(container) {
    const { images, columns, title, back } = this.pageData;
    const cols = columns || 3;

    const backBtn = back ? `<button class="back-btn" onclick="history.back()">← Retour</button>` : '';

    const imagesHtml = images.map((img, idx) => `
      <div class="grid-item" data-index="${idx}" data-link="${img.link}">
        <img 
          src="${img.src}" 
          alt="${img.alt || ''}" 
          class="grid-img"
          draggable="false"
        />
        <div class="grid-caption">${img.alt || ''}</div>
        <div class="grid-hover-overlay">
          <span class="pinch-icon">👌 Pincer pour ouvrir</span>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="page-header">
        ${backBtn}
        <h1 class="page-title">${title}</h1>
      </div>
      <div class="grid-container" style="--cols: ${cols}">
        ${imagesHtml}
      </div>
    `;

    // Clic souris classique sur les images
    container.querySelectorAll('.grid-item').forEach(item => {
      item.addEventListener('click', () => {
        const link = item.dataset.link;
        if (link) window.location.href = link;
      });
    });

    this._currentGridImages = images;
  }

  _renderDetailVideo(container) {
    const { title, image, video, back } = this.pageData;
    const backBtn = back ? `<button class="back-btn" onclick="history.back()">← Retour</button>` : '';

    // Extraire l'ID YouTube pour l'embed
    const videoId = this._extractYouTubeId(video);
    const embedUrl = videoId
      ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=0&rel=0`
      : video;

    container.innerHTML = `
      <div class="page-header">
        ${backBtn}
        <h1 class="page-title">${title}</h1>
      </div>
      <div class="detail-layout">
        <div class="detail-image-wrap">
          <img src="${image.src}" alt="${image.alt || ''}" class="detail-img" draggable="false" />
        </div>
        <div class="detail-video-wrap">
          <div class="video-container" id="video-container">
            <div class="video-placeholder" id="video-placeholder">
              <div class="play-icon">▶</div>
              <p>Cliquez pour lancer la vidéo en plein écran</p>
            </div>
            <iframe 
              id="video-iframe"
              src="${embedUrl}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              style="display:none; width:100%; height:100%;"
            ></iframe>
          </div>
        </div>
      </div>
    `;

    this._setupVideoInteraction();
  }

  _renderLinkImage(container) {
    const { title, image, back } = this.pageData;
    const backBtn = back ? `<button class="back-btn" onclick="history.back()">← Retour</button>` : '';

    container.innerHTML = `
      <div class="page-header">
        ${backBtn}
        <h1 class="page-title">${title}</h1>
      </div>
      <div class="link-image-center">
        <a href="${image.link}" target="_blank" class="link-image-link">
          <img src="${image.src}" alt="${image.alt || ''}" class="link-img" draggable="false" />
          <div class="link-overlay">
            <span>👌 Pincer pour ouvrir</span>
          </div>
        </a>
      </div>
    `;
  }

  _setupVideoInteraction() {
    const placeholder = document.getElementById('video-placeholder');
    const iframe = document.getElementById('video-iframe');
    const container = document.getElementById('video-container');

    if (!placeholder || !iframe) return;

    const openVideo = () => {
      placeholder.style.display = 'none';
      iframe.style.display = 'block';

      // Tenter le plein écran
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      } else if (iframe.webkitRequestFullscreen) {
        iframe.webkitRequestFullscreen();
      }

      // Démarrer la lecture via postMessage YouTube API
      setTimeout(() => {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo' }), '*'
        );
      }, 500);
    };

    const closeVideo = () => {
      iframe.style.display = 'none';
      placeholder.style.display = 'flex';
      // Arrêter la vidéo
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'stopVideo' }), '*'
      );
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    };

    placeholder.addEventListener('click', openVideo);
    container.addEventListener('click', (e) => {
      if (iframe.style.display !== 'none' && e.target !== placeholder) closeVideo();
    });

    // Fermer si on sort du plein écran
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && iframe.style.display !== 'none') {
        closeVideo();
      }
    });

    this._openVideo = openVideo;
    this._closeVideo = closeVideo;
  }

  _extractYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // === Gestion des gestes ===

  _initGestures() {
    const video = document.getElementById('gesture-video');
    const canvas = document.getElementById('gesture-canvas');
    if (!video || !canvas) return;

    // Demander accès caméra
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        video.srcObject = stream;
        video.play();

        this.gestureEngine = new GestureEngine({
          videoElement: video,
          canvasElement: canvas,
          debug: false,

          onPinchRight: (x, y) => this._handlePinch(x, y),
          onZoom: (scale) => this._handleZoom(scale),
          onFist: () => this._handleFist(),
          onIndexMove: (normX, normY) => this._isIndexOnLink(normX, normY)
        });
      })
      .catch(err => {
        console.warn('[PageEngine] Caméra non disponible:', err);
        document.getElementById('gesture-status').textContent = '⚠ Caméra non disponible – Navigation par clic uniquement';
      });
  }

  _handlePinch(normX, normY) {
    // Coordonnées normalisées [0,1] → pixels écran
    const screenX = normX * window.innerWidth;
    const screenY = normY * window.innerHeight;

    // Flash visuel
    this._showPinchFlash(screenX, screenY);

    if (this.pageData.type === 'grid') {
      // Trouver l'image sous le pinch
      const items = document.querySelectorAll('.grid-item');
      items.forEach(item => {
        const rect = item.getBoundingClientRect();
        if (screenX >= rect.left && screenX <= rect.right &&
            screenY >= rect.top && screenY <= rect.bottom) {
          const link = item.dataset.link;
          if (link) {
            item.classList.add('pinch-activate');
            setTimeout(() => window.location.href = link, 300);
          }
        }
      });
    } else if (this.pageData.type === 'detail_video') {
      const placeholder = document.getElementById('video-placeholder');
      const iframe = document.getElementById('video-iframe');
      if (placeholder && placeholder.style.display !== 'none') {
        const rect = document.getElementById('video-container').getBoundingClientRect();
        if (screenX >= rect.left && screenX <= rect.right &&
            screenY >= rect.top && screenY <= rect.bottom) {
          if (this._openVideo) this._openVideo();
        }
      } else if (iframe && iframe.style.display !== 'none') {
        if (this._closeVideo) this._closeVideo();
      }
    } else if (this.pageData.type === 'link_image') {
      const imgEl = document.querySelector('.link-img');
      if (imgEl) {
        const rect = imgEl.getBoundingClientRect();
        if (screenX >= rect.left && screenX <= rect.right &&
            screenY >= rect.top && screenY <= rect.bottom) {
          window.open(this.pageData.image.link, '_blank');
        }
      }
    }
  }

  _handleZoom(scale) {
    this.currentZoom = scale;

    // Zoomer sur toutes les images de la page
    const targets = document.querySelectorAll('.grid-img, .detail-img, .link-img');
    targets.forEach(img => {
      img.style.transform = `scale(${scale})`;
      img.style.transition = 'transform 0.15s ease';
    });

    // Afficher l'indicateur de zoom
    const indicator = document.getElementById('zoom-indicator');
    if (indicator) {
      indicator.textContent = `🔍 ${Math.round(scale * 100)}%`;
      indicator.style.opacity = '1';
      clearTimeout(this._zoomHideTimer);
      this._zoomHideTimer = setTimeout(() => {
        indicator.style.opacity = '0';
      }, 1500);
    }
  }

  _isIndexOnLink(normX, normY) {
    // Coordonnées miroir corrigées (comme dans _updateCursor)
    const screenX = (1 - normX) * window.innerWidth;
    const screenY = normY * window.innerHeight;

    const type = this.pageData ? this.pageData.type : '';

    if (type === 'grid') {
      const items = document.querySelectorAll('.grid-item');
      for (const item of items) {
        const r = item.getBoundingClientRect();
        if (screenX >= r.left && screenX <= r.right && screenY >= r.top && screenY <= r.bottom)
          return true;
      }
    } else if (type === 'detail_video') {
      const vc = document.getElementById('video-container');
      if (vc) {
        const r = vc.getBoundingClientRect();
        if (screenX >= r.left && screenX <= r.right && screenY >= r.top && screenY <= r.bottom)
          return true;
      }
    } else if (type === 'link_image') {
      const img = document.querySelector('.link-img');
      if (img) {
        const r = img.getBoundingClientRect();
        if (screenX >= r.left && screenX <= r.right && screenY >= r.top && screenY <= r.bottom)
          return true;
      }
    }
    return false;
  }

  _handleFist() {
    if (window.history.length > 1) {
      // Animation retour
      document.body.classList.add('fist-exit');
      setTimeout(() => window.history.back(), 400);
    } else {
      window.location.href = 'index.html';
    }
  }

  _showPinchFlash(x, y) {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed; left: ${x-30}px; top: ${y-30}px;
      width: 60px; height: 60px; border-radius: 50%;
      border: 3px solid #00FF88; background: rgba(0,255,136,0.2);
      pointer-events: none; z-index: 9999;
      animation: pinch-flash 0.5s ease-out forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);
  }
}

window.PageEngine = PageEngine;
