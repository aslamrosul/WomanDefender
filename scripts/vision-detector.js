/**
 * ModestyShield AI / WomanDefender AI - Vision Perception Engine
 * Multi-Region Face & Female Perception:
 * Mendeteksi figur wanita di manapun posisinya dalam thumbnail:
 * - Wanita di sebelah kanan/kiri (seperti Ken & Grat, Dewi Pobo)
 * - Wanita di tengah (WandaVision, Kamar Mantan)
 * - Banyak orang/makanan di thumbnail
 * - Karakter wanita Anime/3D maupun Manusia Nyata
 */

class VisionDetector {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.sampleWidth = 160;
    this.sampleHeight = 160;
    this.canvas.width = this.sampleWidth;
    this.canvas.height = this.sampleHeight;

    // Dedicated Ultra-Fast Gatekeeper Canvas (48x48: ~0.005ms skin sampling)
    this.gateCanvas = document.createElement('canvas');
    this.gateCanvas.width = 48;
    this.gateCanvas.height = 48;
    this.gateCtx = this.gateCanvas.getContext('2d', { willReadFrequently: true });

    this.cache = new Map();

    // Inisialisasi Model Neural On-Device (TinyFace + Multitask Gender CNN)
    this.isModelLoaded = false;
    this.isModelLoading = false;
    this.initNeuralModel();
  }

  async initNeuralModel() {
    if (this.isModelLoaded || this.isModelLoading) return;
    if (typeof faceapi === 'undefined') return;

    this.isModelLoading = true;
    try {
      if (faceapi.tf) {
        try {
          await faceapi.tf.setBackend('webgl');
        } catch (e) {
          try {
            await faceapi.tf.setBackend('cpu');
          } catch (cpuErr) {}
        }
        await faceapi.tf.ready();
        console.log('⚡ [WomanDefender AI] Hardware Acceleration aktif:', faceapi.tf.getBackend());
      }

      const modelsUri = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
        ? chrome.runtime.getURL('models')
        : '../models';

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelsUri),
        faceapi.nets.ageGenderNet.loadFromUri(modelsUri)
      ]);

      this.isModelLoaded = true;
      console.log('✅ [WomanDefender AI] Vision AI Neural Head (TinyFace 320 + Multitask Gender) siap.');

      // Pre-warm WebGL shaders secara non-blocking agar scan pertama tidak ada jank
      setTimeout(async () => {
        try {
          const warmCanvas = document.createElement('canvas');
          warmCanvas.width = 64;
          warmCanvas.height = 64;
          await faceapi.detectAllFaces(warmCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })).withAgeAndGender();
        } catch (_) {}
      }, 100);
    } catch (err) {
      console.warn('⚠️ [WomanDefender AI] Model neural dalam proses/fallback ke heuristik:', err.message);
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Stage 1: Ultra-Fast Gatekeeper (< 0.1ms)
   * Memeriksa apakah gambar memuat manusia/kulit.
   * Konten game Minecraft, coding terminal, lanskap, dan logo langsung lolos dalam 0.05ms
   * tanpa membebani model neural AI!
   */
  quickGatekeeperCheck(source) {
    if (!source) return false;
    try {
      this.gateCtx.clearRect(0, 0, 48, 48);
      this.gateCtx.drawImage(source, 0, 0, 48, 48);
      const imgData = this.gateCtx.getImageData(0, 0, 48, 48);
      const pixels = imgData.data;

      let skinCount = 0;
      // Sampling 48x48 canvas dengan step 16 (576 piksel) berjalan instan dalam < 0.005ms
      for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;

        const isRealSkin = (yVal > 30 && cb >= 75 && cb <= 140 && cr >= 124 && cr <= 182) &&
                           (r > g && g >= b && (r - g) >= 6);
        const isAnimeSkin = (yVal > 105 && yVal < 248) &&
                            (r >= g && g >= b) &&
                            (r - b >= 6) && (r - b <= 80) &&
                            (cb >= 70 && cb <= 145 && cr >= 120 && cr <= 185);

        if (isRealSkin || isAnimeSkin) {
          skinCount++;
          if (skinCount >= 8) return true; // Terkonfirmasi figur manusia
        }
      }
      return false; // Bukan manusia / non-human (Game, Coding, Pemandangan, Logo)
    } catch (e) {
      return true; // Fallback aman ke Stage 2 jika error
    }
  }

  /**
   * Menganalisis frame visual menggunakan pemindaian multi-wilayah (Multi-Region)
   */
  analyzeVisualSource(source) {
    if (!source) return null;

    try {
      const width = source.videoWidth || source.naturalWidth || source.width;
      const height = source.videoHeight || source.naturalHeight || source.height;

      if (!width || !height) return null;

      this.ctx.clearRect(0, 0, this.sampleWidth, this.sampleHeight);
      this.ctx.drawImage(source, 0, 0, this.sampleWidth, this.sampleHeight);
      const imgData = this.ctx.getImageData(0, 0, this.sampleWidth, this.sampleHeight);
      const pixels = imgData.data;

      // Buat peta piksel kulit
      const skinGrid = new Uint8Array(this.sampleWidth * this.sampleHeight);
      let totalSkinPixels = 0;

      for (let y = 0; y < this.sampleHeight; y++) {
        for (let x = 0; x < this.sampleWidth; x++) {
          const idx = (y * this.sampleWidth + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];

          const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
          const cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;

          const isRealSkin = (yVal > 30 && cb >= 75 && cb <= 140 && cr >= 124 && cr <= 182) &&
                             (r > g && g >= b && (r - g) >= 6);

          const isAnimeSkin = (yVal > 105 && yVal < 248) &&
                              (r >= g && g >= b) &&
                              (r - b >= 6) && (r - b <= 80) &&
                              (cb >= 70 && cb <= 145 && cr >= 120 && cr <= 185);

          if (isRealSkin || isAnimeSkin) {
            skinGrid[y * this.sampleWidth + x] = 1;
            totalSkinPixels++;
          }
        }
      }

      // Jika tidak ada kulit sama sekali di seluruh gambar
      if (totalSkinPixels < 80) {
        return {
          hasDetectedFace: false,
          isFemale: false,
          femaleConfidence: 0.0,
          hairExposed: false,
          isProminentCurve: false,
          vulgarityScore: 0.0
        };
      }

      // 2. PEMINDAIAN MULTI-WILAYAH (Kiri, Tengah, Kanan, Penuh, & Portrait Top)
      // portrait_top memisahkan wajah & rambut dari tumpukan makanan/meja di bagian bawah (sangat krusial untuk Shorts & Mukbang)
      const regions = [
        { name: 'portrait_top', x1: 15, x2: 145, y1: 0,  y2: 105 },
        { name: 'center',       x1: 25, x2: 135, y1: 5,  y2: 135 },
        { name: 'full',         x1: 0,  x2: 160, y1: 0,  y2: 160 },
        { name: 'right',        x1: 65, x2: 160, y1: 5,  y2: 135 },
        { name: 'left',         x1: 0,  x2: 95,  y1: 5,  y2: 135 }
      ];

      let bestFemaleResult = null;

      for (const reg of regions) {
        const res = this.analyzeRegion(pixels, skinGrid, reg);
        if (res && res.hasDetectedFace) {
          if (!bestFemaleResult || res.femaleConfidence > bestFemaleResult.femaleConfidence) {
            bestFemaleResult = res;
          }
          if (res.isFemale) {
            // Langsung kembalikan jika wanita terkonfirmasi di salah satu wilayah
            return res;
          }
        }
      }

      return bestFemaleResult || {
        hasDetectedFace: false,
        isFemale: false,
        femaleConfidence: 0.1,
        hairExposed: false,
        isProminentCurve: false,
        vulgarityScore: 0.0
      };

    } catch (err) {
      return null;
    }
  }

  /**
   * Menganalisis satu wilayah spesifik (Region)
   */
  analyzeRegion(pixels, skinGrid, reg) {
    let minX = reg.x2, maxX = reg.x1;
    let minY = reg.y2, maxY = reg.y1;
    let regSkinPixels = 0;
    let blushPixels = 0;

    for (let y = reg.y1; y < reg.y2; y++) {
      for (let x = reg.x1; x < reg.x2; x++) {
        if (skinGrid[y * this.sampleWidth + x] === 1) {
          regSkinPixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          const idx = (y * this.sampleWidth + x) * 4;
          const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
          if (r > 130 && r > g * 1.18 && r > b * 1.18) {
            blushPixels++;
          }
        }
      }
    }

    if (regSkinPixels < 70) return null;

    const boxW = Math.max(1, maxX - minX);
    const boxH = Math.max(1, maxY - minY);
    const aspect = boxH / boxW;

    // Rasio wajah manusia lokal (0.55 - 2.6)
    if (aspect < 0.55 || aspect > 2.6) return null;

    // Kepadatan klaster lokal
    const density = regSkinPixels / (boxW * boxH);
    if (density < 0.18) return null;

    // Verifikasi fitur wajah (harus ada mata / alis / kontras gelap, bukan ring gulat atau banner neon polos)
    let eyeFeaturePixels = 0;
    const eyeY1 = Math.floor(minY + boxH * 0.15);
    const eyeY2 = Math.floor(minY + boxH * 0.55);
    const eyeX1 = minX + Math.floor(boxW * 0.15);
    const eyeX2 = maxX - Math.floor(boxW * 0.15);

    for (let y = eyeY1; y < eyeY2; y++) {
      for (let x = eyeX1; x < eyeX2; x++) {
        const idx = (y * this.sampleWidth + x) * 4;
        const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < 95) {
          eyeFeaturePixels++;
        }
      }
    }

    if (eyeFeaturePixels < 6) {
      // Objek polos tanpa mata/alis (misal: kanvas ring gulat, meja, atau banner neon)
      return null;
    }

    // Analisis Rambut Sekitar Wajah Lokal
    let sideHair = 0;
    let topHair = 0;
    let maleBeard = 0;
    let feminineLip = 0;

    const scanY1 = Math.max(0, minY - 25);
    const scanY2 = Math.min(this.sampleHeight, maxY + 25);
    const scanX1 = Math.max(0, minX - 25);
    const scanX2 = Math.min(this.sampleWidth, maxX + 25);

    for (let y = scanY1; y < scanY2; y++) {
      for (let x = scanX1; x < scanX2; x++) {
        const idx = (y * this.sampleWidth + x) * 4;
        const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];

        const isDarkHair = (r < 75 && g < 70 && b < 70);
        const isBrownHair = (r >= 65 && r <= 190 && g >= 40 && g <= 145 && b <= 135 && r > b);
        const isBlondeHair = (r >= 130 && g >= 100 && r >= g && g > b && (r - b) >= 15);
        const isRedHair = (r > 130 && (r - g) > 25 && (r - b) > 30);
        const isDyedHair = (b > 115 && b > r * 1.1) || (r > 130 && b > 110 && g < 110);

        const isHair = isDarkHair || isBrownHair || isBlondeHair || isRedHair || isDyedHair;

        // Rambut di samping wajah (ciri khas wanita)
        if ((x < minX || x > maxX) && y > minY && y < maxY && isHair) {
          sideHair++;
        }

        // Rambut di atas dahi
        if (y < minY + (boxH * 0.30) && isHair) {
          topHair++;
        }

        // Ciri pria (jenggot di dagu) vs bibir feminin (lipstik/bibir cerah)
        if (y > minY + (boxH * 0.65) && y < maxY && x > minX + (boxW * 0.20) && x < maxX - (boxW * 0.20)) {
          if (isDarkHair && (Math.abs(r - g) < 6)) {
            maleBeard++;
          }
          if (r > 120 && r > g * 1.18 && r > b * 1.18) {
            feminineLip++;
          }
        }
      }
    }

    const sideHairRatio = sideHair / (boxH * 20 + 1);
    const topHairRatio = topHair / (boxW * 20 + 1);
    const isLongHair = sideHairRatio > 0.10;
    const hasHair = topHairRatio > 0.10 || isLongHair;

    // Deteksi ciri pria (rambut pendek tanpa riasan, jenggot/kumis)
    const isShortHair = sideHairRatio < 0.06;
    const hasMasculineFeatures = (maleBeard > 20) || (isShortHair && feminineLip < 4 && blushPixels < 6);
    const isMale = hasMasculineFeatures && !isLongHair;

    let femaleConfidence = 0.10;
    if (isLongHair) femaleConfidence += 0.45;
    if (feminineLip > 4) femaleConfidence += 0.25;
    if (blushPixels > 8) femaleConfidence += 0.30;

    // Analisis Lekuk Tubuh di Bawah Wajah
    let torsoBulge = 0;
    const torsoY1 = Math.min(this.sampleHeight, maxY);
    const torsoY2 = Math.min(this.sampleHeight, maxY + 50);

    let leftB = [], rightB = [];
    let chestSkin = 0;

    for (let y = torsoY1; y < torsoY2; y++) {
      let rMin = this.sampleWidth, rMax = 0;
      for (let x = Math.max(0, minX - 20); x < Math.min(this.sampleWidth, maxX + 20); x++) {
        const idx = (y * this.sampleWidth + x) * 4;
        const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];

        if (skinGrid[y * this.sampleWidth + x] === 1) chestSkin++;
        if ((r + g + b) < 720) {
          if (x < rMin) rMin = x;
          if (x > rMax) rMax = x;
        }
      }
      if (rMax > rMin) {
        leftB.push(rMin);
        rightB.push(rMax);
      }
    }

    if (leftB.length > 5) {
      const span = Math.max(...rightB) - Math.min(...leftB);
      if (span > boxW * 1.30) {
        torsoBulge = Math.min(1.0, (span / (boxW * 1.30)) * 0.55);
      }
    }

    const chestArea = (torsoY2 - torsoY1) * (boxW + 20);
    const vulgarityScore = chestArea > 0 && chestSkin > chestArea * 0.22 ? 0.65 : 0.0;

    const hasDetectedFace = boxW > 10 && boxH > 10;
    
    // Lekuk tubuh menonjol HANYA berlaku untuk wanita (bukan bahu lebar pria)
    let isProminentCurve = false;
    if (!isMale) {
      if (vulgarityScore > 0.20 || (torsoBulge > 0.35 && (feminineLip > 3 || blushPixels > 5 || isLongHair))) {
        isProminentCurve = true;
        femaleConfidence = Math.max(femaleConfidence, 0.70);
      }
    }

    if (isMale) {
      femaleConfidence = Math.min(femaleConfidence, 0.10);
    }

    femaleConfidence = Math.max(0.0, Math.min(1.0, femaleConfidence));

    // Figur wanita: Terdeteksi wajah, BUKAN pria, dan confidence memadai atau lekuk menonjol
    const isFemale = hasDetectedFace && !isMale && (femaleConfidence >= 0.48 || isProminentCurve);

    return {
      hasDetectedFace,
      isFemale,
      femaleConfidence: Number(femaleConfidence.toFixed(2)),
      hairExposed: hasHair,
      isProminentCurve,
      vulgarityScore,
      timestamp: Date.now()
    };
  }

  async analyzeWithNeuralModel(source) {
    if (!this.isModelLoaded || typeof faceapi === 'undefined') return null;

    try {
      // Optimasi performa: Jika memindai video bergerak, gunakan 224px (super cepat ~40ms, hemat CPU).
      // Untuk gambar thumbnail, gunakan 320px (sweet spot: 4x lebih cepat dari 416px, deteksi sangat akurat).
      const isVideo = (source.tagName === 'VIDEO') || (typeof source.videoWidth === 'number' && source.videoWidth > 0);
      const inputSize = isVideo ? 224 : 320;
      const scoreThreshold = isVideo ? 0.28 : 0.20;
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
      const detections = await faceapi.detectAllFaces(source, options).withAgeAndGender();

      if (!detections || detections.length === 0) {
        return null;
      }

      let hasFemale = false;
      let maxFemaleConfidence = 0.0;
      let allMale = true;

      for (const det of detections) {
        if (det.gender === 'female' && det.genderProbability >= 0.48) {
          hasFemale = true;
          maxFemaleConfidence = Math.max(maxFemaleConfidence, det.genderProbability);
          allMale = false;
        } else if (det.gender === 'male') {
          if (det.genderProbability < 0.58) {
            allMale = false;
          }
        }
      }

      if (hasFemale) {
        return {
          hasDetectedFace: true,
          isFemale: true,
          femaleConfidence: Number(maxFemaleConfidence.toFixed(2)),
          hairExposed: true,
          isProminentCurve: false,
          vulgarityScore: 0.0,
          modelUsed: 'WomanDefender Neural Vision AI (TinyFace 320 + Gender CNN)',
          timestamp: Date.now()
        };
      }

      if (allMale) {
        // Cek apakah ada lekuk tubuh wanita/vulgaritas di thumbnail sebelum konfirmasi pria
        const heuristicCheck = this.analyzeVisualSource(source);
        if (heuristicCheck && (heuristicCheck.vulgarityScore > 0.20 || heuristicCheck.isProminentCurve)) {
          return {
            hasDetectedFace: true,
            isFemale: true,
            femaleConfidence: 0.85,
            hairExposed: true,
            isProminentCurve: true,
            vulgarityScore: heuristicCheck.vulgarityScore,
            modelUsed: 'WomanDefender Vision Analyzer (Female Curves Detected)',
            timestamp: Date.now()
          };
        }

        return {
          hasDetectedFace: true,
          isFemale: false,
          femaleConfidence: 0.01,
          isMaleConfirmed: true,
          hairExposed: false,
          isProminentCurve: false,
          vulgarityScore: 0.0,
          modelUsed: 'WomanDefender Neural Vision AI (Pria Terkonfirmasi)',
          timestamp: Date.now()
        };
      }

      return null;
    } catch (err) {
      return null;
    }
  }

  async analyzeVisualSourceAsync(source) {
    // STAGE 1: ULTRA-FAST GATEKEEPER (< 0.1ms)
    // Jika frame video bukan figur manusia, lewati seketika tanpa membebani model AI neural
    if (!this.quickGatekeeperCheck(source)) {
      return {
        hasDetectedFace: false,
        isFemale: false,
        femaleConfidence: 0.0,
        hairExposed: false,
        isProminentCurve: false,
        vulgarityScore: 0.0,
        isNonHuman: true,
        timestamp: Date.now()
      };
    }

    if (this.isModelLoaded && typeof faceapi !== 'undefined') {
      const neuralRes = await this.analyzeWithNeuralModel(source);
      if (neuralRes) return neuralRes;

      // Jika model neural aktif namun tidak menemukan wajah (misal game atau busana minim tanpa wajah)
      const heuristicRes = this.analyzeVisualSource(source);
      if (heuristicRes && (heuristicRes.vulgarityScore > 0.25 || heuristicRes.isProminentCurve)) {
        return heuristicRes;
      }
      return {
        hasDetectedFace: false,
        isFemale: false,
        femaleConfidence: 0.0,
        hairExposed: false,
        isProminentCurve: false,
        vulgarityScore: 0.0
      };
    }
    return this.analyzeVisualSource(source);
  }

  async analyzeThumbnailElement(img, customSettings = {}) {
    if (!img) return null;

    let src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:image/gif') || src.startsWith('data:image/svg')) {
      src = img.getAttribute('src') || '';
    }

    if (!src || !src.startsWith('http')) return null;

    const cleanUrl = src.split('?')[0];
    if (this.cache.has(cleanUrl)) {
      return this.cache.get(cleanUrl);
    }

    try {
      // 1. Direct Zero-IPC Image Loading via Browser Cache & CORS (Instant ~0ms)
      let cleanImg = new Image();
      cleanImg.crossOrigin = 'anonymous';
      let loadedDirectly = await new Promise((resolve) => {
        cleanImg.onload = () => resolve(true);
        cleanImg.onerror = () => resolve(false);
        cleanImg.src = src;
      });

      // 2. Fallback aman ke Background Service Worker jika host menolak direct CORS
      if (!loadedDirectly) {
        if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
          return null;
        }

        const response = await chrome.runtime.sendMessage({
          type: 'FETCH_IMAGE_DATA_URL',
          url: src
        }).catch(() => null);

        if (!response || !response.success || !response.dataUrl) {
          return null;
        }

        cleanImg = new Image();
        await new Promise((resolve, reject) => {
          cleanImg.onload = resolve;
          cleanImg.onerror = reject;
          cleanImg.src = response.dataUrl;
        });
      }

      // STAGE 1: ULTRA-FAST GATEKEEPER (< 0.01ms)
      // Cek cepat apakah thumbnail memuat manusia/kulit. Jika bukan manusia (game, coding, mobil, logo, pemandangan),
      // langsung lolos seketika tanpa menyentuh model AI neural!
      const isHuman = this.quickGatekeeperCheck(cleanImg);
      if (!isHuman) {
        const safeRes = {
          hasDetectedFace: false,
          isFemale: false,
          femaleConfidence: 0.0,
          hairExposed: false,
          isProminentCurve: false,
          vulgarityScore: 0.0,
          isNonHuman: true,
          timestamp: Date.now()
        };
        this.cache.set(cleanUrl, safeRes);
        return safeRes;
      }

      // STAGE 2-A: EVALUASI MENGGUNAKAN CLOUDFLARE CLEF-FLASH (JIKA DIAKTIFKAN USER)
      if (customSettings?.aiEngine === 'clef_flash' && customSettings.cfAccountId && customSettings.cfApiToken) {
        try {
          // Render ke canvas kecil (maks 400x400) agar transmisi payload cepat dan hemat token
          const tempCanvas = document.createElement('canvas');
          const maxDim = 400;
          let tw = cleanImg.naturalWidth || cleanImg.width || 320;
          let th = cleanImg.naturalHeight || cleanImg.height || 180;
          if (tw > maxDim || th > maxDim) {
            const ratio = Math.min(maxDim / tw, maxDim / th);
            tw = Math.round(tw * ratio);
            th = Math.round(th * ratio);
          }
          tempCanvas.width = tw;
          tempCanvas.height = th;
          const tctx = tempCanvas.getContext('2d');
          tctx.drawImage(cleanImg, 0, 0, tw, th);
          const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.82);

          const cfRes = await chrome.runtime.sendMessage({
            type: 'ANALYZE_IMAGE_WITH_CLEF',
            dataUrl: dataUrl,
            accountId: customSettings.cfAccountId,
            apiToken: customSettings.cfApiToken
          }).catch(() => null);

          if (cfRes && cfRes.success) {
            const clefResult = {
              hasDetectedFace: true,
              isFemale: cfRes.isFemale,
              femaleConfidence: cfRes.confidence,
              hairExposed: cfRes.isFemale,
              isProminentCurve: false,
              vulgarityScore: cfRes.isFemale ? 0.9 : 0.0,
              modelUsed: 'Cloudflare Clef-flash (9B Decision Model)',
              timestamp: Date.now()
            };
            this.cache.set(cleanUrl, clefResult);
            return clefResult;
          } else {
            console.warn('⚠️ [WomanDefender] Clef-flash API warning, fallback ke model lokal:', cfRes?.error);
          }
        } catch (clefErr) {
          console.warn('⚠️ [WomanDefender] Gagal memanggil Clef-flash, fallback ke lokal:', clefErr);
        }
      }

      // STAGE 2-B: EVALUASI DENGAN MODEL NEURAL ON-DEVICE (WebGL TinyFace 320 + Gender CNN)
      if (this.isModelLoaded && typeof faceapi !== 'undefined') {
        const neuralResult = await this.analyzeWithNeuralModel(cleanImg);
        if (neuralResult) {
          this.cache.set(cleanUrl, neuralResult);
          return neuralResult;
        }

        // Jika neural tidak mendeteksi wajah, periksa apakah ada lekuk tubuh terbuka/vulgar
        const heuristic = this.analyzeVisualSource(cleanImg);
        if (heuristic && (heuristic.vulgarityScore > 0.25 || heuristic.isProminentCurve)) {
          this.cache.set(cleanUrl, heuristic);
          return heuristic;
        }

        const safeRes = {
          hasDetectedFace: false,
          isFemale: false,
          femaleConfidence: 0.0,
          hairExposed: false,
          isProminentCurve: false,
          vulgarityScore: 0.0
        };
        this.cache.set(cleanUrl, safeRes);
        return safeRes;
      }

      // 2. EVALUASI HEURISTIK MULTI-REGION VISION (FALLBACK JIKA NEURAL BELUM LOADED)
      const result = this.analyzeVisualSource(cleanImg);
      if (result) {
        this.cache.set(cleanUrl, result);
        if (this.cache.size > 250) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }
      return result;
    } catch (e) {
      return null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.VisionDetector = VisionDetector;
}
