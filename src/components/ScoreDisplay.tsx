import type { RhymeScore } from "../types";

interface Props { score: RhymeScore }

function Bar({ label, value, color, weight }: {
  label: string; value: number; color: string; weight: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-[5rem] shrink-0 font-mono leading-tight">
        {label}
        <span className="text-gray-800 text-[9px] ml-0.5">{weight}</span>
      </span>
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
      <Bar label="音"       value={score.sound_score}   color="bg-purple-500"  weight="×0.4" />
      <Bar label="発話快感" value={score.speech_score}  color="bg-amber-400"   weight="×0.25" />
      <Bar label="映像性"   value={score.imagery_score} color="bg-emerald-500" weight="×0.15" />
      <Bar label="意味飛躍" value={score.jump_score}    color="bg-blue-400"    weight="×0.1" />
      <Bar label="バカ度"   value={score.baka_score}    color="bg-pink-500"    weight="×0.1" />
    </div>
  );
}
