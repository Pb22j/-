import React from 'react';
import { Button, Piece, Chip } from '../../components/core/index.jsx';
import {
  useTween, useLater, Flip, Torn, TalkingOrb, EyeOrb, GameTag, ChoiceCard,
} from '../../components/games/index.jsx';
import { StarRating } from '../../components/progress/index.jsx';
import { Figure, OutcomeCard } from '../../components/finance/index.jsx';
import { BY_ID } from '../../content/knowledge.js';
import { STAGES } from '../../content/stages.js';
import { n, n2, sar, dir, pct } from '../../lib/format.js';

/* ============================================================
   مراحل المبتدئ — Beginner Stages
   ------------------------------------------------------------
   Six metaphor stages, one behavioural principle each:

     b-team    · تركّز المحفظة   نجم واحد ولا فريق
     b-day27   · مضاعفة رأس المال  الاستمرارية قبل الحجم
     b-family  · البيع من الخوف   الخسارة اليومية
     b-coaster · الخوف من الخسارة  الهبوط يوجع أكثر من الصعود
     b-ice     · الخوف من الخسارة  سجل قرارات آخر ثلاثين يوم
     b-arena   · حجم المركز       حجم المركز تحت التذبذب

   Each beat is its own component, so useLater/useTween fire when
   the beat mounts — the consequence is staged, never swapped in
   with the answer. Navigation happens only through go(id).
   All figures are illustrative, never advice.
   ============================================================ */

/* ---------- typography: tokens only ---------- */
const T_HEAD = { font: 'var(--type-headline)', textWrap: 'balance' };
const T_TITLE = { font: 'var(--type-title)' };
const T_LEAD = { font: 'var(--type-lead)' };
const T_BODY = { font: 'var(--type-body)' };
const T_MARK = { font: 'var(--type-mark)', fontVariantNumeric: 'tabular-nums' };
const T_LABEL = { font: 'var(--type-label)' };
const T_CAP = { font: 'var(--type-caption)' };
const T_BTN = { font: 'var(--type-button)' };

const MUTED = 'var(--ink-muted)';
const LINE = '2px solid var(--cream)';

/* ---------- tiny layout helpers ---------- */

function Screen({ children, style, gap }) {
  return (
    <div className="bs-screen scroll" style={{ gap: gap || 'var(--space-6)', textAlign: 'center', ...style }}>
      {children}
    </div>
  );
}

function StageTag({ stage }) {
  const i = STAGES.beginner.findIndex((s) => s.id === stage.id);
  return <GameTag n={i >= 0 ? i + 1 : 1} name={stage.title} />;
}

function Head({ children, style }) {
  return <h1 style={{ ...T_HEAD, margin: 0, ...style }}>{children}</h1>;
}

function Lead({ children, style }) {
  return <p style={{ ...T_LEAD, margin: 0, color: MUTED, ...style }}>{children}</p>;
}

function Cap({ children, style }) {
  return <span style={{ ...T_CAP, color: MUTED, ...style }}>{children}</span>;
}

function Note({ children }) {
  return <p className="bs-note">{children || 'كل الأرقام أمثلة توضيحية'}</p>;
}

/** "المرحلة · ..." tag + the disclaimer every scene closes with. */
function Feet({ children }) {
  return (
    <div className="bs-row" style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
      {children}
    </div>
  );
}

/** Hesitation costs half a star — the house way of punishing dithering. */
function Hesitate({ hesitant, onClick }) {
  return (
    <div className="bs-row" style={{ marginTop: 'auto' }}>
      <Button variant="quiet" disabled={hesitant} onClick={onClick}>
        {hesitant ? 'راجعت الأرقام قبل قرارك' : 'تراجع — خلني أراجع الأرقام'}
      </Button>
    </div>
  );
}

/** A stack of comparable sheets: label on top, big figure underneath. */
function Compare({ rows, cols }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' }}>
      {rows.map((r, i) => (
        <Piece key={i} color={r.color || 'cream'} cut={(i % 4) + 1} lift={r.emphasis}
          style={{
            padding: '20px 26px', minWidth: 200, maxWidth: 320,
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
            alignItems: 'center', textAlign: 'center',
            animation: 'bs-deal .55s cubic-bezier(.2,.8,.2,1) both',
            animationDelay: `${i * 130 + (cols ? 0 : 200)}ms`,
          }}>
          <span style={{ ...T_LABEL, opacity: .9 }}>{r.label}</span>
          <span style={{ ...T_MARK }}>{r.value}</span>
          {r.sub && <span style={{ ...T_CAP, opacity: .8 }}>{r.sub}</span>}
        </Piece>
      ))}
    </div>
  );
}

/** Row of day/price chips used by the drip and the replay. */
function Strip({ items, color }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
      {items.map((it, i) => (
        <Piece key={i} as="div" color={it.color || color || 'faint'} cut={(i % 4) + 1} lift={!!it.strong}
          style={{
            padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4,
            alignItems: 'center', minWidth: 74,
            animation: 'bs-deal .45s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${i * 90}ms`,
          }}>
          <span style={{ ...T_CAP, opacity: .85 }}>{it.top}</span>
          <span style={{ ...T_BTN, fontVariantNumeric: 'tabular-nums' }}>{it.value}</span>
          {it.sub && <span style={{ ...T_CAP, opacity: .8 }}>{it.sub}</span>}
        </Piece>
      ))}
    </div>
  );
}

/* ---------- the run: one decision, then the consequence, then the lesson ---------- */

