# ベースイメージとして Node.js 18を使用
FROM node:18-slim AS base

# pnpmをインストール
RUN corepack enable && corepack prepare pnpm@latest --activate

# 作業ディレクトリを設定
WORKDIR /app

# パッケージファイルのみをコピー（レイヤーキャッシュ最適化）
COPY package.json pnpm-lock.yaml* ./

# 依存関係インストール用のステージ
FROM base AS deps
RUN pnpm install --frozen-lockfile

# ビルド用のステージ
FROM deps AS builder
COPY . .
RUN pnpm build

# 本番環境用のステージ
FROM base AS runner

# 環境変数を設定
ENV NODE_ENV=production

# ビルドされたアプリケーションと必要なファイルをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# ポートを公開
EXPOSE 3000

# アプリケーションを実行
CMD ["node", "dist/index.js"] 