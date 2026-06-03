import ActionFlowDiagram from "@/components/ActionFlowDiagram";
import ApproachComparisonTable from "@/components/ApproachComparisonTable";
import AudioPlayer from "@/components/AudioPlayer";
import GlossaryList from "@/components/GlossaryList";
import GlossaryText from "@/components/GlossaryText";
import InsightCallout from "@/components/InsightCallout";
import KeyFigureBlock from "@/components/KeyFigureBlock";
import PredictionQuiz from "@/components/PredictionQuiz";
import QuizGate from "@/components/QuizGate";
import QuizSkipBar from "@/components/QuizSkipBar";
import ReadButton from "@/components/ReadButton";
import ResultsHighlightBlock from "@/components/ResultsHighlightBlock";
import ReviewMemoSection from "@/components/ReviewMemo";
import ReadingMeta from "@/components/ReadingMeta";
import RelatedPapers from "@/components/RelatedPapers";
import ShareButtons from "@/components/ShareButtons";
import SourceLinks from "@/components/SourceLinks";
import StoryCardsSection from "@/components/StoryCards";
import StickyReadCta from "@/components/StickyReadCta";
import SummaryBlock from "@/components/SummaryBlock";
import StudyLimitations from "@/components/StudyLimitations";
import TakeawayCard from "@/components/TakeawayCard";
import { buildEditorialView } from "@/lib/editorial";
import { getSiteUrl } from "@/lib/siteUrl";
import type { Paper } from "@/lib/types";

type ReadingPageProps = {
  paper: Paper;
  date: string;
  siblings: Paper[];
};

