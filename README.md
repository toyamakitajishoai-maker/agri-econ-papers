# 農業経済 論文ダイジェスト

農業経済分野の最新論文を毎朝自動取得し、AIで日本語要約して閲覧できるWebアプリです。  
無料枠を前提に、Next.js + GitHub Actions + Vercel で動く構成です。

## 1. プロジェクト概要

- 論文取得:
  - **OpenAlex**（主ソース・無料API、キー不要。メールアドレスを User-Agent に含める必要あり）
  - **Unpaywall**（DOI から合法的なオープンアクセスPDFのURLを解決。出版社サイトのスクレイピングはしない）
  - arXiv API（`econ.GN`, `econ.EM`, `q-fin.EC`・件数不足時の補完）
  - Semantic Scholar API（補助）
- 要約:
  - Google Gemini API（既定: `gemini-2.5-flash`）
- 保存先:
  - `data/YYYY-MM-DD.json`
  - `data/index.json`（過去30日の日付一覧）
- 配信:
  - GitHub Actions で毎朝7:00 JSTに自動更新（論文5件・要約・図表）
  - Vercelで自動デプロイ

## 2. ローカル実行手順

```bash
npm install
cp .env.example .env.local
```

`.env.local` に次を設定（**推奨**: OpenAlex / Unpaywall 用メールは実在するアドレス。Unpaywall の利用規約に沿うため）:

```bash
GEMINI_API_KEY=あなたのAPIキー
OPENALEX_MAILTO=あなたのメール@example.com
UNPAYWALL_EMAIL=あなたのメール@example.com
```

`OPENALEX_MAILTO` と `UNPAYWALL_EMAIL` は同じで構いません。未設定の場合は arXiv 中心の取得にフォールバックします。

開発サーバー起動:

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いて確認できます。

## 3. 手動実行コマンド（データ更新）

論文取得:

```bash
npm run fetch
```

AI要約:

```bash
npm run summarize
```

図表抽出（PDFから主要図1枚）:

```bash
npm run figures
```

## 4. Gemini APIキーの取得方法

1. [Google AI Studio](https://aistudio.google.com/app/apikey) を開く  
2. APIキーを作成  
3. ローカルでは `.env.local` に設定  
4. GitHub Actions用には GitHub Secrets に設定（次項）

## 5. GitHub Secrets 設定手順

1. GitHub リポジトリを開く  
2. `Settings` → `Secrets and variables` → `Actions`  
3. `New repository secret` をクリック  
4. 以下を登録
   - Name: `GEMINI_API_KEY` — 要約用
   - Name: `OPENALEX_MAILTO` — 取得用（実メール推奨。値は `mailto:` なしでメールアドレスのみ）
   - Name: `UNPAYWALL_EMAIL` — DOI→OA PDF 解決用（OpenAlex と同じメールで可）

`npm run fetch` は上記の Secrets を参照します（未設定なら OpenAlex スキップで arXiv 中心になります）。

## 6. Vercel デプロイ手順

1. GitHub にこのリポジトリを push  
2. [Vercel](https://vercel.com/) で `New Project` を作成  
3. リポジトリ `toyamakitajishoai-maker/agri-econ-papers` をインポート  
4. **Root Directory** は空欄のまま（リポジトリ直下がアプリ本体）  
5. Framework Preset は `Next.js` のまま → Deploy  

ビルドが失敗する場合:

- Vercel の **Settings → General → Node.js Version** を **20.x** にする  
- **Root Directory** に `agri-econ-papers` を入れない（親フォルダからインポートした場合のみ `agri-econ-papers` を指定）  
- Build Logs の赤いエラー文を確認する  

環境変数（サイト表示のみなら不要。ビルド時には `data/*.json` を使用）:

- 本番サイトは GitHub Actions が更新した `data/` を表示します  
- Vercel 上で API を動かす場合のみ `GEMINI_API_KEY` 等を設定  

6. 以後、`main` への更新で自動デプロイ

## 7. カスタマイズ方法

- OpenAlex の検索語・期間: `scripts/fetch-papers.ts` の `OPENALEX_SEARCH` と `OPENALEX_LOOKBACK_DAYS`
- 取得対象カテゴリの変更: `scripts/fetch-papers.ts` の `TARGET_CATEGORIES`
- 農業系キーワードの変更: `lib/filter.ts` の `AGRI_KEYWORDS`
- 取得件数の変更: `scripts/fetch-papers.ts` の `MAX_PAPERS`（既定5件。環境変数 `MAX_PAPERS` でも指定可）
- 要約フォーマットやプロンプトの変更: `lib/gemini.ts`

## 8. GitHub Actions の実行タイミング

- ファイル: `.github/workflows/daily-update.yml`
- 定期実行: `0 22 * * *`（UTC）= 毎朝 7:00 JST
- 処理内容: 論文取得 → 要約 → 図表抽出 → `data/` と `public/figures/` をコミット
- 手動実行: GitHub の Actions タブ → Daily Paper Update → Run workflow