const STAR_FOR = { best: 5, partial: 4, wrong: 2 };
const clampStars = (v) => Math.max(1, Math.min(5, v));
const reported = new Set();

/** One award per (stage, stars, won) — the result screen may mount again on retry. */
function reportOnce(stage, stars, won, onComplete) {
  if (!stage) return;
  const key = `${stage.id}|${stars}|${won ? 1 : 0}`;
  if (reported.has(key)) return;
  reported.add(key);
  if (typeof onComplete === 'function') onComplete(stage.id, stars, won);
}

const blank = () => ({ pick: null, q: null, hesitant: false });

/** Bumped by the result screen's retry, so a re-run resets even if the
    router keeps this component mounted across the same stage id. */
let retryEpoch = 0;

function useFlow(stage) {
  const [f, setF] = React.useState(blank);
  const id = (stage && stage.id) || '';
  const seen = React.useRef(retryEpoch);
  React.useEffect(() => { setF(blank()); }, [id]);
  React.useEffect(() => {
    if (seen.current !== retryEpoch) { seen.current = retryEpoch; setF(blank()); }
  }, []);

  const choose = React.useCallback((key, q) => {
    setF((p) => (p.pick ? p : { ...p, pick: key, q }));
  }, []);
  const hesitate = React.useCallback(() => {
    setF((p) => (p.pick || p.hesitant ? p : { ...p, hesitant: true }));
  }, []);

  const stars = f.q ? clampStars(STAR_FOR[f.q] - (f.hesitant ? 1 : 0)) : 0;
  const won = !!f.q && f.q !== 'wrong';
  return { f, choose, hesitate, stars, won };
}

function useReport(stage, stars, won, onComplete, active = true) {
  React.useEffect(() => {
    if (!active || !stage || !stars) return;
    reportOnce(stage, stars, won, onComplete);
  }, [active, stage, stars, won, onComplete]);
}

