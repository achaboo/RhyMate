/**
 * 音スコアリング — kuromoji の正確な音韻データを使って計算
 * AI 評価スコア（発話快感・映像性・意味飛躍・バカ度）は groq.ts 側で付与
 */
import type { PhoneticData, RhymeScore } from "../types";

// ─── 末尾母音スコア ───────────────────────────────────────────────────────────

function tailVowelScore(v1: string[], v2: string[], k = 6): [number, number] {
  const t1 = v1.slice(-k);
  const t2 = v2.slice(-k);

  let consecutive = 0;
  const pairs = [...t1].reverse().map((a, i) => [a, [...t2].reverse()[i]] as const);
  for (const [a, b] of pairs) {
    if (b === undefined) break;
    if (a === b) consecutive++;
    else break;
  }

  const nonConsec = pairs.filter(([a, b]) => b !== undefined && a === b).length;
  const maxLen = Math.max(t1.length, t2.length) || 1;
  let score = ((consecutive * 2 + nonConsec) / (maxLen * 3)) * 100;

  if (consecutive >= 4) score = Math.min(100, score * 1.30);
  else if (consecutive >= 3) score = Math.min(100, score * 1.15);
  else if (consecutive >= 2) score = Math.min(100, score * 1.05);

  return [score, consecutive];
}

// ─── 全体母音類似度 ───────────────────────────────────────────────────────────

const VOWEL_SIMILAR: Record<string, number> = {
  "ie": 0.5, "ei": 0.5,
  "uo": 0.5, "ou": 0.5,
  "ae": 0.3, "ea": 0.3,
  "NQ": 0.3, "QN": 0.3,
};

function vowelSimilarity(vs1: string, vs2: string): number {
  if (!vs1 && !vs2) return 1;
  if (!vs1 || !vs2) return 0;
  const m = vs1.length, n = vs2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = vs1[i - 1] === vs2[j - 1]
        ? 0
        : 1 - (VOWEL_SIMILAR[vs1[i - 1] + vs2[j - 1]] ?? 0);
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

// ─── 音スコア（kuromoji ベース）─────────────────────────────────────────────

export function computeSoundScore(
  original: PhoneticData,
  candidate: PhoneticData
): { sound_score: number; matched_tail: number } {
  const [tail, matched_tail] = tailVowelScore(original.vowels, candidate.vowels);
  const vowel = vowelSimilarity(original.vowel_str, candidate.vowel_str) * 100;
  const moraDiff = Math.abs(original.mora_count - candidate.mora_count);
  const mora = moraDiff === 0 ? 100 : moraDiff === 1 ? 75 : moraDiff === 2 ? 45 : Math.max(0, 20 - moraDiff * 5);
  const sound_score = Math.min(100, Math.round((tail * 0.5 + vowel * 0.3 + mora * 0.2) * 10) / 10);
  return { sound_score, matched_tail };
}

// ─── RhymeScore 組み立て ─────────────────────────────────────────────────────

export function buildRhymeScore(
  sound_score: number,
  matched_tail: number,
  ai: { speech_score: number; imagery_score: number; jump_score: number; baka_score: number }
): RhymeScore {
  const total =
    sound_score        * 0.40 +
    ai.speech_score    * 0.25 +
    ai.imagery_score   * 0.15 +
    ai.jump_score      * 0.10 +
    ai.baka_score      * 0.10;
  const t = Math.round(total * 10) / 10;
  const grade = t >= 80 ? "S" : t >= 65 ? "A" : t >= 50 ? "B" : "C";
  return {
    total: t,
    sound_score,
    speech_score:  Math.round(ai.speech_score  * 10) / 10,
    imagery_score: Math.round(ai.imagery_score * 10) / 10,
    jump_score:    Math.round(ai.jump_score    * 10) / 10,
    baka_score:    Math.round(ai.baka_score    * 10) / 10,
    matched_tail,
    grade: grade as RhymeScore["grade"],
  };
}
