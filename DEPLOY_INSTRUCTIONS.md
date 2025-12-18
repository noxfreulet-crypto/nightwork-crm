# 🚀 デプロイ完全ガイド

## 現在の状況

Sandbox環境からCloudflareへの直接デプロイには、以下の制限があります：
- ❌ Cloudflare APIトークンにIP制限がかかっている
- ❌ Sandbox IPアドレス (170.106.202.227) からのアクセスが拒否される

## ✅ 解決策：ローカル環境からデプロイ

### 📦 ステップ1: プロジェクトをダウンロード

**バックアップURL**: https://www.genspark.ai/api/files/s/bFd9WhAX

```bash
# ダウンロード（ブラウザまたはcurl）
curl -L -o nightwork-crm.tar.gz https://www.genspark.ai/api/files/s/bFd9WhAX

# 展開
tar -xzf nightwork-crm.tar.gz

# プロジェクトディレクトリに移動
cd home/user/webapp
```

### 🔧 ステップ2: 環境準備

```bash
# Node.js バージョン確認（18以上が必要）
node --version

# Wrangler CLIをグローバルインストール（初回のみ）
npm install -g wrangler

# プロジェクトの依存関係をインストール
npm install
```

### 🔐 ステップ3: Cloudflare認証

```bash
# ブラウザでCloudflareにログイン
npx wrangler login

# 認証確認
npx wrangler whoami
```

**出力例**:
```
 ⛅️ wrangler
──────────────
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email 'your-email@example.com'!
┌─────────────────────┬──────────────────────────────────┐
│ Account Name        │ Account ID                        │
├─────────────────────┼──────────────────────────────────┤
│ Your Account        │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx │
└─────────────────────┴──────────────────────────────────┘
```

### 🗄️ ステップ4: D1データベース作成

```bash
# 本番用D1データベースを作成
npx wrangler d1 create webapp-production
```

**出力例**:
```
✅ Successfully created DB 'webapp-production'

[[d1_databases]]
binding = "DB"
database_name = "webapp-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← これをコピー
```

### ✏️ ステップ5: database_id を設定

`wrangler.jsonc` ファイルをエディタで開き、`database_id` を更新：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "webapp",
  "compatibility_date": "2025-12-18",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "ここに先ほどコピーしたIDを貼り付け"  // ← 更新
    }
  ],
  
  "triggers": {
    "crons": ["0 12 * * *"]
  }
}
```

### 📊 ステップ6: マイグレーション適用

```bash
# データベーステーブルを作成
npx wrangler d1 migrations apply webapp-production

# 確認プロンプトで "y" を入力
```

**出力例**:
```
Migrations to be applied:
┌─────┬───────────────────────────┐
│ 0000│ strong_triton.sql         │
└─────┴───────────────────────────┘
? Ok to apply 1 migration? › (y/N)
```

### 🌱 ステップ7: シードデータ投入

```bash
# テストデータを投入
npx wrangler d1 execute webapp-production --file=./scripts/seed.sql
```

### 🏗️ ステップ8: プロジェクトビルド

```bash
# プロジェクトをビルド
npm run build
```

**確認**:
```bash
# distディレクトリが生成されたことを確認
ls -la dist/
# 出力: _worker.js, _routes.json など
```

### 📦 ステップ9: Cloudflare Pagesプロジェクト作成

```bash
# Pagesプロジェクトを作成
npx wrangler pages project create webapp \
  --production-branch main \
  --compatibility-date 2025-12-18
```

### 🚀 ステップ10: デプロイ実行

```bash
# distディレクトリをデプロイ
npx wrangler pages deploy dist --project-name webapp
```

**成功時の出力**:
```
✨ Success! Uploaded 2 files (X.XX sec)

✨ Deployment complete! Take a peek over at
   https://xxxxxxxx.webapp.pages.dev
```

### 🎉 ステップ11: 動作確認

デプロイされたURLにアクセス：

```bash
# ヘルスチェック
curl https://your-deployment.webapp.pages.dev/health

