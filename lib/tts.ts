/**
 * Gemini TTS ラッパー。L16 24kHz mono PCM を取得し、WAV / MP3 で返す。
 * 参考: https://ai.google.dev/gemini-api/docs/speech-generation
 */
/** lamejs は ESM。CJS プロジェクトから読むために動的 import を使う */
type Mp3EncoderCtor = new (
  channels: number,
  sampleRate: number,
  kbps: number
) => {
  encodeBuffer: (left: Int16Array, right?: Int16Array) => Uint8Array;
  flush: () => Uint8Array;
};

let _mp3EncoderPromise: Promise<Mp3EncoderCtor> | null = null;

async function getMp3Encoder(): Promise<Mp3EncoderCtor> {
  if (!_mp3EncoderPromise) {
    _mp3EncoderPromise = import("@breezystack/lamejs").then((mod) => {
      const ctor = (mod as { Mp3Encoder?: Mp3EncoderCtor }).Mp3Encoder
        ?? (mod as { default?: { Mp3Encoder?: Mp3EncoderCtor } }).default?.Mp3Encoder;
      if (!ctor) throw new Error("Mp3Encoder not found in @breezystack/lamejs");
      return ctor;
    });
  }
  return _mp3EncoderPromise;
}

const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE = process.env.GEMINI_TTS_VOICE ?? "Kore";
/** 24kHz mono が Gemini TTS の固定仕様 */
const SAMPLE_RATE = 24000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
/** ナレーション音声向けは 48kbps モノラルで十分（自然な日本語が保てる） */
const MP3_KBPS = Number(process.env.TTS_MP3_KBPS ?? 48);

export type SynthesisOptions = {
  apiKey: string;
  voice?: string;
  /** リトライ回数 */
  retries?: number;
};

/** 内部: 生 PCM バッファ取得（リトライ込み） */
async function fetchPcm(text: string, opts: SynthesisOptions): Promise<Buffer> {
  const { apiKey, voice = DEFAULT_VOICE, retries = 2 } = opts;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for TTS");
  if (!text.trim()) throw new Error("TTS input text is empty");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await callGeminiTts(text, apiKey, voice);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) {
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  throw lastError ?? new Error("TTS failed");
}

/**
 * テキストを音声化し、WAV バイト列を返す。
 */
export async function synthesizeSpeechWav(
  text: string,
  opts: SynthesisOptions
): Promise<Buffer> {
  const pcm = await fetchPcm(text, opts);
  return pcmToWav(pcm, SAMPLE_RATE, NUM_CHANNELS, BITS_PER_SAMPLE);
}

/**
 * テキストを音声化し、MP3 バイト列を返す（WAV の約 1/10 サイズ）。
 */
export async function synthesizeSpeechMp3(
  text: string,
  opts: SynthesisOptions
): Promise<Buffer> {
  const pcm = await fetchPcm(text, opts);
  return pcmToMp3(pcm);
}

async function callGeminiTts(text: string, apiKey: string, voice: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini TTS HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data: unknown = await res.json();
  const b64 = extractAudioBase64(data);
  if (!b64) {
    throw new Error("Gemini TTS response had no audio data");
  }
  return Buffer.from(b64, "base64");
}

function extractAudioBase64(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const candidates = obj.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0] as Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as unknown[] | undefined;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const p = part as Record<string, unknown>;
    const inline = p.inlineData as Record<string, unknown> | undefined;
    const d = inline?.data;
    if (typeof d === "string") return d;
  }
  return null;
}

/** Linear PCM (signed 16-bit LE) を WAV ヘッダー付きに変換 */
export function pcmToWav(
  pcm: Buffer,
  sampleRate = SAMPLE_RATE,
  numChannels = NUM_CHANNELS,
  bitsPerSample = BITS_PER_SAMPLE
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

/** PCM のバイト長から再生秒数を算出 */
export function estimateDurationSec(pcmBytes: number): number {
  const byteRate = (SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
  return pcmBytes / byteRate;
}

/** Linear PCM (signed 16-bit LE) を MP3 に変換 */
export async function pcmToMp3(pcm: Buffer): Promise<Buffer> {
  const Encoder = await getMp3Encoder();
  const samples = new Int16Array(
    pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length)
  );
  const encoder = new Encoder(NUM_CHANNELS, SAMPLE_RATE, MP3_KBPS);
  const blockSize = 1152;
  const chunks: Buffer[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const sub = samples.subarray(i, i + blockSize);
    const enc = encoder.encodeBuffer(sub);
    if (enc.length > 0) chunks.push(Buffer.from(enc));
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(Buffer.from(flushed));
  return Buffer.concat(chunks);
}

/**
 * 読み上げ用に渡す原稿を組み立てる。
 * - キャッチタイトル → 1拍空けて Hook → 1拍空けて Takeaway 3行
 * - 句点/読点に間が入るよう自然な日本語を意識した整形
 */
export function buildNarrationScript(input: {
  catchTitle?: string;
  hook?: string;
  takeaway?: { whatIsIt: string; whatFound: string; soWhat: string };
}): string {
  const parts: string[] = [];
  if (input.catchTitle?.trim()) {
    parts.push(input.catchTitle.trim());
  }
  if (input.hook?.trim()) {
    parts.push(input.hook.trim());
  }
  if (input.takeaway) {
    const { whatIsIt, whatFound, soWhat } = input.takeaway;
    if (whatIsIt?.trim()) parts.push(whatIsIt.trim());
    if (whatFound?.trim()) parts.push(whatFound.trim());
    if (soWhat?.trim()) parts.push(soWhat.trim());
  }
  return parts.join("\n\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
