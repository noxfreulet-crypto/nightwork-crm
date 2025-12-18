#!/bin/bash
# Cloudflare Pages デプロイスクリプト
# このスクリプトはローカル環境で実行してください

set -e  # エラーで停止

echo "🚀 Nightwork CRM デプロイスクリプト"
echo "======================================"
echo ""

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# プロジェクト名
PROJECT_NAME="webapp"
DB_NAME="webapp-production"

echo -e "${YELLOW}ステップ 1: 認証確認${NC}"
echo "Cloudflareアカウントを確認中..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ Cloudflareにログインしていません${NC}"
    echo "以下のコマンドでログインしてください："
    echo "  npx wrangler login"
    exit 1
fi
echo -e "${GREEN}✅ 認証OK${NC}"
echo ""

echo -e "${YELLOW}ステップ 2: D1データベース確認${NC}"
echo "D1データベースの存在を確認中..."

# wrangler.jsoncからdatabase_idを読取
DB_ID=$(grep -A 5 "d1_databases" wrangler.jsonc | grep "database_id" | cut -d'"' -f4)

if [ -z "$DB_ID" ]; then
    echo -e "${RED}❌ database_idが設定されていません${NC}"
    echo ""
    echo "以下の手順を実行してください："
    echo "1. D1データベースを作成:"
    echo "   npx wrangler d1 create $DB_NAME"
    echo ""
    echo "2. 出力されたdatabase_idをwrangler.jsoncに設定"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ データベースID: $DB_ID${NC}"
echo ""

echo -e "${YELLOW}ステップ 3: マイグレーション確認${NC}"
echo "マイグレーションの適用状況を確認中..."
MIGRATIONS=$(npx wrangler d1 migrations list $DB_NAME 2>&1 || true)

if echo "$MIGRATIONS" | grep -q "No migrations"; then
    echo -e "${YELLOW}⚠️  マイグレーションが未適用です${NC}"
    read -p "マイグレーションを適用しますか？ (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npx wrangler d1 migrations apply $DB_NAME
        echo -e "${GREEN}✅ マイグレーション適用完了${NC}"
    else
        echo -e "${RED}❌ マイグレーション未適用のため、デプロイを中止します${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ マイグレーション適用済み${NC}"
fi
echo ""

echo -e "${YELLOW}ステップ 4: プロジェクトビルド${NC}"
echo "依存関係のインストール..."
npm install --silent

echo "プロジェクトをビルド中..."
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ ビルドに失敗しました（distディレクトリが存在しません）${NC}"
    exit 1
fi

echo -e "${GREEN}✅ ビルド完了${NC}"
echo ""

echo -e "${YELLOW}ステップ 5: Cloudflare Pagesにデプロイ${NC}"
echo "デプロイを開始します..."

npx wrangler pages deploy dist --project-name $PROJECT_NAME

echo ""
echo -e "${GREEN}🎉 デプロイ完了！${NC}"
echo ""
echo "======================================"
echo -e "${GREEN}次のステップ:${NC}"
echo "1. デプロイされたURLにアクセスしてログインをテスト"
echo "2. LINE公式アカウントのWebhook URLを設定"
echo "3. 詳細はDEPLOYMENT.mdを参照してください"
echo ""
echo -e "${YELLOW}テストアカウント:${NC}"
echo "  Cast 1: cast1@example.com / password123"
echo "  Cast 2: cast2@example.com / password123"
echo "  Manager: manager@example.com / password123"
echo "======================================"
