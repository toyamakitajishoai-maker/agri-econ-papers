import ActionFlowDiagram from "@/components/ActionFlowDiagram";
import ApproachComparisonTable from "@/components/ApproachComparisonTable";
import ArticleFigureV2Block from "@/components/ArticleFigureV2Block";
import AudioPlayer from "@/components/AudioPlayer";
import GlossaryList from "@/components/GlossaryList";
import GlossaryText from "@/components/GlossaryText";
import KeyFigureBlock from "@/components/KeyFigureBlock";
import PredictionQuiz from "@/components/PredictionQuiz";
import QuizGate from "@/components/QuizGate";
import QuizSkipBar from "@/components/QuizSkipBar";
import ReadButton from "@/components/ReadButton";
import ReadingMeta from "@/components/ReadingMeta";
import RelatedPapers from "@/components/RelatedPapers";
import ResultsHighlightBlock from "@/components/ResultsHighlightBlock";
import ShareButtons from "@/components/ShareButtons";
import SourceLinks from "@/components/SourceLinks";
import StickyReadCta from "@/components/StickyReadCta";
import StudyLimitations from "@/components/StudyLimitations";
import SummaryBlock from "@/components/SummaryBlock";
import TakeawayCard from "@/components/TakeawayCard";
import { getArticleBodyText, resolveBodyGlossarySpans } from "@/lib/articleV2";
import { categoryL2Label, resolvePaperSlot, SLOT_LABELS } from "@/lib/classifyPaper";
import { buildEditorialView } from "@/lib/editorial";
import { estimateReadingTimeSecV2, formatReadingMinutes } from "@/lib/readingTime";
import { getSiteUrl } from "@/lib/siteUrl";
import type { Paper } from "@/lib/types";

type PaperArticleV2Props = {
  paper: Paper;
  date: string;
  siblings: Paper[];
};

