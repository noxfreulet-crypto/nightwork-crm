# 🚀 クイックスタートガイド

このガイドでは、最も簡単な方法でナイトワークCRMをデプロイします。

## 📋 必要なもの

- [ ] Cloudflareアカウント（無料プランでOK）
- [ ] Node.js 18以上がインストールされたPC
- [ ] ターミナル/コマンドプロンプト

## ⚡ 5分でデプロイ

### 1️⃣ プロジェクトのダウンロード

バックアップURLからプロジェクトをダウンロード：

**バックアップURL**: https://www.genspark.ai/api/files/s/bFd9WhAX

```bash
# ダウンロードしたファイルを展開
tar -xzf nightwork-crm-mvp-ready.tar.gz

# プロジェクトディレクトリに移動
cd home/user/webapp
```

### 2️⃣ Cloudflareにログイン

```bash
npx wrangler login
```

ブラウザが開き、Cloudflareへのログインを求められます。

### 3️⃣ D1データベースを作成

```bash
npx wrangler d1 create webapp-production
```

出力例：
```
✅ Successfully created DB 'webapp-production'

[[d1_databases]]
binding = "DB"
database_name = "webapp-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  ← これをコピー
```

### 4️⃣ database_idを設定

`wrangler.jsonc`をエディタで開き、`database_id`に先ほどコピーしたIDを貼り付け：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "webapp-production",
    "database_id": "ここに貼り付け"  // ← ここを更新
  }
]
```

### 5️⃣ 自動デプロイスクリプトを実行

```bash
./deploy.sh
```

このスクリプトが自動で以下を実行：
- ✅ 認証確認
- ✅ データベースマイグレーション適用
- ✅ プロジェクトビルド
- ✅ Cloudflare Pagesにデプロイ

### 6️⃣ 完了！

デプロイ完了後、URLが表示されます：

```
✨ Success! Deployed to https://xxxxxxxx.webapp.pages.dev
```

このURLをブラウザで開いてログイン画面を確認してください。

## 🧪 動作テスト

### ログインテスト

デプロイされたURLにアクセス：

```
https://your-deployment.webapp.pages.dev
```

以下のテストアカウントでログイン：

| ロール | メールアドレス | パスワード |
|--------|---------------|-----------|
| キャスト | cast1@example.com | password123 |
| キャスト | cast2@example.com | password123 |
| マネージャー | manager@example.com | password123 |

### 機能テスト

1. ✅ ログイン
2. ✅ ホーム画面表示
3. ✅ 顧客一覧表示
4. ✅ 登録コード発行

## 📱 LINE公式アカウント連携（オプション）

実際にLINEと連携する場合：

### 1️⃣ LINE Developersで設定

1. [LINE Developers Console](https://developers.line.biz/)にアクセス
2. Messaging APIチャネルを作成
3. Webhook URLを設定：
   ```
   https://your-deployment.webapp.pages.dev/webhook/line
   ```

### 2️⃣ チャネル情報をD1に保存

```bash
npx wrangler d1 execute webapp-production --command="
UPDATE line_channels 
SET 
  channel_access_token = 'YOUR_TOKEN',
  channel_secret = 'YOUR_SECRET',
  bot_user_id = 'YOUR_BOT_ID'
WHERE id = 'channel_001';
"
```

### 3️⃣ 動作確認

1. LINE公式アカウントを友達追加
2. 登録コードを送信
3. 顧客が自動登録されることを確認

## 🔄 更新方法

コードを変更した後、再デプロイするには：

```bash
npm run build
npx wrangler pages deploy dist --project-name webapp
```

または：

```bash
./deploy.sh
```

## 🆘 トラブルシューティング

### 「database_id が設定されていません」エラー

➡️ ステップ3-4を再確認してください

### 「マイグレーションが未適用です」エラー

```bash
npx wrangler d1 migrations apply webapp-production
```

### ログインできない

1. ブラウザのキャッシュをクリア
2. シークレットウィンドウで試す
3. データベースにユーザーが存在するか確認：
```bash
npx wrangler d1 execute webapp-production --command="SELECT * FROM users;"
```

## 📚 詳細情報

より詳しい情報は以下を参照：

- **DEPLOYMENT.md**: 詳細なデプロイ手順
- **README.md**: プロジェクト全体の説明
- **Cloudflare Docs**: https://developers.cloudflare.com/pages/

## 🎉 次のステップ

1. ✅ 本番用の強力なパスワードに変更
2. ✅ シードデータを削除（テストアカウント）
3. ✅ カスタムドメインの設定
4. ✅ 実店舗でベータテスト

---

**サポートが必要な場合**: README.mdのトラブルシューティングセクションを確認してください。
