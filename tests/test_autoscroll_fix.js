// Test simulasi browser DOM & logic auto-scroll Shorts
const assert = require('assert');

console.log('=== TEST 1: Logika Loop Wrap-Around & Near-End Detection ===');

function checkAutoScrollTrigger(video, lastTime, hasAutoScrolled, settings) {
  if (!settings.autoScrollShorts || hasAutoScrolled) return { shouldScroll: false, newLastTime: video.currentTime };

  const dur = video.duration;
  const cur = video.currentTime;
  if (!dur || dur <= 0) return { shouldScroll: false, newLastTime: cur };

  const nearEnd = cur >= Math.max(0, dur - 0.45) || (dur > 2 && cur >= dur * 0.985);
  const loopWrapped = (typeof lastTime === 'number') && lastTime > Math.max(2, dur * 0.70) && cur < 1.2 && cur < lastTime;

  return {
    shouldScroll: nearEnd || loopWrapped || video.ended,
    nearEnd,
    loopWrapped,
    newLastTime: cur
  };
}

const settings = { autoScrollShorts: true };

// Kasus 1: Video sedang di tengah (durasi 15s, currentTime 7s) -> Jangan scroll
let res = checkAutoScrollTrigger({ duration: 15, currentTime: 7, ended: false }, 6.5, false, settings);
assert.strictEqual(res.shouldScroll, false, 'Video di tengah seharusnya tidak auto-scroll');

// Kasus 2: Video hampir habis (durasi 15s, currentTime 14.6s) -> Harus scroll
res = checkAutoScrollTrigger({ duration: 15, currentTime: 14.6, ended: false }, 14.2, false, settings);
assert.strictEqual(res.shouldScroll, true, 'Video di penghujung durasi harus trigger scroll');
assert.strictEqual(res.nearEnd, true, 'nearEnd harus true');

// Kasus 3: Video looping cepat melompati polling threshold (sebelumnya di 14.3s, tiba-tiba di 0.1s) -> Loop wrapped harus menangkap!
res = checkAutoScrollTrigger({ duration: 15, currentTime: 0.1, ended: false }, 14.3, false, settings);
assert.strictEqual(res.shouldScroll, true, 'Video yang baru looping wrap-around harus 100% tertangkap!');
assert.strictEqual(res.loopWrapped, true, 'loopWrapped harus true');

// Kasus 4: Video menembakkan event ended -> Harus scroll
res = checkAutoScrollTrigger({ duration: 15, currentTime: 15, ended: true }, 14.9, false, settings);
assert.strictEqual(res.shouldScroll, true, 'Video ended harus trigger scroll');

console.log('✓ Test 1 LULUS: Semua kondisi durasi, loop wrap-around, dan ended berhasil terdeteksi!');

console.log('\n=== TEST 2: Posisi Tombol & Kontainer Bebas Tabrakan Tombol Silang ===');
// Baca CSS shield-overlay.css
const fs = require('fs');
const css = fs.readFileSync('D:/01_Development/Extension/WomanDefender/scripts/shield-overlay.css', 'utf-8');

assert.ok(css.includes('top: 16px;'), 'CSS harus memiliki top: 16px');
assert.ok(css.includes('left: 16px;'), 'CSS harus memiliki left: 16px (posisi sudut kiri atas video)');
assert.ok(css.includes('right: auto;'), 'CSS harus memiliki right: auto (tidak menimpa sudut kanan atas / komentar)');

console.log('✓ Test 2 LULUS: Styling tombol berposisi di top: 16px, left: 16px di dalam video Shorts.');

console.log('\nSEMUA TEST VERIFIKASI SELESAI & BERHASIL 100%!');
