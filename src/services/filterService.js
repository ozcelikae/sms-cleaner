/**
 * Filter Service
 * Core filtering logic combining number analysis + database checks
 */

import { analyzeNumber } from '../utils/numberAnalyzer';
import {
  isBlacklisted,
  isWhitelisted,
  logBlockedMessage,
  addToBlacklist,
} from './spamDatabase';

export const FILTER_RESULT = {
  ALLOW: 'allow',
  BLOCK: 'block',
  JUNK: 'junk',
};

/**
 * Main filter function
 * Returns { result, reason, score, category }
 */
export async function filterMessage(number, messageBody = '') {
  if (!number) {
    return { result: FILTER_RESULT.ALLOW, reason: 'Numara yok', score: 0, category: 'unknown' };
  }

  // Whitelist check — always allow
  const whitelisted = await isWhitelisted(number);
  if (whitelisted) {
    return {
      result: FILTER_RESULT.ALLOW,
      reason: 'Beyaz listede',
      score: 0,
      category: 'allowed',
    };
  }

  // Blacklist check — always block
  const blacklisted = await isBlacklisted(number);
  if (blacklisted) {
    const reason = 'Kara listede kayıtlı';
    await logBlockedMessage(number, truncatePreview(messageBody), reason, 'spam');
    return {
      result: FILTER_RESULT.BLOCK,
      reason,
      score: 100,
      category: 'spam',
    };
  }

  // Number analysis
  const analysis = analyzeNumber(number);

  if (analysis.shouldBlock) {
    const reason = analysis.reasons.join(', ');

    // Auto-add to blacklist for future fast lookups
    await addToBlacklist(number, reason, true);
    await logBlockedMessage(
      number,
      truncatePreview(messageBody),
      reason,
      analysis.category,
    );

    return {
      result: FILTER_RESULT.BLOCK,
      reason,
      score: analysis.score,
      category: analysis.category,
    };
  }

  if (analysis.score >= 30) {
    await logBlockedMessage(
      number,
      truncatePreview(messageBody),
      analysis.reasons.join(', '),
      'junk',
    );
    return {
      result: FILTER_RESULT.JUNK,
      reason: analysis.reasons.join(', '),
      score: analysis.score,
      category: 'junk',
    };
  }

  return {
    result: FILTER_RESULT.ALLOW,
    reason: 'Temiz',
    score: analysis.score,
    category: analysis.category,
  };
}

/**
 * iOS IdentityLookup compatible response
 * Returns 0 (allow) or 1 (filter/block)
 */
export async function getIosFilterAction(number) {
  const { result } = await filterMessage(number);
  // 0 = allow, 1 = filter (junk folder), 2 = block
  if (result === FILTER_RESULT.BLOCK) return 2;
  if (result === FILTER_RESULT.JUNK) return 1;
  return 0;
}

function truncatePreview(text, maxLength = 80) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

export default { filterMessage, getIosFilterAction, FILTER_RESULT };
