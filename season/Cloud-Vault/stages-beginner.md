# 初心者向け・チュートリアルライン設計

## 設計方針

- **段階的スキルアップ**: ブラウザのみ → curl → AWS CLI の3ステップで自然に慣れる
- **ウォークスルー形式**: 問題文にコマンドの意味と手順を丁寧に記載する
- **理解確認クイズ**: フラグ取得後に「なぜ危険か」を問う選択肢クイズ（ボーナスポイント）
- **実例紐付け**: 各問題に実際のセキュリティインシデント事例を添える

---

## チュートリアルラインの全体像

```
[START]
  │
  ├── [T1] Webの偵察        ★☆☆☆☆  ブラウザのみ
  │    └── [T2] 公開バケット ★☆☆☆☆  ブラウザのみ
  │         └── [T3] ソース確認 ★☆☆☆☆  ブラウザのみ
  │
  └── [T4] curl入門         ★★☆☆☆  ターミナル初歩
       └── [T5] .env漏洩    ★★☆☆☆  curlで設定ファイルを取得
            └── [T6] AWS CLI基礎 ★★☆☆☆  aws configure + 基本コマンド
                 └── [Stage 0] メインラインへ合流 →
```

T1〜T3はブラウザのみで解ける独立した問題として最初から全員に開放。
T4〜T6はT3クリア後に解放し、AWS CLIへ橋渡しするチュートリアルとして機能する。

---

## T1:「Webの歩き方 - 最初の偵察」

| 項目 | 内容 |
|------|------|
| 難易度 | ★☆☆☆☆ |
| スキル | ブラウザ操作, robots.txt, Webの公開情報 |
| 解放条件 | 開始時から解放 |
| 配点 | 30pt + クイズ 10pt |
| 必要なツール | **ブラウザのみ** |

### このチャレンジで学ぶこと

> Webサイトには、一般公開しているけれど「あまり知られたくない」ページが存在することがあります。
> 攻撃者はまず **公開情報を集める偵察** から始めます。特別なツールは不要 — ブラウザだけで始められます。

### シナリオ文

> TechVault社のWebサイトには、検索エンジンに登録されていない隠しページがある。
> Webサーバーには `robots.txt` という「検索エンジンへのルール書き」が置かれていることが多い。
> まずそこから手がかりを探してみよう。

### ウォークスルー

**Step 1: robots.txt にアクセスする**

ブラウザのアドレスバーに以下を入力してアクセスしてみよう：

```
https://portal.techvault-ctf.example/robots.txt
```

ローカル環境では以下にアクセスする：

```
http://localhost:3000/robots.txt
```

`robots.txt` は検索エンジン（Googleなど）に「このページは検索結果に出さないで」と伝えるファイルです。
でも `robots.txt` 自体は誰でも読めるので、「隠したいパス」が丸見えになることがあります。

**Step 2: 内容を読む**

以下のような内容が表示されるはず：

```
User-agent: *
Disallow: /admin/
Disallow: /internal/
Disallow: /debug/status

# TODO: remove before production
# FLAG: TVAULT{robots_txt_is_public}
```

`Disallow` の行に、管理者や内部ページのパスが書いてある。
さらにコメント行にフラグが残っている（開発者がうっかり書き忘れたケースを模している）。

### フラグ

`TVAULT{robots_txt_is_public}`

### 理解確認クイズ（+10pt）

フラグ提出後に以下のクイズが解放される：

> Q: `robots.txt` の `Disallow` に書かれたパスは、実際にアクセスできないようになっていますか？
>
> (A) `TVAULT_QUIZ{disallow_blocks_access}` → はい、ブロックされます
> (B) `TVAULT_QUIZ{disallow_is_just_a_hint}` → いいえ、あくまで検索エンジンへの「お願い」です
> (C) `TVAULT_QUIZ{disallow_needs_login}` → ログインしないとアクセスできません

**正解: (B)** `TVAULT_QUIZ{disallow_is_just_a_hint}`

> `robots.txt` はアクセス制御の仕組みではありません。ブラウザで直接アクセスすれば誰でも見られます。
> 隠したいページは認証・認可で守る必要があります。

### 実際のインシデント事例

2020年代に入っても、`robots.txt` の `Disallow` に管理画面のパスを書いてしまい、
そこが脆弱なログインフォームへの入口になったという事例が多数存在します。

---

## T2:「鍵のかかっていない倉庫 - S3公開バケット」

| 項目 | 内容 |
|------|------|
| 難易度 | ★☆☆☆☆ |
| スキル | S3の概念, URLアクセス |
| 解放条件 | 開始時から解放 |
| 配点 | 30pt + クイズ 10pt |
| 必要なツール | **ブラウザのみ** |

