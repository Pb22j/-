import React from 'react';
import { Piece, Button, Chip } from '../../components/core/index.jsx';
import { ChoiceCard, TalkingOrb } from '../../components/games/index.jsx';
import { StarRating } from '../../components/progress/index.jsx';
import * as stageBuilder from '../../agents/stageBuilderAgent.js';
import { CORPUS } from '../../content/knowledge.js';
import { LEVELS, TIERS } from '../../store/usePlayer.js';
import { dir, n, sar } from '../../lib/format.js';

/* ============================================================
   بناء المراحل — Stage Builder
   ------------------------------------------------------------
   The learner names the thing they did not understand and the agent
   assembles a playable scenario around a real corpus entry, so every
   stage it hands back cites the book it came from. The stage always
   loses virtual money to teach, never real money, and it never
   instructs a trade — it only shows a principle playing out.
   ============================================================ */

/* Every stage runs on the same virtual base so outcomes compare. */
const BASE = 100000;

/* Agent-authored scenario copy can carry decorative symbols; the house
   rule is no emoji in front of the learner, so strip them. */
const clean = (s) => String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

function Upgrade({ go, need }) {
  const plan = TIERS.find((t) => t.id === need);
  return (
    <div className="bs-center">
      <div className="bs-col" style={{ gap: 'var(--space-6)', maxWidth: 620 }}>
        <Chip color="faint" cut={3}>مقفول في خطتك</Chip>
        <h1 style={{ font: 'var(--type-headline)', margin: 0 }}>بناء المراحل مو مفتوح في اشتراك {plan?.ar || ''}</h1>
        <Piece color="cream" cut={3} lift style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'right' }}>
          <p style={{ font: 'var(--type-lead)', margin: 0 }}>
            اكتب للشرط صراحة: تبغى تبني مرحلة على المبدأ اللي ما فهمته، وتلعبها، وتشوف وش تكلّفك من فلوس وهمية.
          </p>
          <p style={{ font: 'var(--type-body)', margin: 0, color: 'var(--ink-muted)' }}>
            هذي الميزة تنفتح مع باقة {plan?.ar || ''} بسعر {n(plan?.price || 0)} ريال شهرياً داخل العرض، بدون أي دفع حقيقي.
          </p>
        </Piece>
        <div className="bs-row">
          <Button onClick={() => go('plans')}>شوف الباقات</Button>
          <Button variant="ghost" onClick={() => go('journey')}>ارجع للرحلة</Button>
        </div>
      </div>
    </div>
  );
}

function Beats({ beats }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
      {beats.map((b, i) => {
        const prev = i > 0 ? beats[i - 1].price : b.price;
        const chg = ((b.price - prev) / prev) * 100;
        return (
          <li key={i}>
            <Piece color="faint" cut={2} style={{ padding: '10px 16px', display: 'flex', gap: 'var(--space-3)', alignItems: 'baseline', font: 'var(--type-caption)' }}>
              <span style={{ fontWeight: 700 }}>اليوم {n(b.day)}</span>
              {i > 0 ? <span className="num" style={{ color: chg >= 0 ? 'var(--green)' : 'var(--red)' }}>{dir(chg, 0)}</span> : null}
              <span style={{ color: 'var(--ink-muted)' }}>{b.note}</span>
            </Piece>
          </li>
        );
      })}
    </ol>
  );
}

