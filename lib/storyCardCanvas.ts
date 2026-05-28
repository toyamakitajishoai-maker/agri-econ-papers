import { STORY_BRAND, type StorySlideMeta } from "@/lib/storyCardTheme";

/** Instagram ストーリーズ / Reels 縦型 */
export const STORY_EXPORT_WIDTH = 1080;
export const STORY_EXPORT_HEIGHT = 1920;

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawStoryCardToCanvas(options: {
  slide: StorySlideMeta;
  catchTitle: string;
  body: string;
  sharePath: string;
}): HTMLCanvasElement {
  const { slide, catchTitle, body, sharePath } = options;
  const w = STORY_EXPORT_WIDTH;
  const h = STORY_EXPORT_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const pad = 72;

  // 背景グラデーション
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#fffdf8");
  bg.addColorStop(0.45, "#faf8f5");
  bg.addColorStop(1, slide.accentMuted);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 上部アクセントバー
  ctx.fillStyle = slide.accent;
  ctx.fillRect(0, 0, w, 12);

  // 大きなステップ番号（透かし）
  ctx.fillStyle = slide.accentMuted;
  ctx.globalAlpha = 0.55;
  ctx.font = "800 280px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(String(slide.index + 1).padStart(2, "0"), w - 48, 340);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  // ブランド
  ctx.fillStyle = "#9a8460";
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(STORY_BRAND, pad, 108);

  // 枚数・英字ラベル
  ctx.fillStyle = "#8a908a";
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${slide.index + 1} / 4`, w - pad, 108);
  ctx.fillStyle = slide.accent;
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillText(slide.labelEn, w - pad, 148);
  ctx.textAlign = "left";

  // タイトル（2行まで）
  ctx.fillStyle = "#1a1f1c";
  ctx.font = "600 40px 'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif";
  const titleLines = wrapCanvasLines(ctx, catchTitle, w - pad * 2);
  let y = 220;
  for (const tl of titleLines.slice(0, 2)) {
    ctx.fillText(tl, pad, y);
    y += 52;
  }

  // ラベルチップ + アイコン
  y += 28;
  const chipLabel = `${slide.icon}  ${slide.label}`;
  ctx.font = "700 32px system-ui, sans-serif";
  const chipW = ctx.measureText(chipLabel).width + 56;
  ctx.fillStyle = slide.chipBg;
  roundRect(ctx, pad, y, chipW, 64, 32);
  ctx.fill();
  ctx.fillStyle = slide.chipText;
  ctx.fillText(chipLabel, pad + 28, y + 44);

  // 本文
  y += 120;
  ctx.fillStyle = "#1a1f1c";
  ctx.font = "500 46px system-ui, -apple-system, 'Hiragino Sans', sans-serif";
  const bodyLines = wrapCanvasLines(ctx, body, w - pad * 2);
  for (const bl of bodyLines.slice(0, 12)) {
    ctx.fillText(bl, pad, y);
    y += 64;
  }

  // フッター帯
  const footerY = h - 200;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, pad, footerY, w - pad * 2, 128, 24);
  ctx.fill();
  ctx.strokeStyle = "#e8e4dc";
  ctx.lineWidth = 2;
  roundRect(ctx, pad, footerY, w - pad * 2, 128, 24);
  ctx.stroke();

  ctx.fillStyle = "#6b726b";
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillText("画像を保存して、ストーリーズやXに投稿できます", pad + 32, footerY + 48);
  ctx.fillStyle = slide.accent;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(sharePath, pad + 32, footerY + 92);

  // ドットインジケーター
  const dotY = h - 56;
  const dotStart = w / 2 - (4 * 20) / 2;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = i === slide.index ? slide.accent : "#d8d2c4";
    ctx.arc(dotStart + i * 20 + 6, dotY, i === slide.index ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export async function downloadStoryCanvas(
  canvas: HTMLCanvasElement,
  filename: string
): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 0.94)
  );
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