export default function PaperArticleV2({ paper, date, siblings }: PaperArticleV2Props) {
  const view = buildEditorialView(paper);
  const { sections } = view;
  const glossary = paper.glossary ?? [];
  const articleUrl = `${getSiteUrl()}/papers/${encodeURIComponent(paper.id)}`;
  const threeLineSummary = paper.threeLineSummary ?? view.threeLineSummary;

  const slot = resolvePaperSlot(paper);
  const slotLabel = SLOT_LABELS[slot.categoryL1].label;
  const l2Label = categoryL2Label(slot.categoryL2);
  const readingSec = paper.readingTimeSec ?? estimateReadingTimeSecV2(paper);
  const readMinutes = formatReadingMinutes(readingSec);

  const oneLiner = paper.oneLiner?.trim() || view.hook;
  const novelty = paper.noveltyContrast ?? {
    before: sections.novelty || "従来のやり方には限界がありました。",
    after: paper.summary.novelty || sections.results,
  };
  const analogy = paper.analogy;
  const kpi = paper.kpi ?? [];
  const whyYouCare = paper.whyYouCare?.trim() || paper.background?.trim() || sections.gist;
  const takeawayTalk =
    paper.takeawayTalk?.trim() || paper.takeaway?.soWhat || view.hook;

  const articleBody = getArticleBodyText(paper);
  const articleBodySpans = resolveBodyGlossarySpans(paper, articleBody);
  const showPlainArticle =
    Boolean(articleBody) &&
    articleBody !== "要約準備中" &&
    !articleBody.startsWith("要約生成に失敗");
  const showHookLead = Boolean(paper.hookLead?.trim());

  const allFigures = paper.keyFigures ?? [];
  const resultsFigure =
    allFigures.find((f) => f.purpose === "results") ?? paper.keyFigure ?? null;
  const hasLimitations =
    Boolean(paper.limitationsBullets?.length) || Boolean(paper.limitations?.trim());
  const hasQuiz = Boolean(paper.quiz);

  const metaTags = [
    slotLabel,
    ...(l2Label ? [l2Label] : []),
    `約${readMinutes}分`,
  ];

  const articleContent = (
    <div className="space-y-10 sm:space-y-12">
      <SummaryBlock title="まずここだけ" variant="lead">
        <ul className="space-y-3">
          {threeLineSummary.map((line, i) => (
            <li key={`sum-${i}`}>
              <GlossaryText text={line} glossary={glossary} />
            </li>
          ))}
        </ul>
      </SummaryBlock>

      {showHookLead ? (
        <SummaryBlock title="リード">
          <p>
            <GlossaryText text={paper.hookLead!} glossary={glossary} />
          </p>
        </SummaryBlock>
      ) : null}

      <section className="scroll-mt-24">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8a908a]">
          何が新しいか
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e8e4dc] bg-[#faf8f5] px-4 py-4">
            <p className="text-xs font-semibold text-[#8a908a]">これまで</p>
            <p className="mt-2 text-sm leading-[1.85] text-[#4a524a]">{novelty.before}</p>
          </div>
          <div className="rounded-2xl border border-[#d8d2c4] bg-white px-4 py-4">
            <p className="text-xs font-semibold text-[#2f4a3a]">この論文</p>
            <p className="mt-2 text-sm leading-[1.85] text-[#1a1f1c]">{novelty.after}</p>
          </div>
        </div>
      </section>

      <SummaryBlock title="たとえると">
        {analogy?.body?.trim() && (analogy.body?.length ?? 0) >= 50 ? (
          <>
            {analogy.title?.trim() ? (
              <p className="mb-3 font-serif text-base font-semibold text-[#1a1f1c]">
                {analogy.title}
              </p>
            ) : null}
            <p>{analogy.body}</p>
          </>
        ) : (
          <p className="text-sm text-[#8a908a]">
            比喩は自動生成の対象です。しばらくしてからページを更新するか、管理者が再生成を実行します。
          </p>
        )}
      </SummaryBlock>

      {showPlainArticle ? (
        <SummaryBlock title="記事要約（わかりやすく）">
          <GlossaryText text={articleBody} glossary={glossary} spans={articleBodySpans} />
        </SummaryBlock>
      ) : null}

      {paper.resultsHighlight ? (
        <SummaryBlock title={paper.resultsTitle ?? "わかったこと"}>
          <ResultsHighlightBlock data={paper.resultsHighlight} glossary={glossary} />
        </SummaryBlock>
      ) : null}

      {paper.approachComparison && paper.approachComparison.length > 0 ? (
        <SummaryBlock title="既存のアプローチとの違い">
          <ApproachComparisonTable rows={paper.approachComparison} />
        </SummaryBlock>
      ) : null}

      {paper.flowSteps && paper.flowSteps.length > 0 ? (
        <ActionFlowDiagram
          steps={paper.flowSteps}
          showBudgetBranch={paper.flowSteps.length >= 4}
        />
      ) : null}

      {kpi.length > 0 ? (
        <section className="scroll-mt-24">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8a908a]">
            数字で見る結果
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {kpi.slice(0, 3).map((item, i) => (
              <div
                key={`kpi-${i}`}
                className="rounded-2xl border border-[#e8e4dc] bg-white px-4 py-5 text-center"
              >
                <p className="font-serif text-2xl font-bold text-[#2f4a3a]">{item.value}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#6b726b]">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasLimitations ? (
        <StudyLimitations text={paper.limitations} bullets={paper.limitationsBullets} />
      ) : null}

      {whyYouCare ? (
        <SummaryBlock title="あなたにどう関係する">
          <p>{whyYouCare}</p>
        </SummaryBlock>
      ) : null}

      {paper.takeaway ? (
        <TakeawayCard
          takeaway={paper.takeaway}
          catchTitle={view.catchTitle}
          url={articleUrl}
        />
      ) : (
        <SummaryBlock title="読み終えたあとに、こう話せる">
          <p className="font-medium text-[#1a1f1c]">{takeawayTalk}</p>
        </SummaryBlock>
      )}

      <div className="pt-2">
        <ShareButtons url={articleUrl} title={view.catchTitle} />
      </div>

      {paper.articleFiguresV2?.map((fig, i) => (
        <ArticleFigureV2Block key={`v2fig-${i}`} figure={fig} />
      ))}
      {resultsFigure ? (
        <KeyFigureBlock figure={resultsFigure} paper={paper} heading="図表" />
      ) : null}

      {sections.results ? (
        <details className="rounded-2xl bg-[#faf8f5] px-5 py-4">
          <summary className="cursor-pointer text-sm font-medium text-[#6b726b]">
            結果の詳細を読む
          </summary>
          <p className="mt-3 text-sm leading-[1.9] text-[#3d4540]">{sections.results}</p>
        </details>
      ) : null}

      {glossary.length > 0 ? <GlossaryList terms={glossary} /> : null}

      {paper.audio ? (
        <div id="audio-player" className="scroll-mt-24">
          <AudioPlayer
            audio={paper.audio}
            label={`要点を ${paper.audio.duration ?? 60} 秒で聴く`}
          />
        </div>
      ) : null}

      <ReadButton paperId={paper.id} field={paper.field} />
      <SourceLinks paper={paper} />
      <RelatedPapers papers={siblings} currentId={paper.id} title="関連する論文" />

      <details className="group rounded-2xl bg-[#faf8f5] px-5 py-4">
        <summary className="cursor-pointer list-none text-sm font-medium text-[#6b726b] marker:content-none">
          <span className="group-open:hidden">原文アブストラクトを見る</span>
          <span className="hidden group-open:inline">原文アブストラクトを閉じる</span>
        </summary>
        <p className="mt-4 whitespace-pre-line text-sm leading-[1.85] text-[#5c635c]">
          {paper.abstract}
        </p>
      </details>
    </div>
  );

  return (
    <>
      <article className="mx-auto max-w-[680px] pb-28 sm:pb-12">
        <header className="space-y-4 pb-6">
          <ReadingMeta readMinutes={readMinutes} tags={metaTags} date={date} />
          <h1 className="font-serif text-2xl font-semibold leading-[1.35] tracking-tight text-[#1a1f1c] sm:text-[2rem]">
            {paper.titleJa?.trim() || view.catchTitle}
          </h1>
          <p className="text-pretty text-lg leading-[1.75] text-[#4a524a]">{oneLiner}</p>
          {paper.audio && !hasQuiz ? (
            <a
              href="#audio-player"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2f4a3a] underline-offset-4 transition hover:underline"
            >
              要点を {paper.audio.duration ?? 60} 秒で聴く（下部へ）→
            </a>
          ) : null}
        </header>

        <div id="read-body" className="scroll-mt-24 space-y-8">
          {hasQuiz ? (
            <>
              <PredictionQuiz quiz={paper.quiz!} paperId={paper.id} field={paper.field} />
              <QuizSkipBar paperId={paper.id} />
            </>
          ) : null}

          <QuizGate paperId={paper.id} skip={!hasQuiz}>
            {articleContent}
          </QuizGate>
        </div>
      </article>

      <StickyReadCta
        paperId={paper.id}
        skipGate={!hasQuiz}
        label="本文を読む"
      />
    </>
  );
}
