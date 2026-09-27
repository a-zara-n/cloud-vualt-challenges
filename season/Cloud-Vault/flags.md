# フラグ一覧（管理用・全33問）

## チュートリアルライン

| Stage | フラグ | 配点 | 仕掛け場所 | 区分 |
|-------|--------|------|------------|------|
| T1 | `TVAULT{robots_txt_is_public}` | 30pt | robots.txtのコメント行 | チュートリアル |
| T1クイズ | `TVAULT_QUIZ{disallow_is_just_a_hint}` | 10pt | クイズの正答選択肢 | クイズ |
| T2 | `TVAULT{s3_public_access_is_dangerous}` | 30pt | 公開S3バケット内のflag.txt | チュートリアル |
| T2クイズ | `TVAULT_QUIZ{s3_needs_only_url}` | 10pt | クイズの正答選択肢 | クイズ |
| T3 | `TVAULT{hardcoded_secret_in_js}` | 30pt | HTMLソースのコメント行 | チュートリアル |
| T3クイズ | `TVAULT_QUIZ{js_frontend_is_public}` | 10pt | クイズの正答選択肢 | クイズ |
| T4 | `TVAULT{curl_headers_revealed}` | 50pt | HTTPレスポンスの X-Internal-Flag ヘッダー | チュートリアル |
| T4クイズ | `TVAULT_QUIZ{server_version_helps_attack}` | 10pt | クイズの正答選択肢 | クイズ |
| T5 | `TVAULT{dotenv_exposed_on_web}` | 75pt | /.env ファイルのFLAG行 | チュートリアル |
| T5クイズ | `TVAULT_QUIZ{env_outside_webroot}` | 10pt | クイズの正答選択肢 | クイズ |
| T6 | `TVAULT{aws_cli_first_step_complete}` | 75pt | IAMユーザーのタグ | チュートリアル |
| T6クイズ | `TVAULT_QUIZ{getcalleridentity_always_allowed}` | 10pt | クイズの正答選択肢 | クイズ |

## メイン・追加問題

| Stage | フラグ | 配点 | 仕掛け場所 | 区分 |
|-------|--------|------|------------|------|
| Stage 0  | `TVAULT{dev_mode_is_dangerous}` | 50pt | APIレスポンスJSONの `debug` フィールド | メイン |
| Stage 1A | `TVAULT{s3_prefix_is_not_security}` | 100pt | S3 `.hidden/flag.txt` | メイン |
| Stage 1B | `TVAULT{iam_user_recon_complete}` | 100pt | IAMポリシーの `Description` | メイン |
| Stage 1C | `TVAULT{git_history_never_forgets}` | 100pt | GitHubリポジトリの削除済みコミット内 `.env` | メイン拡張 |
| Stage 1D | `TVAULT{prompt_injection_ai_is_not_magic}` | 150pt | ポータルAIチャットのシステムプロンプト（Prompt Injection） | メイン拡張 |
| Stage 2A | `TVAULT{versioning_never_truly_deletes}` | 200pt | 削除済みS3オブジェクト（バージョン指定で取得） | メイン |
| Stage 2B | `TVAULT{assume_role_is_lateral_movement}` | 200pt | IAMロールの `Description` | メイン |
| Stage 2C | `TVAULT{ec2_tags_are_not_secrets}` | 150pt | EC2インスタンスのタグ | ボーナス |
| Stage 2D | `TVAULT{lambda_env_is_not_a_vault}` | 200pt | Lambda関数の環境変数 | メイン拡張 |
| Stage 2E | `TVAULT{ssm_secure_string_exposed}` | 200pt | SSM SecureStringの値 | メイン拡張 |
| Stage 2F | `TVAULT{AKIA2F7QZ6XRMVDEPLYA}` | 150pt | feature/old-authブランチのコメントアウト行 | ボーナス |
| Stage 2G | `TVAULT{bedrock_agent_overprivileged}` | 200pt | Bedrock Agentがツール経由で返す機密ファイル内容 | メイン拡張 |
| Stage 3A | `TVAULT{secrets_manager_exposed}` | 300pt | Secrets Manager のシークレット値 | メイン |
| Stage 3B | `TVAULT{imdsv1_ssrf_is_classic}` | 400pt | IMDSv1レスポンス（SSRF経由） | ボーナス |
| Stage 3C | `TVAULT{cognito_custom_attribute_abuse}` | 350pt | 管理者用APIエンドポイントのレスポンス | 上級 |
| Stage 3D | `TVAULT{docker_layer_never_lies}` | 500pt | ECRイメージの削除済みレイヤー内ファイル | ボーナス |
| Stage 3E | `TVAULT{s3_vectors_cross_tenant_leak}` | 350pt | S3 Vectors metadata から他社Vaultデータを取得 | 上級 |
| Stage 4  | `TVAULT{20260202_091255_091852}` | 300pt | 最初の ListBuckets と DataAnalystRole AssumeRole のUTC時刻 | Blue Team |
| Stage 5  | `TVAULT{all_roads_lead_to_cloudtrail}` | 600pt | 隠しS3バケット `cto-evidence/final_complicity.txt` をCTOバックアップキーで復号 | グランドフィナーレ |
| Stage 5B | `TVAULT{combined_attack_surface}` | 200pt | 内部管理API（3D+3E両方クリアで解放） | ボーナス |
| Final    | `TVAULT{cloud_security_matters_always}` | 500pt | 復号後の `evidence/final_flag.txt` | メイン |

## 合計配点

| 区分 | 問題数 | 配点 |
|------|--------|------|
| チュートリアル (T1〜T6) | 6問 | 290pt |
| チュートリアル クイズ | 6問 | 60pt |
| メインルート (0→1A→1B→1C→1D→2A→2B→2D→2E→2G→3A→Final) | 12問 | 2,300pt |
| ボーナス (2C→3B, 2F, 3D, 5B) | 5問 | 1,400pt |
| 上級ルート (3C, 3E) | 2問 | 700pt |
| Blue Team (Stage 4) | 1問 | 300pt |
| グランドフィナーレ (Stage 5) | 1問 | 600pt |
| **総合計** | **33問** | **5,650pt** |

## フラグフォーマット

```
TVAULT{英数字とアンダースコアのみ}
```

## CTFd設定メモ

- フラグの大文字小文字: case-insensitive（大文字・小文字を区別しない）に設定推奨
- フラグの波括弧内は英小文字のみに統一
