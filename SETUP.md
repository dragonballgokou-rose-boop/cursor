# セットアップガイド

Node.jsとnpmがインストールされていないため、以下の手順でインストールしてください。

## macOSでのインストール方法

### 方法1: Homebrewを使用（推奨）

1. **Homebrewをインストール**（まだインストールしていない場合）
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Node.jsをインストール**
   ```bash
   brew install node
   ```

3. **インストールを確認**
   ```bash
   node --version
   npm --version
   ```

### 方法2: 公式インストーラーを使用

1. [Node.js公式サイト](https://nodejs.org/)にアクセス
2. LTS版をダウンロードしてインストール
3. ターミナルを再起動して確認：
   ```bash
   node --version
   npm --version
   ```

## インストール後のセットアップ

Node.jsのインストールが完了したら、以下のコマンドを実行してください：

```bash
# 1. 依存関係をインストール
npm install

# 2. 環境変数ファイルを作成（オプション - OpenAI APIを使用する場合）
cp .env.example .env
# .envファイルを編集してOPENAI_API_KEYを設定

# 3. サーバーを起動
npm start
```

サーバー起動後、ブラウザで以下のURLにアクセス：
```
http://localhost:3000
```

## トラブルシューティング

### コマンドが見つからない場合
ターミナルを再起動して、環境変数が正しく読み込まれているか確認してください。

### 権限エラーが発生する場合
sudoを使用する必要はありません。権限エラーが発生した場合は、Homebrewのインストールパスを確認してください。
