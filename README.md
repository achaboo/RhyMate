# RhyMate 🎤

日本語の韻踏み生成・評価ツール。  
発音・モーラ・母音韻を重視した本格的な韻分析エンジン。

**→ [rhymate.web.app](https://rhymate.web.app)** (Firebase Hosting)

---

## 使い方

1. [Anthropic Console](https://console.anthropic.com/settings/keys) で API キーを取得
2. 画面上部の API キー欄に入力（ブラウザに自動保存）
3. 韻を踏みたいフレーズを入力して「韻踏め 🎤」

---

## 機能

| 機能 | 内容 |
|------|------|
| 音韻解析 | Claude が読み・モーラ・母音列を解析 |
| 韻候補生成 | Claude Sonnet が 8 候補を生成 |
| スコアリング | 末尾韻・全体類似度・モーラ長・インパクト・ミーム感 |
| グレード表示 | S / A / B / C |
| コピー | 候補フレーズをワンクリックでコピー |

---

## スコアリング仕様

| 項目 | 重み |
|------|------|
| 末尾韻 (末尾 6 母音の連続一致) | 40% |
| 全体母音類似度 (編集距離) | 20% |
| モーラ長一致 | 15% |
| インパクト (っ・ん・強い子音) | 15% |
| ミーム感 (文字数・語尾パターン) | 10% |

---

## ローカル開発

```bash
npm install
npm run dev    # → http://localhost:5173
```

## Firebase デプロイ

```bash
npm run build
firebase deploy --only hosting
```

---

## アーキテクチャ

- **フロントエンド**: React + Vite + TypeScript + Tailwind CSS
- **AI**: Claude Sonnet (`dangerouslyAllowBrowser: true` + tool_use で構造化 JSON)
- **ホスティング**: Firebase Hosting (静的ファイル)
- **バックエンドなし**: すべてブラウザで完結

---

Powered by [Claude Sonnet](https://anthropic.com) · Built with ❤️
