/**
 * Number Analyzer Engine
 * Regex + puan sistemi ile numara analizi
 */

export const SCORE_THRESHOLD = 60;

/** Sadece rakamlardan oluşuyor mu? */
function isNumericOnly(number) {
  return /^\d+$/.test(number.trim());
}

/** Tekrarlayan rakamlar: 111111, 999999 */
function hasRepeatingDigits(number) {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 4) return false;
  return /^(\d)\1{3,}$/.test(cleaned);
}

/** Sıralı rakamlar: 123456, 654321 */
function hasSequentialDigits(number) {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 4) return false;
  let asc = true;
  let desc = true;
  for (let i = 1; i < cleaned.length; i++) {
    if (parseInt(cleaned[i]) - parseInt(cleaned[i - 1]) !== 1) asc = false;
    if (parseInt(cleaned[i - 1]) - parseInt(cleaned[i]) !== 1) desc = false;
  }
  return asc || desc;
}

/** Kısa kod: 4-6 haneli (servis numaraları) */
function isShortCode(number) {
  const cleaned = number.replace(/\D/g, '');
  return cleaned.length >= 4 && cleaned.length <= 6;
}

/** 850 ile başlayan numaralar (Türkiye ücretli hatlar) */
function starts850(number) {
  const cleaned = number.replace(/\D/g, '');
  return cleaned.startsWith('850') || cleaned.startsWith('90850');
}

/** Uluslararası format (+90...) → güvenli */
function isInternationalFormat(number) {
  return number.trim().startsWith('+');
}

/**
 * Ana analiz fonksiyonu
 * Döner: { score, reasons, shouldBlock, category }
 */
export function analyzeNumber(rawNumber) {
  if (!rawNumber || typeof rawNumber !== 'string') {
    return { score: 0, reasons: [], shouldBlock: false, category: 'unknown' };
  }

  const number = rawNumber.trim();
  let score = 0;
  const reasons = [];

  // Uluslararası format → güvenli kabul et
  if (isInternationalFormat(number)) {
    return { score: 0, reasons: [], shouldBlock: false, category: 'allowed' };
  }

  // 850 ile başlayanlar
  if (starts850(number)) {
    score += 70;
    reasons.push('850 ile başlayan ücretli hat');
  }

  // Sadece rakam içerenler
  if (isNumericOnly(number)) {
    score += 40;
    reasons.push('Sadece rakamlardan oluşuyor');

    if (hasRepeatingDigits(number)) {
      score += 30;
      reasons.push('Tekrarlayan rakamlar');
    }

    if (hasSequentialDigits(number)) {
      score += 30;
      reasons.push('Sıralı rakamlar');
    }

    if (isShortCode(number)) {
      score += 20;
      reasons.push('Kısa kod (servis numarası)');
    }
  }

  const finalScore = Math.min(score, 100);
  const shouldBlock = finalScore >= SCORE_THRESHOLD;
  let category = 'unknown';

  if (finalScore >= SCORE_THRESHOLD) {
    category = 'spam';
  } else if (finalScore >= 30) {
    category = 'junk';
  }

  return {
    score: finalScore,
    reasons,
    shouldBlock,
    category,
  };
}

export function analyzeNumbers(numbers) {
  return numbers.map(n => ({ number: n, ...analyzeNumber(n) }));
}

export default { analyzeNumber, analyzeNumbers, SCORE_THRESHOLD };
