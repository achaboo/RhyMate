import { useState, useCallback } from "react";
import { ApiKeyInput } from "./components/ApiKeyInput";
import { RhymeInput } from "./components/RhymeInput";
import { RhymeResult } from "./components/RhymeResult";
import { generateRhymes } from "./lib/gemini";
import type { AnalysisResult } from "./types";

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKeyChange = useCallback((k: string) => setApiKey(k), []);

  const handleGenerate = async (text: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await generateRhymes(text, apiKey);
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "不明なエラーが発生しました";
      setError(
        msg.includes("API_KEY_INVALID") || msg.includes("400")
          ? "API キーが無効です。Google AI Studio で発行した Gemini API キーを入力してください。"
          : msg.includes("429")
          ? "レート制限に達しました。少し待ってから再試行してください（無料枠: 15回/分）。"
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tight">
            <span className="text-purple-500">Rhy</span>
            <span className="text-amber-400">Mate</span>
          </h1>
          <p className="text-gray-600 text-sm mt-2">
            日本語韻踏み生成・評価ツール — 発音・モーラ・母音韻を徹底解析
          </p>
        </div>

        {/* API キー */}
        <div className="mb-3">
          <ApiKeyInput onKeyChange={handleKeyChange} />
        </div>

        {/* 入力 */}
        <RhymeInput onGenerate={handleGenerate} loading={loading} hasKey={!!apiKey} />

        {/* エラー */}
        {error && (
          <div className="mt-4 p-4 bg-red-950/50 border border-red-800/50
                          rounded-xl text-red-300 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* 結果 */}
        {result && <RhymeResult data={result} />}

        <footer className="mt-16 text-center text-xs text-gray-800">
          RhyMate — Powered by Gemini（無料で使えます）
        </footer>
      </div>
    </div>
  );
}
