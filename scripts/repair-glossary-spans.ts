/**
 * data/*.json の bodyText と glossarySpans / bodyGlossary の位置ずれを修復
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { spansFromGlossaryTerms } from "@/lib/glossarySpans";
import { validateBodyGlossary } from "@/lib/paperV2Validate";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

async function main() {
  const files = (await readdir(DATA_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  let totalFixed = 0;

  for (const file of files.sort()) {
    const filePath = path.join(DATA_DIR, file);
    const parsed = JSON.parse(await readFile(filePath, "utf-8")) as {
      date: string;
      papers: Paper[];
    };
    let changed = 0;

    for (const paper of parsed.papers ?? []) {
      const body = paper.bodyText?.trim();
      if (!body) continue;

      const raw = paper.bodyGlossary ?? paper.glossarySpans;
      const { valid, invalid } = validateBodyGlossary(body, raw);
      if (invalid === 0 && valid.length > 0) continue;

      const glossary = paper.glossary ?? [];
      const repaired =
        glossary.length > 0
          ? spansFromGlossaryTerms(body, glossary).map((s) => ({
              term: s.term,
              definition: s.definition,
              start: s.start,
              end: s.end,
              reading: s.reading,
            }))
          : valid;

      if (repaired.length === 0) continue;

      paper.bodyGlossary = repaired;
      paper.glossarySpans = repaired;
      changed += 1;
    }

    if (changed > 0) {
      await writeJsonFileAtomic(filePath, parsed);
      console.log(`${file}: ${changed} 件の用語位置を修復`);
      totalFixed += changed;
    }
  }

  console.log(totalFixed > 0 ? `\n合計 ${totalFixed} 件を修復しました。` : "修復が必要なデータはありませんでした。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