### このチャレンジで学ぶこと

> AWS S3（Simple Storage Service）はファイルを保存するクラウドサービスです。
> 設定を誤ると、**URLを知っているだけで誰でもファイルを読める**状態になります。
> AWSのアクセスキーもAWSアカウントも不要です。

### シナリオ文

> TechVault社はS3バケットを使って一部のデータを保管している。
> ある日、バケットの公開設定が誤って変更されたまま放置されていた。
> バケット名はWebサイトのソースコードから見つかった: `techvault-public-assets`

### ウォークスルー

**Step 1: S3バケットのURLにアクセスする**

S3バケットには以下の形式のURLでアクセスできます：
```
https://<バケット名>.s3.<リージョン>.amazonaws.com/
```

ブラウザで以下にアクセスしてみよう：
```
https://techvault-public-assets.s3.ap-northeast-1.amazonaws.com/
```

ローカル環境では Floci の S3 エンドポイントを使う：
```
http://localhost:4566/techvault-public-assets-local/
```

**Step 2: ファイル一覧を確認する**

公開設定になっているバケットはXML形式でファイル一覧が返ってきます：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>techvault-public-assets</Name>
  <Contents>
    <Key>config.js</Key>
  </Contents>
  <Contents>
    <Key>flag.txt</Key>
  </Contents>
</ListBucketResult>
```

**Step 3: フラグファイルにアクセスする**

ファイル名が分かれば直接アクセスできます：
```
https://techvault-public-assets.s3.ap-northeast-1.amazonaws.com/flag.txt
```

ローカル環境：
```
http://localhost:4566/techvault-public-assets-local/flag.txt
```

```
このバケットは誤って公開設定になっています。
FLAG: TVAULT{s3_public_access_is_dangerous}
```

### フラグ

`TVAULT{s3_public_access_is_dangerous}`

### 理解確認クイズ（+10pt）

> Q: S3バケットを「パブリック公開」した場合、ファイルにアクセスするために何が必要ですか？
>
> (A) `TVAULT_QUIZ{s3_needs_aws_key}` → AWSアクセスキーが必要
> (B) `TVAULT_QUIZ{s3_needs_account}` → AWSアカウントへのログインが必要
> (C) `TVAULT_QUIZ{s3_needs_only_url}` → URLを知っているだけで誰でもアクセスできる

**正解: (C)** `TVAULT_QUIZ{s3_needs_only_url}`

> 2017年に多くの企業がS3の誤った公開設定により個人情報を漏洩させました（Uber、Verizonなど）。
> 現在AWSはデフォルトで「パブリックアクセスをブロック」する設定になっていますが、
> 意図せずOFFにしてしまうケースが今でも続いています。

### 実際のインシデント事例

- **2017年 Verizon社**: 約1400万件の顧客情報がS3から漏洩
- **2020年 某日本企業**: S3バケットの公開設定ミスにより内部文書が誰でも閲覧可能な状態に
- 現在でも毎月のように新しいS3公開バケットの漏洩事案が報告されています

---

## T3:「ページの裏側 - HTMLソースと開発者の失敗」

| 項目 | 内容 |
|------|------|
| 難易度 | ★☆☆☆☆ |
| スキル | HTMLソース確認 |
| 解放条件 | 開始時から解放 |
| 配点 | 30pt + クイズ 10pt |
| 必要なツール | **ブラウザのみ** |

### このチャレンジで学ぶこと

> WebページのHTMLソースはブラウザから誰でも見ることができます。
> 開発者がテスト用のメモやコメントを本番環境に残してしまうことがあります。

### シナリオ文

> TechVault社のログインページのHTMLソースに、
> 開発者がデバッグ用に残したコメントが埋め込まれているという情報がある。

### ウォークスルー

**Step 1: ページのソースを開く**

ポータルのトップページで右クリック → 「ページのソースを表示」を選択。
または `Ctrl+U`（Windowsの場合）/ `Cmd+Option+U`（Macの場合）を押す。

**Step 2: HTMLコメントを探す**

ソースの中に開発者向けのコメントが残っている。
```html
<!-- TODO: remove debug marker before release: TVAULT{hardcoded_secret_in_js} -->
```

コメントアウトされているが、フラグが含まれている。

### フラグ

`TVAULT{hardcoded_secret_in_js}`

### 理解確認クイズ（+10pt）

> Q: HTMLやJavaScriptに秘密情報を残さないための最善の方法はどれですか？
>
> (A) `TVAULT_QUIZ{minify_protects_secrets}` → コードを圧縮（minify）する
> (B) `TVAULT_QUIZ{comments_are_hidden}` → コメントアウトすれば見えない
> (C) `TVAULT_QUIZ{js_frontend_is_public}` → フロントエンドに秘密情報を置かない

**正解: (C)** `TVAULT_QUIZ{js_frontend_is_public}`

> フロントエンド（ブラウザで動くコード）に置いた情報は原則として全て公開情報です。
> 圧縮・難読化しても解析できます。APIキーや秘密情報はサーバーサイドで管理しましょう。

---

## T4:「コマンドラインの第一歩 - curl入門」

| 項目 | 内容 |
|------|------|
| 難易度 | ★★☆☆☆ |
| スキル | ターミナル操作, curl基礎, HTTPヘッダー |
| 解放条件 | T3 クリア |
| 配点 | 50pt + クイズ 10pt |
| 必要なツール | **ターミナル + curl** |

### このチャレンジで学ぶこと

> `curl` はターミナルからHTTPリクエストを送るコマンドです。
> ブラウザでは見えない **レスポンスヘッダー** を簡単に確認できます。
> セキュリティエンジニアが日常的に使う基本ツールです。

### シナリオ文

> TechVault社のAPIには、通常のブラウザでは見えない情報がHTTPレスポンスヘッダーに含まれている。
> `curl` コマンドを使ってヘッダーを確認してみよう。

### ウォークスルー

**Step 1: curlをインストール確認する**

ターミナルを開いて以下を実行：
```bash
curl --version
```
`curl 7.xx.x` などのバージョンが表示されればOK。
（Mac/Linuxは最初から入っている。Windowsは WSL または winget でインストール）

**Step 2: 基本的なGETリクエストを送る**

```bash
curl https://portal.techvault-ctf.example/api/ping
```

ローカル環境：
```bash
curl http://localhost:3000/api/ping
```
レスポンスのボディ（中身）が表示される。

**Step 3: ヘッダーも含めて表示する（`-i` オプション）**

```bash
curl -i https://portal.techvault-ctf.example/api/ping
```

ローカル環境：
```bash
curl -i http://localhost:3000/api/ping
```

`-i` をつけるとレスポンスヘッダーも一緒に表示される：
```
HTTP/1.1 200 OK
Content-Type: application/json
X-Powered-By: Express
X-Debug-Info: build=2026.03.15
X-Internal-Flag: TVAULT{curl_headers_revealed}    ← ここ！
Server: nginx

