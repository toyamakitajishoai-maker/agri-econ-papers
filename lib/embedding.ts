/**
 * Gemini Embedding ラッパー。
 * gemini-embedding-001 は最大 3072 次元、outputDimensionality で削減可能。
 * 関連論文計算では 768 次元で十分（精度/サイズのバランス）。
 */

const MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const DIM = Number(process.env.GEMINI_EMBED_DIM ?? 768);

export type EmbedOptions = {
  apiKey: string;
  /** RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY / SEMANTIC_SIMILARITY 等 */
  taskType?: string;
  retries?: number;
  outputDimensionality?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 1 件の埋め込み */
export async function embedText(text: string, opts: EmbedOptions): Promise<number[]> {
  const { apiKey, taskType = "SEMANTIC_SIMILARITY", retries = 2, outputDimensionality = DIM } = opts;
  if (!apiKey) throw new Error("GEMINI_API_KEY required");
  if (!text.trim()) throw new Error("embed input is empty");

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await callEmbed(text, apiKey, taskType, outputDimensionality);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error("embed failed");
}

async function callEmbed(
  text: string,
  apiKey: string,
  taskType: string,
  dim: number
): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${apiKey}`;
  const body = {
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: dim,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Embed HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data: unknown = await res.json();
  const values = extractValues(data);
  if (!values) throw new Error("Embed response had no values");
  return values;
}

function extractValues(data: unknown): number[] | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const embed = obj.embedding as Record<string, unknown> | undefined;
  const values = embed?.values;
  if (Array.isArray(values) && typeof values[0] === "number") {
    return values as number[];
  }
  return null;
}

/** ベクトルを L2 正規化（コサイン類似度を内積で計算できるようにする） */
export function normalize(v: number[]): number[] {
  let sq = 0;
  for (const x of v) sq += x * x;
  const norm = Math.sqrt(sq);
  if (norm === 0) return v.slice();
  return v.map((x) => x / norm);
}

/** L2 正規化済みベクトル同士なら内積がコサイン類似度に等しい */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) sum += a[i] * b[i];
  return sum;
}
