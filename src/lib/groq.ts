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

const SYSTEM = `あなたは日本語ラップの「音ハメ」職人です。
音ハメとは、元フレーズの母音列を「型」として、全く新しい言葉を当てはめる技術です。

【音ハメの鉄則】
単語を一つずつ考えてはいけない。
フレーズ全体を区切らず、「イ・ン・シ・カ・フ・マ・ナ・イ・ヤ・ツ・ハッ・ケ・ン」のように
一本の母音チェーンとして捉え、そのチェーン全体に新しい言葉を当てはめる。

【母音チェーンの作り方】
カタカナ → モーラ分割 → 各モーラの母音を抽出
  ア行系→a / イ行系→i / ウ行系→u / エ行系→e / オ行系→o
  ン→N / ッ→Q / ー→-(長音)

【具体例で学ぶ音ハメ】
元フレーズ: 韻しか踏まない奴発見
読み: イン・シ・カ・フ・マ・ナ・イ・ヤ・ツ・ハッ・ケ・ン
母音型: [i,N]-[i]-[a]-[u]-[a]-[a]-[i]-[a]-[u]-[a,Q]-[e]-[N]
末尾型(重要): a-Q-e-N

音ハメ成功例:
  「品位が瀕死の人事案件」→ ヒン・イ・ガ・ヒン・シ・ノ・ジン・ジ・ア・ン・ケ・ン
   母音: [i,N]-[i]-[a]-[i,N]-[i]-[o]-[i,N]-[i]-[a]-[N]-[e]-[N]
   末尾: N-e-N ← a-Q-e-N と韻を踏んでいる ✓

  「韻踏み気取りの瀕死案件」→ インフミキドリノヒンシアンケン
   末尾: N-e-N ✓

【生成のコツ】
1. まず母音型の末尾4〜6モーラを確定させる（ここが最重要）
2. その末尾に向かって自然につながる言葉を逆算して組み立てる
3. 単語の区切りを気にしない。音が合えば意味は後から付ける
4. ダサかっこいい・煽り・ミーム感のある表現にする

【出力形式】必ず以下のJSONのみを返してください。説明文・コードブロック不要。
{
  "original": {
    "katakana": "カタカナ読み（記号除去済み）",
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

Step1: 元フレーズをカタカナに変換し、モーラ分割して母音チェーンを作れ。
Step2: その母音チェーンを一本のまとまりとして捉え、単語を区切らずに音ハメせよ。
Step3: 特に末尾4〜6モーラの母音を元フレーズと一致させた候補を${count}個生成せよ。

候補の条件:
- 末尾の母音が元フレーズと一致（絶対条件）
- 全体の母音の流れも可能な限り近づける
- モーラ数は元フレーズ±4以内
- Twitter/X向きのパンチのある短文
- ダサかっこいい・煽り・ミーム感

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