{"status": "ok"}
```

**Step 4: ヘッダーだけを表示する（`-I` オプション）**

```bash
curl -I https://portal.techvault-ctf.example/api/ping
```

ローカル環境：
```bash
curl -I http://localhost:3000/api/ping
```
`-I` はボディを取得せずヘッダーだけ取得（HEADリクエスト）。

### フラグ

`TVAULT{curl_headers_revealed}`

### よく使うcurlオプション（参考）

| オプション | 意味 | 例 |
|-----------|------|-----|
| `-i` | ヘッダー+ボディを表示 | `curl -i <url>` |
| `-I` | ヘッダーのみ（HEADリクエスト） | `curl -I <url>` |
| `-v` | 詳細表示（リクエストも見える） | `curl -v <url>` |
| `-H` | ヘッダーを追加して送信 | `curl -H "Authorization: Bearer xxx" <url>` |
| `-X` | HTTPメソッドを指定 | `curl -X POST <url>` |
| `-d` | POSTのボディを指定 | `curl -X POST -d '{"key":"val"}' <url>` |

### 理解確認クイズ（+10pt）

> Q: HTTPレスポンスヘッダーに `X-Powered-By: PHP/7.2.0` と表示されていた場合、攻撃者にとって何が有利になりますか？
>
> (A) `TVAULT_QUIZ{server_info_is_harmless}` → 特に問題ない
> (B) `TVAULT_QUIZ{server_version_helps_attack}` → バージョン情報から既知の脆弱性を調べられる
> (C) `TVAULT_QUIZ{header_blocks_attack}` → ヘッダーがあることでむしろ安全になる

**正解: (B)** `TVAULT_QUIZ{server_version_helps_attack}`

> バージョン情報の開示は「情報漏洩」の一種です。攻撃者はバージョンから既知のCVEを調べ、
> 攻撃コードを探します。本番環境では `Server` ヘッダーや `X-Powered-By` を隠すことが推奨されます。

---

## T5:「設定ファイルの流出 - .envファイル」

| 項目 | 内容 |
|------|------|
| 難易度 | ★★☆☆☆ |
| スキル | curl, Webの設定ファイル偵察 |
| 解放条件 | T4 クリア |
| 配点 | 75pt + クイズ 10pt |
| 必要なツール | **ターミナル + curl** |

### このチャレンジで学ぶこと

> `.env` ファイルはアプリケーションの環境変数（設定値）を管理するファイルです。
> データベースのパスワードやAPIキーが書かれることが多く、
> Webサーバーの設定ミスで公開されてしまうケースが後を絶ちません。

### シナリオ文

> TechVault社の開発チームはLaravelというPHPフレームワークを使用している。
> Laravelは `.env` ファイルで設定を管理するが、Webサーバーの設定ミスで外部公開されていることがある。

### ウォークスルー

**Step 1: .envファイルにアクセスしてみる**

```bash
curl https://portal.techvault-ctf.example/.env
```

ローカル環境：
```bash
curl http://localhost:3000/.env
```

```
APP_NAME=TechVault
APP_ENV=production
APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxx
APP_DEBUG=true

