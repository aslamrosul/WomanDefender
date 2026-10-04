/**
 * WomanDefender AI - Popup Logic
 * Mengontrol pengaturan pengguna, persistensi storage, dan sinkronisasi status UI.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elemen DOM
  const masterToggle = document.getElementById('master-toggle');
  const statusBanner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const coverStyleSelect = document.getElementById('cover-style-select');
  const autoMuteToggle = document.getElementById('auto-mute-toggle');
  const autoScrollToggle = document.getElementById('auto-scroll-toggle');
  const filterTextToggle = document.getElementById('filter-text-toggle');
  const peekDurationSlider = document.getElementById('peek-duration-slider');
  const peekDurationVal = document.getElementById('peek-duration-val');
  const statVideo = document.getElementById('stat-video');
  const statThumb = document.getElementById('stat-thumb');

  // 1. Muat Pengaturan dari chrome.storage.local
  try {
    const data = await chrome.storage.local.get([
      'enabled',
      'strictness',
      'coverStyle',
      'autoMute',
      'autoScrollShorts',
      'filterText',
      'peekDuration',
      'stats'
    ]);

    // Nilai Default jika belum ada (Ketat menyaring semua wanita via Vision AI)
    const enabled = data.enabled !== undefined ? data.enabled : true;
    const coverStyle = data.coverStyle || 'blur';
    const autoMute = data.autoMute !== undefined ? data.autoMute : true;
    const autoScrollShorts = data.autoScrollShorts !== undefined ? data.autoScrollShorts : false;
    const filterText = data.filterText !== undefined ? data.filterText : false; // Default: Murni Vision AI
    const peekDuration = data.peekDuration || 5;
    const stats = data.stats || { videosFiltered: 0, thumbnailsFiltered: 0 };

    // Pastikan strictness selalu 'all_female'
    await chrome.storage.local.set({ strictness: 'all_female' });

    // Set Status Toggle & Banner
    masterToggle.checked = enabled;
    updateBannerState(enabled);

    // Set Select & Toggles
    if (coverStyleSelect) coverStyleSelect.value = coverStyle;
    if (autoMuteToggle) autoMuteToggle.checked = autoMute;
    if (autoScrollToggle) autoScrollToggle.checked = autoScrollShorts;
    if (filterTextToggle) filterTextToggle.checked = filterText;
    if (peekDurationSlider) {
      peekDurationSlider.value = peekDuration;
      peekDurationVal.textContent = `${peekDuration}s`;
    }

    // Set Statistik
    if (statVideo) statVideo.textContent = stats.videosFiltered || 0;
    if (statThumb) statThumb.textContent = stats.thumbnailsFiltered || 0;

  } catch (err) {
    console.error('Gagal memuat pengaturan popup:', err);
  }

  // 2. Event Listeners untuk Interaksi Pengguna

  // Toggle Utama
  masterToggle.addEventListener('change', async () => {
    const isEnabled = masterToggle.checked;
    await chrome.storage.local.set({ enabled: isEnabled });
    updateBannerState(isEnabled);
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', enabled: isEnabled });
  });

  // Gaya Penutup
  if (coverStyleSelect) {
    coverStyleSelect.addEventListener('change', async () => {
      await chrome.storage.local.set({ coverStyle: coverStyleSelect.value });
    });
  }

  // Auto-Mute
  if (autoMuteToggle) {
    autoMuteToggle.addEventListener('change', async () => {
      await chrome.storage.local.set({ autoMute: autoMuteToggle.checked });
    });
  }

  // Auto-Scroll Shorts
  if (autoScrollToggle) {
    autoScrollToggle.addEventListener('change', async () => {
      await chrome.storage.local.set({ autoScrollShorts: autoScrollToggle.checked });
    });
  }

  // Filter Teks Judul & Channel
  if (filterTextToggle) {
    filterTextToggle.addEventListener('change', async () => {
      await chrome.storage.local.set({ filterText: filterTextToggle.checked });
    });
  }

  // Sinkronisasi status jika diubah dari tombol Shorts di halaman YouTube
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.autoScrollShorts !== undefined && autoScrollToggle) {
      autoScrollToggle.checked = !!changes.autoScrollShorts.newValue;
    }
  });

  // Slider Durasi Peek
  if (peekDurationSlider) {
    peekDurationSlider.addEventListener('input', () => {
      peekDurationVal.textContent = `${peekDurationSlider.value}s`;
    });

    peekDurationSlider.addEventListener('change', async () => {
      const val = parseInt(peekDurationSlider.value, 10);
      await chrome.storage.local.set({ peekDuration: val });
    });
  }

  function updateBannerState(isEnabled) {
    if (isEnabled) {
      statusBanner.classList.remove('disabled');
      statusText.textContent = 'Perlindungan Aktif (Vision AI)';
    } else {
      statusBanner.classList.add('disabled');
      statusText.textContent = 'Perlindungan Dinonaktifkan';
    }
  }
});
