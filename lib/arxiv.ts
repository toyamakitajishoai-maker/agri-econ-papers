/** 取得元が異なっても共通で扱う論文レコード（OpenAlex / arXiv など） */
export type ArxivPaper = {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  publishedAt: string;
  url: string;
  pdfUrl: string;
  categories: string[];
  /** OpenAlex 等で得た DOI（Unpaywall 用、10.xxxx/...） */
  doi?: string;
  source?: "arxiv" | "openalex";
  /** 掲載誌名（arXiv の場合はプレプリント表記） */
  journal?: string;
  /** 収集時の分野ラベル */
  field?: string;
};

/** arXiv 公式の export エンドポイント（https 推奨） */
const ARXIV_API_URL = "https://export.arxiv.org/api/query";

/** 公式推奨: リクエスト間隔は最低3秒。連続呼び出しで429が出やすいため5秒以上空ける */
const MIN_ARXIV_GAP_MS = Number(process.env.ARXIV_MIN_GAP_MS ?? 5_000);
let lastArxivRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForArxivRateLimitSlot(): Promise<void> {
  const elapsed = Date.now() - lastArxivRequestAt;
  if (elapsed < MIN_ARXIV_GAP_MS) {
    await sleep(MIN_ARXIV_GAP_MS - elapsed);
  }
  lastArxivRequestAt = Date.now();
}

export type FetchArxivOptions = {
  /** true のとき 429 等で最終失敗しても空配列を返す（fetch 全体を止めない） */
  softFail?: boolean;
  maxAttempts?: number;
};

/** arXiv が 429 で返す Retry-After（秒数 or HTTP日付）をミリ秒に */
function parseRetryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, 600_000);
  }
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    return Math.min(600_000, Math.max(0, asDate - Date.now()));
  }
  return null;
}

function buildCategoryQuery(categories: string[]): string {
  return categories.map((category) => `cat:${category}`).join(" OR ");
}

function stripXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return match ? stripXml(match[1]) : "";
}

function extractAllTags(block: string, tagName: string): string[] {
  const matches = [...block.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "g"))];
  return matches.map((item) => stripXml(item[1])).filter(Boolean);
}

function parseEntry(entryXml: string): ArxivPaper | null {
  const idUrl = extractTag(entryXml, "id");
  const title = extractTag(entryXml, "title");
  const abstract = extractTag(entryXml, "summary");
  const publishedAt = extractTag(entryXml, "published");
  const authors = extractAllTags(entryXml, "name");
  const categories = [...entryXml.matchAll(/<category\s+term="([^"]+)"/g)].map((m) => m[1]);

  if (!idUrl || !title || !abstract) {
    return null;
  }

  const id = idUrl.split("/abs/")[1] ?? idUrl;
  const mainCategory = categories[0];
  const journal = mainCategory ? `arXiv（プレプリント / ${mainCategory}）` : "arXiv（プレプリント）";

  return {
    id,
    title,
    abstract,
    authors,
    publishedAt,
    url: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
    categories,
    journal,
  };
}

/**
 * `since` 以降〜`now` までに投稿された論文を取得（新しい順でAPIから取り、日付で絞る）
 */
export async function fetchArxivPapersSince(
  categories: string[],
  since: Date,
  maxResults = 100,
  now: Date = new Date(),
  options: FetchArxivOptions = {}
): Promise<ArxivPaper[]> {
  const query = buildCategoryQuery(categories);
  const url = new URL(ARXIV_API_URL);
  url.searchParams.set("search_query", query);
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(maxResults));

  await waitForArxivRateLimitSlot();

  const maxAttempts = options.maxAttempts ?? Number(process.env.ARXIV_MAX_ATTEMPTS ?? 4);
  let xml = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "agri-econ-papers/0.1 (mailto:research@local; respectful arXiv API use)",
      },
    });

    /** 429 に加え、混雑時の 502/503 も再試行 */
    const retryable = [429, 502, 503, 504, 408].includes(response.status);
    if (retryable) {
      const fromHeader = response.status === 429 ? parseRetryAfterMs(response) : null;
      const exponential = Math.min(45_000, 8_000 * 2 ** (attempt - 1));
      const waitMs = Math.min(90_000, Math.max(fromHeader ?? 0, exponential, 5_000));
      console.warn(
        `arXiv ${response.status}: ${Math.round(waitMs / 1000)}秒待ってから再試行 (${attempt}/${maxAttempts})`
      );
      if (attempt === maxAttempts) {
        const msg = `arXiv API error: ${response.status} after ${maxAttempts} attempts`;
        if (options.softFail) {
          console.warn(`${msg} — 今回の arXiv 取得はスキップします。`);
          return [];
        }
        throw new Error(msg);
      }
      await sleep(waitMs);
      lastArxivRequestAt = Date.now();
      continue;
    }

    if (!response.ok) {
      const msg = `arXiv API error: ${response.status} ${response.statusText}`;
      if (options.softFail) {
        console.warn(`${msg} — 今回の arXiv 取得はスキップします。`);
        return [];
      }
      throw new Error(msg);
    }

    xml = await response.text();
    break;
  }

  const entryBlocks = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);

  return entryBlocks
    .map(parseEntry)
    .filter((paper): paper is ArxivPaper => Boolean(paper))
    .filter((paper) => {
      if (!paper.publishedAt) return false;
      const publishedAt = new Date(paper.publishedAt);
      return publishedAt >= since && publishedAt <= now;
    });
}

/** 直近24時間（後方互換） */
export async function fetchArxivPapersLast24h(
  categories: string[],
  maxResults = 50
): Promise<ArxivPaper[]> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return fetchArxivPapersSince(categories, since, maxResults, now);
}