DB_CONNECTION=mysql
DB_HOST=internal-db.techvault.local
DB_PORT=3306
DB_DATABASE=techvault_prod
DB_USERNAME=app_user
DB_PASSWORD=Pr0duction_DB_Pass!

AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE2
AWS_SECRET_ACCESS_KEY=another-secret-key-here
AWS_DEFAULT_REGION=ap-northeast-1

FLAG=TVAULT{dotenv_exposed_on_web}
```

**Step 2: 他にも探してみる**

開発者がよく間違えて公開してしまうパス：
```bash
curl https://portal.techvault-ctf.example/.env.backup
curl https://portal.techvault-ctf.example/.env.production
curl https://portal.techvault-ctf.example/config.php
curl https://portal.techvault-ctf.example/database.yml

# ローカル環境で確認する場合はドメインを localhost:3000 に置き換える
curl http://localhost:3000/.env.backup
curl http://localhost:3000/.env.production
curl http://localhost:3000/config.php
curl http://localhost:3000/database.yml
```

### フラグ

`TVAULT{dotenv_exposed_on_web}`

### 理解確認クイズ（+10pt）

> Q: Webサーバーで `.env` ファイルを外部から見えないようにするには？
>
> (A) `TVAULT_QUIZ{rename_env_file}` → ファイル名を変える
> (B) `TVAULT_QUIZ{env_outside_webroot}` → URLでアクセスできないように、Webサーバーの公開ルート配下に配置しない
> (C) `TVAULT_QUIZ{encrypt_env_content}` → ファイルの内容を暗号化する

**正解: (B)** `TVAULT_QUIZ{env_outside_webroot}`

> `.env` ファイルは、URLで到達できる公開ディレクトリやWebサーバーのドキュメントルート配下に配置しない。
> 追加の防御として、NginxやApacheでドットファイルへの直接アクセスを拒否する設定も入れる。

### 実際のインシデント事例

- 2019〜2023年にかけ、Laravel製アプリの `.env` 公開により数百件以上の漏洩事案が報告
- 自動スキャンツールが `/robots.txt`・`/.env`・`/config.php` を毎分スキャンしている

---

## T6:「AWS CLIの第一歩 - 自分が誰かを知る」

| 項目 | 内容 |
|------|------|
| 難易度 | ★★☆☆☆ |
| スキル | AWS CLIインストール, aws configure, 基本コマンド |
| 解放条件 | T5 クリア |
| 配点 | 75pt + クイズ 10pt |
| 必要なツール | **AWS CLI** |

### このチャレンジで学ぶこと

> AWS CLIはコマンドラインからAWSのサービスを操作するツールです。
> アクセスキーを手に入れたら、まず「このキーは誰のもので何ができるか」を確認するのが基本です。
> このコマンドは **読み取り専用で権限がなくても必ず実行できる** という特性があります。

### シナリオ文

> T5で `.env` ファイルからAWSアクセスキーを発見した。
> このキーを使ってAWS CLIで調査を始めよう。まず「自分が誰か」を確認する。

### ウォークスルー

**Step 1: AWS CLIをインストールする**

```bash
# Mac (Homebrew)
brew install awscli

# 確認
aws --version
# aws-cli/2.x.x Python/3.x.x ...
```

公式ドキュメント: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

**Step 2: クレデンシャルを設定する**

```bash
aws configure
```

対話式で入力する：
```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE2
AWS Secret Access Key [None]: another-secret-key-here
Default region name [None]: ap-northeast-1
Default output format [None]: json
```

これで `~/.aws/credentials` にキーが保存される。

**Step 3: 自分のアイデンティティを確認する**

```bash
aws sts get-caller-identity
```

ローカル環境：
```bash
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 \
  aws --endpoint-url http://127.0.0.1:4566 sts get-caller-identity
