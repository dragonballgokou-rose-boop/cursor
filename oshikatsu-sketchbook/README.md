# 推し活スケッチブック · Design System

「推し活スケッチブック」のためのデザインシステム。
ライブの参戦記録・グッズコレクション・お渡し会メモなど、
推し活で頻出する画面を組み立てるための部品とトークンをまとめています。

ビルドツールなしで動く Vanilla HTML + CSS + JS 構成。
`index.html` をブラウザで直接開けば動きます。

## 構成

```
oshikatsu-sketchbook/
├── index.html              ホーム
├── pages/
│   ├── tokens.html         デザイントークン一覧
│   ├── components.html     コンポーネントカタログ
│   ├── patterns.html       ページパターン例
│   ├── sketchbook.html     スケッチブックエディタ（画像差し込み・コンビニ印刷用）
│   └── uchiwa.html         うちわメーカー
└── assets/
    ├── tokens.css          CSS Custom Properties（推し色12色 等）
    ├── base.css            ベーススタイル
    ├── nav.css             ナビゲーション
    ├── components.css      コンポーネントスタイル
    ├── theme.js            推し色テーマ切り替え（localStorage 永続化）
    ├── sketchbook.js       スケッチブックエディタのロジック（画像/テキスト/和紙/ステッカー配置、PNG 書き出し）
    └── uchiwa.js           うちわメーカーのロジック（SVG/PNG 書き出し）
```

## 主な機能

### 1. 推し色テーマ
12色のメンバーカラー（桜・ローズ・コーラル・蜜柑・レモン・ミント・スカイ・コバルト・ラベンダー・ヴァイオレット・ホワイト・ブラック）をプリセット。
画面右上のスウォッチで切り替えると、ボタン・バッジ・ステッカー・装飾の色が一斉に変わります。

```html
<html data-oshi="sakura">  <!-- 桜色テーマ -->
```

### 2. デザイントークン
全ての色・タイポ・余白・角丸・影は CSS Custom Properties で公開。

```css
.my-button {
  background: var(--oshi-primary);
  color: var(--oshi-primary-ink);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sticker);
}
```

### 3. スケッチブックエディタ
推し活ページを組み立てて、**コンビニ印刷用 PNG (300dpi)** で書き出せるエディタ。

- 紙サイズ: L判 / 2L判 / ましかく / KGサイズ / A4(縦・横) / B5 / A3
- 要素: 画像（アップロード/ドラッグ&ドロップ）/ テキスト / 和紙テープ / ハート・スター・丸シール
- ドラッグで移動、右パネルで サイズ・回転・色・テキスト編集
- 並び替え (前面・背面)、複製、削除
- 背景プリセット＋オーバーレイ（方眼・罫線・ドット）
- ブラウザ内保存（localStorage）
- 書き出し: PNG 300dpi（コンビニ印刷向け）/ PNG 150dpi（画面用）/ SVG

**コンビニ印刷の手順**
1. エディタで作る → PNG 300dpi をダウンロード
2. セブン: かんたん netprint / ネットプリント、ローソン・ファミマ: PrintSmash / ネットワークプリントにアップロード
3. 店舗のマルチコピー機で写真プリント or 普通紙プリント

### 4. うちわメーカー
公式ジャンボうちわ規定サイズ（うちわ面 285×295mm + 持ち手）でレイアウト可能。

- テンプレート（推し♡ / 指さして！ / 好き♡ / ROCK / 名前うちわ）
- 文字（最大3行、自動サイズ調整）
- 蛍光カラープリセット文字色＋自由色
- 2重縁取り（内側・外側それぞれ色と太さ）
- ハート / スター 装飾
- 持ち手表示の切替
- 書き出し: SVG / PNG (4x プレビュー用 / 8x ≒ 300dpi 印刷用)

## 使い方

```bash
# 直接開くだけ
open oshikatsu-sketchbook/index.html

# ローカルサーバーで開きたいとき
cd oshikatsu-sketchbook
python3 -m http.server 8080
# → http://localhost:8080
```

## カスタマイズ

新しい推し色を追加するには `assets/tokens.css` の `:root` と `[data-oshi="..."]` を追加し、
`assets/theme.js` の `OSHI` 配列に同じ id を追加してください。
