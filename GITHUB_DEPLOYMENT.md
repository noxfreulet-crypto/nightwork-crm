# GitHub連携とCloudflare Pages自動デプロイ

## 概要

GitHubリポジトリにコードをプッシュし、Cloudflare Pagesと連携することで、自動デプロイが可能になります。

## 📋 前提条件

- [ ] GitHubアカウント
- [ ] Cloudflareアカウント
- [ ] このプロジェクトのバックアップ: https://www.genspark.ai/api/files/s/41zXzb1p

---

## 🔄 方法1: GitHub + Cloudflare Pages自動デプロイ（推奨）

### ステップ1: GitHubリポジトリ作成

1. [GitHub](https://github.com/new)で新規リポジトリを作成
   - リポジトリ名: `nightwork-crm` (任意)
   - 公開/非公開: お好みで選択
   - README、.gitignore、ライセンス: **追加しない**（既に存在するため）

2. リポジトリURLをコピー:
   ```
   https://github.com/YOUR_USERNAME/nightwork-crm.git
   ```

### ステップ2: ローカルでプロジェクトを準備

```bash
# プロジェクトバックアップをダウンロード・展開
curl -L -o nightwork-crm.tar.gz https://www.genspark.ai/api/files/s/41zXzb1p
tar -xzf nightwork-crm.tar.gz
cd home/user/webapp

# GitHubリポジトリをリモートに追加
git remote add origin https://github.com/YOUR_USERNAME/nightwork-crm.git

# mainブランチにプッシュ
git push -u origin main
```

### ステップ3: Cloudflare PagesでGitHub連携

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. GitHubアカウントを接続
4. リポジトリ `nightwork-crm` を選択
5. ビルド設定:
   ```
   Framework preset: None
   Build command: npm run build
   Build output directory: dist
   Root directory: (leave empty)
   ```
6. 環境変数: **設定不要**（D1バインディングは後で設定）
7. **Save and Deploy** をクリック

### ステップ4: D1データベースをバインド

1. デプロイ完了後、**Settings** → **Functions** に移動
2. **D1 database bindings** セクション:
   - Variable name: `DB`
   - D1 database: 新規作成または既存を選択
   
3. 新規作成する場合:
   ```bash
   # ローカルターミナルで実行
   npx wrangler d1 create webapp-production
   ```
   
4. 出力されたdatabase_idをCloudflare Dashboardで選択

### ステップ5: マイグレーションを適用

```bash
# ローカルターミナルで実行
npx wrangler d1 migrations apply webapp-production
```

### ステップ6: Cronトリガーを設定

1. Cloudflare Dashboard → **Workers & Pages** → あなたのプロジェクト
2. **Settings** → **Triggers** → **Cron Triggers**
3. **Add Cron Trigger**: `0 12 * * *` （毎日12:00）

### ステップ7: 動作確認

デプロイされたURLにアクセス:
```
https://nightwork-crm.pages.dev
```

テストアカウントでログイン:
- Cast 1: `cast1@example.com` / `password123`

---

## 🚀 方法2: 手動デプロイ（Wrangler CLI）

GitHub連携を使わず、直接デプロイする方法です。

### ステップ1: プロジェクトを準備

```bash
# プロジェクトバックアップをダウンロード・展開
curl -L -o nightwork-crm.tar.gz https://www.genspark.ai/api/files/s/41zXzb1p
tar -xzf nightwork-crm.tar.gz
cd home/user/webapp

# 依存関係をインストール
npm install
```

### ステップ2: Cloudflare認証

```bash
npx wrangler login
```

### ステップ3: D1データベース作成

```bash
npx wrangler d1 create webapp-production
```

出力されたdatabase_idを`wrangler.jsonc`に設定:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "ここに貼り付け"
    }
  ]
}
```

### ステップ4: マイグレーション適用

```bash
npx wrangler d1 migrations apply webapp-production
```

### ステップ5: ビルド＆デプロイ

```bash
# 自動デプロイスクリプトを使用
./deploy.sh

# または手動で
npm run build
npx wrangler pages deploy dist --project-name webapp
```

---

## 🔄 継続的デプロイ（CI/CD）

GitHub連携の場合、コードをプッシュするだけで自動デプロイされます。

### ワークフロー

```bash
# コード変更
git add .
git commit -m "Update feature"
git push origin main

