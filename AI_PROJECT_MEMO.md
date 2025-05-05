# My New Gear プロジェクト進捗メモ

## 実装済み機能

1. **環境構築**: Docker、PostgreSQL、Hono、Drizzle、Zodなど
2. **認証機能**: サインアップ、ログイン（JWT）
3. **ユーザー管理**: プロフィール取得・更新
4. **アイテム管理**: 作成、一覧取得、詳細取得、更新、削除
5. **ポスト機能**: 作成、詳細取得、アイテムごとの一覧取得
6. **いいね機能**: いいねの追加・削除
7. **コメント機能**: 投稿へのコメント追加、コメント一覧取得
8. **フォロー機能**:
   - ユーザーのフォロー・アンフォロー
   - フォロワー数/フォロー数の取得
   - フォロワー/フォロー一覧の取得
   - タグのフォロー・アンフォロー
   - フォロー中のタグ一覧取得
9. **タグ機能**: タグ一覧取得、詳細取得

## 次回実装予定（優先度順）

1. **フィード機能**

   - フォロー中のユーザーの投稿を時系列で取得
   - フォロー中のタグに関連する投稿を取得
   - 新規ファイル: `src/services/feed.service.ts` と `src/controllers/feed.controller.ts`

2. **通知機能**

   - 通知の種類（いいね、コメント、フォローなど）の定義
   - 通知作成、一覧取得、既読機能
   - 新規ファイル: `src/services/notification.service.ts` と `src/controllers/notification.controller.ts`

3. **検索機能**
   - ユーザー、アイテム、投稿、タグの検索
   - 新規ファイル: `src/services/search.service.ts` と `src/controllers/search.controller.ts`

## 技術的な注意点

- Branded Types（UserId、ItemId、PostId、CommentId、TagIdなど）を使用して型安全性を確保
- ZodによるURLパラメータとリクエストボディの検証
- コントローラー内でのtry-catchによる適切なエラーハンドリング
- サービス層でのデータ整形とZodによる戻り値の検証

## DB構造

主なテーブル:

- users: ユーザー情報
- items: アイテム情報
- posts: 投稿情報
- comments: コメント情報
- likes: いいね情報
- follows: ユーザーフォロー関係
- tags: タグ情報
- tagFollows: タグフォロー関係

## API設計

RESTful APIパターン:

- GET: リソース取得
- POST: リソース作成
- PUT: リソース更新
- DELETE: リソース削除

基本的なエンドポイント構造:

- /api/auth: 認証関連
- /api/users: ユーザー関連
- /api/items: アイテム関連
- /api/posts: 投稿関連
- /api/tags: タグ関連
