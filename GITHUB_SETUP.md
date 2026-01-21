# GitHubでのセットアップガイド

このプロジェクトをGitHubで使用する方法を説明します。

## 📦 GitHubリポジトリとしてセットアップ

### 1. Gitリポジトリを初期化

```bash
git init
git add .
git commit -m "Initial commit: AI Agent System"
```

### 2. GitHubリポジトリを作成

1. [GitHub](https://github.com)にログイン
2. 新しいリポジトリを作成（名前: `ai-agent-system` など）
3. リモートリポジトリを追加

```bash
git remote add origin https://github.com/yourusername/ai-agent-system.git
git branch -M main
git push -u origin main
```

## 🚀 GitHub Codespacesで実行（推奨）

### メリット
- ✅ Node.jsのインストール不要
- ✅ ブラウザで完結
- ✅ すぐに始められる
- ✅ 環境構築不要

### 手順

1. **GitHubリポジトリを開く**
   - https://github.com/yourusername/ai-agent-system

2. **Codespacesを作成**
   - 「Code」ボタンをクリック
   - 「Codespaces」タブを選択
   - 「Create codespace on main」をクリック
   - 数分待つ（初回は環境構築に時間がかかります）

3. **ターミナルで実行**
   ```bash
   npm install
   npm start
   ```

4. **ポートを公開**
   - Codespacesが自動的にポート3000を公開
   - 「Ports」タブでアクセスURLが表示されます
   - または、自動的にブラウザが開きます

### 環境変数の設定（Codespaces）

Codespacesのシークレット機能を使用：

1. リポジトリの「Settings」→「Secrets and variables」→「Codespaces」
2. 「New repository secret」をクリック
3. 名前: `OPENAI_API_KEY`、値: あなたのAPIキー
4. Codespacesを再起動すると、環境変数が自動的に設定されます

または、Codespacesのターミナルで：

```bash
echo 'export OPENAI_API_KEY=your_key_here' >> ~/.bashrc
source ~/.bashrc
```

## 🔧 GitHub Actions（CI/CD）

プロジェクトにはCI/CDワークフローが含まれています：

- **自動テスト**: プッシュやPR時に自動実行
- **構文チェック**: サーバーファイルの検証
- **ヘルスチェック**: サーバーが正常に起動するか確認

## 📝 GitHub Pages（静的サイトとして公開）

HTMLファイルのみをGitHub Pagesで公開する場合：

1. リポジトリの「Settings」→「Pages」
2. Source: `Deploy from a branch`
3. Branch: `main` / `/ (root)`
4. 「Save」

**注意**: GitHub Pagesではバックエンドサーバーが動作しないため、API機能は使用できません。フロントエンドのみが表示されます。

## 🔐 セキュリティ

### APIキーの管理

**重要**: `.env`ファイルは`.gitignore`に含まれています。以下の方法でAPIキーを管理してください：

1. **GitHub Codespaces Secrets**（推奨）
   - リポジトリのSettings → Secrets and variables → Codespaces
   - シークレットとして保存

2. **環境変数**
   - Codespacesのターミナルで設定
   - セッションごとに設定が必要

3. **`.env`ファイル**
   - ローカル開発環境のみ
   - リポジトリにコミットしないこと

## 🌍 デプロイオプション

### Vercel
```bash
npm install -g vercel
vercel
```

### Railway
1. Railwayにログイン
2. 「New Project」→「Deploy from GitHub repo」
3. リポジトリを選択
4. 環境変数を設定

### Render
1. Renderにログイン
2. 「New Web Service」
3. GitHubリポジトリを接続
4. 環境変数を設定

## 📚 参考リンク

- [GitHub Codespaces](https://docs.github.com/en/codespaces)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Node.js公式サイト](https://nodejs.org/)
