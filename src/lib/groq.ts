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

const SYSTEM = `お前は日本語ラップの「音ハメ」職人だ。
音ハメとは「母音骨格（ボーカルスケルトン）」を全モーラにわたって守りながら、
全く新しい言葉を当てはめる技法だ。末尾だけ合っても失敗——全スロットが命だ。

【母音別カタカナ対応表（必ず参照せよ）】
a → ア段: ア/カ/ガ/サ/ザ/タ/ダ/ナ/ハ/バ/パ/マ/ヤ/ラ/ワ/ャ/キャ/シャ/チャ/ニャ/ヒャ/ミャ/リャ等
i → イ段: イ/キ/ギ/シ/ジ/チ/ヂ/ニ/ヒ/ビ/ピ/ミ/リ/ィ/ティ/ディ等
u → ウ段: ウ/ク/グ/ス/ズ/ツ/ヅ/ヌ/フ/ブ/プ/ム/ユ/ル/ュ/キュ/シュ/チュ/ニュ/ヒュ/ミュ/リュ等
e → エ段: エ/ケ/ゲ/セ/ゼ/テ/デ/ネ/ヘ/ベ/ペ/メ/レ/ェ/ティ→エ等
o → オ段: オ/コ/ゴ/ソ/ゾ/ト/ド/ノ/ホ/ボ/ポ/モ/ヨ/ロ/ヲ/ョ/キョ/ショ/チョ/ニョ/ヒョ/ミョ/リョ等
N → ン（撥音。直前の音と合わせて発音）
Q → ッ（促音。次の子音を詰める）
- → ー（長音。直前の母音を伸ばす）

【音ハメの正しい手順】
STEP1: ユーザーが渡す「母音スロット表」を左から右に見る
STEP2: スロット1から順に、その母音を持つカタカナを仮置きする
STEP3: 仮置きした音の列が自然な日本語になるよう言葉を当てはめる
STEP4: 全スロットの母音が元フレーズと完全一致しているか確認する
STEP5: OKなら出力。NGならSTEP2に戻る

【禁止事項】
- 英単語・ローマ字・アルファベット表記（日本語・漢字・カタカナのみ）
- 同じ言い回し・構造の繰り返し
- 退屈・平凡・予測可能なフレーズ

【推奨事項】
- 固有名詞・ネットスラング・Z世代語・毒舌・自虐・社会風刺・時事ネタ
- 意外性とパンチのある表現

【出力形式】以下のJSONのみ返すこと。説明文・コードブロック不要。
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
    // 失敗した場合は LLM に任せる
  }

  const original = katakana
    ? buildPhoneticFromKatakana(katakana)
    : null;

  const charCount = [...text].length;

  // 母音スロット表を視覚的に構築
  const buildSlotTable = (vowels: string[]): string => {
    const nums = vowels.map((_, i) => String(i + 1).padStart(2));
    const vs   = vowels.map(v => v.padEnd(2));
    return `番号: ${nums.join(" ")}\n母音: ${vs.join(" ")}`;
  };

  const slotTable = original
    ? buildSlotTable(original.vowels)
    : "（読み取得失敗：LLMが母音を判断してください）";

  const moraCount = original?.mora_count ?? "不明";
  const tailVowels = original?.vowels.slice(-6).join("-") ?? "";

  const userPrompt = `【元フレーズ】: ${text}
【文字数】: ${charCount}文字
【モーラ数】: ${moraCount}モーラ
【カタカナ読み】: ${original?.katakana ?? "（不明）"}

■ 母音スロット表（全${moraCount}モーラ）:
${slotTable}

■ 末尾スロット（最重要・死守）: ${tailVowels}

■ 音ハメ手順:
まずスロット1から順に各母音に対応するカタカナを仮置きし、
その音の列から意味が通る・面白いフレーズを逆算して組み立てよ。
完成したら全スロットの母音が上記表と一致しているか必ず確認せよ。

■ 絶対条件（優先度順）:
1. 全スロットの母音が元フレーズと完全一致（最重要・妥協不可）
2. モーラ数を${moraCount}モーラに完全一致させる（字余り厳禁）
3. 候補の文字数を${charCount}文字の±3文字以内に収める
4. 日本語・漢字・カタカナのみ使用（英単語・アルファベット禁止）
5. 面白い・パンチがある・意外性がある内容
6. 候補${count}個それぞれでテイストを変える（爆笑・毒舌・エモ・煽り・社会風刺など）

各候補の音韻解析（katakana・moras・vowels・mora_count）も出力すること。
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
      temperature: 0.9,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const msg = err?.error?.message ?? res.statusText;
    throw new Error(`${res.status}::${msg}`);
  }

  const data = await res.json();
  const raw: RawResponse = JSON.parse(data.choices[0].message.content);

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
