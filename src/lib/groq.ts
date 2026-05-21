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

const SYSTEM = `日本語韻踏み。末尾の音が近い別フレーズを作る。
例:「蓼食う虫も好き好き」→「酒飲む父もウキウキ」（末尾u-i-u-i一致・自然な日本語）
禁止: 元フレーズの単語流用・英単語・下品な表現
出力: {"candidates":[{"text":"..."}]}`;

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

  // ② LLM には「末尾の音を合わせた自然な日本語」の生成だけ頼む
  //    phonetics 計算は kuromoji に任せるので LLM に計算させない
  const generateCount = count + 4; // 少し多めに生成して後で絞る

  const userPrompt = `元:「${text}」読み:${katakana}(${original.mora_count}モーラ) 末尾:〜${tailMoras}

↑と末尾音が近い日本語フレーズを${generateCount}個。①意味が通る②${original.mora_count}モーラ③末尾「〜${tailMoras}」に近い音④元の単語不使用⑤口語OK⑥各テイスト違える。JSONのみ。`;

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
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const msg = err?.error?.message ?? res.statusText;
    throw new Error(`${res.status}::${msg}`);
  }

  const data = await res.json();
  const raw: RawResponse = JSON.parse(data.choices[0].message.content);

  // 元フレーズから2文字以上の部分文字列を禁止ワードとして抽出
  const forbidden = new Set<string>();
  for (let len = 2; len <= text.length; len++) {
    for (let i = 0; i <= text.length - len; i++) {
      forbidden.add(text.slice(i, i + len));
    }
  }
  const containsForbidden = (s: string) =>
    [...forbidden].some(w => s.includes(w));

  // ③ 各候補を kuromoji で正確に音韻計算してスコアリング
  const scored = await Promise.all(
    (raw.candidates ?? [])
      .filter(c => c.text?.trim() && c.text.trim() !== text.trim() && !containsForbidden(c.text))
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
