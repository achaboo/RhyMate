/**
 * Gemini API クライアント
 * - 無料枠あり（Google AI Studio で API キー取得、クレカ不要）
 * - ブラウザから直接呼び出し可能（CORS 対応）
 * - responseMimeType: "application/json" + responseSchema で構造化 JSON を強制取得
 */
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import type { AnalysisResult } from "../types";
import { buildPhonetic } from "./phonetics";
import { scoreRhyme } from "./scorer";

// ─── レスポンス JSON スキーマ ─────────────────────────────────────────────────

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    original: {
      type: SchemaType.OBJECT,
      properties: {
        katakana:   { type: SchemaType.STRING  },
        moras:      { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        vowels:     { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        mora_count: { type: SchemaType.NUMBER  },
      },
      required: ["katakana", "moras", "vowels", "mora_count"],
    },
    candidates: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text:       { type: SchemaType.STRING },
          katakana:   { type: SchemaType.STRING },
          moras:      { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          vowels:     { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          mora_count: { type: SchemaType.NUMBER },
        },
        required: ["text", "katakana", "moras", "vowels", "mora_count"],
      },
    },
  },
  required: ["original", "candidates"],
};

// ─── プロンプト ───────────────────────────────────────────────────────────────

const SYSTEM = `あなたは日本語ラップの超一流の韻師です。

【音韻解析ルール】
1. カタカナ読みに変換（記号・空白は除去）
2. モーラ分割: 拗音(シャ・チョ等)は2文字で1モーラ、ッ・ン・ーは各1モーラ
3. 各モーラの母音を以下で判定:
   - 母音行(ア/イ/ウ/エ/オ系) → a/i/u/e/o
   - ン → N
   - ッ → Q
   - ー → - (長音)
   例: イン→[i,N] シカ→[i,a] ハッケン→[a,Q,e,N]

【韻候補生成ルール】
- 末尾の母音パターンが元フレーズと同じ or 非常に近いこと（最重要）
- モーラ数は元フレーズ±4を目安に
- Twitter/X向きのパンチのある短文
- ダサかっこいい・煽り・ミーム感のある表現
- 各候補の音韻解析も必ず行う`;

// ─── API 呼び出し ─────────────────────────────────────────────────────────────

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

export async function generateRhymes(
  text: string,
  apiKey: string,
  count = 8
): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const prompt = `【元フレーズ】: ${text}

1. 元フレーズの音韻解析をしてください
2. 末尾の母音パターンに合う韻候補を${count}個生成し、各候補の音韻解析も行ってください`;

  const result = await model.generateContent(prompt);
  const raw: RawResponse = JSON.parse(result.response.text());

  const original = buildPhonetic(raw.original);

  const candidates = raw.candidates
    .filter(c => c.text.trim() !== text.trim())
    .map(c => {
      const phonetic = buildPhonetic(c);
      const score = scoreRhyme(original, phonetic, c.text);
      return { text: c.text, phonetic, score };
    })
    .sort((a, b) => b.score.total - a.score.total);

  return { original, originalText: text, candidates };
}
