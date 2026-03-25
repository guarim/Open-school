/**
 * gesture-engine.js
 * Moteur de détection de gestes MediaPipe Hands pour le Lycée Jules Verne
 * Gestes supportés :
 *   - Pinch main droite (pouce + index) sur une image → ouvrir le lien
 *   - Double pinch (deux mains) + écartement → zoom in
 *   - Double pinch + rapprochement → zoom out / reset
 *   - Poing fermé → retour page précédente
 *   - Curseur index : suit l'extrémité de l'index droit en temps réel
 *     Rouge = pas sur lien, Vert = survol d'une image cliquable
 */

class GestureEngine {
  constructor(options = {}) {
    this.options = {
      videoElement: null,
      canvasElement: null,
      onPinchRight: null,      // callback(x, y) pinch main droite
      onZoom: null,            // callback(scale) zoom deux mains
      onFist: null,            // callback() poing fermé
      onIndexMove: null,       // callback(normX, normY) position index droit
      debug: false,
      ...options
    };

    // Curseur plein écran (div DOM superposée à la page)
    this._cursor = null;
    this._createCursor();

    this.hands = null;
    this.camera = null;
    this.lastPinchState = { left: false, right: false };
    this.lastBothPinch = false;
    this.lastTwoHandDist = null;
    this.currentZoom = 1.0;
    this.zoomTarget = null;
    this.fistCooldown = false;
    this.pinchCooldown = false;
    this._cursorOnLink = false;

    // Seuils
    this.PINCH_THRESHOLD = 0.06;       // distance normalisée pouce-index pour pinch
    this.FIST_THRESHOLD = 0.08;        // seuil pour poing fermé
    this.ZOOM_SENSITIVITY = 3.0;       // sensibilité du zoom

    this._init();
  }

  /* ---- Curseur plein écran ---- */
  _createCursor() {
    const el = document.createElement('div');
    el.id = 'hand-cursor';
    el.style.cssText = `
      position: fixed;
      width: 28px; height: 28px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ff6060, #cc0000);
      border: 3px solid rgba(255,255,255,0.85);
      box-shadow: 0 0 12px 4px rgba(220,0,0,0.55), 0 2px 8px rgba(0,0,0,0.5);
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.06s linear;
      display: none;
    `;
    document.body.appendChild(el);
    this._cursor = el;
  }

  _updateCursor(normX, normY, onLink, isPinching) {
    if (!this._cursor) return;
    // MediaPipe renvoie des coordonnées miroir → inverser X
    const screenX = (1 - normX) * window.innerWidth;
    const screenY = normY * window.innerHeight;

    this._cursor.style.left = screenX + 'px';
    this._cursor.style.top  = screenY + 'px';
    this._cursor.style.display = 'block';

    if (isPinching) {
      // Pinch : cercle doré agrandi
      this._cursor.style.background = 'radial-gradient(circle at 35% 35%, #ffe066, #e8a020)';
      this._cursor.style.boxShadow   = '0 0 20px 8px rgba(232,160,32,0.7), 0 2px 8px rgba(0,0,0,0.5)';
      this._cursor.style.transform   = 'translate(-50%, -50%) scale(1.5)';
    } else if (onLink) {
      // Sur un lien : vert
      this._cursor.style.background = 'radial-gradient(circle at 35% 35%, #66ff99, #00cc55)';
      this._cursor.style.boxShadow   = '0 0 14px 5px rgba(0,220,80,0.6), 0 2px 8px rgba(0,0,0,0.5)';
      this._cursor.style.transform   = 'translate(-50%, -50%) scale(1.15)';
    } else {
      // Défaut : rouge
      this._cursor.style.background = 'radial-gradient(circle at 35% 35%, #ff6060, #cc0000)';
      this._cursor.style.boxShadow   = '0 0 12px 4px rgba(220,0,0,0.55), 0 2px 8px rgba(0,0,0,0.5)';
      this._cursor.style.transform   = 'translate(-50%, -50%) scale(1)';
    }
  }

  _hideCursor() {
    if (this._cursor) this._cursor.style.display = 'none';
  }

