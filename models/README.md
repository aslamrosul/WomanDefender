# Arsitektur & Model AI ModestyShield

## 1. Decision Model: Julia-1 vs Jev vs Laya

Ekstensi ini mengintegrasikan **System 1 Decision Model** mutakhir yang dirancang khusus untuk inferensi keputusan cepat (*non-autoregressive classification*) langsung pada perangkat pengguna (*on-device*).

### Perbandingan Model:
| Aspek | Julia-1 (Dipilih) | Jev (Ditolak) | Laya |
| :--- | :--- | :--- | :--- |
| **Pengembang** | Supersonic Labs | TypeSafe AI | Convai Innovations |
| **Lisensi** | **Apache 2.0 (Open-Weights)** | Proprietary (Komersial) | Apache 2.0 (Open-Weights) |
| **Biaya** | **100% GRATIS** | **BERBAYAR (API Cloud)** | **100% GRATIS** |
| **Ukuran** | **144.3M parameter** | Ukuran Cloud (Tertutup) | ~421M parameter |
| **Kecepatan di Browser** | Sangat Cepat (< 15ms) | Tergantung Latensi Internet | Cenderung Berat untuk Tab |
| **Privasi** | **100% Lokal di PC User** | Data dikirim ke server luar | Lokal |

### Mengapa Julia-1?
1. **100% Gratis:** Tidak memerlukan saldo kartu kredit, akun berbayar, atau API token.
2. **Efisiensi Ekstrem:** Berukuran 144.3M parameter berbasis `mmBERT-small`, model ini dapat dieksekusi secara mulus pada CPU laptop konsumen tanpa membutuhkan GPU diskrit.
3. **Format ONNX & Transformers.js:** Supersonic Labs menyediakan artefak resmi `SupersonicLabs/Julia-1-ONNX` yang kompatibel dengan eksekusi WebGPU dan WebAssembly di peramban Chrome.

---

## 2. Pipeline Deteksi Visual Lokal (Vision Engine)

Karena model decision Julia-1 memproses representasi state dan konteks, ekstensi ini menggunakan **Vision Perception Engine** berbasis kanvas lokal berkecepatan tinggi:
1. **Analisis Krominans Ruang Warna YCbCr & HSV:** Mendeteksi kepadatan piksel kulit manusia di area wajah dan tubuh bagian atas (dada, bahu, leher) untuk mengevaluasi rasio busana terbuka (*vulgarity / cleavage score*).
2. **Analisis Area Rambut (Kepala Atas):** Mengevaluasi kontras helai rambut dan variasi tekstur untuk membedakan antara rambut wanita terbuka vs penutup kepala/jilbab seragam.
3. **Analisis Fitur Feminin:** Mendeteksi kontras lembut wajah dan pewarnaan bibir untuk probabilitas wanita.

---

## 3. Fast-Path Matrix (Fallback Zero-Latency)

Untuk menjamin pemutaran video 60 FPS di YouTube tanpa *frame drop* sedikitpun, ekstensi ini menyediakan mode alternatif **Fast-Path Matrix**. Mode ini mengeksekusi logika klasifikasi deterministik langsung dalam waktu < 1 milidetik.
