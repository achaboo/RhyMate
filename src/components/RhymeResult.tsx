import type { AnalysisResult, RhymeCandidate } from "../types";
import { ScoreDisplay } from "./ScoreDisplay";

const GRADE: Record<string, string> = {
  S: "text-amber-400 bg-amber-400/10 border-amber-500/30",
  A: "text-purple-400 bg-purple-400/10 border-purple-500/30",
  B: "text-blue-400  bg-blue-400/10  border-blue-500/30",
  C: "text-gray-400  bg-gray-400/10  border-gray-500/30",
};

function VowelRow({ vowels, tailCount }: { vowels: string[]; tailCount: number }) {
  return (
    <span className="font-mono text-[11px] tracking-wide break-all">
      {vowels.map((v, i) => {
        const isMatch = i >= vowels.length - tailCount && tailCount > 0;
        return (
          <span key={i} className={isMatch ? "text-amber-400 font-bold" : "text-gray-700"}>
            {v}{i < vowels.length - 1 && <span className="text-gray-800">‑</span>}
          </span>
        );
      })}
    </span>
  );
}

function CandidateCard({ c }: { c: RhymeCandidate }) {
  const { text, phonetic: p, score: s } = c;
  const copy = () => navigator.clipboard.writeText(text).catch(() => undefined);

  return (
    <div className="group bg-[#13131a] rounded-xl p-5 border border-gray-800
                    hover:border-gray-600 transition-all animate-slide-up">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-lg sm:text-xl font-bold leading-snug break-all">{text}</p>
          <p className="font-mono text-purple-300/70 text-xs sm:text-sm mt-0.5 break-all">{p.katakana}</p>
          <VowelRow vowels={p.vowels} tailCount={s.matched_tail} />
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span className={`text-2xl font-black px-3 py-1 rounded-lg border ${GRADE[s.grade] ?? GRADE.C}`}>
            {s.grade}
          </span>
          <span className="text-[11px] text-gray-600 tabular-nums">{s.total}pt</span>
        </div>
      </div>

      <ScoreDisplay score={s} />

      <div className="mt-3 flex justify-between items-center">
        <span className="text-xs text-gray-700 font-mono">
          {p.mora_count}モーラ · 末尾{s.matched_tail}音一致
        </span>
        <button
          onClick={copy}
          className="text-xs text-gray-700 hover:text-gray-300 transition-colors
                     opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded hover:bg-gray-800"
        >
          コピー
        </button>
      </div>
    </div>
  );
}

export function RhymeResult({ data }: { data: AnalysisResult }) {
  const { original: op, originalText, candidates } = data;

  return (
    <div className="mt-6 space-y-5 animate-fade-in">
      {/* 音韻解析パネル */}
      <div className="bg-[#13131a] rounded-2xl p-5 border border-gray-800">
        <p className="text-xs text-gray-600 font-mono tracking-widest mb-4">PHONETIC ANALYSIS</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">元フレーズ</p>
            <p className="font-bold text-white/90 text-sm">{originalText}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">読み</p>
            <p className="font-mono text-purple-300 text-sm break-all">{op.katakana}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">モーラ数</p>
            <p className="font-bold text-3xl text-amber-400 leading-none">{op.mora_count}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">末尾の韻 🔑</p>
            <p className="font-mono text-amber-400 text-lg font-bold">
              {op.tail_vowels.join("‑")}
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800/60">
          <p className="text-xs text-gray-600 mb-1 font-mono">母音列</p>
          <VowelRow vowels={op.vowels} tailCount={op.tail_vowels.length} />
        </div>
      </div>

      {/* 候補リスト */}
      <div>
        <p className="text-xs text-gray-600 font-mono tracking-widest mb-3">
          RHYME CANDIDATES ({candidates.length})
        </p>
        {candidates.length > 0 ? (
          <div className="space-y-3">
            {candidates.map((c, i) => <CandidateCard key={i} c={c} />)}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl text-gray-600">
            <p className="text-3xl mb-2">🎤</p>
            <p className="text-sm">候補が見つかりませんでした</p>
          </div>
        )}
      </div>
    </div>
  );
}
