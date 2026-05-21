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
与えられたフレーズと「発音が似た音で終わる」新しいフレーズを生成するのが仕事だ。

【理想の韻踏みの例】
元フレーズ:「蓼食う虫も好き好き」（タデクウムシモスキズキ）
             a  e u u u i o u i u i
韻踏み例  :「酒飲む父もウキウキ」（サケノムチチモウキウキ）
             a  e o u i i o u i u i
→ 末尾「ウキウキ（u-i-u-i）」がぴったり一致。全体の母音の流れも近い。
→ 日常的な言葉で、読んで意味が通り、思わず笑えるフレーズ。これが正解。

【絶対禁止（1つでも違反したら失格）】
- 元フレーズに含まれる単語・文字を候補に使うこと（完全に別の語彙を使え）
- 英単語・アルファベット表記
- 下品・卑猥・差別的な表現

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

  // ② LLM には「末尾の音を合わせた自然な日本語」の生成だけ頼む
  //    phonetics 計算は kuromoji に任せるので LLM に計算させない
  const generateCount = count * 3; // 多めに生成して後で絞る

  const userPrompt = `元フレーズ: 「${text}」
読み: ${katakana}（${original.mora_count}モーラ）
狙う末尾の音: 〜${tailMoras}

↑ 日本語として自然に読めて、かつ発音が「〜${tailMoras}」に近い音で終わるフレーズを${generateCount}個生成せよ。

【絶対禁止】「${text}」に含まれる単語・文字を1文字も使うな。完全に別の語彙で作れ。

条件（優先度順）:
1. 日本語として意味が通ること（gibberishは絶対禁止）
2. ${original.mora_count}モーラに合わせること
3. 発音が末尾「〜${tailMoras}」に近い音で終わること（近いほど良い）
4. 日本語のみ（英単語・アルファベット禁止）
5. 下品・差別的な表現は禁止
6. 口語・砕けた表現・体言止めなど自由に使ってよい
7. 候補ごとにテイストを変えること（ユーモア・自虐・エモ・社会風刺など）

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
