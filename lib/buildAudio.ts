/**
 * 1論文に対して読み上げ音声を生成し、public/audio に保存する。
 * fetch / summarize / backfill から共通利用する。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildNarrationScript, estimateDurationSec, synthesizeSpeechMp3 } from "@/lib/tts";
import type { Paper, PaperAudio } from "@/lib/types";

const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

function safeFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** 音声化に必要な最低限のフィールドが揃っているか */
export function isReadyForAudio(paper: Paper): boolean {
  if (!paper.catchTitle?.trim()) return false;
  if (!paper.takeaway?.whatIsIt?.trim()) return false;
  return true;
}

/**
 * 既存音声が有効かどうか。差し戻したい場合は呼び出し側で undefined を渡せば良い。
 */
export function isAudioFresh(audio: PaperAudio | undefined): boolean {
  if (!audio) return false;
  if (!audio.src) return false;
  return true;
}

export type BuildAudioResult = {
  audio: PaperAudio;
  bytes: number;
};

/**
 * 音声を生成して public/audio に保存し、Paper.audio に入れるべきメタ情報を返す。
 */
export async function buildAudioForPaper(
  paper: Paper,
  apiKey: string,
  opts: { voice?: string } = {}
): Promise<BuildAudioResult> {
  const script = buildNarrationScript({
    catchTitle: paper.catchTitle,
    hook: paper.hook,
    takeaway: paper.takeaway,
  });
  if (!script.trim()) {
    throw new Error(`No narration script for ${paper.id}`);
  }
  const mp3 = await synthesizeSpeechMp3(script, { apiKey, voice: opts.voice });

  await mkdir(AUDIO_DIR, { recursive: true });
  const fname = `${safeFileName(paper.id)}.mp3`;
  const abs = path.join(AUDIO_DIR, fname);
  await writeFile(abs, mp3);

  // 文字数からおおよその再生時間を推定（日本語: 約7文字/秒）
  const charCount = script.replace(/\s/g, "").length;
  const duration = Math.max(10, Math.round(charCount / 7));

  const audio: PaperAudio = {
    src: `/audio/${fname}`,
    format: "mp3",
    duration,
    voice: opts.voice ?? process.env.GEMINI_TTS_VOICE ?? "Kore",
    generatedAt: new Date().toISOString(),
  };
  // pcm 由来の正確な秒数（後で参考）も loosely 求めるなら別途調整
  void estimateDurationSec;
  return { audio, bytes: mp3.length };
}
