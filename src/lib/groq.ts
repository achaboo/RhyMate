/**
 * 語感大喜利エンジン — 生成AI + 評価AI の二段構成
 *
 * Phase 1（生成AI）: 音が近く笑える日本語フレーズを大量生成
 * Phase 2（評価AI）: 発話快感・映像性・意味飛躍・バカ度を採点
 * kuromoji: 音スコアを正確に計算
 */
import type { AnalysisResult, RhymeCandidate } from "../types";
import { buildPhoneticFromKatakana } from "./phonetics";
import { computeSoundScore, buildRhymeScore } from "./scorer";
import { toKatakana } from "./reading";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

// ─── 生成AI システムプロンプト ────────────────────────────────────────────────

const GEN_SYSTEM = `語感大喜利AI。元フレーズと「音が近く、声に出して気持ちよく、情景が浮かぶ」日本語フレーズを生成する。

【成功例】
「蓼食う虫も好き好き」→「酒飲む父もウキウキ」
「猫に小判」→「寝込み後半」
「高円寺でシャケが飲酒運転」→「高低差でバテた登山遠征」
「南極で迷子ペンギン」→「パイオツでかい子天使」

【成功の理由】意味は飛んでいい。音の流れと発話リズムを守る。情景が浮かぶ。少しアホらしい。

【禁止】元フレーズの単語流用・英単語・下品な表現
【出力】{"candidates":[{"text":"..."}]}`;

// ─── 評価AI システムプロンプト ────────────────────────────────────────────────

const EVAL_SYSTEM = `フレーズ採点AI。各フレーズを0-100で採点。
speech=声に出して気持ちいいか / imagery=情景が浮かぶか / jump=意味が適度に飛んでいるか(近すぎも飛びすぎも低点) / baka=少しアホらしいか
【出力】{"scores":[{"speech":数,"imagery":数,"jump":数,"baka":数},...]}`;

// ─── API 共通呼び出し ─────────────────────────────────────────────────────────

async function callGroq(
  system: string,
  user: string,
  apiKey: string,
  maxTokens: number
): Promise<Record<string, unknown>> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`${res.status}::${(err as { error?: { message?: string } })?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// ─── メイン ──────────────────────────────────────────────────────────────────

export async function generateRhymes(
  text: string,
  apiKey: string,
  count = 8
): Promise<AnalysisResult> {
  // ① kuromoji で元フレーズの音韻を正確に取得
  const katakana = await toKatakana(text);
  const original = buildPhoneticFromKatakana(katakana);
  const tailLen   = Math.min(6, original.moras.length);
  const tailMoras = original.moras.slice(-tailLen).join("");

  // 禁止ワード（元フレーズの2文字以上の部分文字列）
  const forbidden = new Set<string>();
  for (let len = 2; len <= text.length; len++)
    for (let i = 0; i <= text.length - len; i++)
      forbidden.add(text.slice(i, i + len));
  const hasForbidden = (s: string) => [...forbidden].some(w => s.includes(w));

  const generateCount = count + 6;

  // ② Phase 1：生成AI
  const genData = await callGroq(
    GEN_SYSTEM,
    `元:「${text}」読み:${katakana}(${original.mora_count}モーラ) 末尾:〜${tailMoras}\n語感大喜利フレーズを${generateCount}個。①日本語として意味が通る②${original.mora_count}モーラ③末尾「〜${tailMoras}」に近い音④元の単語不使用⑤各テイスト違える。JSONのみ。`,
    apiKey,
    900
  );

  const rawCandidates = ((genData.candidates ?? []) as { text?: string }[])
    .filter(c => c.text?.trim() && c.text.trim() !== text.trim() && !hasForbidden(c.text));

  if (rawCandidates.length === 0) {
    return { original, originalText: text, candidates: [] };
  }

  // ③ Phase 2：評価AI（失敗してもデフォルト値でフォールバック）
  type AiScore = { speech: number; imagery: number; jump: number; baka: number };
  const defaultScore: AiScore = { speech: 50, imagery: 50, jump: 50, baka: 50 };

  let aiScores: AiScore[] = rawCandidates.map(() => defaultScore);
  try {
    const evalData = await callGroq(
      EVAL_SYSTEM,
      `元:「${text}」への返し:\n${rawCandidates.map((c, i) => `${i + 1}.${c.text}`).join(" / ")}`,
      apiKey,
      600
    );
    const raw = (evalData.scores ?? []) as Partial<AiScore>[];
    aiScores = rawCandidates.map((_, i) => ({
      speech:  Math.min(100, Math.max(0, raw[i]?.speech  ?? 50)),
      imagery: Math.min(100, Math.max(0, raw[i]?.imagery ?? 50)),
      jump:    Math.min(100, Math.max(0, raw[i]?.jump    ?? 50)),
      baka:    Math.min(100, Math.max(0, raw[i]?.baka    ?? 50)),
    }));
  } catch {
    // 評価API失敗時はデフォルト値のまま続行
  }

  // ④ kuromoji で各候補の音韻計算 → スコア合算 → ランキング
  const candidates: RhymeCandidate[] = (
    await Promise.all(
      rawCandidates.map(async (c, i) => {
        try {
          const cKana    = await toKatakana(c.text!);
          const phonetic = buildPhoneticFromKatakana(cKana);
          const { sound_score, matched_tail } = computeSoundScore(original, phonetic);
          const ai = aiScores[i];
          const score = buildRhymeScore(sound_score, matched_tail, {
            speech_score:  ai.speech,
            imagery_score: ai.imagery,
            jump_score:    ai.jump,
            baka_score:    ai.baka,
          });
          return { text: c.text!, phonetic, score };
        } catch {
          return null;
        }
      })
    )
  )
    .filter((c): c is RhymeCandidate => c !== null)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, count);

  return { original, originalText: text, candidates };
}
