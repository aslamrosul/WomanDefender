/**
 * ModestyShield AI / WomanDefender AI - Content Script
 * Menghubungkan VisionDetector, DecisionEngine, dan DOM YouTube.
 * Mendeteksi video player dan seluruh thumbnail: Home, Search Results, dan Rak Shorts.
 */

(function () {
  'use strict';

  let settings = {
    enabled: true,
    strictness: 'all_female',
    coverStyle: 'blur',
    autoMute: true,
    autoScrollShorts: false,
    filterText: false,
    peekDuration: 5,
    decisionModel: 'julia1_hybrid'
  };

  let visionDetector = null;
  let decisionEngine = null;
  let videoCheckInterval = null;
  let isCurrentlyPeeking = false;
  let peekTimeout = null;
  let sessionWhitelistedVideos = new Set();
  let wasMutedByShield = false;

  // State untuk Anti-Lag & Smooth 60 FPS Scrolling
  let isUserScrolling = false;
  let scrollStopTimer = null;

  // State untuk Fitur Auto Scroll Shorts
  let hasAutoScrolledCurrentShort = false;
  let lastShortVideoId = '';
  let lastActiveReelElement = null;

  const SHIELD_SVG = `
    <svg viewBox="0 0 24 24">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
  `;

  async function init() {
    try {
      const stored = await chrome.storage.local.get([
        'enabled',
        'strictness',
        'coverStyle',
        'autoMute',
        'autoScrollShorts',
        'filterText',
        'peekDuration',
        'decisionModel'
      ]);

      settings = { ...settings, ...stored };

      visionDetector = new window.VisionDetector();
      decisionEngine = new window.DecisionEngine({
        strictness: settings.strictness,
        modelType: settings.decisionModel,
        filterText: settings.filterText
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          let reScanNeeded = false;
          for (const [key, change] of Object.entries(changes)) {
            settings[key] = change.newValue;
            if (key === 'autoScrollShorts') {
              updateShortsAutoScrollButtonUI();
            }
            if (key === 'strictness' || key === 'decisionModel' || key === 'enabled' || key === 'filterText') {
              reScanNeeded = true;
            }
          }
          if (decisionEngine) {
            decisionEngine.updateConfig({
              strictness: settings.strictness,
              modelType: settings.decisionModel,
              filterText: settings.filterText
            });
          }
          if (!settings.enabled) {
            removeVideoShield();
            unblurAllThumbnails();
          } else if (reScanNeeded) {
            unblurAllThumbnails();
            scanThumbnailsBatch();
          }
        }
      });

      window.addEventListener('yt-navigate-finish', handlePageNavigation);
      window.addEventListener('yt-page-data-updated', handlePageNavigation);
      window.addEventListener('popstate', handlePageNavigation);

      // Anti-Lag Scroll Engine: Hentikan pemindaian AI saat user aktif scroll.
      // Scan HANYA dimulai saat user berhenti scroll (smooth 60/120 FPS tanpa hambatan!)
      window.addEventListener('scroll', () => {
        isUserScrolling = true;
        clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(() => {
          isUserScrolling = false;
          scanThumbnailsBatch();
        }, 180);
      }, { passive: true });

      setupVideoMonitoring();
      setupThumbnailObserver();
      setupShortsAutoScroll();

      setTimeout(scanThumbnailsBatch, 200);
      setTimeout(scanThumbnailsBatch, 700);
      setTimeout(scanThumbnailsBatch, 1500);

    } catch (err) {
      console.error('Inisialisasi WomanDefender gagal:', err);
    }
  }

  function throttle(func, limit) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  function handlePageNavigation() {
    isCurrentlyPeeking = false;
    clearTimeout(peekTimeout);
    hasAutoScrolledCurrentShort = false;
    lastShortVideoId = '';
    lastActiveReelElement = null;

    setupVideoMonitoring();
    setupShortsAutoScroll();

    setTimeout(scanThumbnailsBatch, 200);
    setTimeout(scanThumbnailsBatch, 600);
    setTimeout(scanThumbnailsBatch, 1200);
    setTimeout(scanThumbnailsBatch, 2200);
  }

  /**
   * ========================================================
   * 1. PENANGANAN PEMUTAR VIDEO (HTML5 VIDEO PLAYER)
   * ========================================================
   */
  function setupVideoMonitoring() {
    if (videoCheckInterval) {
      clearInterval(videoCheckInterval);
      videoCheckInterval = null;
    }
    videoCheckInterval = setInterval(checkCurrentVideoFrame, 2500);
  }

  function getVideoElement() {
    // 1. Jika di Shorts: Cari video yang sedang PLAYING atau di dalam reel aktif
    if (window.location.pathname.startsWith('/shorts/')) {
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]');
      if (activeReel) {
        const v = activeReel.querySelector('video');
        if (v) return v;
      }
      const shortsVideos = document.querySelectorAll('ytd-shorts video, ytd-reel-video-renderer video, video');
      for (const v of shortsVideos) {
        if (!v.paused && v.readyState >= 2) return v;
      }
    }

    // 2. Video reguler YouTube
    const mainVid = document.querySelector('video.html5-main-video');
    if (mainVid && !mainVid.closest('ytd-reel-video-renderer:not([is-active])')) {
      return mainVid;
    }
    return document.querySelector('video');
  }

  function getVideoContainer(video) {
    if (!video) video = getVideoElement();

    // 1. Jika di Shorts: Kaitkan ke reel aktif atau player-container
    if (window.location.pathname.startsWith('/shorts/')) {
      if (video) {
        const reel = video.closest('ytd-reel-video-renderer') ||
                     document.querySelector('ytd-reel-video-renderer[is-active]');
        if (reel) {
          const playerCont = reel.querySelector('#player-container, .player-container, .html5-video-player');
          if (playerCont) return playerCont;
          return video.parentElement || reel;
        }
        return video.parentElement;
      }
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (activeReel) {
        return activeReel.querySelector('#player-container, .player-container, .html5-video-player') || activeReel;
      }
    }

    // 2. Video reguler YouTube
    return document.querySelector('#movie_player') ||
           document.querySelector('.html5-video-player') ||
           document.querySelector('ytd-player') ||
           (video ? video.parentElement : null);
  }

  function getCurrentVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('v')) return urlParams.get('v');
    if (window.location.pathname.startsWith('/shorts/')) {
      return window.location.pathname.split('/shorts/')[1].split('/')[0];
    }
    return window.location.href;
  }

  function getMetadata() {
    let titleText = '';
    let channelText = '';

    if (window.location.pathname.startsWith('/shorts/')) {
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]');
      if (activeReel) {
        const titleEl = activeReel.querySelector('h2.title, #title h2, .ytd-reel-player-header-renderer h2, [id*="title"], h3');
        if (titleEl) titleText = titleEl.textContent.trim();

        const channelEl = activeReel.querySelector('#channel-name, .ytd-reel-channel-bar-renderer #channel-name, ytd-channel-name, [class*="channel-name"]');
        if (channelEl) channelText = channelEl.textContent.trim();
      }
    }

    if (!titleText) {
      const titleEl = document.querySelector('#title h1 yt-formatted-string, h1.ytd-watch-metadata, .ytd-reel-player-header-renderer #title, h1');
      titleText = titleEl ? titleEl.textContent.trim() : document.title;
    }

    if (!channelText) {
      const channelEl = document.querySelector('#channel-name, #owner #text, .ytd-reel-channel-bar-renderer #channel-name');
      channelText = channelEl ? channelEl.textContent.trim() : '';
    }

    return {
      title: titleText,
      channel: channelText,
      isShorts: window.location.pathname.startsWith('/shorts/')
    };
  }

  let isCheckingVideoFrame = false;

  async function checkCurrentVideoFrame() {
    if (!settings.enabled || isCurrentlyPeeking || isCheckingVideoFrame || isUserScrolling || typeof chrome === 'undefined' || !chrome.runtime?.id) return;

    const video = getVideoElement();
    const videoId = getCurrentVideoId();

    if (window.location.pathname.startsWith('/shorts/')) {
      const currentActiveReel = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]');

      // Deteksi pergantian reel/video Short: reset state scrolling & posisikan ulang tombol
      if ((videoId && videoId !== lastShortVideoId) || (currentActiveReel && currentActiveReel !== lastActiveReelElement)) {
        lastShortVideoId = videoId || '';
        lastActiveReelElement = currentActiveReel;
        hasAutoScrolledCurrentShort = false;
        renderShortsAutoScrollButton();
      }

      if (video) {
        bindShortsVideoEvents(video);

        // Auto-Scroll Shorts jika video selesai atau terdeteksi looping berulang
        if (settings.autoScrollShorts && !hasAutoScrolledCurrentShort && !isCurrentlyPeeking) {
          const dur = video.duration;
          const cur = video.currentTime;
          if (dur && dur > 0) {
            const nearEnd = cur >= Math.max(0, dur - 0.45) || (dur > 2 && cur >= dur * 0.985);
            const loopWrapped = (typeof video._lastTime === 'number') && video._lastTime > Math.max(2, dur * 0.70) && cur < 1.2 && cur < video._lastTime;
            video._lastTime = cur;

            if (nearEnd || loopWrapped || video.ended) {
              hasAutoScrolledCurrentShort = true;
              triggerScrollToNextShort();
              return;
            }
          }
        }
      }
    }

    if (!video || video.paused || video.ended || sessionWhitelistedVideos.has(videoId)) {
      return;
    }

    // Jika video sudah diblur, lewati analisis frame berulang untuk menghemat CPU
    if (video.classList.contains('modesty-video-blurred')) {
      return;
    }

    isCheckingVideoFrame = true;
    try {
      const meta = getMetadata();

      if (settings.filterText) {
        const titleDecision = decisionEngine.evaluate(null, meta);
        if (titleDecision.shouldBlock) {
          applyVideoShield(titleDecision, video);
          if (settings.autoMute && !video.muted) {
            video.muted = true;
            wasMutedByShield = true;
          }
          return;
        }
      }

      const visual = await visionDetector.analyzeVisualSourceAsync(video);
      if (!visual) return;

      const decision = decisionEngine.evaluate(visual, meta);
      if (decision.shouldBlock) {
        applyVideoShield(decision, video);
        if (settings.autoMute && !video.muted) {
          video.muted = true;
          wasMutedByShield = true;
        }
      } else {
        removeVideoShield();
        if (wasMutedByShield && video.muted) {
          video.muted = false;
          wasMutedByShield = false;
        }
      }
    } finally {
      isCheckingVideoFrame = false;
    }
  }

  function applyVideoShield(decision, video) {
    if (!video) video = getVideoElement();
    if (video) {
      video.classList.add('modesty-video-blurred');
    }

    const container = getVideoContainer(video);
    if (!container) return;

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    let overlay = container.querySelector('#modesty-video-shield-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modesty-video-shield-overlay';
      overlay.className = `modesty-video-shield-container style-${settings.coverStyle}`;

      overlay.innerHTML = `
        <div class="modesty-shield-card">
          <div class="modesty-shield-icon">${SHIELD_SVG}</div>
          <h3 class="modesty-shield-title">WomanDefender Shield Aktif</h3>
          <p class="modesty-shield-reason" id="modesty-shield-reason-text">${decision.reason}</p>
          <p class="modesty-shield-meta">Diproses lokal oleh ${decision.modelUsed} (${Math.round(decision.confidence * 100)}% keyakinan)</p>
          <div class="modesty-shield-actions">
            <button class="modesty-btn modesty-btn-allow" id="modesty-btn-allow">✓ Izinkan</button>
            <button class="modesty-btn modesty-btn-reject" id="modesty-btn-reject">✕ Jangan (Lewati)</button>
          </div>
          <div class="modesty-shield-sub-actions">
            <button class="modesty-btn-link" id="modesty-btn-peek">Buka Sementara (${settings.peekDuration}s)</button>
          </div>
        </div>
      `;

      overlay.querySelector('#modesty-btn-allow').addEventListener('click', (e) => {
        e.stopPropagation();
        const vId = getCurrentVideoId();
        sessionWhitelistedVideos.add(vId);
        removeVideoShield();
        const activeVid = getVideoElement();
        if (wasMutedByShield && activeVid) {
          activeVid.muted = false;
          wasMutedByShield = false;
        }
      });

      overlay.querySelector('#modesty-btn-reject').addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.location.pathname.startsWith('/shorts/')) {
          triggerScrollToNextShort();
        } else {
          const activeVid = getVideoElement();
          if (activeVid) activeVid.pause();
        }
      });

      overlay.querySelector('#modesty-btn-peek').addEventListener('click', (e) => {
        e.stopPropagation();
        triggerPeekMode();
      });

      container.appendChild(overlay);
      if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: 'RECORD_FILTER_EVENT', target: 'video' }).catch(() => {});
      }
    } else {
      overlay.className = `modesty-video-shield-container style-${settings.coverStyle}`;
      const reasonEl = overlay.querySelector('#modesty-shield-reason-text');
      if (reasonEl && reasonEl.textContent !== decision.reason) {
        reasonEl.textContent = decision.reason;
      }
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
    }
  }

  function removeVideoShield() {
    document.querySelectorAll('.modesty-video-blurred').forEach((v) => {
      v.classList.remove('modesty-video-blurred');
    });

    document.querySelectorAll('#modesty-video-shield-overlay').forEach((overlay) => {
      overlay.style.display = 'none';
      overlay.style.opacity = '0';
    });
  }

  function triggerPeekMode() {
    isCurrentlyPeeking = true;
    removeVideoShield();

    const video = getVideoElement();
    if (wasMutedByShield && video) {
      video.muted = false;
    }

    clearTimeout(peekTimeout);
    peekTimeout = setTimeout(() => {
      isCurrentlyPeeking = false;
      checkCurrentVideoFrame();
    }, settings.peekDuration * 1000);
  }

  /**
   * ========================================================
   * 1.B FITUR AUTO SCROLL YOUTUBE SHORTS (ON-PAGE & ENGINE)
   * ========================================================
   */
  function setupShortsAutoScroll() {
    if (!window.location.pathname.startsWith('/shorts/')) {
      removeShortsAutoScrollButton();
      return;
    }
    renderShortsAutoScrollButton();
    const video = getVideoElement();
    if (video) {
      bindShortsVideoEvents(video);
    }
  }

  function bindShortsVideoEvents(video) {
    if (!video || video._modestyBound) return;
    video._modestyBound = true;
    video._lastTime = video.currentTime || 0;

    const onProgress = () => {
      if (!settings.autoScrollShorts || !window.location.pathname.startsWith('/shorts/')) return;
      if (isCurrentlyPeeking || hasAutoScrolledCurrentShort) return;

      const dur = video.duration;
      const cur = video.currentTime;
      if (!dur || isNaN(dur) || dur <= 0) return;

      // 1. Threshold mendekati akhir video
      const nearEnd = cur >= Math.max(0, dur - 0.45) || (dur > 2 && cur >= dur * 0.985);
      // 2. Loop wrap-around detection (sebelumnya di > 70% durasi, lalu reset ke awal < 1.2s)
      const loopWrapped = (typeof video._lastTime === 'number') && video._lastTime > Math.max(2, dur * 0.70) && cur < 1.2 && cur < video._lastTime;
      video._lastTime = cur;

      if (nearEnd || loopWrapped) {
        hasAutoScrolledCurrentShort = true;
        triggerScrollToNextShort();
      }
    };

    video.addEventListener('timeupdate', onProgress);
    video.addEventListener('ended', () => {
      if (settings.autoScrollShorts && !hasAutoScrolledCurrentShort && !isCurrentlyPeeking) {
        hasAutoScrolledCurrentShort = true;
        triggerScrollToNextShort();
      }
    });
  }

  function getShortsPlayerContainer() {
    const activeReel = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]');
    if (activeReel) {
      // Prioritaskan kontainer frame video langsung (#player-container)
      const playerContainer = activeReel.querySelector('#player-container, .player-container, .html5-video-player');
      if (playerContainer) return playerContainer;
      return activeReel;
    }
    return document.querySelector('#player-container, ytd-shorts #player-container') || document.querySelector('ytd-shorts');
  }

  function renderShortsAutoScrollButton() {
    if (!window.location.pathname.startsWith('/shorts/')) return;

    const targetParent = getShortsPlayerContainer();
    if (!targetParent) return;

    // Pastikan kontainer memiliki position relative agar tombol berposisi presisi di sudut kiri atas video Shorts
    if (window.getComputedStyle(targetParent).position === 'static') {
      targetParent.style.position = 'relative';
    }

    let btn = document.getElementById('modesty-shorts-autoscroll-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'modesty-shorts-autoscroll-btn';
      btn.className = 'modesty-shorts-autoscroll-btn';
      btn.type = 'button';
      btn.title = 'WomanDefender AI: Klik untuk Mengaktifkan/Mematikan Auto Scroll Shorts';

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newState = !settings.autoScrollShorts;
        settings.autoScrollShorts = newState;
        await chrome.storage.local.set({ autoScrollShorts: newState });
        updateShortsAutoScrollButtonUI(btn);

        // Jika baru diaktifkan dan video sudah di akhir, langsung scroll
        if (newState) {
          const video = getVideoElement();
          if (video && video.duration > 0 && video.currentTime >= video.duration - 0.5) {
            hasAutoScrolledCurrentShort = true;
            triggerScrollToNextShort();
          }
        }
      });
    }

    updateShortsAutoScrollButtonUI(btn);

    if (btn.parentElement !== targetParent) {
      targetParent.appendChild(btn);
    }
  }

  function updateShortsAutoScrollButtonUI(btnEl) {
    const btn = btnEl || document.getElementById('modesty-shorts-autoscroll-btn');
    if (!btn) return;

    const isActive = !!settings.autoScrollShorts;
    if (isActive) {
      btn.classList.add('active');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        <span>Auto Scroll: ON</span>
      `;
      btn.title = 'WomanDefender: Auto Scroll Shorts AKTIF (Klik untuk Mematikan)';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        <span>Auto Scroll: OFF</span>
      `;
      btn.title = 'WomanDefender: Auto Scroll Shorts MATI (Klik untuk Mengaktifkan)';
    }
  }

  function removeShortsAutoScrollButton() {
    const btn = document.getElementById('modesty-shorts-autoscroll-btn');
    if (btn) btn.remove();
  }

  function triggerScrollToNextShort() {
    // 1. Coba klik tombol bawaan navigasi panah bawah YouTube Shorts
    const navDownSelectors = [
      '#navigation-button-down button',
      'ytd-shorts #navigation-button-down button',
      '#navigation-button-down yt-button-shape button',
      '#navigation-button-down tp-yt-paper-icon-button',
      '#navigation-button-down yt-icon-button',
      '#navigation-button-down',
      'button[aria-label="Next video"]',
      'button[aria-label="Video berikutnya"]',
      'button[aria-label="Berikutnya"]',
      'button[aria-label*="Next" i]',
      'button[aria-label*="berikutnya" i]',
      '[aria-label="Next video"] button',
      '[aria-label="Video berikutnya"] button'
    ];

    for (const selector of navDownSelectors) {
      const btn = document.querySelector(selector);
      if (btn && (btn.offsetWidth > 0 || btn.offsetHeight > 0 || btn.getClientRects().length > 0)) {
        try {
          btn.click();
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          break;
        } catch (e) {
          // Lanjut ke opsi berikutnya
        }
      }
    }

    // 2. Dispatch keyboard events (ArrowDown & PageDown) pada active reel, document, dan window
    const activeReel = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]');
    
    // Pastikan fokus tidak tertahan di input/komentar agar keyboard shortcuts YT bekerja
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
      document.activeElement.blur();
    }

    const dispatchKey = (key, code, keyCode) => {
      const opts = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true, view: window };
      const kDown = new KeyboardEvent('keydown', opts);
      const kUp = new KeyboardEvent('keyup', opts);

      if (activeReel) activeReel.dispatchEvent(kDown);
      document.dispatchEvent(kDown);
      window.dispatchEvent(kDown);
      document.body.dispatchEvent(kDown);

      if (activeReel) activeReel.dispatchEvent(kUp);
      document.dispatchEvent(kUp);
      window.dispatchEvent(kUp);
    };

    dispatchKey('ArrowDown', 'ArrowDown', 40);

    // 3. Gulir DOM langsung ke reel berikutnya (scrollIntoView)
    if (activeReel && activeReel.nextElementSibling) {
      try {
        activeReel.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {}
    }

    // 4. Fallback scroll container jika YouTube menggunakan kontainer scroll snap internal
    const shortsContainer = document.getElementById('shorts-container') || document.querySelector('ytd-shorts');
    if (shortsContainer && typeof shortsContainer.scrollBy === 'function') {
      try {
        const step = activeReel?.clientHeight || window.innerHeight || 800;
        shortsContainer.scrollBy({ top: step, behavior: 'smooth' });
      } catch (err) {}
    }
  }

  /**
   * ========================================================
   * 2. PENANGANAN THUMBNAIL (BERANDA, PENCARIAN, & SHORTS)
   * ========================================================
   */
  function setupThumbnailObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      if (isUserScrolling) return;
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (settings.enabled && !isUserScrolling) {
          scanThumbnailsBatch();
        }
      }, 500);
    });

    const target = document.querySelector('ytd-app') || document.body;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  let isScanningThumbnails = false;

  async function scanThumbnailsBatch() {
    if (!settings.enabled || isScanningThumbnails || isUserScrolling || typeof chrome === 'undefined' || !chrome.runtime?.id) return;

    isScanningThumbnails = true;
    try {
      // Selector komprehensif HANYA untuk elemen yang BELUM diproses
      const rawSelectors = [
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-rich-grid-slim-media',
        'ytd-reel-shelf-renderer yt-lockup-view-model',
        'yt-shorts-shelf-view-model yt-lockup-view-model',
        'div.shortsLockupViewModelHost',
        'ytd-reel-item-renderer',
        'yt-reel-item-renderer'
      ];

      const unhandledSelector = rawSelectors.map(s => `${s}:not([data-modesty-processed])`).join(',');
      const items = document.querySelectorAll(unhandledSelector);
      if (!items || items.length === 0) return;

      // Viewport Culling: Hanya proses thumbnail yang terlihat di layar (+ buffer 200px)
      // Thumbnail di luar layar TIDAK dianalisis agar CPU/GPU 100% bebas beban
      const viewportH = window.innerHeight || 800;
      const visibleItems = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rect = item.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.top <= viewportH + 200 && rect.bottom >= -100) {
          visibleItems.push(item);
        }
      }

      for (const item of visibleItems) {
        if (isUserScrolling) break; // Jika user mulai scrolling lagi, batalkan seketika agar scroll tetap 60/120 FPS mulus!
        await processThumbnailItem(item);
        // Yield mikro ke browser agar UI tetap 60 FPS mulus tanpa lag
        if (globalThis.scheduler?.yield) {
          await scheduler.yield();
        } else {
          await new Promise(r => setTimeout(r, 16));
        }
      }
    } finally {
      isScanningThumbnails = false;
    }
  }

  function extractItemTitle(item) {
    const explicit = item.querySelector('#video-title, #video-title-link, [id*="video-title"]');
    if (explicit) {
      const t = explicit.getAttribute('title') || explicit.textContent;
      if (t && t.trim()) return t.trim();
    }

    const shortsTitle = item.querySelector('h3.title a, h3.title span, h3.title, .shortsLockupViewModelHostTitle, h3 a, h3 span');
    if (shortsTitle) {
      const t = shortsTitle.getAttribute('title') || shortsTitle.textContent;
      if (t && t.trim()) return t.trim();
    }

    const reelA = item.querySelector('a.reel-item-endpoint[title], a[href*="/shorts/"][title]');
    if (reelA) {
      const t = reelA.getAttribute('title');
      if (t && t.trim()) return t.trim();
    }

    const reelAria = item.querySelector('a.reel-item-endpoint, a[href*="/shorts/"]');
    if (reelAria) {
      const t = reelAria.getAttribute('aria-label') || reelAria.getAttribute('title');
      if (t && t.trim()) return t.trim();
    }

    return item.getAttribute('title') || item.getAttribute('aria-label') || '';
  }

  async function processThumbnailItem(item) {
    if (!item || item.dataset.modestyProcessed === 'true') return;
    item.dataset.modestyProcessed = 'true';

    let thumbWrapper = item.querySelector('#thumbnail, ytd-thumbnail, yt-image, .shortsLockupViewModelHostThumbnailContainer, a.reel-item-endpoint, [class*="thumbnail"]');
    if (!thumbWrapper) {
      thumbWrapper = item.querySelector('a[href*="/shorts/"]') || item;
    }

    const img = item.querySelector('img.yt-core-image, yt-image img, #thumbnail img, img');

    const titleText = extractItemTitle(item);

    // Ambil nama channel
    const channelEl = item.querySelector('ytd-channel-name, #channel-name, #byline, .ytd-channel-name, #owner #text, ytd-video-meta-block #text');
    const channelText = channelEl ? channelEl.textContent.trim() : '';

    const quickMeta = { title: titleText, channel: channelText };

    // 1. Evaluasi Cepat Judul & Channel
    if (settings.filterText) {
      const titleDecision = decisionEngine.evaluate(null, quickMeta);
      if (titleDecision.shouldBlock) {
        applyThumbnailBlur(thumbWrapper, item, titleDecision.reason);
        return;
      }
    }

    // 2. Evaluasi Gambar Visual (Single-pass eksekusi pasti)
    if (img) {
      let src = img.currentSrc || img.src || img.getAttribute('src') || '';
      if (src && src.startsWith('http')) {
        const visual = await visionDetector.analyzeThumbnailElement(img);
        if (visual) {
          const visualDecision = decisionEngine.evaluate(visual, quickMeta);
          if (visualDecision.shouldBlock) {
            applyThumbnailBlur(thumbWrapper, item, visualDecision.reason);
          }
        }
      } else {
        const onImgReady = async () => {
          img.removeEventListener('load', onImgReady);
          const visual = await visionDetector.analyzeThumbnailElement(img);
          if (visual) {
            const visualDecision = decisionEngine.evaluate(visual, quickMeta);
            if (visualDecision.shouldBlock) {
              applyThumbnailBlur(thumbWrapper, item, visualDecision.reason);
            }
          }
        };
        img.addEventListener('load', onImgReady, { once: true });
      }
    }
  }

  function applyThumbnailBlur(thumbWrapper, item, reason) {
    const targets = [thumbWrapper, item].filter(Boolean);
    for (const t of targets) {
      t.classList.add('modesty-thumb-container-wrapped', 'modesty-thumb-blurred');
    }

    const host = thumbWrapper || item;
    if (host && !host.querySelector('.modesty-thumb-badge')) {
      const badge = document.createElement('div');
      badge.className = 'modesty-thumb-badge';
      badge.title = `Konten Disaring: ${reason}. Klik untuk melihat.`;
      badge.innerHTML = `${SHIELD_SVG} <span>Disaring</span>`;

      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (const t of targets) {
          t.classList.toggle('modesty-thumb-blurred');
        }
      });

      host.appendChild(badge);
      if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: 'RECORD_FILTER_EVENT', target: 'thumbnail' }).catch(() => {});
      }
    }
  }

  function unblurAllThumbnails() {
    document.querySelectorAll('.modesty-thumb-blurred').forEach((el) => {
      el.classList.remove('modesty-thumb-blurred');
    });
    document.querySelectorAll('.modesty-thumb-badge').forEach((el) => {
      el.remove();
    });
    document.querySelectorAll('[data-modesty-processed]').forEach((el) => {
      delete el.dataset.modestyProcessed;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
