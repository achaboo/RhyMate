import { useState, useEffect } from "react";

const STORAGE_KEY = "rhymate_groq_key";

interface Props {
  onKeyChange: (key: string) => void;
}

export function ApiKeyInput({ onKeyChange }: Props) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    setKey(stored);
    onKeyChange(stored);
  }, [onKeyChange]);

  const handleChange = (v: string) => {
    setKey(v);
    localStorage.setItem(STORAGE_KEY, v);
    onKeyChange(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 bg-[#13131a] border border-gray-800 rounded-xl px-3 py-2.5">
      <span className="text-xs text-gray-500 shrink-0 font-mono">GROQ KEY</span>
      <div className="relative flex-1 min-w-0">
        <input
          type={show ? "text" : "password"}
          value={key}
          onChange={e => handleChange(e.target.value)}
          placeholder="gsk_..."
          className="w-full bg-transparent text-gray-300 focus:outline-none
                     placeholder:text-gray-700 font-mono pr-1
                     text-[16px] sm:text-sm"
        />
      </div>
      <button
        onClick={() => setShow(s => !s)}
        className="text-xs text-gray-600 hover:text-gray-400 transition-colors shrink-0"
      >
        {show ? "隠す" : "表示"}
      </button>
      {saved && <span className="text-xs text-emerald-500 shrink-0 animate-fade-in">保存済</span>}
      {!key && (
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-orange-400 hover:text-orange-300 shrink-0 transition-colors whitespace-nowrap"
        >
          無料で取得 →
        </a>
      )}
    </div>
  );
}
