/**
 * 動的 OG 画像エンドポイント。
 * URL: /api/og?id=<paperId>
 * サイズ: 1200x630（X / LINE / はてブ標準）
 * スマホタイムラインでも読めるよう、大見出し中心の構図。
 */
import { ImageResponse } from "next/og";

import { getPaperById } from "@/lib/data";
import { buildEditorialView } from "@/lib/editorial";

export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

/** 1行が長い時に切り詰めるユーティリティ */
function clip(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function FallbackImage({ message }: { message: string }) {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        background: "#faf8f5",
        color: "#1a1f1c",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
      }}
    >
      <div style={{ fontSize: 28, color: "#9a8460", letterSpacing: 4 }}>今日の研究、3分で。</div>
      <div style={{ marginTop: 24, fontSize: 40 }}>{message}</div>
    </div>
  );
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  /** クエリなし: サイトロゴ的なデフォルト画像 */
  if (!id) {
    return new ImageResponse(<FallbackImage message="論文ではなく、発見を読む。" />, {
      width: WIDTH,
      height: HEIGHT,
    });
  }

  const paper = await getPaperById(id);
  if (!paper) {
    return new ImageResponse(<FallbackImage message="論文が見つかりませんでした。" />, {
      width: WIDTH,
      height: HEIGHT,
    });
  }

  const view = buildEditorialView(paper);
  const headline = clip(view.catchTitle, 60);
  const hook = clip(view.hook, 90);
  /** 大分類タグ（field）と中分類1つを左下に */
  const tagText = view.tags.slice(0, 2).join("　・　");

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          background: "#faf8f5",
          color: "#1a1f1c",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
        }}
      >
        {/* ヘッダ: サイトロゴ風 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 12,
                background: "#2f4a3a",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: 1 }}>今日の研究</span>
              <span style={{ fontSize: 14, color: "#8a908a", letterSpacing: 4 }}>3 MIN READ</span>
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#9a8460",
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Discoveries, in 3 minutes
          </div>
        </div>

        {/* 中央: キャッチタイトル */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 24,
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: headline.length > 28 ? 56 : 68,
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: -0.5,
              color: "#1a1f1c",
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.6,
              color: "#4a524a",
            }}
          >
            {hook}
          </div>
        </div>

        {/* 下: タグと細い区切り線 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #e0dcd2",
            paddingTop: 24,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: "#9a8460",
              letterSpacing: 2,
            }}
          >
            {tagText || "今日の研究"}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#8a908a",
              letterSpacing: 2,
            }}
          >
            論文ではなく、発見を読む。
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}
