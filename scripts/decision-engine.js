/**
 * ModestyShield AI / WomanDefender AI - Decision Model Engine
 * Menggunakan pencocokan kata utuh (Strict Word-Boundary) agar TIDAK ADA
 * kata bahasa Inggris/istilah teknologi yang salah terpicu (seperti "integration" atau "another").
 */

class DecisionEngine {
  constructor(config = {}) {
    this.strictness = config.strictness || 'all_female';
    this.modelType = config.modelType || 'julia1_hybrid';
    this.filterText = config.filterText !== undefined ? config.filterText : true;

    // 1. KATA KUNCI WANITA EKSPLISIT (Wajib dicocokkan sebagai kata utuh)
    this.femaleKeywords = [
      'cewek', 'cewe', 'wanita', 'gadis', 'perempuan', 'putri', 'ibunya', 'ibu', 'mama', 'bunda',
      'tante', 'mbak', 'istri', 'janda', 'selebgram', 'biduan', 'pacar', 'pacaran', 'mantan',
      'waifu', 'heroine', 'loli', 'tsundere', 'yandere', 'harem', 'yuri', 'ecchi',
      'vtuber', 'ayang', 'cosplay', 'hijabers', 'jilbabers',
      'girl', 'girls', 'woman', 'women', 'female', 'lady', 'actress',
      'sister', 'girlfriend', 'wife', 'princess', 'maiden',
      'michele', 'michelle', 'michelealexander'
    ];

    // 2. FIGUR / ARTIS / CHANNEL WANITA SPESIFIK
    this.femaleCelebrities = [
      'dua lipa', 'mitski', 'bernadya', 'taylor swift', 'ariana grande', 'billie eilish',
      'blackpink', 'jennie', 'lisa blackpink', 'jisoo', 'rosé', 'rose blackpink', 'sabrina carpenter',
      'olivia rodrigo', 'fuji', 'nagita slavina', 'lesti', 'ayu ting ting', 'nikita mirzani',
      'wika salim', 'gisel', 'marion jola', 'lyodra', 'tiara andini', 'keisya', 'chrystal',
      'dewi pobo', 'ken & grat', 'wandavision'
    ];

    // 3. ISTILAH VULGARITAS / BUSANA TERBUKA
    this.vulgarKeywords = [
      'jorok', 'vulgar', 'sensual', 'belahan dada', 'baju ketat', 'bikini',
      'cleavage', 'lingerie', 'underwear', 'swimsuit', 'sexy', 'seksi', 'desah',
      'hentai', 'paha mulus'
    ];

    // 4. ISTILAH CLICKBAIT SALFOK / LEKUK TUBUH
    this.suggestiveKeywords = [
      'salfok', 'gagal fokus', 'bikin salfok', 'fokus sama', 'fokus ke',
      'baju ketat', 'kaos ketat', 'menonjol', 'nonjol',
      'tobrut', 'jilboobs', 'montok', 'semok', 'bohay', 'body goals',
      'bikin gerah'
    ];

    // 5. PENGECUALIAN AMAN (Game, Teknologi, Tutorial, Edukasi, Figur Pria)
    this.safeExemptionKeywords = [
      'ibm', 'ibm technology', 'martin keen', 'counter-strike', 'cs:go', 'cs2', 'minecraft', 'roblox',
      'unity', 'unreal', 'coding', 'python', 'javascript', 'developer', 'programming',
      'full course', 'komdigi', 'operator seluler', 'sisa kuota', 'telkomsel',
      'kajian', 'ceramah', 'ustadz', 'khutbah', 'quran', 'masjid',
      'gadgetin', 'david gadgetin', 'windah basudara', 'bang pascol', 'pascol', 'afif yulistian',
      'mkbhd', 'marques brownlee', 'linus tech', 'mrwhosetheboss'
    ];
  }

  updateConfig(config) {
    if (config.strictness) this.strictness = config.strictness;
    if (config.modelType) this.modelType = config.modelType;
    if (config.filterText !== undefined) this.filterText = config.filterText;
  }

  /**
   * Helper pencocokan KATA UTUH yang ketat (Strict Word Boundary)
   * Mencegah "integration" terpicu oleh "grat", "distribute" terpicu oleh "ibu",
   * atau "another" terpicu oleh "her".
   */
  matchesStrictWord(text, word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
    return regex.test(text);
  }

