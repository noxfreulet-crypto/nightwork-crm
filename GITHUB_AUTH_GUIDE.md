# GitHub認証ガイド

## 🔐 Sandbox環境でのGitHub認証

### ステップ1: GitHub認証を完了する

1. **Sandbox UIの#githubタブを開く**
2. **GitHub認証ボタンをクリック**
3. **GitHubアカウントでログイン**
4. **アクセス権限を承認**

認証が完了すると、以下のコマンドが使用可能になります。

---

## 🚀 認証完了後の手順

### オプション1: Sandbox環境から直接プッシュ（認証完了後）

```bash
# プロジェクトディレクトリに移動
cd /home/user/webapp

# GitHub認証環境をセットアップ（自動）
# setup_github_environment ツールが実行される

# 新規リポジトリを作成（GitHub CLIを使用）
gh repo create nightwork-crm --public --source=. --remote=origin --push

# または既存リポジトリにプッシュ
git remote add origin https://github.com/YOUR_USERNAME/nightwork-crm.git
git push -u origin main
```

### オプション2: ローカル環境でプッシュ（推奨）

**理由**: より安定した接続、より多くの制御

```bash
# 1. プロジェクトをダウンロード
curl -L -o nightwork-crm.tar.gz https://www.genspark.ai/api/files/s/2rRUuo18
tar -xzf nightwork-crm.tar.gz
cd home/user/webapp

# 2. GitHubで新規リポジトリを作成
# https://github.com/new にアクセスして作成

# 3. リモートを追加してプッシュ
git remote add origin https://github.com/YOUR_USERNAME/nightwork-crm.git
git push -u origin main
```

---

## 📋 GitHub認証のトラブルシューティング

### 問題: "GitHub Session State Missing"

**原因**: GitHub認証が完了していない

**解決策**:
1. Sandbox UIの#githubタブを確認
2. GitHub認証を完了する
3. `setup_github_environment`コマンドを再実行

### 問題: 認証は完了したがプッシュできない

**確認事項**:
- [ ] リポジトリが作成されているか
- [ ] リモートURLが正しいか: `git remote -v`
- [ ] ブランチ名が正しいか: `git branch`

**解決策**:
```bash
# リモート確認
git remote -v

# リモート削除（必要な場合）
git remote remove origin

# リモート再追加
git remote add origin https://github.com/YOUR_USERNAME/nightwork-crm.git

# プッシュ（強制）
git push -u origin main -f
```

---

## 🎯 次のステップ（GitHub認証完了後）

1. ✅ **リポジトリ作成**: `gh repo create` または GitHubウェブUI
2. ✅ **コードプッシュ**: `git push origin main`
3. ✅ **Cloudflare連携**: Cloudflare DashboardでGitHub接続
4. ✅ **自動デプロイ設定**: ビルド設定を構成
5. ✅ **本番稼働**: デプロイ完了！

---

## 💡 推奨アプローチ

### 最も確実な方法: ローカル環境

```bash
# 完全な手順
1. プロジェクトバックアップをダウンロード
   https://www.genspark.ai/api/files/s/2rRUuo18

2. ローカルで展開
   tar -xzf nightwork-crm.tar.gz
   cd home/user/webapp

3. GitHubで新規リポジトリ作成
   https://github.com/new

4. プッシュ
   git remote add origin https://github.com/YOUR_USERNAME/nightwork-crm.git
   git push -u origin main

5. Cloudflare Pages連携
   Cloudflare Dashboard → Workers & Pages → Connect to Git
```

この方法なら、認証の問題を回避でき、確実にデプロイできます。

---

## 📚 関連ドキュメント

- **[GITHUB_SETUP.md](GITHUB_SETUP.md)** - 詳細なGitHub連携ガイド
- **[GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md)** - Cloudflare Pages自動デプロイ
- **[README.md](README.md)** - プロジェクト概要

---

**プロジェクトバックアップ**: https://www.genspark.ai/api/files/s/2rRUuo18
