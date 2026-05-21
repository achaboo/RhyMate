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
  tail_score: number;
  vowel_score: number;
  mora_score: number;
  impact_score: number;
  meme_score: number;
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
