/**
 * Number Analyzer Engine
 * Score-based analysis for detecting spam/short-code senders
 */

export const SCORE_THRESHOLD = 60;

/** Check if the number contains only digits */
function isNumericOnly(number) {
  return /^\d+$/.test(number.trim());
}

/** Check for repeating digits: 111111, 999999 */
function hasRepeatingDigits(number) {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 4) return false;
  return /^(\d)\1{3,}$/.test(cleaned);
}

/** Check for sequential digits: 123456, 654321 */
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

/** Check for short code: 4–6 digit service numbers */
function isShortCode(number) {
  const cleaned = number.replace(/\D/g, '');
  return cleaned.length >= 4 && cleaned.length <= 6;
}

/** Check for 850-prefix numbers (Turkey premium-rate lines) */
function starts850(number) {
  const cleaned = number.replace(/\D/g, '');
  return cleaned.startsWith('850') || cleaned.startsWith('90850');
}

/** International format (+90...) → always safe */
function isInternationalFormat(number) {
  return number.trim().startsWith('+');
}

/**
 * Main analysis function
 * Returns: { score, reasons, shouldBlock, category }
 */
export function analyzeNumber(rawNumber) {
  if (!rawNumber || typeof rawNumber !== 'string') {
    return { score: 0, reasons: [], shouldBlock: false, category: 'unknown' };
  }

  const number = rawNumber.trim();
  let score = 0;
  const reasons = [];

  // International format → always safe
  if (isInternationalFormat(number)) {
    return { score: 0, reasons: [], shouldBlock: false, category: 'allowed' };
  }

  // 850-prefix premium-rate numbers
  if (starts850(number)) {
    score += 70;
    reasons.push('850 premium-rate prefix');
  }

  // Numeric-only senders
  if (isNumericOnly(number)) {
    score += 40;
    reasons.push('Numeric-only sender');

    if (hasRepeatingDigits(number)) {
      score += 30;
      reasons.push('Repeating digits');
    }

    if (hasSequentialDigits(number)) {
      score += 30;
      reasons.push('Sequential digits');
    }

    if (isShortCode(number)) {
      score += 20;
      reasons.push('Short code (service number)');
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
