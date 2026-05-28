import AudioPlayer from "@/components/AudioPlayer";
import GlossaryList from "@/components/GlossaryList";
import GlossaryText from "@/components/GlossaryText";
import InsightCallout from "@/components/InsightCallout";
import KeyFigureBlock from "@/components/KeyFigureBlock";
import PredictionQuiz from "@/components/PredictionQuiz";
import QuizGate from "@/components/QuizGate";
import ReadButton from "@/components/ReadButton";
import ReadingMeta from "@/components/ReadingMeta";
import RelatedPapers from "@/components/RelatedPapers";
import ShareButtons from "@/components/ShareButtons";
import SourceLinks from "@/components/SourceLinks";
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
      <article className="mx-auto max-w-[680px]">
        <header className="space-y-5 pb-8">
          <ReadingMeta readMinutes={view.readMinutes} tags={view.tags} date={date} />
          <h1 className="font-serif text-2xl font-semibold leading-[1.35] tracking-tight text-[#1a1f1c] sm:text-[2rem]">
            {view.catchTitle}
          </h1>
          <p className="text-pretty text-lg leading-[1.8] text-[#4a524a]">{view.hook}</p>
          {paper.audio ? (
            <AudioPlayer
              audio={paper.audio}
              label={`要点を ${paper.audio.duration ?? 60} 秒で聴く`}
            />
          ) : null}
        </header>

        <div id="read-body" className="space-y-10 sm:space-y-12">
          {paper.quiz ? (
            <PredictionQuiz quiz={paper.quiz} paperId={paper.id} field={paper.field} />
          ) : null}

          <QuizGate paperId={paper.id} skip={!paper.quiz}>
          <div className="space-y-10 sm:space-y-12">
          {glossary.length > 0 ? <GlossaryList terms={glossary} /> : null}

          {paper.limitations?.trim() ? <StudyLimitations text={paper.limitations} /> : null}

          <SummaryBlock title="まずここだけ" variant="lead">
            <ul className="space-y-3">
              {view.threeLineSummary.map((line, i) => (
                <li key={`sum-${i}`}>
                  <GlossaryText text={line} glossary={glossary} />
                </li>
              ))}
            </ul>
          </SummaryBlock>

          {sections.gist && sections.gist !== view.threeLineSummary.join("") ? (
            <SummaryBlock title="背景">
              <p>
                <GlossaryText text={sections.gist} glossary={glossary} />
              </p>
            </SummaryBlock>
          ) : null}

          <InsightCallout label="この研究の面白さ">
            <GlossaryText text={view.insight || sections.novelty} glossary={glossary} />
          </InsightCallout>

          {sections.method ? (
            <SummaryBlock title="どうやって確かめた？">
              <p>
                <GlossaryText text={sections.method} glossary={glossary} />
              </p>
            </SummaryBlock>
          ) : null}

          {sections.results ? (
            <SummaryBlock title="わかったこと">
              <p>
                <GlossaryText text={sections.results} glossary={glossary} />
              </p>
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

          {paper.takeaway ? (
            <TakeawayCard
              takeaway={paper.takeaway}
              catchTitle={view.catchTitle}
              url={articleUrl}
            />
          ) : null}

          <ReadButton paperId={paper.id} field={paper.field} />

          <ShareButtons url={articleUrl} title={view.catchTitle} />

          <SourceLinks paper={paper} />

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

        <RelatedPapers papers={siblings} currentId={paper.id} />
      </article>

      <StickyReadCta label="本文へ" />
    </>
  );
}
