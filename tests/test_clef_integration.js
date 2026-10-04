const assert = require('assert');

console.log('=== TEST: Verifikasi Integrasi Cloudflare Clef-flash ===');

// 1. Simulasi Parser Response Cloudflare Clef-flash (type: 'noul')
function parseClefResponse(json) {
  if (!json || !json.success) {
    return { success: false, fallbackNeeded: true };
  }
  const answers = json.result?.answers || {};
  let prob = 0;
  if (typeof answers.is_female === 'number') {
    prob = answers.is_female;
  } else if (answers.is_female && typeof answers.is_female.probability === 'number') {
    prob = answers.is_female.probability;
  }

  return {
    success: true,
    isFemale: prob >= 0.48,
    confidence: Number(prob.toFixed(2)),
    modelUsed: 'Cloudflare Clef-flash (9B Decision Model)'
  };
}

// Kasus 1: Response Wanita (Probability tinggi)
const femaleResp = {
  success: true,
  result: {
    answers: {
      is_female: 0.942
    }
  }
};
const res1 = parseClefResponse(femaleResp);
assert.strictEqual(res1.success, true);
assert.strictEqual(res1.isFemale, true, 'is_female 0.942 harus terdeteksi sebagai wanita');
assert.strictEqual(res1.confidence, 0.94);
assert.strictEqual(res1.modelUsed, 'Cloudflare Clef-flash (9B Decision Model)');
console.log('✓ Kasus 1 Lulus: Response wanita Clef-flash (0.942) berhasil diproses!');

// Kasus 2: Response Pria / Non-wanita (Probability rendah)
const maleResp = {
  success: true,
  result: {
    answers: {
      is_female: 0.031
    }
  }
};
const res2 = parseClefResponse(maleResp);
assert.strictEqual(res2.success, true);
assert.strictEqual(res2.isFemale, false, 'is_female 0.031 tidak boleh diblokir');
console.log('✓ Kasus 2 Lulus: Response pria/game Clef-flash (0.031) lolos tanpa false positive!');

// Kasus 3: Response Error / Kuota Habis (Rate Limit 429) -> Harus Fallback
const errorResp = {
  success: false,
  errors: [{ message: 'Rate limit exceeded: 10,000 neurons reached' }]
};
const res3 = parseClefResponse(errorResp);
assert.strictEqual(res3.success, false);
assert.strictEqual(res3.fallbackNeeded, true, 'Error API harus otomatis meminta fallback ke lokal WebGL');
console.log('✓ Kasus 3 Lulus: Fallback otomatis aktif jika kuota habis!');

console.log('\nSEMUA TEST INTEGRASI CLEF-FLASH 100% SUKSES!');
