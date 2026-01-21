# GitHubリポジトリにプッシュする手順

## 方法1: GitHub Desktopを使用（最も簡単）

1. [GitHub Desktop](https://desktop.github.com/)をダウンロードしてインストール
2. GitHub Desktopを開いてサインイン
3. 「File」→「Add Local Repository」
4. `/Users/uedakohei`を選択
5. 「Publish repository」をクリックしてプッシュ

## 方法2: コマンドラインを使用

### ステップ1: Xcode Command Line Toolsをインストール

ターミナルで以下を実行（パスワード入力が必要です）：

```bash
xcode-select --install
```

インストールが完了するまで数分かかります。

### ステップ2: Gitリポジトリを初期化

```bash
cd /Users/uedakohei
git init
```

### ステップ3: ファイルを追加

```bash
git add ai-agent.html server.js package.json .env.example .gitignore README.md GITHUB_SETUP.md SETUP.md .devcontainer .github
```

### ステップ4: コミット

```bash
git commit -m "Initial commit: AI Agent System"
```

### ステップ5: リモートリポジトリを追加

**重要**: `yourusername`と`your-repo-name`を実際のリポジトリ情報に置き換えてください。

```bash
git remote add origin https://github.com/yourusername/your-repo-name.git
```

### ステップ6: プッシュ

```bash
git branch -M main
git push -u origin main
```

## 方法3: GitHub Webインターフェースでアップロード

1. GitHubリポジトリのページを開く
2. 「uploading an existing file」をクリック
3. 以下のファイルをドラッグ&ドロップ：
   - `ai-agent.html`
   - `server.js`
   - `package.json`
   - `.env.example`
   - `.gitignore`
   - `README.md`
   - `GITHUB_SETUP.md`
   - `SETUP.md`
   - `.devcontainer/`フォルダ（中のファイルも含む）
   - `.github/`フォルダ（中のファイルも含む）
4. 「Commit changes」をクリック

**注意**: `.env`ファイルはアップロードしないでください（機密情報が含まれます）。

## リポジトリURLを教えてください

以下の情報を教えていただければ、正確なコマンドを提供できます：
- GitHubユーザー名
- リポジトリ名
