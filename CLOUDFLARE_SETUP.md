# 🚀 Cloudflare Pages セットアップガイド

## ✅ GitHub連携完了！

プロジェクトがGitHubにプッシュされました：
**リポジトリURL**: https://github.com/noxfreulet-crypto/nightwork-crm

次は、Cloudflare PagesでGitHub連携を設定して、自動デプロイを有効化します。

---

## 📋 Cloudflare Pages設定手順

### ステップ1: Cloudflare Dashboardにアクセス

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 左側メニューから **Workers & Pages** を選択

### ステップ2: 新しいアプリケーションを作成

1. **Create application** ボタンをクリック
2. **Pages** タブを選択
3. **Connect to Git** をクリック

### ステップ3: GitHubアカウントを接続

1. **Connect GitHub** ボタンをクリック
2. GitHubの認証画面が表示されます
3. **Authorize Cloudflare Pages** をクリック
4. リポジトリへのアクセス権限を付与:
   - **All repositories** または
   - **Only select repositories** → `nightwork-crm` を選択

### ステップ4: リポジトリを選択

1. リポジトリ一覧から **noxfreulet-crypto/nightwork-crm** を選択
2. **Begin setup** をクリック

### ステップ5: ビルド設定

以下の設定を入力します：

```
Project name: nightwork-crm
Production branch: main

Build settings:
  Framework preset: None
  Build command: npm run build
  Build output directory: dist
  Root directory: (空白のまま)

Environment variables: (後で設定)
```

**重要**: 
- Build command: `npm run build`
- Build output directory: `dist`

### ステップ6: Save and Deploy

1. **Save and Deploy** ボタンをクリック
2. 初回デプロイが開始されます（3-5分程度）
3. デプロイ完了後、URLが表示されます:
   ```
   https://nightwork-crm.pages.dev
   ```

---

## 🗄️ D1データベースの設定

### ステップ1: D1データベースを作成

ローカルターミナルで以下を実行：

```bash
# Cloudflareにログイン
npx wrangler login

# D1データベースを作成
npx wrangler d1 create nightwork-crm-production
```

**出力例**:
```
✅ Successfully created DB 'nightwork-crm-production'

[[d1_databases]]
binding = "DB"
database_name = "nightwork-crm-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**database_id をコピーしてください！**

### ステップ2: Cloudflare DashboardでD1をバインド

1. Cloudflare Pages → **nightwork-crm** プロジェクト
2. **Settings** → **Functions** タブ
3. **D1 database bindings** セクション:
   - **Add binding** をクリック
   - **Variable name**: `DB`
   - **D1 database**: `nightwork-crm-production` を選択
4. **Save** をクリック

### ステップ3: マイグレーションを適用

```bash
# 本番データベースにテーブルを作成
npx wrangler d1 migrations apply nightwork-crm-production

# 確認プロンプトで "y" を入力
```

### ステップ4: シードデータを投入（テスト用）

```bash
# テストアカウントを作成
npx wrangler d1 execute nightwork-crm-production --file=./scripts/seed.sql
```

---

## ⏰ Cronトリガーの設定

### Cloudflare Dashboard経由

1. **Settings** → **Triggers** タブ
2. **Cron Triggers** セクション:
   - **Add Cron Trigger** をクリック
   - **Cron expression**: `0 12 * * *` （毎日12:00 UTC）
3. **Add Trigger** をクリック

これで、毎日12:00にToDo自動生成が実行されます。

---

## 🔄 再デプロイ（D1設定後）

D1バインディングを追加した後、再デプロイが必要です：

### 方法1: Cloudflare Dashboard経由

1. **Deployments** タブに移動
2. 最新のデプロイを選択
3. **Retry deployment** をクリック

### 方法2: GitHubからプッシュ

```bash
# ローカルで小さな変更をコミット
cd /path/to/nightwork-crm
echo "# Updated" >> README.md
git add README.md
git commit -m "Trigger redeploy after D1 setup"
git push origin main
```

GitHubにプッシュすると、自動的に再デプロイされます。

---

## ✅ 動作確認

### 1. ヘルスチェック

```bash
curl https://nightwork-crm.pages.dev/health
```

**期待される出力**:
```json
{"status":"ok","timestamp":"2025-12-18T..."}
```

### 2. ログイン画面

ブラウザで以下にアクセス:
```
https://nightwork-crm.pages.dev
```

### 3. テストアカウントでログイン

- **Cast 1**: `cast1@example.com` / `password123`
- **Cast 2**: `cast2@example.com` / `password123`
- **Manager**: `manager@example.com` / `password123`

---

## 📱 LINE公式アカウント連携

### ステップ1: LINE Developers設定

1. [LINE Developers Console](https://developers.line.biz/) にアクセス
2. プロバイダーを作成（または既存を選択）
3. **Messaging API** チャネルを作成

### ステップ2: Webhook URL設定

```
Webhook URL: https://nightwork-crm.pages.dev/webhook/line
```

1. LINE Developers Console → あなたのチャネル
2. **Messaging API settings** タブ
3. **Webhook URL**: 上記URLを入力
4. **Use webhook**: **ON**
5. **Verify** ボタンで動作確認

### ステップ3: チャネル情報を取得

以下をコピー：
- **Channel Access Token** (長期)
- **Channel Secret**
- **Bot User ID**

### ステップ4: D1に設定を保存

```bash
npx wrangler d1 execute nightwork-crm-production --command="
UPDATE line_channels 
SET 
  channel_access_token = 'YOUR_CHANNEL_ACCESS_TOKEN',
  channel_secret = 'YOUR_CHANNEL_SECRET',
  bot_user_id = 'YOUR_BOT_USER_ID'
