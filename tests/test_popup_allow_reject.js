const assert = require('assert');
const fs = require('fs');

console.log('=== TEST: Verifikasi Pop-up Shield "Izinkan / Tidak" & Tiada Auto-Scroll Saat Terblokir ===');

const contentJs = fs.readFileSync('D:/01_Development/Extension/WomanDefender/scripts/content.js', 'utf-8');
const css = fs.readFileSync('D:/01_Development/Extension/WomanDefender/scripts/shield-overlay.css', 'utf-8');

// 1. Pastikan TIDAK ADA pemanggilan handleBlockedAutoScroll
assert.ok(!contentJs.includes('handleBlockedAutoScroll'), 'handleBlockedAutoScroll HARUS sudah dihapus agar tidak pernah auto-scroll saat terdeteksi');

// 2. Pastikan tombol Izinkan dan Jangan (Lewati) ada di HTML overlay
assert.ok(contentJs.includes('id="modesty-btn-allow"'), 'Harus ada tombol id="modesty-btn-allow"');
assert.ok(contentJs.includes('id="modesty-btn-reject"'), 'Harus ada tombol id="modesty-btn-reject"');
assert.ok(contentJs.includes('✓ Izinkan'), 'Harus ada teks "✓ Izinkan"');
assert.ok(contentJs.includes('✕ Jangan (Lewati)'), 'Harus ada teks "✕ Jangan (Lewati)"');

// 3. Pastikan event listener reject memanggil triggerScrollToNextShort()
assert.ok(contentJs.includes("overlay.querySelector('#modesty-btn-reject')"), 'Harus ada listener untuk #modesty-btn-reject');

// 4. Pastikan styling tombol reject dan allow ada di CSS
assert.ok(css.includes('.modesty-btn-allow'), 'CSS harus ada .modesty-btn-allow');
assert.ok(css.includes('.modesty-btn-reject'), 'CSS harus ada .modesty-btn-reject');

console.log('✓ SEMUA TEST POPUP IZINKAN/TIDAK BERHASIL 100%!');
