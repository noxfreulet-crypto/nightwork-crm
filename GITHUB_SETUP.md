# GitHub連携セットアップガイド

## 🎯 目的

このプロジェクトをGitHubリポジトリにプッシュし、Cloudflare Pagesの自動デプロイを設定します。

## 📋 準備

### 必要なもの
- [ ] GitHubアカウント
- [ ] このプロジェクトのバックアップ: https://www.genspark.ai/api/files/s/41zXzb1p
- [ ] Git CLI（ローカル環境）

---

## 🚀 セットアップ手順

### ステップ1: GitHubで新規リポジトリを作成

1. [GitHub](https://github.com/new)にアクセス
2. 新規リポジトリを作成:
   - **Repository name**: `nightwork-crm` （任意の名前）
   - **Description**: `Multi-tenant CRM for nightwork establishments with LINE integration`
   - **Public/Private**: お好みで選択
   - **Initialize**: チェックを**入れない**（README、.gitignore、licenseは既に存在）
3. **Create repository** をクリック

### ステップ2: ローカルでプロジェクトを準備

```bash
# プロジェクトバックアップをダウンロード
curl -L -o nightwork-crm.tar.gz https://www.genspark.ai/api/files/s/41zXzb1p

# 展開
tar -xzf nightwork-crm.tar.gz

# プロジェクトディレクトリに移動
cd home/user/webapp

# Git設定確認（初回のみ）
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

### ステップ3: GitHubリポジトリに接続

```bash
# リモートリポジトリを追加
git remote add origin https://github.com/YOUR_USERNAME/nightwork-crm.git

# または SSH使用の場合
# git remote add origin git@github.com:YOUR_USERNAME/nightwork-crm.git

# リモート確認
git remote -v
```

### ステップ4: コードをプッシュ

```bash
# mainブランチにプッシュ
git push -u origin main
```

**認証方法**:
- **HTTPS**: GitHubのPersonal Access Token（PAT）を使用
- **SSH**: SSH鍵を事前に設定

### ステップ5: GitHubで確認

1. GitHubリポジトリページにアクセス
2. ファイルがプッシュされていることを確認:
   - `src/`
   - `public/`
   - `migrations/`
   - `README.md`
   - `package.json`
   - など

---

## 🔗 Cloudflare Pages連携

### ステップ1: Cloudflare Dashboardでプロジェクト作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)にログイン
2. **Workers & Pages** → **Create application**
3. **Pages** → **Connect to Git**

### ステップ2: GitHubアカウントを接続

1. **Connect GitHub** をクリック
2. GitHub認証画面で承認
3. リポジトリのアクセス権限を付与:
   - **All repositories** または
   - **Only select repositories**: `nightwork-crm`を選択

### ステップ3: リポジトリを選択

1. リポジトリ一覧から `nightwork-crm` を選択
2. **Begin setup** をクリック

### ステップ4: ビルド設定

```
Project name: nightwork-crm
Production branch: main
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: (空白のまま)
Environment variables: (後で設定)
```

### ステップ5: Save and Deploy

1. **Save and Deploy** をクリック
2. 初回デプロイが開始されます（数分かかります）
3. デプロイ完了後、URLが表示されます:
   ```
   https://nightwork-crm.pages.dev
   ```

---

## 🗄️ D1データベースのバインド

### ステップ1: D1データベースを作成

```bash
# ローカルターミナルで実行
npx wrangler login
npx wrangler d1 create webapp-production
```

**出力例**:
```
✅ Successfully created DB 'webapp-production'

[[d1_databases]]
binding = "DB"
database_name = "webapp-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### ステップ2: Cloudflare Dashboardでバインディング設定

1. Cloudflare Pages → あなたのプロジェクト
2. **Settings** → **Functions**
3. **D1 database bindings** セクション:
   - **Variable name**: `DB`
   - **D1 database**: `webapp-production` を選択
4. **Save** をクリック

### ステップ3: マイグレーションを適用

```bash
# 本番データベースにマイグレーションを適用
npx wrangler d1 migrations apply webapp-production

# 確認プロンプトで "y" を入力
```

### ステップ4: シードデータ投入（オプション）

```bash
# テストデータを投入
npx wrangler d1 execute webapp-production --file=./scripts/seed.sql
```

---

## ⏰ Cronトリガーの設定

### Cloudflare Dashboard経由

1. **Settings** → **Triggers**
2. **Cron Triggers** → **Add Cron Trigger**
3. Schedule: `0 12 * * *` （毎日12:00 UTC）
4. **Add Trigger** をクリック

---

## 🔄 自動デプロイのワークフロー

### コード更新からデプロイまで

```bash
# 1. コードを変更
vim src/index.tsx

# 2. 変更をコミット
git add .
git commit -m "Update feature"

# 3. GitHubにプッシュ
git push origin main

# 4. Cloudflare Pagesが自動的に:
#    - コードをpull
#    - npm run build を実行
#    - dist/ をデプロイ
#    - 新しいバージョンを公開
```

### プレビューデプロイ

```bash
# 機能ブランチを作成
git checkout -b feature/new-feature

# 変更をプッシュ
git push origin feature/new-feature

# → プレビューURLが自動生成される:
#    https://abc123.nightwork-crm.pages.dev
```

---

## 📱 LINE Webhook設定

### 本番環境のWebhook URL

```
https://nightwork-crm.pages.dev/webhook/line
```

### LINE Developers Consoleで設定

1. [LINE Developers Console](https://developers.line.biz/)にアクセス
2. あなたのMessaging APIチャネルを選択
3. **Webhook settings**:
   - Webhook URL: `https://nightwork-crm.pages.dev/webhook/line`
   - Use webhook: **ON**
4. **Verify** をクリックして動作確認

### チャネル情報をD1に保存

```bash
npx wrangler d1 execute webapp-production --command="
UPDATE line_channels 
SET 
  channel_access_token = 'YOUR_CHANNEL_ACCESS_TOKEN',
  channel_secret = 'YOUR_CHANNEL_SECRET',
  bot_user_id = 'YOUR_BOT_USER_ID'
WHERE id = 'channel_001';
"
```

---

## ✅ デプロイ確認

### 1. ヘルスチェック

```bash
curl https://nightwork-crm.pages.dev/health

# 期待される出力:
# {"status":"ok","timestamp":"2025-12-18T..."}
```

### 2. ログイン画面

ブラウザで `https://nightwork-crm.pages.dev` にアクセス

### 3. テストアカウントでログイン

- Cast 1: `cast1@example.com` / `password123`
- Cast 2: `cast2@example.com` / `password123`
- Manager: `manager@example.com` / `password123`

### 4. LINE Webhook

LINE公式アカウントを友達追加してメッセージを送信

---

## 🔐 本番運用の推奨設定

### 1. テストアカウントの削除

```bash
npx wrangler d1 execute webapp-production --command="
DELETE FROM users WHERE email LIKE '%@example.com';
"
```

### 2. 本番ユーザーの作成

```bash
# パスワードハッシュを生成（ローカルで）
node -e "console.log(require('bcryptjs').hashSync('YOUR_STRONG_PASSWORD', 10))"

# D1に挿入
npx wrangler d1 execute webapp-production --command="
INSERT INTO users (id, store_id, email, password_hash, display_name, role, is_active)
VALUES (
  'user_' || lower(hex(randomblob(8))),
  'store_demo001',
  'real-email@example.com',
  'GENERATED_HASH',
  '実際の名前',
  'manager',
  1
);
"
```

### 3. セキュリティ設定

- [ ] 強力なパスワードポリシー
- [ ] HTTPS強制（Cloudflare Pagesはデフォルト有効）
- [ ] Rate Limitingの検討
- [ ] 定期的なバックアップ

---

## 🐛 トラブルシューティング

### GitHubへのプッシュが失敗する

**エラー**: `Permission denied (publickey)`

**解決策**:
```bash
# SSH鍵を生成（初回のみ）
ssh-keygen -t ed25519 -C "your-email@example.com"

# 公開鍵をGitHubに追加
cat ~/.ssh/id_ed25519.pub
# → GitHubのSettings > SSH and GPG keysに追加
```

**エラー**: `Authentication failed`

**解決策**:
- HTTPS使用時: Personal Access Token（PAT）を発行
- GitHub Settings > Developer settings > Personal access tokens

### Cloudflare Pagesのビルドが失敗する

**確認事項**:
1. ビルドコマンドが正しいか: `npm run build`
2. 出力ディレクトリが正しいか: `dist`
3. Node.jsバージョン互換性

**ローカルでテスト**:
```bash
npm ci
npm run build
ls -la dist/  # _worker.js が存在することを確認
```

### D1データベースに接続できない

**確認事項**:
1. D1 database bindingsが設定されているか
2. Variable name が `DB` か
3. 正しいデータベースが選択されているか

---

## 📚 関連ドキュメント

- **[README.md](README.md)** - プロジェクト概要
- **[GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md)** - GitHub連携詳細
- **[DEPLOY_INSTRUCTIONS.md](DEPLOY_INSTRUCTIONS.md)** - デプロイ完全ガイド

---

**最終更新**: 2025-12-18  
**プロジェクトバージョン**: MVP v1.0  
**バックアップURL**: https://www.genspark.ai/api/files/s/41zXzb1p
