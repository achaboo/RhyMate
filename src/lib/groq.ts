/**
 * Groq API クライアント
 * - 完全無料・クレジットカード不要（console.groq.com でアカウント作成のみ）
 * - OpenAI 互換 API を fetch で直接呼び出し（追加パッケージ不要）
 */
import type { AnalysisResult } from "../types";
import { buildPhonetic } from "./phonetics";
import { scoreRhyme } from "./scorer";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

// ─── プロンプト ───────────────────────────────────────────────────────────────

const SYSTEM = `あなたは日本語ラップの超一流の韻師です。
ユーザーから日本語フレーズを受け取り、音韻解析と韻候補生成を行います。

【音韻解析ルール】
- カタカナ読みに変換（記号・空白は除去）
- モーラ分割: 拗音(シャ・チョ等)は2文字で1モーラ、ッ・ン・ーは各1モーラ
- 各モーラの母音: ア行系→a, イ行系→i, ウ行系→u, エ行系→e, オ行系→o, ン→N, ッ→Q, ー→-

【出力形式】必ず以下のJSONのみを返してください。説明文・コードブロック不要。
{
  "original": {
    "katakana": "カタカナ読み",
    "moras": ["モーラ1","モーラ2"],
    "vowels": ["母音1","母音2"],
    "mora_count": 数値
  },
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
  original: RawPhonetic;
  candidates: ({ text: string } & RawPhonetic)[];
}

// ─── API 呼び出し ─────────────────────────────────────────────────────────────

export async function generateRhymes(
  text: string,
  apiKey: string,
  count = 8
): Promise<AnalysisResult> {
  const userPrompt = `【元フレーズ】: ${text}

手順:
1. 元フレーズの音韻解析（カタカナ読み・モーラ分割・母音列）
2. 末尾の母音パターンに合う韻候補を${count}個生成（各候補の音韻解析も行う）

韻候補の条件:
- 末尾の母音パターンが元フレーズと同じ or 非常に近い（最重要）
- モーラ数は元フレーズ±4を目安
- Twitter/X向きのパンチのある短文
- ダサかっこいい・煽り・ミーム感のある表現

JSONのみで返してください。`;

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
      temperature: 0.85,
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

  const original = buildPhonetic(raw.original);
  const candidates = (raw.candidates ?? [])
    .filter(c => c.text?.trim() !== text.trim())
    .map(c => {
      const phonetic = buildPhonetic(c);
      const score    = scoreRhyme(original, phonetic, c.text);
      return { text: c.text, phonetic, score };
    })
    .sort((a, b) => b.score.total - a.score.total);

  return { original, originalText: text, candidates };
}
