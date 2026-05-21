/**
 * Groq API クライアント
 * - 完全無料・クレジットカード不要（console.groq.com でアかウント作成のみ）
 * - OpenAI 互換 API を fetch で直接呼び出し（追加パッケージ不要）
 *
 * 設計方針:
 *   LLM  → 「末尾の音が合う自然な日本語フレーズ」を大量生成するだけ
 *   kuromoji → 各候補の音韻を正確に計算してスコアリング・ランキング
 */
import type { AnalysisResult } from "../types";
import { buildPhoneticFromKatakana } from "./phonetics";
import { scoreRhyme } from "./scorer";
import { toKatakana } from "./reading";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

// ─── プロンプト ───────────────────────────────────────────────────────────────

const SYSTEM = `お前は日本語の「韻踏み」達人だ。
与えられたフレーズと「末尾の音が一致する」新しいフレーズを生成するのが仕事だ。

【韻とは何か】
発音したときに末尾数モーラの音が一致すること。
例: 「ドラゴンボール」の末尾「ン・ボ・ー・ル」
    →「ジャンボボール」「アンコボール」なども同じ末尾音で韻を踏んでいる

【禁止事項】
- 英単語・アルファベット表記
- 下品・卑猥・差別的な表現
- 元フレーズに含まれる単語の流用

【出力形式】以下のJSONのみ返せ。説明文・コードブロック不要。
{"candidates": [{"text": "候補フレーズ"}]}`;

// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface RawResponse {
  candidates: { text: string }[];
}

// ─── API 呼び出し ─────────────────────────────────────────────────────────────

export async function generateRhymes(
  text: string,
  apiKey: string,
  count = 8
): Promise<AnalysisResult> {
  // ① kuromoji で元フレーズの正確な音韻を取得
  const katakana = await toKatakana(text);
  const original = buildPhoneticFromKatakana(katakana);

  // 末尾モーラ（最大6）を実際のカタカナで取り出す
  const tailLen   = Math.min(6, original.moras.length);
  const tailMoras = original.moras.slice(-tailLen).join("");
  const tailVowels = original.vowels.slice(-tailLen).join("-");

  // ② LLM には「末尾の音を合わせた自然な日本語」の生成だけ頼む
  //    phonetics 計算は kuromoji に任せるので LLM に計算させない
  const generateCount = count * 3; // 多めに生成して後で絞る

  const userPrompt = `元フレーズ: 「${text}」
読み: ${katakana}（${original.mora_count}モーラ）
末尾の音: 〜${tailMoras}（母音: ${tailVowels}）

↑ この末尾と同じ音で終わる日本語フレーズを${generateCount}個生成せよ。

条件（優先度順）:
1. 発音したとき末尾「〜${tailMoras}」と同じ音で終わること（最重要）
2. ${original.mora_count}モーラに合わせること
3. 日本語として意味が通ること
4. 元フレーズの単語を使わないこと
5. 日本語のみ（英単語・アルファベット禁止）
6. 下品・差別的な表現は禁止
7. 口語・砕けた表現・体言止めなど自由に使ってよい
8. 候補ごとにテイストを変えること（ユーモア・自虐・エモ・社会風刺など）

JSONのみで返せ。`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const msg = err?.error?.message ?? res.statusText;
    throw new Error(`${res.status}::${msg}`);
  }

  const data = await res.json();
  const raw: RawResponse = JSON.parse(data.choices[0].message.content);

  // ③ 各候補を kuromoji で正確に音韻計算してスコアリング
  const scored = await Promise.all(
    (raw.candidates ?? [])
      .filter(c => c.text?.trim() && c.text.trim() !== text.trim())
      .map(async c => {
        try {
          const cKana    = await toKatakana(c.text);
          const phonetic = buildPhoneticFromKatakana(cKana);
          const score    = scoreRhyme(original, phonetic, c.text);
          return { text: c.text, phonetic, score };
        } catch {
          return null;
        }
      })
  );

  // ④ スコア順に並べて上位 count 件を返す
  const candidates = scored
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, count);

  return { original, originalText: text, candidates };
}
