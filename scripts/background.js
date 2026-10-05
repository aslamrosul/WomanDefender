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
  aiEngine: 'local',        // 'local' (WebGL On-Device) | 'clef_flash' (Cloudflare Workers AI)
  cfAccountId: '',          // Cloudflare Account ID
  cfApiToken: '',           // Cloudflare API Token
  cfFallbackLocal: true,    // Otomatis fallback ke model lokal jika kuota habis
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

      } else if (message.type === 'TEST_CLOUDFLARE_CONNECTION') {
        const { accountId, apiToken } = message;
        if (!accountId || !apiToken) {
          sendResponse({ success: false, error: 'Account ID dan API Token wajib diisi.' });
          return;
        }

        try {
          const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef-flash`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'clef-flash',
              state: 'Health check connectivity test.',
              questions: {
                is_connected: {
                  type: 'noul',
                  instructions: 'Is the connection active?'
                }
              }
            })
          });

          const json = await resp.json().catch(() => null);
          if (resp.ok && json && json.success) {
            sendResponse({ success: true, message: 'Koneksi ke Cloudflare Clef-flash Berhasil! ⚡' });
          } else {
            const errDetail = json?.errors?.[0]?.message || `HTTP ${resp.status} ${resp.statusText}`;
            sendResponse({ success: false, error: `Gagal: ${errDetail}` });
          }
        } catch (netErr) {
          sendResponse({ success: false, error: `Network error: ${netErr.message}` });
        }

      } else if (message.type === 'ANALYZE_IMAGE_WITH_CLEF') {
        const { accountId, apiToken, dataUrl } = message;
        if (!accountId || !apiToken || !dataUrl) {
          sendResponse({ success: false, error: 'Parameter tidak lengkap', fallbackNeeded: true });
          return;
        }

        try {
          const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef-flash`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'clef-flash',
              state: 'YouTube video thumbnail content moderation.',
              images: [dataUrl],
              questions: {
                is_female: {
                  type: 'noul',
                  instructions: 'Does this thumbnail depict, feature, or contain any female human (woman, girl, lady, female facial features, or female hair)?'
                }
              }
            })
          });

          const json = await resp.json().catch(() => null);
          if (resp.ok && json && json.success) {
            const answers = json.result?.answers || {};
            const femaleAns = answers.is_female;
            let prob = 0;
            if (typeof femaleAns === 'number') {
              prob = femaleAns;
            } else if (femaleAns && typeof femaleAns === 'object') {
              if (typeof femaleAns.noul === 'number') {
                prob = femaleAns.noul;
              } else if (typeof femaleAns.probability === 'number') {
                prob = femaleAns.probability;
              } else if (typeof femaleAns.prob === 'number') {
                prob = femaleAns.prob;
              } else if (femaleAns.choice) {
                prob = (femaleAns.choice === 'yes' || femaleAns.choice === 'female') ? 1.0 : 0.0;
              }
            }

            const isFemale = prob >= 0.45;
            console.log(`⚡ [WomanDefender Clef-flash] Deteksi: ${isFemale ? 'Wanita Terdeteksi' : 'Bukan Wanita'} (prob: ${prob.toFixed(3)})`);

            sendResponse({
              success: true,
              isFemale: isFemale,
              confidence: Number(prob.toFixed(2)),
              modelUsed: 'Cloudflare Clef-flash (9B Decision Model)'
            });
          } else {
            const errDetail = json?.errors?.[0]?.message || `HTTP ${resp.status}`;
            console.warn('⚠️ [WomanDefender] Clef-flash API Error:', errDetail);
            sendResponse({ success: false, error: errDetail, fallbackNeeded: true });
          }
        } catch (fetchErr) {
          sendResponse({ success: false, error: fetchErr.message, fallbackNeeded: true });
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