WHERE id = 'channel_001';
"
```

### ステップ5: LINE動作確認

1. LINE公式アカウントを友達追加
2. 登録コードを送信してテスト
3. Webhook処理が正常に動作することを確認

---

## 🔄 継続的デプロイ（CI/CD）

### 自動デプロイのワークフロー

```bash
# ローカルでコード変更
vim src/index.tsx

# コミット
git add .
git commit -m "Update feature"

# GitHubにプッシュ
git push origin main

# → Cloudflare Pagesが自動的に:
#    1. コードをpull
#    2. npm run build を実行
#    3. dist/ をデプロイ
#    4. 新バージョンを公開
```

### プレビュー環境

```bash
# 機能ブランチを作成
git checkout -b feature/new-feature

# 変更をプッシュ
git push origin feature/new-feature

# → プレビューURLが自動生成:
#    https://abc123.nightwork-crm.pages.dev
```

---

## 🎯 カスタムドメイン設定（オプション）

### Cloudflare Dashboard経由

1. **Custom domains** → **Set up a custom domain**
2. ドメイン名を入力: `crm.yourdomain.com`
3. DNS設定を確認・適用

### Wrangler CLI経由

```bash
npx wrangler pages domain add crm.yourdomain.com \
  --project-name nightwork-crm
```

---

## 🔐 本番運用の推奨設定

### 1. テストアカウントを削除

```bash
npx wrangler d1 execute nightwork-crm-production --command="
DELETE FROM users WHERE email LIKE '%@example.com';
"
```

### 2. 本番ユーザーを作成

```bash
# パスワードハッシュを生成
node -e "console.log(require('bcryptjs').hashSync('YOUR_STRONG_PASSWORD', 10))"

# D1に挿入
npx wrangler d1 execute nightwork-crm-production --command="
INSERT INTO users (id, store_id, email, password_hash, display_name, role, is_active)
VALUES (
  'user_' || lower(hex(randomblob(8))),
  'store_demo001',
  'real-manager@example.com',
  'GENERATED_HASH',
  'マネージャー名',
  'manager',
  1
);
"
```

### 3. セキュリティチェックリスト

- [ ] 強力なパスワードに変更
- [ ] HTTPSが有効（Cloudflare Pagesはデフォルト）
- [ ] 本番環境のLINEチャネルを設定
- [ ] 定期的なバックアップ計画
- [ ] アクセスログの監視

---

## 🐛 トラブルシューティング

### デプロイが失敗する

**確認**:
1. Build command: `npm run build`
2. Build output: `dist`
3. エラーログを確認: Cloudflare Dashboard → Deployments → View build log

### D1データベースに接続できない

**確認**:
1. D1 database bindings が設定されているか
2. Variable name が `DB` か
3. 再デプロイを実行したか

### ログインできない

**確認**:
1. シードデータが投入されているか:
   ```bash
   npx wrangler d1 execute nightwork-crm-production --command="SELECT * FROM users;"
   ```
2. ブラウザのCookieをクリア
3. シークレットウィンドウで試す

---

## 📊 デプロイ完了チェックリスト

- [ ] Cloudflare PagesでGitHub連携完了
- [ ] 初回デプロイ成功
- [ ] D1データベース作成・バインド完了
- [ ] マイグレーション適用完了
- [ ] シードデータ投入完了
- [ ] 再デプロイ実行
- [ ] ヘルスチェック成功
- [ ] ログイン動作確認
- [ ] Cronトリガー設定完了
- [ ] LINE Webhook設定（本番運用時）

---

## 🎉 次のステップ

1. ✅ **動作確認**: ログイン・顧客管理・メッセージ送信
2. ✅ **LINE連携**: 本番環境のLINE公式アカウント接続
3. ✅ **ベータテスト**: 実店舗での試験運用
4. ✅ **フィードバック収集**: 改善点の洗い出し

---

**GitHub Repository**: https://github.com/noxfreulet-crypto/nightwork-crm  
**Cloudflare Pages**: https://nightwork-crm.pages.dev （設定後）  
**最終更新**: 2025-12-18
