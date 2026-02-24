---
name: variant-review
description: This skill should be used when the user asks to "process pending reviews",
  "apply review results", "handle variant reviews", "watch mode", "監視して",
  "pending を処理", "レビュー結果を適用", or discusses variant review processing.
  Reads variant-review.json and dispatches agents to handle each pending variant.
---

# Variant Review Processor

## Overview

Process pending variant reviews from `docs/variant-review.json` and dispatch agents to handle each decision.

Two modes of operation:
- **逐次モード** — pending を1回処理して完了
- **Watch モード** — `variant-review.json` をポーリングし、新しいレビューを即座に処理し続ける

---

## 実行モード

### 逐次モード（デフォルト）

トリガー: 「pending を処理して」「レビュー結果を適用して」

1. `docs/variant-review.json` を読む
2. 全ての pending を処理
3. 完了を報告して終了

### Watch モード

トリガー: 「watch mode で処理して」「監視して自動処理して」

1. `docs/variant-review.json` を読み、既存の pending をまず処理
2. 2秒間隔でファイルをポーリング
3. 新しい pending（前回チェック時に存在しなかったもの）を検知したら即座に処理
4. ユーザーが停止を指示するまで継続

**Watch ループの実装:**

```
seen = {} # 処理済みの component/variantId のセット

# 初回: 既存 pending を処理
initial_pending = detect_pending(variant-review.json)
for each in initial_pending:
    process(each)
    seen.add(each.key)

# ポーリングループ
while not stopped:
    sleep(2 seconds)
    read variant-review.json
    for each variant where status !== null && applied !== true:
        if variant.key not in seen:
            seen.add(variant.key)
            process(variant)
```

**注意:**
- ポーリングは `docs/variant-review.json` ファイルの読み取りのみ。軽量
- 新規 pending を検知したらユーザーに報告してから処理を開始
- 処理中に新しいレビューが入った場合、現在の処理が完了してから次を処理

---

## Pending の検出

`docs/variant-review.json` を読み、以下の条件に合致するバリアントを抽出:

```
pending = variants where status !== null && applied !== true
```

---

## ステータス別の処理

| Status | Agent Task |
|--------|-----------|
| **adopt** | variant ファイルを Default にコピー（base component を置換）→ `applied: true` |
| **iterate** | `docs/variant-generation-guide.md` を参照し、feedback + iterateMode で次世代 v{N+1}a,b,c を生成 → `applied: true` |
| **drop** | variant ファイルを削除 → `applied: true` |
| **keep** | ファイル変更なし → `applied: true` |
| **skip** | 何もしない。applied も設定しない |

---

## Agent State Files

各 agent は `.kiln/agents/{agentId}.json` に状態を書く。
フォーマットは `references/agent-protocol.md` を参照。

Kiln Oracle がこのディレクトリをポーリングし、Dashboard UI に反映する。

---

## Iterate Mode の詳細

`iterate` バリアントの処理:

1. `docs/variant-generation-guide.md` を読む
2. `iterateMode` フィールドを確認:
   - `structural` — 3+ 要素を変更（layout, color, typography, motion, visual weight）
   - `component` — `targetPart` のみ変更、他は同一
   - `auto`（または null）— feedback テキストから自動判定:
     - 具体的な UI 要素名に言及 → **component** モード
     - 全体の印象・レイアウトに言及 → **structural** モード
     - 不明確 → **structural** にフォールバック
3. `feedback` テキストを主要な指示として使用
4. 3 バリアント生成: v{N+1}a, v{N+1}b, v{N+1}c
5. Guide の命名規則に従う

---

## Post-Processing

各バリアントの処理完了後:
- `docs/variant-review.json` で `applied: true` を設定
- ユーザーに処理結果のサマリーを報告
