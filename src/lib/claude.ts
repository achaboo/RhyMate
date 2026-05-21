/**
 * Claude API クライアント
 * - dangerouslyAllowBrowser: true でブラウザから直接呼び出し
 * - tool_use で構造化 JSON を強制取得
 */
import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult } from "../types";
import { buildPhonetic } from "./phonetics";
import { scoreRhyme } from "./scorer";

// ─── Tool 定義 ────────────────────────────────────────────────────────────────

const RHYME_TOOL: Anthropic.Tool = {
  name: "rhyme_analysis",
  description: "日本語フレーズの音韻解析結果と韻候補をまとめて返す",
  input_schema: {
    type: "object",
    required: ["original", "candidates"],
    properties: {
      original: {
        type: "object",
        required: ["katakana", "moras", "vowels", "mora_count"],
        description: "元フレーズの音韻解析",
        properties: {
          katakana:   { type: "string", description: "カタカナ読み（例: インシカフマナイヤツハッケン）" },
          moras:      { type: "array",  items: { type: "string" }, description: "モーラリスト" },
          vowels:     { type: "array",  items: { type: "string" }, description: "各モーラの母音 (a/i/u/e/o/N/Q/-)" },
          mora_count: { type: "number", description: "モーラ数" },
        },
      },
      candidates: {
        type: "array",
        description: "韻候補リスト",
        items: {
          type: "object",
          required: ["text", "katakana", "moras", "vowels", "mora_count"],
          properties: {
            text:       { type: "string" },
            katakana:   { type: "string" },
            moras:      { type: "array", items: { type: "string" } },
            vowels:     { type: "array", items: { type: "string" } },
            mora_count: { type: "number" },
          },
        },
      },
    },
  },
};

// ─── システムプロンプト ───────────────────────────────────────────────────────

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

interface ToolInput {
  original: RawPhonetic;
  candidates: ({ text: string } & RawPhonetic)[];
}

export async function generateRhymes(
  text: string,
  apiKey: string,
  count = 8
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const userPrompt = `【元フレーズ】: ${text}

1. 元フレーズの音韻解析をしてください
2. 末尾の母音パターンに合う韻候補を${count}個生成し、各候補の音韻解析も行ってください

rhyme_analysis ツールで返してください。`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [RHYME_TOOL],
    tool_choice: { type: "tool", name: "rhyme_analysis" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolBlock = response.content.find(b => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Claude からの応答を解析できませんでした。");
  }

  const raw = toolBlock.input as ToolInput;
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
