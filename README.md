# 🛡️ WomanDefender AI - YouTube Modesty & Vision Gaze Protection

**WomanDefender AI** adalah ekstensi Google Chrome 100% gratis, open-source, dan beroperasi sepenuhnya di perangkat lokal Anda (*On-Device Vision AI*) untuk melindungi pandangan di YouTube dan YouTube Shorts.

---

## ✨ Fitur Utama

- 🧠 **Vision AI On-Device (100% Privat)**: Mendeteksi figur wanita (wajah, hijab/jilbab, busana terbuka) pada Thumbnail, Shorts, dan Pemutar Video menggunakan model neural lokal. Tidak ada gambar yang dikirim ke server luar!
- ⚡ **2-Stage Ultra-Fast Gatekeeper**: Melewati video game, coding, logo, dan konten non-manusia dalam waktu **< 0.1ms** tanpa membebani CPU.
- 📱 **Integrasi Penuh YouTube Shorts**: Dilengkapi tombol **Auto Scroll Shorts On/Off** langsung di sudut pemutar Shorts, serta popup interaktif **✓ Izinkan** vs **✕ Lewati**.
- 🎯 **1 Pilihan Saja (Simpel & Tegas)**: Tidak ada pengaturan sensitivitas yang membingungkan. Ekstensi langsung bekerja dengan standar perlindungan optimal.
- 🔇 **Fitur Pendukung**: Auto-Mute suara saat video disaring, pilihan efek penutup (*Frosted Glass Blur* / *Solid Dark*), dan durasi buka sementara (*Peek*).

---

## 🚀 Cara Memasang (Install) di Google Chrome

1. **Unduh Versi Terbaru**: Unduh file `.zip` dari menu **[Releases](../../releases)**.
2. **Ekstrak File**: Ekstrak file zip ke folder pilihan Anda di komputer.
3. **Buka Menu Ekstensi Chrome**: Kunjungi `chrome://extensions` di browser Anda.
4. **Aktifkan Developer Mode**: Geser saklar **Developer mode** (Mode Pengembang) di pojok kanan atas ke posisi **ON**.
5. **Muat Ekstensi**: Klik tombol **Load unpacked** (*Muat yang belum dibongkar*) di pojok kiri atas, lalu pilih folder yang telah diekstrak.
6. **Selesai!** Buka YouTube dan perlindungan akan aktif secara otomatis.

---

## 🛠️ Arsitektur & Teknologi

- **Model AI**: TinyFace Detector (416px / 224px adaptif) + Multitask Gender CNN via `face-api.js` / TensorFlow.js CPU/WebGL.
- **Perlindungan Hijab & Kolase**: Analisis multi-wilayah lokal yang mampu mendeteksi wanita berhijab maupun thumbnail kolase keluarga tanpa *false positive*.
- **Anti-Lag Engine**: Viewport culling (hanya memindai thumbnail yang tampak di layar) dan micro-yielding untuk menjaga browser tetap mulus pada 60 FPS.

---

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi [MIT](LICENSE). Bebas digunakan, dipelajari, dan dikembangkan untuk kebaikan bersama.