# 期待される出力:
# {"status":"ok","timestamp":"2025-12-18T..."}
```

ブラウザでアクセス：
```
https://your-deployment.webapp.pages.dev
```

テストアカウントでログイン：
- **Cast 1**: `cast1@example.com` / `password123`
- **Cast 2**: `cast2@example.com` / `password123`
- **Manager**: `manager@example.com` / `password123`

---

## 🔄 自動デプロイスクリプト（オプション）

上記の手順を自動化するスクリプトを用意しています：

```bash
# 実行権限を付与（初回のみ）
chmod +x deploy.sh

# 自動デプロイ実行
./deploy.sh
```

このスクリプトは以下を自動実行します：
1. ✅ 認証確認
2. ✅ データベース確認
3. ✅ マイグレーション適用
4. ✅ ビルド
5. ✅ デプロイ

---

## 📱 LINE公式アカウント連携

### 1. LINE Developers設定

1. [LINE Developers Console](https://developers.line.biz/) にアクセス
2. プロバイダーを作成（または既存を選択）
3. Messaging APIチャネルを作成
4. Webhook設定：
   ```
   https://your-deployment.webapp.pages.dev/webhook/line
   ```
5. Webhookの利用: **ON**

### 2. チャネル情報取得

以下をコピー：
- **Channel Access Token** (長期)
- **Channel Secret**
- **Bot User ID**

### 3. D1に設定を保存

```bash
npx wrangler d1 execute webapp-production --command="
UPDATE line_channels 
SET 
  channel_access_token = 'あなたのChannel Access Token',
  channel_secret = 'あなたのChannel Secret',
  bot_user_id = 'あなたのBot User ID'
WHERE id = 'channel_001';
"
```

### 4. Webhook動作テスト

1. LINE公式アカウントを友達追加
2. テストメッセージを送信
3. Cloudflare Dashboardでログ確認

---

## 🔧 トラブルシューティング

### エラー: "Cannot use the access token from location"

**原因**: IP制限がかかっている  
**解決策**: ローカル環境からデプロイしてください

### エラー: "database_id が設定されていません"

**原因**: `wrangler.jsonc`にdatabase_idが未設定  
**解決策**: ステップ4-5を再実行

### エラー: "D1_ERROR: no such table"

**原因**: マイグレーションが未適用  
**解決策**: 
```bash
npx wrangler d1 migrations apply webapp-production
```

### エラー: ログインできない

**原因**: シードデータ未投入 or Cookie問題  
**解決策**:
1. シードデータを投入:
   ```bash
   npx wrangler d1 execute webapp-production --file=./scripts/seed.sql
   ```
2. ブラウザのCookieをクリア
3. シークレットウィンドウで試す

---

## 📊 デプロイ後の確認

### ✅ 必須確認項目

- [ ] ヘルスチェックが正常 (`/health`)
- [ ] ログインが成功する
- [ ] 顧客一覧が表示される
- [ ] 登録コードが発行できる
- [ ] D1データベースに接続できている

### ✅ LINE連携確認項目

- [ ] Webhook URLが設定されている
- [ ] LINE友達追加が可能
- [ ] メッセージ送信で応答がある
- [ ] 登録コードでの顧客登録が動作

---

## 🎯 次のステップ

1. ✅ **本番パスワード変更**: シードデータのテストアカウントを削除または変更
2. ✅ **カスタムドメイン設定**: 
   ```bash
   npx wrangler pages domain add yourdomain.com --project-name webapp
   ```
3. ✅ **実店舗ベータテスト**: 実際のキャストに使ってもらう
4. ✅ **フィードバック収集**: 改善点を洗い出す

---

## 📞 サポート

- **詳細ドキュメント**: `README.md`, `QUICKSTART.md`
- **Cloudflare Docs**: https://developers.cloudflare.com/pages/
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/

---

**Last Updated**: 2025-12-18  
**Project Version**: MVP 1.0  
**Backup URL**: https://www.genspark.ai/api/files/s/bFd9WhAX
