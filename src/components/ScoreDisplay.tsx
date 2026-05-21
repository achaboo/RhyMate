import type { RhymeScore } from "../types";

interface Props { score: RhymeScore }

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-[4.5rem] shrink-0 font-mono">{label}</span>
      <div className="flex-1 bg-gray-800/80 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-7 text-right tabular-nums">{Math.round(value)}</span>
    </div>
  );
}

export function ScoreDisplay({ score }: Props) {
  return (
    <div className="space-y-1.5">
      <Bar label="末尾韻"     value={score.tail_score}   color="bg-purple-500" />
      <Bar label="母音列"     value={score.vowel_score}  color="bg-blue-500" />
      <Bar label="モーラ"     value={score.mora_score}   color="bg-emerald-500" />
      <Bar label="インパクト" value={score.impact_score} color="bg-amber-500" />
      <Bar label="ミーム感"   value={score.meme_score}   color="bg-pink-500" />
    </div>
  );
}
