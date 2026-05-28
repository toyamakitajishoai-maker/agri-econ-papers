/**
 * クイズ回答状態のLocalStorage管理。
 * SSR では何もしない。ブラウザ専用ロジック。
 *
 * 設計:
 * - キー: `quiz-stats-v1`
 * - ストリーク定義: その日にクイズを「回答完了」したら +1 日（正解不問）
 * - 同じ paperId への複数回答は1回として数える
 */

export type QuizAnswer = {
  /** ユーザーが選んだ index */
  picked: number;
  /** その時の正解 index（変更検知用） */
  correctIndex: number;
  /** 回答日（YYYY-MM-DD, JST） */
  date: string;
  /** 任意: 論文の分野（後の分野別ダッシュボード用） */
  field?: string;
  /** 任意: 難易度 */
  difficulty?: string;
};

export type ReadRecord = {
  /** 読破日（YYYY-MM-DD, JST） */
  date: string;
  /** 任意: 分野ラベル */
  field?: string;
};

export type QuizStats = {
  version: 1;
  /** paperId -> 最新回答 */
  answers: Record<string, QuizAnswer>;
  /** 日別の集計 */
  byDate: Record<string, { total: number; correct: number }>;
  /** 分野別の集計（将来用） */
  byField: Record<string, { total: number; correct: number }>;
  /** ストリーク状態 */
  streak: { current: number; longest: number; lastDate: string | null };
  /** 読破した論文（paperId -> 記録） */
  readPapers?: Record<string, ReadRecord>;
  /** 分野別の読破数 */
  readByField?: Record<string, number>;
};

const KEY = "quiz-stats-v1";

const emptyStats = (): QuizStats => ({
  version: 1,
  answers: {},
  byDate: {},
  byField: {},
  streak: { current: 0, longest: 0, lastDate: null },
  readPapers: {},
  readByField: {},
});

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** JSTでのYYYY-MM-DD */
export function todayJst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 日付差（src→dest）の日数。JST基準で日付単位の差 */
function daysBetween(src: string, dest: string): number {
  const a = new Date(`${src}T00:00:00+09:00`).getTime();
  const b = new Date(`${dest}T00:00:00+09:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function readStats(): QuizStats {
  if (!isBrowser()) return emptyStats();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<QuizStats> & { version?: number };
    if (parsed?.version !== 1) return emptyStats();
    return {
      version: 1,
      answers: parsed.answers ?? {},
      byDate: parsed.byDate ?? {},
      byField: parsed.byField ?? {},
      streak: parsed.streak ?? { current: 0, longest: 0, lastDate: null },
      readPapers: parsed.readPapers ?? {},
      readByField: parsed.readByField ?? {},
    };
  } catch {
    return emptyStats();
  }
}

function writeStats(stats: QuizStats): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stats));
    /** 同タブ内の他コンポーネントへ通知（StreakBadge等） */
    window.dispatchEvent(new CustomEvent("quiz-stats:updated"));
  } catch {
    /* quota/PrivateBrowsing は黙殺 */
  }
}

/** 回答記録 + ストリーク更新を一括処理 */
export function recordAnswer(input: {
  paperId: string;
  picked: number;
  correctIndex: number;
  field?: string;
  difficulty?: string;
}): QuizStats {
  const stats = readStats();
  const today = todayJst();
  const already = stats.answers[input.paperId];
  const correct = input.picked === input.correctIndex;

  stats.answers[input.paperId] = {
    picked: input.picked,
    correctIndex: input.correctIndex,
    date: today,
    field: input.field,
    difficulty: input.difficulty,
  };

  /** 同じ論文に再回答した場合はカウントを増やさない */
  if (!already) {
    const dateBucket = stats.byDate[today] ?? { total: 0, correct: 0 };
    dateBucket.total += 1;
    if (correct) dateBucket.correct += 1;
    stats.byDate[today] = dateBucket;

    if (input.field) {
      const fieldBucket = stats.byField[input.field] ?? { total: 0, correct: 0 };
      fieldBucket.total += 1;
      if (correct) fieldBucket.correct += 1;
      stats.byField[input.field] = fieldBucket;
    }

    /** ストリーク: 今日が初回なら更新。同日2回目以降は不変 */
    const last = stats.streak.lastDate;
    if (last !== today) {
      const gap = last ? daysBetween(last, today) : null;
      if (gap === 1) {
        stats.streak.current += 1;
      } else {
        stats.streak.current = 1;
      }
      stats.streak.lastDate = today;
      if (stats.streak.current > stats.streak.longest) {
        stats.streak.longest = stats.streak.current;
      }
    }
  }

  writeStats(stats);
  return stats;
}

/** 表示用: 今日まで連続でなければ 0 を返す（昨日までで切れていた場合） */
export function currentStreak(stats: QuizStats, today: string = todayJst()): number {
  if (!stats.streak.lastDate) return 0;
  const gap = daysBetween(stats.streak.lastDate, today);
  if (gap <= 0) return stats.streak.current;
  if (gap === 1) return stats.streak.current;
  return 0;
}

export function hasAnswered(paperId: string): boolean {
  if (!isBrowser()) return false;
  const stats = readStats();
  return Boolean(stats.answers[paperId]);
}

/** 読破フラグの toggle（true で読破登録、false で取り消し） */
export function setRead(input: { paperId: string; field?: string; read: boolean }): QuizStats {
  const stats = readStats();
  const map = stats.readPapers ?? {};
  const fieldMap = stats.readByField ?? {};
  const already = Boolean(map[input.paperId]);

  if (input.read && !already) {
    map[input.paperId] = { date: todayJst(), field: input.field };
    if (input.field) fieldMap[input.field] = (fieldMap[input.field] ?? 0) + 1;
  } else if (!input.read && already) {
    const prev = map[input.paperId];
    delete map[input.paperId];
    if (prev?.field && fieldMap[prev.field]) {
      fieldMap[prev.field] = Math.max(0, fieldMap[prev.field] - 1);
      if (fieldMap[prev.field] === 0) delete fieldMap[prev.field];
    }
  }
  stats.readPapers = map;
  stats.readByField = fieldMap;
  writeStats(stats);
  return stats;
}

export function hasRead(paperId: string): boolean {
  if (!isBrowser()) return false;
  return Boolean(readStats().readPapers?.[paperId]);
}

/** 集計用ユーティリティ */
export function totalRead(stats: QuizStats): number {
  return Object.keys(stats.readPapers ?? {}).length;
}

export function totalAnswered(stats: QuizStats): number {
  return Object.keys(stats.answers).length;
}

export function totalCorrect(stats: QuizStats): number {
  return Object.values(stats.byDate).reduce((sum, v) => sum + v.correct, 0);
}

export function fieldsRead(stats: QuizStats): string[] {
  return Object.keys(stats.readByField ?? {}).filter(
    (f) => (stats.readByField?.[f] ?? 0) > 0
  );
}
