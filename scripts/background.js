/**
 * ModestyShield AI / WomanDefender AI - Service Worker
 * Mengelola state persistensi, inisialisasi pengaturan, statistik filter,
 * dan bridge proxy pengambilan gambar bebas CORS via host_permissions.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  strictness: 'all_female', // Default ketat agar perlindungan maksimal
  coverStyle: 'blur',       // 'blur' | 'solid'
  autoMute: true,
  autoScrollShorts: false,  // Fitur Auto Scroll YouTube Shorts
  peekDuration: 5,          // Detik buka sementara
  decisionModel: 'julia1_hybrid', // 'julia1_hybrid' | 'fast_path'
  stats: {
    videosFiltered: 0,
    thumbnailsFiltered: 0
  }
};

chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await chrome.storage.local.get(null);
  const toInit = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[key] === undefined) {
      toInit[key] = value;
    }
  }

  if (Object.keys(toInit).length > 0) {
    await chrome.storage.local.set(toInit);
  }

  await updateBadge(current.enabled !== undefined ? current.enabled : true);
});

async function updateBadge(enabled) {
  try {
    if (enabled) {
      await chrome.action.setBadgeText({ text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Emerald Green
    } else {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#6B7280' }); // Gray
    }
  } catch (err) {
    console.error('Error setting badge:', err);
  }
}

// Mendengarkan pesan dari content script dan popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'TOGGLE_STATUS') {
        const { enabled } = await chrome.storage.local.get('enabled');
        const newStatus = !enabled;
        await chrome.storage.local.set({ enabled: newStatus });
        await updateBadge(newStatus);
        sendResponse({ success: true, enabled: newStatus });

      } else if (message.type === 'RECORD_FILTER_EVENT') {
        const data = await chrome.storage.local.get('stats');
        const stats = data.stats || { videosFiltered: 0, thumbnailsFiltered: 0 };
        if (message.target === 'video') {
          stats.videosFiltered = (stats.videosFiltered || 0) + 1;
        } else if (message.target === 'thumbnail') {
          stats.thumbnailsFiltered = (stats.thumbnailsFiltered || 0) + 1;
        }
        await chrome.storage.local.set({ stats });
        sendResponse({ success: true, stats });

      } else if (message.type === 'UPDATE_BADGE') {
        await updateBadge(message.enabled);
        sendResponse({ success: true });

      } else if (message.type === 'FETCH_IMAGE_DATA_URL') {
        // Ambil gambar menggunakan hak istimewa host_permissions service worker (bebas CORS & CSP)
        try {
          const resp = await fetch(message.url);
          if (!resp.ok) {
            sendResponse({ success: false, error: `HTTP ${resp.status}` });
            return;
          }
          const blob = await resp.blob();
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          sendResponse({ success: true, dataUrl });
        } catch (fetchErr) {
          sendResponse({ success: false, error: fetchErr.message });
        }

      } else {
        sendResponse({ received: true });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Menjaga channel tetap terbuka untuk respon asinkron
});