```

結果：
```json
{
  "UserId": "AIDAIOSFODNN7EXAMPLE",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/svc-web-backend"
}
```

- `UserId`: IAMエンティティのID
- `Account`: AWSアカウントID（12桁）
- `Arn`: このクレデンシャルの完全な識別子

**Step 4: フラグを取得する**

```bash
aws iam list-user-tags --user-name svc-web-backend
```

ローカル環境：
```bash
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 \
  aws --endpoint-url http://127.0.0.1:4566 iam list-user-tags --user-name svc-web-backend
```

```json
{
  "Tags": [
    { "Key": "Team",  "Value": "Backend" },
    { "Key": "Flag",  "Value": "TVAULT:aws_cli_first_step_complete" },
    { "Key": "FlagFormat",  "Value": "replace-colon-with-braces" }
  ]
}
```

IAMタグ値では `{` `}` が使えないため、`Flag` タグの `TVAULT:aws_cli_first_step_complete` を標準のCTF形式に直して提出する。

### フラグ

`TVAULT{aws_cli_first_step_complete}`

### よく使うSTS/IAMコマンド（参考）

```bash
# 自分のアイデンティティを確認（権限不要）
aws sts get-caller-identity

# 自分のユーザー情報を確認
aws iam get-user

# アタッチされているポリシーを確認
aws iam list-attached-user-policies --user-name <username>

# ポリシーの中身を確認
aws iam get-policy --policy-arn <arn>
aws iam get-policy-version --policy-arn <arn> --version-id v1
```

### 理解確認クイズ（+10pt）

> Q: `aws sts get-caller-identity` は、付与されているIAM権限がほぼ何もなくても実行できます。なぜでしょうか？
>
> (A) `TVAULT_QUIZ{sts_is_special_service}` → STSはIAMの制限外の特別なサービスだから
> (B) `TVAULT_QUIZ{getcalleridentity_always_allowed}` → GetCallerIdentityは常に許可されているAWSの仕様だから
> (C) `TVAULT_QUIZ{iam_allow_all_by_default}` → IAMはデフォルトで全て許可しているから

**正解: (B)** `TVAULT_QUIZ{getcalleridentity_always_allowed}`

> AWSは `sts:GetCallerIdentity` を、IAMポリシーで明示的にDenyされていない限り
> 常に許可する仕様にしています。これはAWSのサポート体制上の設計です。
> 逆に言うと、攻撃者がキーを入手した際に必ず最初に実行するコマンドでもあります。

---

## 配点まとめ（チュートリアルライン）

| Stage | フラグ | 配点 | クイズ |
|-------|--------|------|--------|
| T1 | `TVAULT{robots_txt_is_public}` | 30pt | +10pt |
| T2 | `TVAULT{s3_public_access_is_dangerous}` | 30pt | +10pt |
| T3 | `TVAULT{hardcoded_secret_in_js}` | 30pt | +10pt |
| T4 | `TVAULT{curl_headers_revealed}` | 50pt | +10pt |
| T5 | `TVAULT{dotenv_exposed_on_web}` | 75pt | +10pt |
| T6 | `TVAULT{aws_cli_first_step_complete}` | 75pt | +10pt |
| クイズフラグ | `TVAULT_QUIZ{...}` | 各10pt | ─ |
| **合計** | | **290pt** | **+60pt** |

## クイズフラグ一覧

| クイズ | フラグ | 正答内容 |
|--------|--------|---------|
| T1クイズ | `TVAULT_QUIZ{disallow_is_just_a_hint}` | Disallowはアクセス制御ではない |
| T2クイズ | `TVAULT_QUIZ{s3_needs_only_url}` | パブリックS3はURLだけでアクセスできる |
| T3クイズ | `TVAULT_QUIZ{js_frontend_is_public}` | フロントエンドに秘密情報を置かない |
| T4クイズ | `TVAULT_QUIZ{server_version_helps_attack}` | バージョン情報は攻撃のヒントになる |
| T5クイズ | `TVAULT_QUIZ{env_outside_webroot}` | Webルート配下に .env を配置しない |
| T6クイズ | `TVAULT_QUIZ{getcalleridentity_always_allowed}` | GetCallerIdentityは常に許可 |

## CTFdでの実装方針

- メインフラグとクイズフラグは **別の問題** として登録する
- クイズ問題は「メインフラグを提出後に解放」するようにPrerequisiteを設定
- クイズの選択肢は問題文内に書き、該当する選択肢のフラグを提出する形式
- クイズ問題のタイトルには「[理解確認] T1: robots.txtの役割」などのプレフィックスをつける