export default function ReadingPage({ paper, date, siblings }: ReadingPageProps) {
  const view = buildEditorialView(paper);
  const { sections } = view;
  const glossary = paper.glossary ?? [];
  const articleUrl = `${getSiteUrl()}/papers/${encodeURIComponent(paper.id)}`;
  const threeLineSummary = paper.threeLineSummary ?? view.threeLineSummary;
  const backgroundText = paper.background?.trim() || sections.gist?.trim() || "";
  const showBackground =
    Boolean(backgroundText) &&
    backgroundText !== threeLineSummary.join("");
  const resultsTitle = paper.resultsTitle ?? "わかったこと";
  const hasLimitations =
    Boolean(paper.limitationsBullets?.length) || Boolean(paper.limitations?.trim());

  /** 新形式（keyFigures）優先。旧形式（keyFigure 単数）は results 用にフォールバック */
  const allFigures = paper.keyFigures ?? [];
  const resultsFigure =
    allFigures.find((f) => f.purpose === "results") ?? paper.keyFigure ?? null;
  const whyFigure = allFigures.find((f) => f.purpose === "why") ?? null;
  /** results/why 以外の余り図（旧データ互換のため） */
  const extraFigures = allFigures.filter(
    (f) => f !== resultsFigure && f !== whyFigure && f.purpose !== "results" && f.purpose !== "why"
  );

  return (
    <>
      <article className="mx-auto max-w-[680px] pb-28 sm:pb-12">
        <header className="space-y-5 pb-8">
          <ReadingMeta readMinutes={view.readMinutes} tags={view.tags} date={date} />
          <h1 className="font-serif text-2xl font-semibold leading-[1.35] tracking-tight text-[#1a1f1c] sm:text-[2rem]">
            {view.catchTitle}
          </h1>
          <p className="text-pretty text-lg leading-[1.8] text-[#4a524a]">{view.hook}</p>
          {paper.hookLead?.trim() ? (
            <p className="text-pretty text-base leading-[1.85] text-[#5c635c]">
              <GlossaryText text={paper.hookLead} glossary={glossary} />
            </p>
          ) : null}
          {paper.audio ? (
            <a
              href="#audio-player"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2f4a3a] underline-offset-4 transition hover:text-[#1a1f1c] hover:underline"
            >
              <span aria-hidden>🎧</span>
              要点を {paper.audio.duration ?? 60} 秒で聴く（下部へ）
              <span aria-hidden>→</span>
            </a>
          ) : null}
        </header>

        <div id="read-body" className="space-y-10 sm:space-y-12">
          {paper.quiz ? (
            <>
              <PredictionQuiz quiz={paper.quiz} paperId={paper.id} field={paper.field} />
              <QuizSkipBar paperId={paper.id} />
            </>
          ) : null}

          <QuizGate paperId={paper.id} skip={!paper.quiz}>
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

          {showBackground ? (
            <SummaryBlock title="背景">
              <p>
                <GlossaryText text={backgroundText} glossary={glossary} />
              </p>
            </SummaryBlock>
          ) : null}

          {!paper.approachComparison?.length ? (
            <InsightCallout label="この研究の面白さ">
              <GlossaryText text={view.insight || sections.novelty} glossary={glossary} />
            </InsightCallout>
          ) : null}

          {sections.method ? (
            <SummaryBlock title="どうやって確かめた？">
              <p>
                <GlossaryText text={sections.method} glossary={glossary} />
              </p>
            </SummaryBlock>
          ) : null}

          {paper.resultsHighlight ? (
            <SummaryBlock title={resultsTitle}>
              <ResultsHighlightBlock data={paper.resultsHighlight} glossary={glossary} />
            </SummaryBlock>
          ) : sections.results ? (
            <SummaryBlock title={resultsTitle}>
              <p>
                <GlossaryText text={sections.results} glossary={glossary} />
              </p>
            </SummaryBlock>
          ) : null}

          {paper.approachComparison && paper.approachComparison.length > 0 ? (
            <SummaryBlock title="既存のアプローチとの違い">
              <ApproachComparisonTable rows={paper.approachComparison} />
            </SummaryBlock>
          ) : null}

          {resultsFigure ? (
            <KeyFigureBlock
              figure={resultsFigure}
              paper={paper}
              heading="わかったこと（図表）"
            />
          ) : null}

          {sections.why?.trim() ? (
            <SummaryBlock title="なぜそうなるのか">
              <p>
                <GlossaryText text={sections.why} glossary={glossary} />
              </p>
            </SummaryBlock>
          ) : null}

          {whyFigure ? (
            <KeyFigureBlock
              figure={whyFigure}
              paper={paper}
              heading="なぜそうなるのか（図表）"
            />
          ) : null}

          {hasLimitations ? (
            <StudyLimitations
              text={paper.limitations}
              bullets={paper.limitationsBullets}
            />
          ) : null}

          {paper.flowSteps && paper.flowSteps.length > 0 ? (
            <ActionFlowDiagram
              steps={paper.flowSteps}
              showBudgetBranch={paper.flowSteps.length >= 4}
            />
          ) : null}

          {glossary.length > 0 ? <GlossaryList terms={glossary} /> : null}

          {sections.figures &&
          !sections.figures.includes("図表の記述なし") &&
          sections.figures.trim() ? (
            <SummaryBlock title="図表から読み取れること">
              <p className="whitespace-pre-line">{sections.figures}</p>
            </SummaryBlock>
          ) : null}

          {extraFigures.map((fig, i) => (
            <KeyFigureBlock key={`extra-${i}`} figure={fig} paper={paper} />
          ))}

          <InsightCallout label="私たちに関係あるのはここ">{view.relevance}</InsightCallout>

          {paper.audio ? (
            <div id="audio-player" className="scroll-mt-24">
              <AudioPlayer
                audio={paper.audio}
                label={`要点を ${paper.audio.duration ?? 60} 秒で聴く`}
              />
            </div>
          ) : null}

          {paper.storyCards ? (
            <StoryCardsSection
              cards={paper.storyCards}
              catchTitle={view.catchTitle}
              sharePath={`/papers/${encodeURIComponent(paper.id)}`}
            />
          ) : null}

          {paper.takeaway ? (
            <TakeawayCard
              takeaway={paper.takeaway}
              catchTitle={view.catchTitle}
              url={articleUrl}
            />
          ) : null}

          <ReadButton paperId={paper.id} field={paper.field} />

          <ReviewMemoSection paperId={paper.id} takeaway={paper.takeaway} />

          <ShareButtons url={articleUrl} title={view.catchTitle} />

          <SourceLinks paper={paper} />

          <RelatedPapers
            papers={siblings}
            currentId={paper.id}
            title="関連する論文"
          />

          <details className="group rounded-2xl bg-[#faf8f5] px-5 py-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-[#6b726b] marker:content-none">
              <span className="group-open:hidden">原文アブストラクトを見る</span>
              <span className="hidden group-open:inline">原文アブストラクトを閉じる</span>
            </summary>
            <p className="mt-4 whitespace-pre-line text-sm leading-[1.85] text-[#5c635c]">{paper.abstract}</p>
          </details>
          </div>
          </QuizGate>
        </div>

      </article>

      <StickyReadCta paperId={paper.id} skipGate={!paper.quiz} label="本文を読む" />
    </>
  );
}
