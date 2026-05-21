import { useState, useRef, useEffect } from "react";

const EXAMPLES = [
  "韻しか踏まない奴発見！",
  "努力が足りない天才気取り",
  "センスないのにセンス語る",
  "全部俺のせいにする天才",
];

interface Props {
  onGenerate: (text: string) => void;
  loading: boolean;
  hasKey: boolean;
}

export function RhymeInput({ onGenerate, loading, hasKey }: Props) {
  const [text, setText] = useState(EXAMPLES[0]);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const submit = () => { if (text.trim() && !loading && hasKey) onGenerate(text.trim()); };

  return (
    <div className="bg-[#13131a] rounded-2xl p-4 sm:p-5 border border-gray-800">
      <p className="text-xs text-gray-600 font-mono tracking-widest mb-2">PHRASE</p>
      <div className="flex gap-2">
        <input
          ref={ref}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="韻を踏みたいフレーズを入力..."
          className="flex-1 min-w-0 bg-[#0a0a0f] border border-gray-700 rounded-xl px-4 py-3
                     text-[16px] sm:text-lg focus:outline-none focus:border-purple-500 transition-colors
                     placeholder:text-gray-700"
        />
        <button
          onClick={submit}
          disabled={loading || !text.trim() || !hasKey}
          className="shrink-0 px-4 sm:px-6 py-3 bg-purple-600 hover:bg-purple-500 active:bg-purple-700
                     disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold
                     transition-colors whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              <span className="hidden sm:inline">生成中</span>
            </span>
          ) : "韻踏め 🎤"}
        </button>
      </div>
      {!hasKey && (
        <p className="mt-2 text-xs text-amber-600">↑ API キーを入力すると使えます</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-gray-700">例：</span>
        {EXAMPLES.map(ex => (
          <button
            key={ex}
            onClick={() => setText(ex)}
            className="text-xs px-2.5 py-1 rounded-lg bg-gray-800/60 hover:bg-gray-700
                       text-gray-500 hover:text-gray-200 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
