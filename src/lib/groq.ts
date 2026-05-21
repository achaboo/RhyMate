/**
 * Groq API クライアント
 * - 完全無料・クレジットカード不要（console.groq.com でアカウント作成のみ）
 * - OpenAI 互換 API を fetch で直接呼び出し（追加パッケージ不要）
 */
import type { AnalysisResult } from "../types";
import { buildPhonetic, buildPhoneticFromKatakana } from "./phonetics";
import { scoreRhyme } from "./scorer";
import { toKatakana } from "./reading";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

// ─── プロンプト ───────────────────────────────────────────────────────────────

const SYSTEM = `お前は日本語ラップ界最強の「音ハメ」職人だ。
韻を踏みながら人を爆笑させるか、刺さる毒を吐くか、思わずRTしたくなるフレーズを量産するのが仕事だ。

【絶対禁止】
- 退屈・平凡・予測可能なフレーズ
- 似たような言い回しの使いまわし（「〜案件」「〜発見」を連発しない）
- 意味が薄い・インパクトに欠ける表現
- 同じ単語・同じ構造の繰り返し

【音ハメの鉄則】
単語を一つずつ考えてはいけない。
フレーズ全体を区切らず、一本の母音チェーンとして捉え、そのチェーン全体に新しい言葉を当てはめる。

【母音チェーンの作り方】
カタカナ → モーラ分割 → 各モーラの母音を抽出
  ア行系→a / イ行系→i / ウ行系→u / エ行系→e / オ行系→o
  ン→N / ッ→Q / ー→-(長音)

【面白いフレーズの作り方】
1. 末尾4〜6モーラの母音を完全一致（死守・最重要）
2. モーラ数を元フレーズと完全に一致させる（字余り厳禁）
3. 固有名詞・ネットスラング・Z世代語・自虐・毒舌・社会風刺を積極活用
4. 意外性・ギャップ・ボケが命
5. 候補ごとにテイストを変える（爆笑系・毒舌系・エモ系・煽り系・時事ネタ系など）

【面白いフレーズの具体例】
元フレーズ: 韻しか踏まない奴発見（末尾母音: a-Q-e-N）
  ×つまらない: 「品位が瀕死の人事案件」→ ありきたり
  ○爆笑系: 「引きこもりのオタク大集結」
  ○毒舌系: 「チー牛がドヤ顔で自己主張」
  ○Z世代系: 「エモいとか言ってる陰キャ卍」
  ○時事ネタ: 「AIに職を奪われた残念な末路」

【出力形式】必ず以下のJSONのみを返してください。説明文・コードブロック不要。
{
  "candidates": [
    {
      "text": "候補フレーズ",
      "katakana": "カタカナ読み",
      "moras": ["モーラ1","モーラ2"],
      "vowels": ["母音1","母音2"],
      "mora_count": 数値
    }
  ]
}`;

// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface RawPhonetic {
  katakana: string;
  moras: string[];
  vowels: string[];
  mora_count: number;
}

interface RawResponse {
  candidates: ({ text: string } & RawPhonetic)[];
}

// ─── API 呼び出し ─────────────────────────────────────────────────────────────

export async function generateRhymes(
  text: string,
  apiKey: string,
  count = 8
): Promise<AnalysisResult> {
  // kuromoji で正確な読みをローカル計算
  let katakana = "";
  try {
    katakana = await toKatakana(text);
  } catch {
    // 失敗した場合は LLM に任せる（後述のフォールバック）
  }

  const original = katakana
    ? buildPhoneticFromKatakana(katakana)
    : null;

  const phoneticsInfo = original
    ? `【正確な読み（カタカナ）】: ${original.katakana}
【モーラ分割】: ${original.moras.join("・")}
【母音チェーン】: ${original.vowels.join("-")}
【モーラ数】: ${original.mora_count}
【末尾母音（重要）】: ${original.vowels.slice(-6).join("-")}`
    : `Step1: 元フレーズをカタカナに変換し、モーラ分割して母音チェーンを作れ。`;

  const charCount = [...text].length;

  const userPrompt = `【元フレーズ】: ${text}
${phoneticsInfo}
【文字数】: ${charCount}文字

以下の条件で候補を${count}個生成せよ:
1. 末尾の母音が元フレーズと一致（絶対条件）
2. モーラ数を元フレーズと完全に一致させる（字余り厳禁。どうしても無理な場合のみ±1まで許容）
3. 候補の文字数を${charCount}文字の±3文字以内に必ず収めること（これは絶対条件）
4. 英単語・ローマ字・アルファベット表記は使わない（日本語・漢字・カタカナのみ）
5. 全体の母音の流れも可能な限り近づける
6. 固有名詞・スラング・時事ネタ・Z世代語など使ってとにかくパンチのある表現にする
7. 候補ごとにテイスト（爆笑・毒舌・エモ・煽り・社会風刺）を必ず変える
8. 似たような表現・構造の繰り返し厳禁

各候補の音韻解析（katakana・moras・vowels・mora_count）も必ず出力すること。
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

  // original は kuromoji 優先、失敗時は LLM フォールバック用に空データ
  const finalOriginal = original ?? buildPhoneticFromKatakana("");

  const candidates = (raw.candidates ?? [])
    .filter(c => c.text?.trim() !== text.trim())
    .map(c => {
      const phonetic = buildPhonetic(c);
      const score    = scoreRhyme(finalOriginal, phonetic, c.text);
      return { text: c.text, phonetic, score };
    })
    .sort((a, b) => b.score.total - a.score.total);

  return { original: finalOriginal, originalText: text, candidates };
}
