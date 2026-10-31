# Kiln

> English: [README.md](./README.md)

**Claude Code の「目」と「構造化入力」を提供するインターフェース**

Kiln 自体はコードを生成しない。判断もしない。
**見ること**と**構造的にやり取りすること**だけに徹する。

```
Claude Code（主体・実行者）
  │
  ├── テキスト CLI で十分なこと → そのまま対話
  │
  └── テキストでは伝わらないこと → Kiln が補助
       ├── バリアントの視覚的プレビュー（見る）
       └── レビュー判定の構造化入力（やり取りする）
```

---

## インストール

```bash
# 1. submodule として追加
git submodule add https://github.com/Socrates10101/kiln.git tools/kiln

# 2. セットアップ（依存・スクリプト・skills・作業ディレクトリ・config 一括）
tools/kiln/install.sh
```

`install.sh` が行うこと：

| ステップ | 内容 |
|----------|------|
| Dependencies | `tools/kiln/` の `pnpm install` |
| Package script | ホストの `package.json` に `"kiln"` スクリプトを追加 |
| Skills | `.claude/skills/` に symlink（Claude Code がスキルを認識する） |
| Working dir | `.kiln/variants/`, `.kiln/agents/`, `.kiln/.gitignore` を作成 |
| Config | `kiln.config.ts` をスキャフォールド（存在しなければ） |

セットアップ後：

```bash
# kiln.config.ts を自分のプロジェクトに合わせて編集
vim kiln.config.ts

# 起動
pnpm kiln
```

`http://localhost:4400` で Dashboard が開く。

---

## kiln.config.ts

各オプションの詳細は英語版 README の「`kiln.config.ts` reference」を参照。

```typescript
import { defineConfig } from './tools/kiln/src/index.js';

export default defineConfig({
  name: 'my-project',

  // バリアントファイルの探索パターン
  variants: {
    include: ['.kiln/variants/**/*.v*.tsx'],
    pattern: /^(.+)\.v(\d+)([a-z])\.tsx$/,
  },

  // ページ単位のコンポーネントグループ
  groups: [
    { name: 'Homepage', components: ['HeroSection', 'Footer'] },
  ],

  // レビューデータの保存先
  review: {
    file: 'docs/variant-review.json',
  },

  // プレビュー描画
  preview: {
    framework: 'react',
    css: ['./src/app/globals.css'],
    vite: {
      plugins: [],
      resolve: { alias: { '@/': './src/' } },
    },
  },

  // Agent 監視
  agents: {
    stateDir: '.kiln/agents/',
    pollInterval: 2000,
  },

  server: { port: 4400 },
});
```

---

## プロジェクトに生成されるもの

```
my-project/
  ├── kiln.config.ts                      ← プロジェクト設定（自分で編集）
  ├── tools/kiln/                         ← submodule（触らない）
  ├── .kiln/
  │   ├── variants/                       ← バリアントファイル（git 追跡）
  │   ├── agents/                         ← Agent 通信（gitignore）
  │   └── .gitignore                      ← agents/ を除外
  ├── .claude/skills/
  │   └── variant-review → tools/kiln/... ← symlink（git 追跡）
  └── docs/
      └── variant-review.json             ← レビューデータ（git 追跡）
```

---

## バリアントファイルの命名

`<Component>.v<世代><スロット>.tsx`。例: `HeroSection.v2b.tsx`。
先頭の JSDoc（`/** v2b: Split Horizon (Gen 2) */`）が Dashboard の表示名になる。

---

## 設計思想

### 役割分担

```
User          — 意思決定者
                バリアントを見て、判定（adopt/iterate/keep/drop）を下す

Kiln          — インターフェース
                見る + 構造的にやり取りする
                判断はしない。User の意思を構造化して伝えるだけ

Claude Code   — 実行者（Leader + Agents）
                Leader がタスクを分配し、Agent が並行してバリアントを生成する
```

### 通信チャネル

```
          variant-review.json
User ──→ Kiln ─────────────────────→ Claude Code (Leader)
                                        │
                                        ├── Agent 1 (iterate)
                                        ├── Agent 2 (adopt)
                                        └── Agent 3 (iterate)
                                        │
          .kiln/variants/               │
User ←── Kiln ←────────────────────────┘
          (chokidar で自動検知)
```

| チャネル | 方向 | 内容 |
|----------|------|------|
| `variant-review.json` | Kiln → Claude Code | User の判定・フィードバック |
| `.kiln/variants/` | Claude Code → Kiln | 生成されたバリアントファイル |
| `.kiln/agents/*.json` | Claude Code → Kiln | Agent の実行状態 |

---

## レビュー UI

### ステータス

| ボタン | 意味 | 色 |
|--------|------|-----|
| `adopt` | デフォルトに採用 | 緑 |
| `iterate` | フィードバック付きで次世代生成 | 黄 |
| `keep` | 保留 | 灰 |
| `drop` | 削除 | 赤 |

### iterate モード

| モード | 変更範囲 |
|--------|----------|
| `auto` | フィードバックから自動判定（デフォルト） |
| `structural` | レイアウト・色・タイポグラフィ等を大幅変更 |
| `component` | targetPart のみ変更 |

### レビュー結果の適用

Claude Code に以下のように指示する：

```
レビュー結果を適用して
```

`variant-review` skill が発動し、各判定を Agent に分配して処理する。

---

## 実行モード

| モード | トリガー | 動作 |
|--------|----------|------|
| 逐次 | 「pending を処理して」 | Leader が pending を1回処理 |
| Watch | 「監視して自動処理して」 | variant-review.json を監視し自動処理 |

---

## 開発

```bash
pnpm install
pnpm build   # tsc による型チェック
pnpm test    # vitest
```

---

## 技術構成

| 層 | 技術 |
|----|------|
| Server | Express + Vite (middleware mode) |
| Client | React (inline styles, dark theme) |
| リアルタイム | SSE (Server-Sent Events) |
| ファイル監視 | chokidar |
| Agent 監視 | Oracle (polling) |

---

## ライセンス

[MIT](./LICENSE)
