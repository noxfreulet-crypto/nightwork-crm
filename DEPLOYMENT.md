# Cloudflare Pages デプロイ手順書

## 📦 プロジェクトバックアップ

**バックアップURL**: https://www.genspark.ai/api/files/s/bFd9WhAX

このtar.gzファイルをダウンロードして、ローカル環境に展開してください：

```bash
# ダウンロード後
tar -xzf nightwork-crm-mvp-ready.tar.gz
cd home/user/webapp
```

## 🚀 デプロイ手順（ローカル環境から）

### 前提条件
- Node.js 18以上がインストールされていること
- Cloudflareアカウントを持っていること
- Wrangler CLIがインストールされていること（`npm install -g wrangler`）

### ステップ1: Cloudflare認証

```bash
# Cloudflareにログイン
npx wrangler login

# アカウント確認
npx wrangler whoami
```

### ステップ2: D1データベースの作成

```bash
# 本番用D1データベースを作成
npx wrangler d1 create webapp-production

# 出力されたdatabase_idをコピー
# 例: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### ステップ3: wrangler.jsoncの更新

`wrangler.jsonc`ファイルを開き、`database_id`を設定：

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
      "database_id": "ここにdatabase_idを貼り付け"
    }
  ],
  
  "triggers": {
    "crons": ["0 12 * * *"]
  }
}
```

### ステップ4: マイグレーションの適用

```bash
# 本番データベースにマイグレーションを適用
npx wrangler d1 migrations apply webapp-production

# 確認プロンプトで "y" を入力
```

### ステップ5: シードデータの投入（オプション）

```bash
# シードデータを投入（テスト用）
npx wrangler d1 execute webapp-production --file=./scripts/seed.sql

# 注意: 本番環境では実際のデータに置き換えてください
```

### ステップ6: プロジェクトのビルド

```bash
# 依存関係のインストール
npm install

# プロジェクトのビルド
npm run build

# dist/ディレクトリが生成されることを確認
ls -la dist/
```

### ステップ7: Cloudflare Pagesプロジェクトの作成

```bash
# Pagesプロジェクトを作成（mainブランチを本番とする）
npx wrangler pages project create webapp \
  --production-branch main \
  --compatibility-date 2025-12-18
```

### ステップ8: デプロイ実行

```bash
# distディレクトリをデプロイ
npx wrangler pages deploy dist --project-name webapp

# デプロイ完了後、URLが表示されます：
# ✅ Success! Uploaded 2 files
# ✨ Deployment complete! Take a peek over at https://xxxxxxxx.webapp.pages.dev
```

### ステップ9: 動作確認

デプロイされたURLにアクセスして動作確認：

```bash
# ヘルスチェック
curl https://your-deployment.webapp.pages.dev/health

# ログインテスト（ブラウザで）
# https://your-deployment.webapp.pages.dev/
```

テストアカウント:
- Cast 1: `cast1@example.com` / `password123`
- Cast 2: `cast2@example.com` / `password123`
- Manager: `manager@example.com` / `password123`

## 🔧 LINE公式アカウント連携設定

### ステップ1: LINE Developersコンソール

1. [LINE Developers Console](https://developers.line.biz/)にアクセス
2. プロバイダーを作成（既存のものを使用も可）
3. Messaging APIチャネルを作成

### ステップ2: Webhook URL設定

LINE Developersコンソールで以下を設定：

```
Webhook URL: https://your-deployment.webapp.pages.dev/webhook/line
Webhookの利用: ON
```

### ステップ3: チャネル情報の取得

以下の情報をコピー：
- Channel Access Token（ロングターム）
- Channel Secret
- Bot User ID

### ステップ4: D1データベースに設定を保存

```bash
# ローカルから実行
npx wrangler d1 execute webapp-production --command="
UPDATE line_channels 
SET 
  channel_access_token = 'YOUR_ACTUAL_TOKEN_HERE',
  channel_secret = 'YOUR_ACTUAL_SECRET_HERE',
  bot_user_id = 'YOUR_BOT_USER_ID_HERE'
WHERE id = 'channel_001';
"
```

### ステップ5: Webhook動作テスト

1. LINE公式アカウントを友達追加
2. メッセージを送信
3. Cloudflare Dashboardでログを確認

```bash
# Wranglerでログを確認
npx wrangler pages deployment tail --project-name webapp
```

## 🔐 環境変数・シークレットの設定（必要に応じて）

```bash
# シークレットの追加（例: LINE Channel Secret）
npx wrangler pages secret put LINE_CHANNEL_SECRET --project-name webapp

# 環境変数の設定
npx wrangler pages deployment create --project-name webapp \
  --env production \
  --var KEY=VALUE
```

## 📊 デプロイ後の確認事項

### ✅ 必須確認
- [ ] ヘルスチェックエンドポイント (`/health`) が200を返す
- [ ] ログイン機能が動作する
- [ ] 顧客一覧が表示される
- [ ] D1データベースに接続できている
- [ ] LINE Webhookが正常に動作する

### ✅ 機能確認
- [ ] 登録コード発行
- [ ] 顧客登録（LINE連携）
- [ ] 来店登録
- [ ] メッセージ送信
- [ ] ToDo自動生成（Cron）

## 🐛 トラブルシューティング

### D1接続エラー

**症状**: `D1_ERROR: no such table`

**解決策**:
```bash
# マイグレーションが適用されているか確認
npx wrangler d1 migrations list webapp-production

# 未適用の場合
npx wrangler d1 migrations apply webapp-production
```

### ビルドエラー

**症状**: `vite build` が失敗

**解決策**:
```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 認証エラー

**症状**: ログインできない

**解決策**:
1. ブラウザのCookieをクリア
2. シークレットウィンドウで試す
3. D1データベースにユーザーデータがあるか確認：
```bash
npx wrangler d1 execute webapp-production --command="SELECT * FROM users;"
```

### LINE Webhook エラー

**症状**: `Signature validation failed`

**解決策**:
1. Channel Secretが正しく設定されているか確認
2. Webhook URLが正確か確認
3. LINE Developersコンソールで「Webhook検証」を実行

## 📝 デプロイ後の設定変更

### カスタムドメインの追加

```bash
# カスタムドメインを追加
npx wrangler pages domain add example.com --project-name webapp
```

### Cronスケジュールの変更

`wrangler.jsonc`の`triggers.crons`を編集して再デプロイ：

```jsonc
"triggers": {
  "crons": ["0 12 * * *"]  // 毎日12:00
}
```

## 🎯 本番運用の推奨事項

### セキュリティ
- [ ] シードデータの削除（テストアカウント）
- [ ] 強力なパスワードポリシーの実装
- [ ] HTTPS強制（Cloudflare Pagesはデフォルトでサポート）
- [ ] Rate Limitingの設定

### モニタリング
- [ ] Cloudflare Analytics有効化
- [ ] エラーログの定期確認
- [ ] パフォーマンスメトリクスの監視

### バックアップ
- [ ] D1データベースの定期バックアップ
- [ ] コードのGitリポジトリ管理
- [ ] 環境変数のドキュメント化

## 📞 サポート

問題が発生した場合：
1. README.mdのトラブルシューティングセクションを確認
2. Cloudflare Dashboardのログを確認
3. GitHub Issuesで報告（リポジトリ作成後）

---

**最終更新**: 2025-12-18
**プロジェクトバージョン**: MVP 1.0
**デプロイ環境**: Cloudflare Pages + D1