  async _init() {
    if (!this.options.videoElement || !this.options.canvasElement) {
      console.warn('[GestureEngine] Éléments vidéo/canvas non fournis');
      return;
    }

    try {
      // Charger MediaPipe Hands
      const { Hands, HAND_CONNECTIONS } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js'
      ).catch(() => window.mpHands);

      this.HAND_CONNECTIONS = HAND_CONNECTIONS;

      this.hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6
      });

      this.hands.onResults((results) => this._onResults(results));

      // Démarrer la caméra
      const { Camera } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js'
      ).catch(() => window.mpCameraUtils);

      this.camera = new Camera(this.options.videoElement, {
        onFrame: async () => {
          await this.hands.send({ image: this.options.videoElement });
        },
        width: 640,
        height: 480
      });

      this.camera.start();
      console.log('[GestureEngine] Initialisé avec MediaPipe Hands');
    } catch (err) {
      console.error('[GestureEngine] Erreur initialisation:', err);
    }
  }

  _distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  _isPinch(landmarks) {
    const thumb = landmarks[4];
    const index = landmarks[8];
    return this._distance(thumb, index) < this.PINCH_THRESHOLD;
  }

  _isFist(landmarks) {
    // Vérifier que les 4 doigts sont repliés (tips proches de la paume)
    const palm = landmarks[0];
    const tips = [8, 12, 16, 20];
    const bases = [5, 9, 13, 17];
    let fistCount = 0;
    for (let i = 0; i < tips.length; i++) {
      const tipToPalm = this._distance(landmarks[tips[i]], palm);
      const baseToPalm = this._distance(landmarks[bases[i]], palm);
      if (tipToPalm < baseToPalm * 1.1) fistCount++;
    }
    return fistCount >= 3;
  }

  _getPinchCenter(landmarks) {
    const thumb = landmarks[4];
    const index = landmarks[8];
    return {
      x: (thumb.x + index.x) / 2,
      y: (thumb.y + index.y) / 2
    };
  }

  _onResults(results) {
    const canvas = this.options.canvasElement;
    const ctx = canvas ? canvas.getContext('2d') : null;

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.lastBothPinch = false;
      this.lastTwoHandDist = null;
      this._hideCursor();
      return;
    }

    const hands = results.multiHandLandmarks;
    const handedness = results.multiHandedness;

    let leftHand = null, rightHand = null;

    handedness.forEach((h, i) => {
      // MediaPipe inverse gauche/droite (miroir)
      if (h.label === 'Left') rightHand = hands[i];
      else leftHand = hands[i];
    });

    // === Curseur index droit (landmark 8 = tip de l'index) ===
    if (rightHand) {
      const indexTip = rightHand[8];
      const isPinching = this._isPinch(rightHand);
      // Notifier page-engine pour la détection hover
      if (this.options.onIndexMove) {
        this._cursorOnLink = this.options.onIndexMove(indexTip.x, indexTip.y);
      }
      this._updateCursor(indexTip.x, indexTip.y, this._cursorOnLink, isPinching);
    } else {
      this._hideCursor();
    }

    // Dessiner les mains en debug
    if (ctx && this.options.debug) {
      hands.forEach((lm) => this._drawHand(ctx, lm, canvas));
    }

    // === Geste : POING FERMÉ (retour) ===
    const rightFist = rightHand && this._isFist(rightHand);
    const leftFist = leftHand && this._isFist(leftHand);

    if ((rightFist || leftFist) && !this.fistCooldown) {
      this.fistCooldown = true;
      setTimeout(() => { this.fistCooldown = false; }, 2000);
      if (this.options.onFist) this.options.onFist();
      return; // Ne pas traiter les autres gestes en même temps
    }

    const rightPinch = rightHand && this._isPinch(rightHand);
    const leftPinch = leftHand && this._isPinch(leftHand);

    // === Geste : DOUBLE PINCH (zoom deux mains) ===
    if (rightPinch && leftPinch) {
      const rightCenter = this._getPinchCenter(rightHand);
      const leftCenter = this._getPinchCenter(leftHand);
      const dist = this._distance(rightCenter, leftCenter);

      if (this.lastTwoHandDist !== null) {
        const delta = dist - this.lastTwoHandDist;
        const newZoom = Math.max(1.0, Math.min(5.0, this.currentZoom + delta * this.ZOOM_SENSITIVITY));
        if (Math.abs(newZoom - this.currentZoom) > 0.01) {
          this.currentZoom = newZoom;
          if (this.options.onZoom) this.options.onZoom(this.currentZoom);
        }
      }

      this.lastTwoHandDist = dist;
      this.lastBothPinch = true;

      // Indicateur visuel zoom
      if (ctx) this._drawZoomIndicator(ctx, rightCenter, leftCenter, canvas);
      return;
    }

    // Reset zoom state si on lâche
    if (!rightPinch || !leftPinch) {
      if (this.lastBothPinch && this.currentZoom > 1.05) {
        // On garde le zoom actuel jusqu'au prochain reset
      }
      this.lastTwoHandDist = null;
      this.lastBothPinch = false;
    }

    // === Geste : PINCH MAIN DROITE (clic sur image) ===
    if (rightPinch && !leftPinch && !this.pinchCooldown) {
      const center = this._getPinchCenter(rightHand);
      this.pinchCooldown = true;
      setTimeout(() => { this.pinchCooldown = false; }, 1000);
      if (this.options.onPinchRight) this.options.onPinchRight(center.x, center.y);

      if (ctx) this._drawPinchIndicator(ctx, center, canvas, '#00FF88');
    }

    // Indicateur pinch gauche (info seulement)
    if (leftPinch && ctx) {
      const center = this._getPinchCenter(leftHand);
      this._drawPinchIndicator(ctx, center, canvas, '#FF8800');
    }
  }

  _drawHand(ctx, landmarks, canvas) {
    ctx.fillStyle = 'rgba(0, 255, 136, 0.8)';
    landmarks.forEach(lm => {
      ctx.beginPath();
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _drawPinchIndicator(ctx, center, canvas, color) {
    const x = center.x * canvas.width;
    const y = center.y * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = color + '44';
    ctx.fill();
  }

  _drawZoomIndicator(ctx, a, b, canvas) {
    const ax = a.x * canvas.width, ay = a.y * canvas.height;
    const bx = b.x * canvas.width, by = b.y * canvas.height;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    this._drawPinchIndicator(ctx, a, canvas, '#FFD700');
    this._drawPinchIndicator(ctx, b, canvas, '#FFD700');
  }

  resetZoom() {
    this.currentZoom = 1.0;
    if (this.options.onZoom) this.options.onZoom(1.0);
  }

  destroy() {
    if (this.camera) this.camera.stop();
    if (this.hands) this.hands.close();
  }
}

window.GestureEngine = GestureEngine;
