/**
 * 韻スコアリング — 純粋な TypeScript 実装（ネットワーク呼び出しなし）
 */
import type { PhoneticData, RhymeScore } from "../types";

// ─── 末尾母音スコア ────────────────────────────────────────────────────────────

function tailVowelScore(v1: string[], v2: string[], k = 6): [number, number] {
  const t1 = v1.slice(-k);
  const t2 = v2.slice(-k);

  // 末尾から連続一致数
  let consecutive = 0;
  const pairs = [...t1].reverse().map((a, i) => [a, [...t2].reverse()[i]] as const);
  for (const [a, b] of pairs) {
    if (b === undefined) break;
    if (a === b) consecutive++;
    else break;
  }

  // 末尾 k 個の総一致数（連続でなくても加点）
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

// ─── インパクトスコア ─────────────────────────────────────────────────────────

const STRONG_KANA = new Set("カキクケコタテトパピプペポバビブベボ".split(""));

function impactScore(p: PhoneticData): number {
  let s = 50;
  if (p.vowels.includes("Q")) s += 10;
  if (p.vowels[p.vowels.length - 1] === "N") s += 8;
  if (p.mora_count >= 8 && p.mora_count <= 16) s += 5;
  if (p.mora_count < 5) s -= 12;
  else if (p.mora_count > 22) s -= 6;
  const strong = [...p.katakana].filter(c => STRONG_KANA.has(c)).length;
  s += Math.min(12, strong * 3);
  return Math.min(100, Math.max(0, s));
}

// ─── ミーム感スコア ───────────────────────────────────────────────────────────

const MEME_ENDINGS = ["案件", "事案", "発見", "確認", "以上", "完全", "元気",
                      "人生", "解散", "終焉", "崩壊", "限界", "頂点", "覚醒"];

function memeScore(p: PhoneticData, originalText: string): number {
  let s = 40;
  const len = originalText.length;
  if (len >= 10 && len <= 25) s += 15;
  else if (len < 10) s += 5;
  for (const v of "aiueo") {
    if (p.vowel_str.split("").filter(x => x === v).length >= 3) { s += 5; break; }
  }
  for (const e of MEME_ENDINGS) {
    if (originalText.slice(-8).includes(e)) { s += 12; break; }
  }
  if (originalText.includes("！") || originalText.includes("!")) s += 5;
  return Math.min(100, Math.max(0, s));
}

// ─── メイン ──────────────────────────────────────────────────────────────────

export function scoreRhyme(
  original: PhoneticData,
  candidate: PhoneticData,
  candidateText: string
): RhymeScore {
  const [tail, matched_tail] = tailVowelScore(original.vowels, candidate.vowels);
  const vowel = vowelSimilarity(original.vowel_str, candidate.vowel_str) * 100;
  const moraDiff = Math.abs(original.mora_count - candidate.mora_count);
  const mora = moraDiff === 0 ? 100 : moraDiff === 1 ? 75 : moraDiff === 2 ? 45 : Math.max(0, 20 - moraDiff * 5);
  const impact = impactScore(candidate);
  const meme = memeScore(candidate, candidateText);

  const total = tail * 0.45 + vowel * 0.20 + mora * 0.20 + impact * 0.10 + meme * 0.05;
  const grade =
    total >= 80 ? "S" :
    total >= 65 ? "A" :
    total >= 50 ? "B" : "C";

  return {
    total: Math.round(total * 10) / 10,
    tail_score: Math.round(tail * 10) / 10,
    vowel_score: Math.round(vowel * 10) / 10,
    mora_score: Math.round(mora * 10) / 10,
    impact_score: Math.round(impact * 10) / 10,
    meme_score: Math.round(meme * 10) / 10,
    matched_tail,
    grade: grade as RhymeScore["grade"],
  };
}