export function StageBuilderScreen({ go, player, market }) {
  const allowed = player.hasFeature('stageBuilder');
  const level = player.level || 'beginner';

  const [request, setRequest] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [stage, setStage] = React.useState(null);
  const [picked, setPicked] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [covered, setCovered] = React.useState(null);
  const [used, setUsed] = React.useState([]);
  const [showSuggest, setShowSuggest] = React.useState(false);

  const suggestions = CORPUS.filter((c) => !used.includes(c.id));
  const watchName = market?.meta?.[market?.selected]?.ar;

  const build = async () => {
    const text = request.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const hit = stageBuilder.alreadyCovered(text);
      setCovered(hit ? hit.title : null);
      const built = await stageBuilder.build(text, {
        level,
        budget: BASE,
        series: market.series,
        ...(watchName ? { company: watchName, companyId: market.selected } : {}),
      });
      setStage(built);
      setPicked(null);
      setResult(null);
      setUsed((u) => (u.includes(built.concept) ? u : [...u, built.concept]));
    } finally {
      setBusy(false);
    }
  };

  const remix = () => {
    if (!stage) return;
    setStage(stageBuilder.remix(stage));
    setPicked(null);
    setResult(null);
  };

  /** Stars follow where the choice landed against the other options. */
  const choose = (opt) => {
    if (!stage) return;
    const ranked = [...stage.options].sort((a, b) => (a.outcome?.valuePct ?? 0) - (b.outcome?.valuePct ?? 0));
    const at = ranked.findIndex((o) => o.key === opt.key);
    /* Worst pick earns 1 star, best pick earns 5, whatever the option count. */
    const stars = ranked.length < 2 ? 5 : 1 + Math.round((at / (ranked.length - 1)) * 4);
    setPicked(opt.key);
    setResult({
      opt,
      stars,
      good: at === ranked.length - 1,
      valuePct: opt.outcome?.valuePct ?? 0,
      final: (BASE * (opt.outcome?.valuePct ?? 0)) / 100,
      delta: (opt.outcome?.valuePct ?? 0) - 100,
    });
    player.awardCustom(stage.id, stars);
  };

  if (!allowed) {
    return <Upgrade go={go} need={stageBuilder.REQUIRES_TIER} />;
  }

  const takeSuggestion = (entry) => {
    setRequest(`ما فهمت ${entry.title}`);
    setShowSuggest(false);
  };

  return (
    <div className="bs-screen" style={{ gap: 'var(--space-5)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Chip color="orange" cut={3} lift>بصير يبني لك</Chip>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>مستواك {LEVELS[level]?.ar || ''}</span>
        </div>
        <h1 style={{ font: 'var(--type-headline)', margin: 0 }}>قول وش ما فهمت، وبصير يبني لك مرحلة</h1>
      </header>

      <Piece color="cream" cut={3} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: 'var(--type-label)' }}>وش تبغى تتعلّم؟</span>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={2}
            placeholder="اكتب بكلامك، مثل: ما فهمت وقف الخسارة"
            style={{ background: 'transparent', border: '2px solid var(--line-strong)', borderRadius: 0, padding: '14px 16px', font: 'var(--type-body)', width: '100%', resize: 'vertical' }} />
        </label>

        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={build} disabled={busy || !request.trim()}>
            {busy ? 'بصير يبني' : 'ابنِ لي المرحلة'}
          </Button>
          <button type="button" onClick={() => setShowSuggest((v) => !v)}
            style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'var(--type-label)', fontWeight: 700, color: 'var(--blue)', textDecoration: 'underline', textUnderlineOffset: 6, textDecorationThickness: 2 }}>
            اقترحني مبادئ غير مشروحة
          </button>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
            كل مرحلة تلعب بـ {sar(BASE)} وهمية، وما فيها ولا ريال حقيقي.
          </span>
        </div>

        {covered && (
          <Piece color="faint" cut={2} style={{ padding: 'var(--space-4) var(--space-5)', font: 'var(--type-caption)' }}>
            <span>المكتبة عندنا تغطي «{covered}» في مرحلة تعليمية جاهزة، وبنيت لك واحدة على نفس المبدأ عشان تجرب بزاوية ثانية.</span>
          </Piece>
        )}

        {showSuggest && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {suggestions.length === 0
              ? <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>غطّيت كل مبادئ المكتبة في هذه الجلسة. ما في اقتراحات جديدة.</span>
              : suggestions.map((c) => (
                <button key={c.id} type="button" onClick={() => takeSuggestion(c)}
                  style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}>
                  <Chip color="faint" cut={2} tilt={-1}>{c.title}</Chip>
                </button>
              ))}
          </div>
        )}
      </Piece>

      <div className="scroll grow" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {!stage && (
          <Piece color="faint" cut={3} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ font: 'var(--type-body)', margin: 0 }}>
              اكتب فوق وش تبغى تتعلّم، واضغط ابنِ لي المرحلة. بتطلع لك مرحلة على مبدأ من كتب، تلعبها وتختار، وتشوف التكلفة.
            </p>
          </Piece>
        )}

        {stage && (
          <>
            <Piece color="orange" cut={4} lift style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip color="ink" cut={3} tilt={0}>{LEVELS[stage.level]?.ar || ''}</Chip>
                  <Chip color="cream" cut={2}>{stage.kind === 'sequence' ? 'سيناريو متسلسل' : 'قرار من شقين'}</Chip>
                </div>
                <h2 style={{ font: 'var(--type-title)', margin: 0 }}>{stage.title}</h2>
                <p style={{ font: 'var(--type-caption)', margin: 0, color: 'var(--ink-muted)' }}>
                  المبدأ من {stage.book} · {stage.source}
                </p>
                <p style={{ font: 'var(--type-lead)', margin: 0 }}>{clean(stage.opening || stage.brief)}</p>
              </header>

              {stage.feed && (
                <Piece color="faint" cut={2} style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{clean(stage.feed.handle)}</span>
                  <span style={{ font: 'var(--type-body)' }}>{clean(stage.feed.text)}</span>
                </Piece>
              )}

              {stage.beats?.length > 0 && <Beats beats={stage.beats} />}

              <Piece color="cream" cut={3} style={{ padding: 'var(--space-5)' }}>
                <p style={{ font: 'var(--type-lead)', margin: 0 }}>{stage.prompt}</p>
              </Piece>

              <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', justifyContent: 'center' }}>
                {stage.options.map((o, i) => (
                  <ChoiceCard
                    key={o.key}
                    i={i}
                    w={220}
                    label={o.label}
                    sub={o.sub}
                    cut={o.cut}
                    tilt={o.tilt}
                    on={picked === o.key}
                    disabled={!!result}
                    onClick={() => choose(o)} />
                ))}
              </div>
            </Piece>

            {result && (
              <Piece color="cream" cut={2} lift style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                  <span className="num" style={{ font: 'var(--type-headline)', fontVariantNumeric: 'tabular-nums' }}>{sar(result.final)}</span>
                  <span className="num" style={{ font: 'var(--type-title)', color: result.delta > 0 ? 'var(--green)' : result.delta < 0 ? 'var(--red)' : 'var(--ink-muted)' }}>
                    {dir(result.delta, 0)}
                  </span>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
                    من أصل {sar(BASE)} وهمية، بعد اختيارك «{result.opt.label}».
                  </span>
                </div>

                <StarRating value={result.stars} max={5} size={40} label={`نجومك ${result.stars} من 5`} />

                <div style={{ display: 'flex', justifyContent: 'center', direction: 'ltr' }}>
                  <TalkingOrb
                    big
                    color={result.good ? 'green' : 'red'}
                    text={result.good ? (stage.resolution?.win || stage.title) : (stage.resolution?.lose || stage.title)} />
                </div>

                {result.opt.lesson && (
                  <Piece color="faint" cut={3} style={{ padding: 'var(--space-5)' }}>
                    <span style={{ font: 'var(--type-body)' }}>{clean(result.opt.lesson)}</span>
                  </Piece>
                )}
              </Piece>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
        {stage && <Button variant="ghost" onClick={remix}>نبني مرحلة ثانية</Button>}
        <Button variant="quiet" onClick={() => go('journey')}>ارجع للرحلة</Button>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
          المراحل تعلّم مبادئ على بيانات تاريخية، ما فيها توصية ولا هدف سعري.
        </span>
      </div>

    </div>
  );
}
