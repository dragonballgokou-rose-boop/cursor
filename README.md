# AI Agent System

モダンなWebベースのAI Agentシステム。OpenAI APIを統合したチャットインターフェースを提供します。

## 特徴

- 🤖 OpenAI API統合（GPT-3.5/GPT-4対応）
- 💬 リアルタイムチャットインターフェース
- 🎨 モダンで美しいUIデザイン
- 📱 レスポンシブデザイン（モバイル対応）
- 💾 会話履歴の保持
- 🔄 フォールバック機能（API未設定時も動作）

## セットアップ方法

### 🌐 GitHub Codespacesで実行（推奨・最も簡単）

1. **GitHubリポジトリにプッシュ**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/ai-agent-system.git
   git push -u origin main
   ```

2. **GitHub Codespacesで開く**
   - GitHubリポジトリのページで「Code」ボタンをクリック
   - 「Codespaces」タブを選択
   - 「Create codespace on main」をクリック
   - 自動的にNode.js環境がセットアップされます

3. **サーバーを起動**
   ```bash
   npm install
   npm start
   ```
   - ポート3000が自動的に公開されます

### 💻 ローカル環境でのセットアップ

#### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成：

```bash
cp .env.example .env
```

`.env`ファイルを編集してOpenAI APIキーを設定：

```env
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
```

**OpenAI APIキーの取得方法：**
1. [OpenAI Platform](https://platform.openai.com/)にアクセス
2. アカウントを作成（またはログイン）
3. [API Keys](https://platform.openai.com/api-keys)ページで新しいキーを作成

**注意：** OpenAI APIキーが設定されていない場合、システムはローカルフォールバックモードで動作します。

### 3. サーバーの起動

```bash
npm start
```

または、開発モード（自動リロード）：

```bash
npm run dev
```

### 4. ブラウザでアクセス

サーバー起動後、ブラウザで以下のURLにアクセス：

```
http://localhost:3000
```

## 使い方

1. ブラウザでアプリケーションを開く
2. 入力フィールドにメッセージを入力
3. 「送信」ボタンをクリック、またはEnterキーを押す
4. AI Agentからの応答を待つ

## プロジェクト構造

```
.
├── ai-agent.html              # フロントエンド（HTML/CSS/JavaScript）
├── server.js                  # バックエンドサーバー（Express）
├── package.json               # プロジェクト設定と依存関係
├── .env.example               # 環境変数のテンプレート
├── .env                       # 環境変数（.gitignoreに含まれる）
├── .gitignore                 # Git除外設定
├── README.md                  # このファイル
├── GITHUB_SETUP.md           # GitHubセットアップガイド
├── SETUP.md                   # ローカルセットアップガイド
├── .devcontainer/
│   └── devcontainer.json      # GitHub Codespaces設定
└── .github/
    └── workflows/
        ├── ci.yml             # CI/CDワークフロー
        └── codespaces-setup.yml
```

## API エンドポイント

### POST /api/chat

チャットメッセージを送信し、AI応答を取得します。

**リクエスト：**
```json
{
  "message": "こんにちは",
  "conversationHistory": [
    {
      "content": "以前のメッセージ",
      "isUser": true
    }
  ]
}
```

**レスポンス：**
```json
{
  "response": "AIからの応答",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/health

サーバーの状態を確認します。

**レスポンス：**
```json
{
  "status": "ok",
  "openaiConfigured": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 技術スタック

- **フロントエンド：** HTML5, CSS3, Vanilla JavaScript
- **バックエンド：** Node.js, Express.js
- **AI API：** OpenAI API
- **その他：** dotenv（環境変数管理）

## カスタマイズ

### AIモデルの変更

`.env`ファイルで`OPENAI_MODEL`を変更：

```env
OPENAI_MODEL=gpt-4
```

### ポートの変更

`.env`ファイルで`PORT`を変更：

```env
PORT=8080
```

### システムプロンプトの変更

`server.js`の`getOpenAIResponse`関数内のシステムメッセージを編集：

```javascript
{
    role: 'system',
    content: 'あなたのカスタムプロンプト'
}
```

## トラブルシューティング

### OpenAI APIエラー

- APIキーが正しく設定されているか確認
- APIキーに十分なクレジットがあるか確認
- ネットワーク接続を確認

### サーバーが起動しない

- Node.jsがインストールされているか確認（`node --version`）
- ポート3000が使用されていないか確認
- `npm install`が正常に完了しているか確認

### CORSエラー

- サーバーが正しく起動しているか確認
- ブラウザのコンソールでエラーメッセージを確認

## ライセンス

MIT

## 貢献

プルリクエストやイシューの報告を歓迎します！