  checkTitleContext(title, channel) {
    const text = `${title} ${channel}`.toLowerCase();

    // A. CEK PENGECUALIAN AMAN TERLEBIH DAHULU (IBM, Tech, Coding, Game)
    for (const safeKw of this.safeExemptionKeywords) {
      if (this.matchesStrictWord(text, safeKw) || text.includes(safeKw)) {
        const hasExplicitFemale = this.femaleCelebrities.some(c => this.matchesStrictWord(text, c)) ||
                                  this.vulgarKeywords.some(v => this.matchesStrictWord(text, v));
        if (!hasExplicitFemale) {
          return { isSafeExemption: true, safeTopic: safeKw };
        }
      }
    }

    // Pengecualian frasa bukan wanita (misal: "ibu kota nusantara", "tanaman putri malu")
    const cleanText = text
      .replace(/ibu\s+kota/g, '')
      .replace(/putri\s+malu/g, '');

    // B. CEK KATA KUNCI WANITA DENGAN STRICT WORD BOUNDARY
    for (const kw of this.femaleKeywords) {
      if (this.matchesStrictWord(cleanText, kw)) {
        return { isFemaleTitle: true, matched: kw };
      }
    }

    // C. CEK ARTIS / CHANNEL WANITA
    for (const celeb of this.femaleCelebrities) {
      if (this.matchesStrictWord(text, celeb)) {
        return { isFemaleTitle: true, matched: celeb };
      }
    }

    // D. CEK VULGARITAS
    for (const v of this.vulgarKeywords) {
      if (this.matchesStrictWord(text, v)) {
        return { isVulgarTitle: true, matched: v };
      }
    }

    // E. CEK SALFOK / CLICKBAIT
    for (const s of this.suggestiveKeywords) {
      if (this.matchesStrictWord(text, s)) {
        return { isSuggestiveTitle: true, matched: s };
      }
    }

    return {};
  }

  evaluate(visualFeatures, metadata = {}) {
    const title = (metadata.title || '').toLowerCase();
    const channel = (metadata.channel || '').toLowerCase();

    // 1. Evaluasi Teks Judul & Channel (Hanya jika fitur filterText diaktifkan)
    if (this.filterText !== false) {
      const ctx = this.checkTitleContext(title, channel);

      // Jika masuk pengecualian aman (IBM, Tech, Coding, Game)
      if (ctx.isSafeExemption) {
        return {
          shouldBlock: false,
          reason: `Konten aman (${ctx.safeTopic})`,
          confidence: 0.98,
          modelUsed: 'WomanDefender Safety Shield'
        };
      }

      if (ctx.isFemaleTitle) {
        return {
          shouldBlock: true,
          reason: `Terdeteksi Wanita pada Judul/Channel ("${ctx.matched}")`,
          confidence: 0.98,
          modelUsed: 'WomanDefender Title Classifier'
        };
      }

      if (ctx.isVulgarTitle) {
        return {
          shouldBlock: true,
          reason: `Terdeteksi Unsur Vulgar pada Judul ("${ctx.matched}")`,
          confidence: 0.98,
          modelUsed: 'WomanDefender Title Classifier'
        };
      }

      if (ctx.isSuggestiveTitle) {
        return {
          shouldBlock: true,
          reason: `Terdeteksi Judul Salfok/Menonjol ("${ctx.matched}")`,
          confidence: 0.95,
          modelUsed: 'WomanDefender Clickbait Shield'
        };
      }
    }

    // 2. Evaluasi Visual (Neural Model / Multi-Region Vision)
    if (visualFeatures) {
      if (visualFeatures.isMaleConfirmed) {
        return {
          shouldBlock: false,
          reason: 'Pria terkonfirmasi (Neural AI)',
          confidence: 0.98,
          modelUsed: visualFeatures.modelUsed || 'WomanDefender Neural Vision AI'
        };
      }

      // Deteksi figur wanita: Wajah wanita terdeteksi, lekuk tubuh menonjol, atau busana terbuka
      const isDetectedWoman = (visualFeatures.hasDetectedFace && visualFeatures.isFemale) ||
                              visualFeatures.isFemale ||
                              visualFeatures.isProminentCurve ||
                              (visualFeatures.vulgarityScore > 0.25);

      if (isDetectedWoman) {
        return {
          shouldBlock: true,
          reason: 'Figur wanita terdeteksi (Vision AI)',
          confidence: visualFeatures.femaleConfidence || 0.85,
          modelUsed: visualFeatures.modelUsed || 'WomanDefender Vision AI'
        };
      }
    }

    return {
      shouldBlock: false,
      reason: 'Bukan wanita / konten aman',
      confidence: 0.90,
      modelUsed: 'WomanDefender AI'
    };
  }
}

if (typeof window !== 'undefined') {
  window.DecisionEngine = DecisionEngine;
}
