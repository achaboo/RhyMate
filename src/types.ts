export interface PhoneticData {
  katakana: string;
  moras: string[];
  vowels: string[];
  mora_count: number;
  vowel_str: string;
  tail_vowels: string[];
}

export interface RhymeScore {
  total: number;
  sound_score: number;    // 音スコア   40pt：末尾・母音・モーラ近似
  speech_score: number;   // 発話快感   25pt：声に出して気持ちいいか
  imagery_score: number;  // 映像性     15pt：情景が浮かぶか
  jump_score: number;     // 意味飛躍   10pt：意味が適度に飛んでいるか
  baka_score: number;     // バカ度     10pt：少しアホらしいか
  matched_tail: number;
  grade: "S" | "A" | "B" | "C";
}

export interface RhymeCandidate {
  text: string;
  phonetic: PhoneticData;
  score: RhymeScore;
}

export interface AnalysisResult {
  original: PhoneticData;
  originalText: string;
  candidates: RhymeCandidate[];
}
