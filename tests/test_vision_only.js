const assert = require('assert');
const fs = require('fs');

// Muat DecisionEngine
const code = fs.readFileSync('D:/01_Development/Extension/WomanDefender/scripts/decision-engine.js', 'utf-8');
const vm = require('vm');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const DecisionEngine = sandbox.window.DecisionEngine;

console.log('=== TEST 1: Mode Vision-Only (filterText: false) ===');
const engineVisionOnly = new DecisionEngine({ strictness: 'all_female', filterText: false });

// 1. Judul memuat kata "wanita", tapi gambar visual aman/null
const dec1 = engineVisionOnly.evaluate(null, { title: 'Kisah Wanita Pejuang', channel: 'Sejarah Dunia' });
assert.strictEqual(dec1.shouldBlock, false, 'Dalam mode vision-only, kata di judul TIDAK BOLEH memblokir!');
console.log('✓ Kasus 1 Lulus: Judul dengan kata "wanita" tidak diblokir tanpa visual!');

// 2. Judul memuat kata "cewek", gambar pria
const visualPria = { hasDetectedFace: true, isFemale: false, isMaleConfirmed: true };
const dec2 = engineVisionOnly.evaluate(visualPria, { title: 'Cewek Idaman Gamer', channel: 'Windah Basudara' });
assert.strictEqual(dec2.shouldBlock, false, 'Gambar pria tidak boleh diblokir');
console.log('✓ Kasus 2 Lulus: Video dengan gambar pria aman!');

// 3. Judul netral/kosong, tapi visual mendeteksi wanita
const visualWanita = { hasDetectedFace: true, isFemale: true, femaleConfidence: 0.95 };
const dec3 = engineVisionOnly.evaluate(visualWanita, { title: 'Daily Vlog Random', channel: 'Channel A' });
assert.strictEqual(dec3.shouldBlock, true, 'Visual wanita HARUS diblokir!');
console.log('✓ Kasus 3 Lulus: Gambar dengan figur wanita berhasil diblokir oleh Vision AI!');

console.log('\n=== TEST 2: Mode Hybrid (filterText: true) ===');
const engineHybrid = new DecisionEngine({ strictness: 'all_female', filterText: true });

// 4. Judul memuat kata "wanita", filter teks aktif
const dec4 = engineHybrid.evaluate(null, { title: 'Kisah Wanita Pejuang', channel: 'Sejarah Dunia' });
assert.strictEqual(dec4.shouldBlock, true, 'Dalam mode hybrid, teks tetap memblokir');
console.log('✓ Kasus 4 Lulus: Mode hybrid tetap memfilter judul!');

console.log('\nSEMUA TEST VISION-ONLY BERHASIL 100%!');
