"use client";

import { Headphones, Loader2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PaperAudio } from "@/lib/types";

type AudioPlayerProps = {
  audio: PaperAudio;
  /** プレイヤー横に表示するラベル（例: "60秒で聴く"） */
  label?: string;
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ audio, label }: AudioPlayerProps) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(audio.duration ?? 0);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onLoaded() {
      if (el && Number.isFinite(el.duration)) setDuration(el.duration);
      setLoading(false);
    }
    function onTime() {
      if (el) setCurrent(el.currentTime);
    }
    function onEnd() {
      setPlaying(false);
      setCurrent(0);
    }
    function onWaiting() {
      setLoading(true);
    }
    function onCanPlay() {
      setLoading(false);
    }
    function onError() {
      setErrored(true);
      setLoading(false);
      setPlaying(false);
    }
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("error", onError);
    };
  }, [audio.src]);

  async function toggle() {
    const el = ref.current;
    if (!el || errored) return;
    if (el.paused) {
      try {
        setLoading(true);
        await el.play();
        setPlaying(true);
        setLoading(false);
      } catch {
        setErrored(true);
        setLoading(false);
      }
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function onSeek(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !duration || errored) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  }

  if (errored) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-[#e8e4dc] bg-white/60 px-3 py-2 text-xs text-[#8a908a]">
        <Headphones className="h-3.5 w-3.5" strokeWidth={1.6} />
        音声を読み込めませんでした
      </div>
    );
  }

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const remain = Math.max(0, (duration || audio.duration || 0) - current);
  const displayLabel = label ?? `${audio.duration ?? 60}秒で聴く`;

  return (
    <div className="flex items-center gap-3 rounded-full border border-[#e8e4dc] bg-white/80 px-3 py-2 backdrop-blur">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "一時停止" : "再生"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#2f4a3a] text-white transition hover:bg-[#22382b] disabled:bg-[#6b726b]"
        disabled={loading && !playing}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : playing ? (
          <Pause className="h-4 w-4" strokeWidth={2.4} />
        ) : (
          <Play className="ml-0.5 h-4 w-4" strokeWidth={2.4} fill="currentColor" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#6b726b]">
          <span className="flex items-center gap-1.5">
            <Headphones className="h-3 w-3" strokeWidth={1.8} aria-hidden />
            {displayLabel}
          </span>
          <span className="tabular-nums text-[#8a908a]">
            {playing || current > 0 ? formatTime(current) : "-"} / {formatTime(duration || audio.duration || 0)}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          onClick={onSeek}
          className="group h-1.5 cursor-pointer overflow-hidden rounded-full bg-[#f0ede6]"
        >
          <div
            className="h-full rounded-full bg-[#9a8460] transition-[width] duration-150"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
      </div>
      <audio ref={ref} src={audio.src} preload="metadata" />
      <span className="sr-only" aria-live="polite">
        残り {formatTime(remain)}
      </span>
    </div>
  );
}
