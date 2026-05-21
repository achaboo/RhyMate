/**
 * 音韻ユーティリティ — Claude が返したカタカナ・モーラから派生フィールドを計算する
 * (読み変換自体は Claude API が担う)
 */
import type { PhoneticData } from "../types";

// ─── 母音マッピング ───────────────────────────────────────────────────────────

const COMPOUND_KANA: Record<string, string> = {
  キャ: "a", キュ: "u", キョ: "o",
  ギャ: "a", ギュ: "u", ギョ: "o",
  シャ: "a", シュ: "u", ショ: "o",
  ジャ: "a", ジュ: "u", ジョ: "o",
  チャ: "a", チュ: "u", チョ: "o",
  ニャ: "a", ニュ: "u", ニョ: "o",
  ヒャ: "a", ヒュ: "u", ヒョ: "o",
  ビャ: "a", ビュ: "u", ビョ: "o",
  ピャ: "a", ピュ: "u", ピョ: "o",
  ミャ: "a", ミュ: "u", ミョ: "o",
  リャ: "a", リュ: "u", リョ: "o",
  ファ: "a", フィ: "i", フェ: "e", フォ: "o",
  ティ: "i", ディ: "i", トゥ: "u", ドゥ: "u",
  ウィ: "i", ウェ: "e", ウォ: "o",
  ヴァ: "a", ヴィ: "i", ヴェ: "e", ヴォ: "o",
  イェ: "e",
};

const SINGLE_KANA: Record<string, string> = {
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
  カ: "a", キ: "i", ク: "u", ケ: "e", コ: "o",
  ガ: "a", ギ: "i", グ: "u", ゲ: "e", ゴ: "o",
  サ: "a", シ: "i", ス: "u", セ: "e", ソ: "o",
  ザ: "a", ジ: "i", ズ: "u", ゼ: "e", ゾ: "o",
  タ: "a", チ: "i", ツ: "u", テ: "e", ト: "o",
  ダ: "a", ヂ: "i", ヅ: "u", デ: "e", ド: "o",
  ナ: "a", ニ: "i", ヌ: "u", ネ: "e", ノ: "o",
  ハ: "a", ヒ: "i", フ: "u", ヘ: "e", ホ: "o",
  バ: "a", ビ: "i", ブ: "u", ベ: "e", ボ: "o",
  パ: "a", ピ: "i", プ: "u", ペ: "e", ポ: "o",
  マ: "a", ミ: "i", ム: "u", メ: "e", モ: "o",
  ヤ: "a", ユ: "u", ヨ: "o",
  ラ: "a", リ: "i", ル: "u", レ: "e", ロ: "o",
  ワ: "a", ヲ: "o",
  ン: "N", ッ: "Q", ー: "-",
  ヴ: "u",
};

export function moraToVowel(mora: string): string | undefined {
  return COMPOUND_KANA[mora] ?? SINGLE_KANA[mora];
}

/** カタカナ文字列をモーラ配列に分割 */
export function katakanaToMoras(katakana: string): string[] {
  const moras: string[] = [];
  let i = 0;
  while (i < katakana.length) {
    if (i + 1 < katakana.length && COMPOUND_KANA[katakana.slice(i, i + 2)]) {
      moras.push(katakana.slice(i, i + 2));
      i += 2;
    } else {
      moras.push(katakana[i]);
      i++;
    }
  }
  return moras;
}

/** Claude から受け取った生データを PhoneticData に整形 */
export function buildPhonetic(raw: {
  katakana: string;
  moras: string[];
  vowels: string[];
  mora_count: number;
}): PhoneticData {
  const vowel_str = raw.vowels.join("");
  const tail_vowels = raw.vowels.slice(-4);
  return {
    katakana: raw.katakana,
    moras: raw.moras,
    vowels: raw.vowels,
    mora_count: raw.mora_count,
    vowel_str,
    tail_vowels,
  };
}