# ↓ Cloudflare Pagesが自動実行
# 1. npm run build
# 2. dist/をデプロイ
# 3. 新しいバージョンが公開される
```

### プレビューデプロイ

- **mainブランチ**: 本番環境にデプロイ
- **その他のブランチ**: プレビュー環境にデプロイ

```bash
# 機能ブランチを作成
git checkout -b feature/new-feature

# 変更をプッシュ
git push origin feature/new-feature

# → プレビューURLが生成される:
#    https://abc123.nightwork-crm.pages.dev
```

---

## 🔐 環境変数・シークレット管理

### Cloudflare Dashboard経由

1. **Settings** → **Environment variables**
2. **Add variable**:
   - Production: 本番環境用
   - Preview: プレビュー環境用

### Wrangler CLI経由

```bash
# シークレットを追加
npx wrangler pages secret put SECRET_NAME --project-name webapp

# 環境変数を追加
npx wrangler pages deployment create \
  --project-name webapp \
  --branch main \
  --var KEY=VALUE
```

---

## 📱 LINE Webhook設定

### 本番環境

```
Webhook URL: https://nightwork-crm.pages.dev/webhook/line
```

### プレビュー環境（テスト用）

```
Webhook URL: https://abc123.nightwork-crm.pages.dev/webhook/line
```

### チャネル情報の設定

```bash
# 本番データベースに設定
npx wrangler d1 execute webapp-production --command="
UPDATE line_channels 
SET 
  channel_access_token = 'YOUR_TOKEN',
  channel_secret = 'YOUR_SECRET',
  bot_user_id = 'YOUR_BOT_ID'
WHERE id = 'channel_001';
"
```

---

## 🔧 トラブルシューティング

### デプロイが失敗する

**原因**: ビルドエラー

**確認**:
```bash
# ローカルでビルドテスト
npm run build
```

### D1データベースに接続できない

**原因**: バインディングが未設定

**解決**:
1. Cloudflare Dashboard → **Settings** → **Functions**
2. **D1 database bindings** を確認
3. Variable name: `DB`, Database: `webapp-production`

### マイグレーションエラー

**原因**: マイグレーションが未適用

**解決**:
```bash
npx wrangler d1 migrations apply webapp-production
```

### Cronが動作しない

**原因**: Cronトリガーが未設定

**解決**:
1. Cloudflare Dashboard → **Settings** → **Triggers**
2. **Cron Triggers** → **Add Cron Trigger**
3. Schedule: `0 12 * * *`

---

## 📊 デプロイ後の確認

### ✅ 必須確認項目

```bash
# ヘルスチェック
curl https://your-deployment.pages.dev/health

# ログイン画面の確認
curl -I https://your-deployment.pages.dev/

# API動作確認
curl -X POST https://your-deployment.pages.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cast1@example.com","password":"password123"}'
```

### ✅ 機能確認

- [ ] ログイン成功
- [ ] 顧客一覧表示
- [ ] 登録コード発行
- [ ] LINE Webhook応答
- [ ] Cron実行ログ（12:00以降）

---

## 🎯 カスタムドメイン設定

### Cloudflare Dashboard経由

1. **Custom domains** → **Set up a domain**
2. ドメイン名を入力: `crm.yourdomain.com`
3. DNS設定を確認・適用

### Wrangler CLI経由

```bash
npx wrangler pages domain add crm.yourdomain.com \
  --project-name webapp
```

---

## 🔄 更新・ロールバック

### 新バージョンのデプロイ

```bash
# コードを更新
git add .
git commit -m "Update to v1.1"
git push origin main

# 自動的に新バージョンがデプロイされる
```

### ロールバック

1. Cloudflare Dashboard → **Deployments**
2. 以前のデプロイを選択
3. **Rollback to this deployment**

---

## 📚 参考リンク

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Docs](https://docs.github.com/)

---

**最終更新**: 2025-12-18  
**プロジェクトバージョン**: MVP v1.0  
**バックアップURL**: https://www.genspark.ai/api/files/s/41zXzb1p
