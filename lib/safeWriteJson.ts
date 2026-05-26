import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** 途中で止まっても JSON が空にならないよう、一時ファイル経由で保存する */
export async function writeJsonFileAtomic(filePath: string, data: unknown): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}`);
  await writeFile(tmpPath, body, "utf-8");
  await rename(tmpPath, filePath);
}