/** The closing beat every stage ends on: verdict, stars, the lesson itself. */
function LessonBeat({ stage, stars, won, onComplete, headline, tone = 'orange', scene, body, go }) {
  useReport(stage, stars, won, onComplete);
  const entry = BY_ID[stage.concept] || BY_ID.diversification;
  const lesson = [entry.principles[0], entry.probe].filter(Boolean).join(' ');
  return (
    <Screen>
      <StageTag stage={stage} />
      <Head>{headline}</Head>
      {body && <Lead>{body}</Lead>}
      {scene}
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Piece color={won ? 'green' : 'orange'} cut={3} lift tilt={won ? -2 : 2}
          style={{ padding: '18px 28px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <StarRating value={stars} max={5} size={40} animate delay={200} step={180} label={`نجومك ${stars} من 5`} />
          <span style={{ ...T_CAP }}>{won ? 'قرار سليم' : 'هالم مرة لا'}</span>
        </Piece>
        <TalkingOrb text={lesson} color={tone} />
      </div>
      <Feet>
        <Button onClick={() => go('journey')}>كمّل</Button>
      </Feet>
      <Note />
    </Screen>
  );
}

/* ============================================================
   b-team — النجم ولا الفريق؟
   ============================================================ */

const POS = [[50, 90], [15, 70], [38, 74], [62, 74], [85, 70], [20, 46], [40, 50], [60, 50], [80, 46], [38, 20], [62, 20]];
const COL = ['ink', 'blue', 'green', 'orange', 'red', 'blue', 'orange', 'green', 'red', 'orange', 'blue'];
const FALL = 'transform .9s cubic-bezier(.5,-.4,.6,1.3)';

/** The centre circle, drawn as a paper ring — no radius anywhere. */
function Ring() {
  return (
    <span style={{ position: 'absolute', inset: 0, background: 'var(--cream)', clipPath: 'var(--circle)' }}>
      <span style={{ position: 'absolute', inset: 2, background: 'var(--green)', backgroundImage: 'var(--grain)', clipPath: 'var(--circle)' }} />
    </span>
  );
}

function Pitch({ mode, injured, w = 520, h = 350 }) {
  const k = w / 520;
  return (
    <Piece color="green" cut={2} lift style={{ width: w, height: h, flex: 'none' }}>
      <span style={{ position: 'absolute', inset: 18 * k, border: LINE, opacity: .75 }} />
      <span style={{ position: 'absolute', left: 18 * k, right: 18 * k, top: '50%', borderTop: LINE, opacity: .75 }} />
      <span style={{ position: 'absolute', left: '50%', top: '50%', width: 90 * k, height: 90 * k, marginLeft: -45 * k, marginTop: -45 * k, opacity: .75 }}>
        <Ring />
      </span>
      <span style={{ position: 'absolute', left: '50%', top: 18 * k, width: 150 * k, height: 50 * k, marginLeft: -75 * k, border: LINE, borderTop: 0, opacity: .75 }} />
      <span style={{ position: 'absolute', left: '50%', bottom: 18 * k, width: 150 * k, height: 50 * k, marginLeft: -75 * k, border: LINE, borderBottom: 0, opacity: .75 }} />

      {mode === 'star' ? (
        <span style={{ position: 'absolute', left: '50%', top: '50%', transition: FALL, transform: `translate(-50%,-50%)${injured ? ` translateY(${60 * k}px) rotate(100deg)` : ''}` }}>
          <Piece color="orange" cut={3} lift style={{ width: 104 * k, height: 136 * k, display: 'grid', placeItems: 'center' }}>
            <span style={T_TITLE}>نجم</span>
          </Piece>
        </span>
      ) : (
        POS.map((p, i) => (
          <span key={i} style={{ position: 'absolute', left: `${p[0]}%`, top: `${p[1]}%`, transition: FALL, transform: `translate(-50%,-50%)${injured && i === 9 ? ` translateY(${28 * k}px) rotate(90deg)` : ''}` }}>
            <Piece color={COL[i]} cut={(i % 4) + 1} lift style={{ width: 34 * k, height: 42 * k }} />
          </span>
        ))
      )}

      {injured && (
        <span style={{ position: 'absolute', left: mode === 'star' ? '62%' : '30%', top: mode === 'star' ? '70%' : '28%', animation: 'bs-pop .4s cubic-bezier(.3,1.4,.5,1) .8s both' }}>
          <Chip color="red" lift tilt={-4}>إصابة</Chip>
        </span>
      )}
    </Piece>
  );
}

function TeamStage({ stage, go, player, onComplete }) {
  const { f, choose, hesitate, stars, won } = useFlow(stage);
  const [beat, setBeat] = React.useState('match');
  const budget = stage.budget || 10000000;
  const team = f.pick === 'team';

  if (!f.pick) {
    return (
      <Screen>
        <StageTag stage={stage} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
          <Head>عندك {sar(budget)} ريال. وين تحطها كلها؟</Head>
          <Figure value={n(budget)} unit="ريال" label="ميزانيتك" variant="points" />
        </div>
        <div className="bs-row" style={{ gap: 'var(--space-8)' }}>
          <ChoiceCard i={0} w={300} h={260} cut={1} tilt={-1} label="النجم"
            sub={`لاعب واحد ياخذ ${sar(budget)}`}
            onClick={() => choose('star', 'wrong')}>
            <Pitch mode="star" w={250} h={168} />
          </ChoiceCard>
          <ChoiceCard i={1} w={300} h={260} cut={3} tilt={1} label="الفريق"
            sub={`11 لاعب، كل واحد ${sar(budget / 11)}`}
            onClick={() => choose('team', 'best')}>
            <Pitch mode="team" w={250} h={168} />
          </ChoiceCard>
        </div>
        <Hesitate hesitant={f.hesitant} onClick={hesitate} />
        <Note />
      </Screen>
    );
  }

  if (beat === 'match') {
    return <TeamMatch stage={stage} budget={budget} team={f.pick === 'team'} onNext={() => setBeat('lesson')} />;
  }

  return (
    <LessonBeat stage={stage} stars={stars} won={won} onComplete={onComplete} go={go}
      tone={team ? 'orange' : 'red'}
      headline={team ? 'الفريق = الصندوق. ما تراهن على لاعب واحد.' : 'النجم كان كل محفظتك. طاح بوحده.'}
      body={team
        ? `واحد أُصيب والفريق كمّل، وفقدت ${n(budget * 0.05)} ريال فقط من ${n(budget)} ريال.`
        : `النجم أُصيب بوحده، وخسرت ${n(budget * 0.4)} ريال من ${n(budget)} ريال في يوم واحد.`}
      scene={
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Pitch mode={team ? 'team' : 'star'} injured w={400} h={266} />
          {team
            ? <Flip w={250} h={150} color="blue" backColor="green" cut={1} backCut={4}
                front={<span style={T_TITLE}>11 لاعب</span>} back={<span style={T_TITLE}>الصندوق</span>} />
            : <Flip w={250} h={150} color="orange" backColor="red" cut={3} backCut={2}
                front={<span style={T_TITLE}>النجم</span>} back={<span style={T_TITLE}>سهم واحد</span>} />}
        </div>
      } />
  );
}

function TeamMatch({ stage, budget, team, onNext }) {
  const down = useLater(900);
  const settled = useLater(1700);
  const share = team ? 95 : 60;
  const value = useTween(settled ? (budget * share) / 100 : budget, 1200);
  return (
    <Screen>
      <StageTag stage={stage} />
      <Head>{team ? 'دخلت على الفريق. المباراة بدأت.' : 'دخلت كل فلوسك على لاعب واحد. المباراة بدأت.'}</Head>
      <Pitch mode={team ? 'team' : 'star'} injured={down} w={440} h={292} />
      <div style={{ display: 'flex', gap: 'var(--space-7)', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Figure value={n(value)} unit="ريال" label={`قيمة ${team ? 'الفريق' : 'النجم'}`} variant="points" />
        {settled && (
          <span style={{ ...T_HEAD, color: share < 90 ? 'var(--red)' : 'var(--green)', animation: 'bs-pop .45s cubic-bezier(.3,1.4,.5,1) both' }}>
            {dir(share - 100, 0)}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
        {down && (
          <TalkingOrb hype color={team ? 'orange' : 'red'} speaker="بصير · المعلّق"
            text={team ? 'إصابة لواحد… والفريق واقف على رجله.' : 'الدقيقة 20. إصابة. مصير فلوسك صار بيد لاعب واحد.'} />
        )}
      </div>
      <Feet>
        <Button onClick={onNext}>كمّل الموسم</Button>
      </Feet>
      <Note />
    </Screen>
  );
}

/* ============================================================
   b-day27 — اليوم السابع والعشرين
   ============================================================ */

const D27 = { daily: 100, days: 26, lump: 2600, years: 20, fvDaily: 1736084, fvLump: 12118 };

function Day27Stage({ stage, go, player, onComplete }) {
  const { f, choose, hesitate, stars, won } = useFlow(stage);
  const ready = useLater(1000);

  if (!f.pick) {
    const days = [];
    for (let i = 1; i <= D27.days; i++) days.push(i);
    return (
      <Screen>
        <StageTag stage={stage} />
        <Head>{ready ? 'اليوم 27. الحين كل شي يبدأ.' : '26 يوماً قلت فيها: بكرة أسوي شي.'}</Head>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
          <Strip
            items={days.map((d) => ({
              top: 'يوم', value: n(d), color: d % 5 === 0 ? 'faint' : 'cream',
            }))}
          />
          {ready && (
            <div style={{ animation: 'bs-drop .7s cubic-bezier(.3,1.3,.5,1) both' }}>
              <Piece color="cream" cut="torn" lift tilt={-2} style={{ padding: '18px 40px' }}>
                <span style={T_TITLE}>اليوم 27 · نزل الراتب</span>
              </Piece>
            </div>
          )}
        </div>
        <Lead>عندك {sar(D27.lump)} ريال. وش تسوي بيها اليوم؟</Lead>
        <div className="bs-row">
          <ChoiceCard i={0} w={210} h={150} cut={1} tilt={-1} label="أقسّمها على الأيام"
            sub={`${sar(D27.daily)} كل يوم، من الحين لأبد`}
            onClick={() => choose('split', 'best')} />
          <ChoiceCard i={1} w={210} h={150} cut={3} tilt={1} label="أحطها كلها اليوم"
            sub={`${sar(D27.lump)} دفعة وحدة`}
            onClick={() => choose('lump', 'partial')} />
          <ChoiceCard i={2} w={210} h={150} cut={4} tilt={-.5} label="أأجل، بكرة أسوي"
            sub="زي كل يوم"
            onClick={() => choose('wait', 'wrong')} />
        </div>
        <Hesitate hesitant={f.hesitant} onClick={hesitate} />
        <Note />
      </Screen>
    );
  }

  if (f.pick === 'wait') {
    return (
      <LessonBeat stage={stage} stars={stars} won={won} onComplete={onComplete} go={go}
        headline="بكرة صارت 26 يوم."
        body="ما استثمرت ولا ريال. والخسارة ما تبدأ من يوم كده."
        tone="red"
        scene={
          <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Flip w={240} h={140} color="cream" backColor="faint" cut={2} backCut={4}
              front={<span style={T_TITLE}>بكرة أسوي</span>}
              back={<span style={T_TITLE}>27 يوم ضاعوا</span>} />
            <Torn w={300} h={140}><span style={T_MARK}>0 ريال مستثمر</span></Torn>
          </div>
        } />
    );
  }

  const label = f.pick === 'split' ? `${sar(D27.daily)} كل يوم` : `${sar(D27.lump)} دفعة وحدة`;
  return (
    <LessonBeat stage={stage} stars={stars} won={won} onComplete={onComplete} go={go}
      tone={f.pick === 'split' ? 'orange' : 'red'}
      headline={f.pick === 'split' ? 'سوّيت شي كل يوم. هذا هو الفرق.' : 'بداية قوية، بس وقفت. والمضاعفة ما تصير.'}
      body={`بفرض 8% سنوياً لمدة ${n(D27.years)} سنة، بدون رسوم ولا ضرائب`}
      scene={<Day27Compare label={label} />} />
  );
}

/** Mounted with the lesson beat, so the two futures count up after the beat lands. */
function Day27Compare({ label }) {
  const settled = useLater(1400);
  const a = useTween(settled ? D27.fvDaily : 0, 1500);
  const b = useTween(settled ? D27.fvLump : 0, 1500);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
      <Compare rows={[
        { label: `لو ضمّنت ${label} من الحين`, value: `↑${n(a)} ريال`, sub: 'الاستمرارية', color: 'green', emphasis: true },
        { label: 'لو حطيت المبلغ كله مرة وحدة', value: `↑${n(b)} ريال`, sub: 'البداية الكبيرة', color: 'faint' },
      ]} />
      <Lead>نفس البداية ونفس العائد، والفرق كله في الاستمرارية.</Lead>
    </div>
  );
}

/* ============================================================
   b-family — الخسارة اليومية
   ============================================================ */

const FAMILY = {
  budget: 20000,
  drip: [100, 97, 93, 88, 82, 75],
  end: 118,
  hold: 23600,
  half: 21800,
  sold: 15000,
};

function DripLine({ days }) {
  const max = FAMILY.drip[0];
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', justifyContent: 'center' }}>
      {FAMILY.drip.slice(0, days).map((p, i) => (
        <Piece key={i} as="div" color={i === days - 1 ? 'red' : 'cream'} cut={(i % 4) + 1} lift={i === days - 1}
          style={{
            width: 58, padding: '8px 6px 10px', display: 'flex', flexDirection: 'column',
            gap: 6, alignItems: 'center',
            animation: 'bs-deal .45s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${i * 140}ms`,
          }}>
          <span style={{ ...T_CAP, opacity: .8 }}>يوم {n(i + 1)}</span>
          <span style={{ display: 'block', width: 18, height: Math.round(60 * p / max), background: 'var(--red)' }} />
          <span style={{ ...T_BTN, fontVariantNumeric: 'tabular-nums' }}>{n(p)}</span>
        </Piece>
      ))}
    </div>
  );
}

function FamilyStage({ stage, go, player, onComplete }) {
  const { f, choose, hesitate, stars, won } = useFlow(stage);
  const pressed = useLater(900);
  const days = pressed ? 6 : 4;

  if (!f.pick) {
    return (
      <Screen>
        <StageTag stage={stage} />
        <Head>كل يوم أسوأ من اللي قبله.</Head>
        <Lead>دخلت بـ {sar(FAMILY.budget)} ريال على سهم طلع، ثم بدأ التراجع.</Lead>
        <DripLine days={days} />
        <div className="bs-row" style={{ gap: 'var(--space-4)' }}>
          <Piece color="blue" cut={1} lift tilt={-1} style={{ padding: '12px 20px', maxWidth: 240, textAlign: 'right' }}>
            <b style={{ ...T_BTN }}>خالك أبو فهد</b>
            <span style={{ ...T_BODY, display: 'block' }}>والله نزّل، لا تمسك. أنا بايع من أمس.</span>
          </Piece>
          <Piece color="green" cut={3} lift tilt={1} style={{ padding: '12px 20px', maxWidth: 240, textAlign: 'right' }}>
            <b style={{ ...T_BTN }}>عمتك</b>
            <span style={{ ...T_BODY, display: 'block' }}>لا تستمع للكلام، روح شوف القوائم المالية.</span>
          </Piece>
        </div>
        <Head style={{ ...T_TITLE }}>وش تسوي؟</Head>
        <div className="bs-row">
          <ChoiceCard i={0} w={210} h={140} cut={1} tilt={-1} label="أراجع سببي"
            sub="السعر نزل، لكن سبب شرائي واقف؟"
            onClick={() => choose('review', 'best')} />
          <ChoiceCard i={1} w={210} h={140} cut={3} tilt={1} label="أبيع نص وأنصّف"
            sub="أأمن نص المحفظة"
            onClick={() => choose('half', 'partial')} />
          <ChoiceCard i={2} w={210} h={140} cut={4} tilt={-.5} label="أبيع كل شي"
            sub="ما أقدر أنام وأنا نازل"
            onClick={() => choose('sell', 'wrong')} />
        </div>
        <Hesitate hesitant={f.hesitant} onClick={hesitate} />
        <Note />
      </Screen>
    );
  }

  const mine = f.pick === 'review' ? FAMILY.hold : f.pick === 'half' ? FAMILY.half : FAMILY.sold;
  const headline = f.pick === 'review'
    ? 'سببك واقف، فالسعر ما يدير قرارك.'
    : f.pick === 'half'
      ? 'نصَفْت: خففت الخسارة وما خففت القرار.'
      : ' بعتها في أسوأ يوم.';
  return (
    <LessonBeat stage={stage} stars={stars} won={won} onComplete={onComplete} go={go}
      headline={headline} tone={f.pick === 'review' ? 'orange' : 'red'}
      body={`السهم رجع ${pct(118 - 100)} بعد أسبوعين. سؤال واحد: هل تغيّر سبب الشراء، ولا تغيّر السعر بس؟`}
      scene={
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <OutcomeCard label="لو أصبر على السهم" color="green" cut={3} emphasis value={n(FAMILY.hold)} />
          <OutcomeCard label="لو سرت على يومك" color="red" cut={2} tilt={-2} value={n(FAMILY.sold)} />
          <Piece color="ink" cut={4} lift style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ ...T_LABEL, opacity: .85 }}>اللي صار لك</span>
            <span style={{ ...T_MARK }}>{n(mine)} ريال</span>
          </Piece>
        </div>
      } />
  );
}

/* ============================================================
   b-coaster — الموجة الهائلة
   ============================================================ */

const CP = [[0, .30], [.12, .12], [.26, .48], [.38, .28], [.56, .86], [.74, .40], [.86, .14], [1, .06]];
const DIP = .56;
const TOPX = .9;

function yAt(x) {
  for (let i = 0; i < CP.length - 1; i++) {
    const [x0, y0] = CP[i];
    const [x1, y1] = CP[i + 1];
    if (x <= x1) {
      const m = (1 - Math.cos(((x - x0) / (x1 - x0)) * Math.PI)) / 2;
      return y0 * (1 - m) + y1 * m;
    }
  }
  return CP[CP.length - 1][1];
}

function Track({ W = 760, H = 250, cartX = DIP, ghostX, labels }) {
  const N = 56;
  const strips = [];
  const sup = [];
  for (let i = 0; i < N; i++) {
    const a = i / N;
    const b = (i + 1) / N;
    const x0 = a * W;
    const y0 = yAt(a) * H;
    const x1 = b * W;
    const y1 = yAt(b) * H;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    strips.push(
      <span key={i} style={{
        position: 'absolute', left: x0 + len / 2 - len / 2, top: (y0 + y1) / 2 - 5,
        width: len + 3, height: 10, background: 'var(--ink)', opacity: i % 2 ? .9 : .5,
        transform: `rotate(${ang}deg)`,
      }} />
    );
    if (i % 6 === 3) {
      sup.push(<span key={`s${i}`} style={{ position: 'absolute', left: (x0 + x1) / 2 - 3, top: (y0 + y1) / 2, width: 6, height: H - (y0 + y1) / 2 + 20, background: 'var(--line)' }} />);
    }
  }
  const cart = (x, ghost) => {
    const y = yAt(x) * H;
    const ang = Math.atan2(yAt(x + .01) * H - yAt(x - .01) * H, .02 * W) * 180 / Math.PI;
    return (
      <span style={{
        position: 'absolute', left: x * W, top: y - 5,
        transform: `translate(-50%,-100%) rotate(${ang}deg)`, transformOrigin: '50% 100%',
        zIndex: 2, opacity: ghost ? .35 : 1,
      }}>
        <Piece color={ghost ? 'cream' : 'orange'} cut={3} lift={!ghost}
          style={{ width: 118, height: 50, display: 'grid', placeItems: 'center', outline: ghost ? '2px dashed var(--ink)' : 'none' }}>
          <span style={T_LABEL}>محفظتك</span>
        </Piece>
        <span style={{ position: 'absolute', bottom: -8, left: 18, width: 16, height: 16, background: 'var(--ink)', clipPath: 'var(--circle)' }} />
        <span style={{ position: 'absolute', bottom: -8, right: 18, width: 16, height: 16, background: 'var(--ink)', clipPath: 'var(--circle)' }} />
      </span>
    );
  };
  return (
    <div style={{ position: 'relative', width: W, height: H + 20, direction: 'ltr', flex: 'none', maxWidth: '100%' }}>
      {sup}{strips}
      {ghostX != null && cart(ghostX, true)}
      {cart(cartX)}
      {(labels || []).map((l, i) => (
        <div key={i} style={{ position: 'absolute', left: l.x * W, top: yAt(l.x) * H + (l.dy || -110), transform: 'translateX(-50%)', zIndex: 3, direction: 'rtl' }}>
          {l.el}
        </div>
      ))}
    </div>
  );
}

function CoasterStage({ stage, go, player, onComplete }) {
  const { f, choose, hesitate, stars, won } = useFlow(stage);

  if (!f.pick) {
    return (
      <Screen>
        <StageTag stage={stage} />
        <Head>أنت في أعمق نزلة… والناس حولك يبيعون.</Head>
        <Track labels={[
          { x: .45, dy: -150, el: <span style={{ '--r': '-8deg', animation: 'bs-float .5s ease-in-out infinite alternate' }}><Chip color="red" lift big>يبيعون</Chip></span> },
          { x: .68, dy: -130, el: <span style={{ '--r': '6deg', animation: 'bs-float .6s ease-in-out infinite alternate' }}><Chip color="cream" lift big>يشترون القمة</Chip></span> },
        ]} />
        <Cap>مسار السوق · نسبة محفظتك من 100</Cap>
        <div className="bs-row">
          <ChoiceCard i={0} w={210} h={140} cut={1} tilt={-1} label="أصبر وأكمل"
            sub="ما غيّرت سببه، بس السعر مزاج"
            onClick={() => choose('hold', 'best')} />
          <ChoiceCard i={1} w={210} h={140} cut={3} tilt={1} label="أبيع نص"
            sub="أأمن شوي"
            onClick={() => choose('half', 'partial')} />
          <ChoiceCard i={2} w={210} h={140} cut={4} tilt={-.5} label="نزّلني الحين"
            sub="خلاص ما أقدر"
            onClick={() => choose('sell', 'wrong')} />
        </div>
        <Hesitate hesitant={f.hesitant} onClick={hesitate} />
        <Note />
      </Screen>
    );
  }

  const mine = f.pick === 'hold' ? 11800 : f.pick === 'half' ? 9800 : 7800;
  return (
    <LessonBeat stage={stage} stars={stars} won={won} onComplete={onComplete} go={go}
      tone={f.pick === 'hold' ? 'orange' : 'red'}
      headline={f.pick === 'hold' ? 'الصبر هو نص اللعبة.' : f.pick === 'half' ? 'نصّفت، والنتيجة بين النصين.' : 'نزّلت في القاع، والسوق رجع فوقك.'}
      body="الخسارة توجع أكثر من الفرح بسعادة، وهذا هو الفخ كله."
      scene={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
          <CoasterRide pick={f.pick} />
          <Compare rows={[
            { label: 'لو صبرت للآخر', value: '↑11,800 ريال', sub: 'بعد موجة الصعود', color: 'green', emphasis: true },
            { label: 'لو نزلت في القاع', value: '↓7,800 ريال', sub: 'خسرت 22% دفعة وحدة', color: 'red' },
            { label: 'محفظتك الآن', value: `${n(mine)} ريال`, sub: 'حسب قرارك', color: 'faint' },
          ]} />
        </div>
      } />
  );
}

/** Mounted with the lesson beat — the cart rides the track up after the beat lands. */
function CoasterRide({ pick }) {
  const ride = useLater(800);
  const x = useTween(ride ? TOPX : DIP, 1700);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
      <Head>{ride ? 'السوق كمّل بعد ما سبقت.' : 'ثواني…'}</Head>
      <Track cartX={x} labels={pick === 'hold' ? [] : [
        { x: DIP, dy: -100, el: <Chip color="red" lift>نزلت هنا</Chip> },
        { x: TOPX, dy: -100, el: <Chip color="green" lift>السوق كمّل</Chip> },
      ]} />
      <Cap>مسار السوق · نسبة محفظتك من 100</Cap>
    </div>
  );
}

/* ============================================================
   b-ice — آلة الزمن
   ============================================================ */

const ICE = { start: 20000, now: 112, log: [
  { day: 8, act: 'بعت', why: 'السهم نزل يومين', p: 88 },
  { day: 19, act: 'شريت', why: 'رجع طالع', p: 124 },
  { day: 26, act: 'بعت', why: 'خفت يرجع ينزل', p: 96 },
] };

function IceStage({ stage, go, player, onComplete }) {
  const { f, choose, hesitate, stars, won } = useFlow(stage);
  const watching = useLater(700);
  const hold = Math.round(ICE.start * ICE.now / 100);
  const reacted = Math.round(ICE.start * 0.88 * 0.96 / 1.24);
  const cost = hold - reacted;

  if (!f.pick) {
    return (
      <Screen>
        <StageTag stage={stage} />
        <Head>ارجع قبل 30 يوم وشوف وش كنت تسوي.</Head>
        <Strip items={ICE.log.map((e) => ({
          top: `يوم ${n(e.day)}`, value: `${e.act} @ ${n2(e.p)} ريال`, sub: e.why,
          color: e.act === 'بعت' ? 'red' : 'green',
        }))} />
        <Lead>هذا سجل قراراتك، وراجعه المراقب معك.</Lead>
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
          <EyeOrb size={watching ? 72 : 56} alert={false} />
          {watching && (
            <TalkingOrb color="blue" speaker="مراقب المخاطر"
              text="ثلاث قرارات في ثلاثين يوم. كل وحدة لفتها حول محور السعر." />
          )}
        </div>
        <Head style={{ ...T_TITLE }}>لو معك نقد اليوم بدل هذا السهم، وش تسوي به؟</Head>
        <div className="bs-row">
          <ChoiceCard i={0} w={210} h={140} cut={1} tilt={-1} label="أشتريه أول"
            sub="نفس السؤال على نفس السعر"
            onClick={() => choose('buy', 'best')} />
          <ChoiceCard i={1} w={210} h={140} cut={3} tilt={1} label="أبيع الرابح وأمسك الخاسر"
            sub="أخفف الخسارة الظاهرة"
            onClick={() => choose('split', 'partial')} />
          <ChoiceCard i={2} w={210} h={140} cut={4} tilt={-.5} label="أبيع كل شي"
            sub="أرتاح وأشوف"
            onClick={() => choose('sell', 'wrong')} />
        </div>
        <Hesitate hesitant={f.hesitant} onClick={hesitate} />
        <Note />
      </Screen>
    );
  }

  return (
    <LessonBeat stage={stage} stars={stars} won={won} onComplete={onComplete} go={go}
      tone={f.pick === 'buy' ? 'orange' : 'red'}
      headline={f.pick === 'buy' ? 'اليوم تسأل قبل ما تبيع.' : f.pick === 'split' ? 'خففت الألم، وما عالجت السبب.' : 'رتّاح يوم، وندمت بعدين.'}
      body={`لو ما تصرفت من اليوم صفر: ${n(hold)} ريال. وأنت تنتهي بـ ${n(reacted)} ريال.`}
      scene={
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <IceWatch />
          <Compare rows={[
            { label: 'لو سويت ولا شي', value: `${n(hold)} ريال`, color: 'green', emphasis: true },
            { label: 'لو سويت قراراتك الثلاث', value: `${n(reacted)} ريال`, color: 'faint' },
            { label: 'الفرق', value: `↓${n(cost)} ريال`, color: 'red' },
          ]} />
        </div>
      } />
  );
}

/** The replay ends with the watcher going red, a beat after the screen lands. */
function IceWatch() {
  const replayed = useLater(1200);
  return <EyeOrb alert={replayed} size={60} />;
}

/* ============================================================
   b-arena — ساحة التذبذب
   ============================================================ */

const STK = [
  { n: 'صقر للتقنية', ch: 4.2, c: 'blue' },
  { n: 'نخلة للتطوير', ch: -2.1, c: 'green' },
  { n: 'موجة للطاقة', ch: 1.3, c: 'orange' },
  { n: 'قمرة للاتصالات', ch: -0.8, c: 'cream' },
  { n: 'رمال للتعدين', ch: 3.5, c: 'red' },
  { n: 'واحة للأغذية', ch: -1.6, c: 'ink' },
];
const CALM = [20, 15, 20, 15, 15, 15];
const CROWDED = [70, 6, 6, 6, 6, 6];

function ArenaStage({ stage, go, player, onComplete }) {
  const { f, choose, hesitate, stars, won } = useFlow(stage);
  const alert = useLater(2800);
  const budget = player && player.investable > 0 ? player.investable : 40000;
  const alloc = alert ? CROWDED : CALM;

  if (!f.pick) {
    return (
      <Screen>
        <StageTag stage={stage} />
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip color="ink">اليوم 12 من 30</Chip>
          <Chip color="cream" lift>محفظتك: {sar(budget)}</Chip>
          <Chip color={alert ? 'red' : 'faint'} lift={alert}>إنذارات المراقب: {alert ? 1 : 0}</Chip>
        </div>
        <Head>{alert ? 'الموجة جت. 70% من محفظتك في سهم واحد.' : 'ساحة التذبذب. ثماني محطات، وتذبذب على طول.'}</Head>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'center', alignItems: 'center' }}>
          {STK.map((s, i) => {
            const big = alert && i === 0;
            return (
              <span key={s.n} style={{ '--r': `${[-1.5, 1, -.5, 1.5, -1, .5][i]}deg`, animation: 'bs-float .9s ease-in-out infinite alternate', animationDelay: `${-i * .17}s` }}>
                <Piece color={s.c} cut={(i % 4) + 1} lift style={{ width: big ? 250 : 190, minHeight: 120, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', transition: 'width .5s' }}>
                  <span style={{ ...T_BTN }}>{s.n}</span>
                  <Piece as="span" color="cream" cut={2} style={{ padding: '2px 12px' }}>
                    <span style={{ ...T_LABEL, color: s.ch > 0 ? 'var(--green)' : 'var(--red)' }}>{dir(s.ch)}</span>
                  </Piece>
                  <span style={{ ...T_BTN, fontVariantNumeric: 'tabular-nums' }}>حصتك {n(alloc[i])}%</span>
                </Piece>
              </span>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
          <EyeOrb alert={alert} size={60} />
          {alert && <TalkingOrb color="red" speaker="مراقب المخاطر" text="انتبه: 70% من فلوسك في سهم واحد. هذا مخاطرة واحدة على كل محفظتك." />}
        </div>
        <Head style={{ ...T_TITLE }}>الحين: وش تسوي بحجم مركزك؟</Head>
        <div className="bs-row">
          <ChoiceCard i={0} w={200} h={130} disabled={!alert} cut={1} tilt={-1} label="أسيبها 70%"
            sub="السهم الصاعد أقوى"
            onClick={() => choose('keep', 'wrong')} />
          <ChoiceCard i={1} w={200} h={130} disabled={!alert} cut={3} tilt={1} label="أنزّلها 40%"
            sub="والباقي نقد"
            onClick={() => choose('half', 'partial')} />
          <ChoiceCard i={2} w={200} h={130} disabled={!alert} cut={4} tilt={-.5} label="أنزّلها 20%"
            sub="وأوزّع الباقي"
            onClick={() => choose('small', 'best')} />
        </div>
        <Hesitate hesitant={f.hesitant} onClick={hesitate} />
        <Note>محاكاة تعليمية · الأرقام أمثلة توضيحية</Note>
      </Screen>
    );
  }

  const mine = f.pick === 'keep' ? 0.7 : f.pick === 'half' ? 0.4 : 0.2;
  const risk = Math.round(budget * mine * 0.3);
  return (
    <LessonBeat stage={stage} stars={stars} won={won} onComplete={onComplete} go={go}
      tone={f.pick === 'small' ? 'orange' : 'red'}
      headline={f.pick === 'small' ? 'حجم المركز أهم من نقطة الدخول.' : 'الخلاف على السهم، والمخاطرة كانت على المحفظة كلها.'}
      body={`لو هذا السهم نزل 30%، خسارتك على المحفظة كلها ${pct(mine * 30)} — يعني ${sar(risk)}.`}
      scene={
        <Compare rows={[
          { label: 'حصة 70% في سهم واحد', value: `↓${n(budget * 0.7 * 0.3)} ريال`, sub: 'مخاطرة 21% من المحفظة', color: 'red' },
          { label: 'حصة 40%', value: `↓${n(budget * 0.4 * 0.3)} ريال`, sub: 'مخاطرة 12%', color: 'faint' },
          { label: 'حصة 20%', value: `↓${n(budget * 0.2 * 0.3)} ريال`, sub: 'مخاطرة 6%', color: 'green', emphasis: true },
        ]} />
      } />
  );
}

/* ============================================================
   Router-facing exports
   ============================================================ */

const KINDS = {
  'team-vs-star': TeamStage,
  day27: Day27Stage,
  family: FamilyStage,
  coaster: CoasterStage,
  ice: IceStage,
  arena: ArenaStage,
};

export function BeginnerStages({ stage, go, player, onComplete }) {
  const props = { stage, go, player, onComplete };
  const Stage = KINDS[stage && stage.kind];

  if (!Stage) {
    return (
      <Screen>
        <StageTag stage={stage || { id: 'b-team', title: 'مرحلة' }} />
        <Head>ما وصلني نوع هالمرحلة.</Head>
        <Feet>
          <Button onClick={() => go('journey')}>كمّل</Button>
        </Feet>
        <Note />
      </Screen>
    );
  }
  return <Stage {...props} />;
}

export function StageResult({ stage, won, stars, headline, lesson, go, player, onComplete }) {
  const entry = BY_ID[stage && stage.concept] || BY_ID.diversification;
  const value = clampStars(stars || 1);
  const best = (player && player.stars && player.stars[stage.id]) || 0;

  useReport(stage, value, !!won, onComplete);

  return (
    <Screen>
      <StageTag stage={stage} />
      <div style={{ display: 'flex', gap: 'var(--space-7)', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Piece color={won ? 'green' : 'orange'} cut={3} lift tilt={won ? -2 : 2}
          style={{ padding: '26px 40px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
          <StarRating value={value} max={stage.maxStars || 5} size={62} animate delay={220} step={240}
            label={`نجومك ${value} من 5`} />
          <span style={T_LABEL}>{won ? 'نجحت' : 'هالم مرة ما نجحت'}</span>
          <span style={T_CAP}>{n(value)} من 5 نجوم</span>
        </Piece>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 560, minWidth: 0 }}>
          <Head>{headline}</Head>
          <Cap>
            {entry.title}
            {best > 0 && ` · أحسن نتيجة لك ${n(best)} من 5`}
          </Cap>
        </div>
      </div>
      <TalkingOrb text={lesson || entry.principles[0]} color={won ? 'orange' : 'red'} />
      <Feet>
        <Button onClick={() => go('journey')}>كمّل</Button>
        <Button variant="ghost" onClick={() => { retryEpoch += 1; go(`stage/${stage.id}`, { retry: true }); }}>جرّب مرة ثانية</Button>
      </Feet>
      <Note />
    </Screen>
  );
}
