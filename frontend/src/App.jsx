import React from 'react';
import { TopBar } from './components/navigation/index.jsx';
import { Button } from './components/core/index.jsx';
import { Welcome } from './screens/onboarding/Welcome.jsx';
import { Salary, Margin } from './screens/onboarding/Salary.jsx';
import { LevelQuiz } from './screens/Quiz.jsx';
import { Journey } from './screens/Journey.jsx';
import { PathChooser } from './screens/PathChooser.jsx';
import { CoachDock } from './screens/CoachDock.jsx';
import { Chat } from './screens/Chat.jsx';
import { Plans } from './screens/subscription/Plans.jsx';
import { NewsPortal } from './screens/news/NewsPortal.jsx';
import { KnowledgeLibrary } from './screens/library/KnowledgeLibrary.jsx';
import { StageBuilderScreen } from './screens/builder/StageBuilderScreen.jsx';
import { CustomStage } from './screens/builder/CustomStagePlayer.jsx';
import { BeginnerStages, StageResult } from './screens/beginner/BeginnerStages.jsx';
import { IntermediateStages, TrapResult } from './screens/intermediate/IntermediateStages.jsx';
import { OpenWorld } from './screens/expert/OpenWorld.jsx';
import { STAGE_BY_ID } from './content/stages.js';
import { usePlayer } from './store/usePlayer.js';
import { useMarket } from './store/useMarket.js';

/* ============================================================
   بصير — app shell + router
   ------------------------------------------------------------
   Hash router. The route table is the single source of truth for the
   top bar (step indicator, back button) and the disclaimer.
   ============================================================ */

/* The disclaimer is rendered once by the shell, as the last child of every
   screen. Screens must not render their own copy. */
const ROUTES = {
  welcome:      { C: Welcome,            label: 'الترحيب',   noBar: true },
  choose:       { C: PathChooser,        label: 'اختر مسارك', back: ['الرئيسية', 'welcome'] },
  salary:       { C: Salary,             label: 'كم راتبك؟', step: 1, back: ['الرئيسية', 'welcome'], foot: 'num' },
  margin:       { C: Margin,             label: 'هامشك الحر', step: 2, back: ['راتبك', 'salary'], foot: 'num' },
  quiz:         { C: LevelQuiz,          label: 'اختبار المستوى', step: 3, back: ['الهامش', 'margin'] },
  journey:      { C: Journey,            label: 'خريطة الرحلة', back: ['البداية', 'welcome'] },
  stages:       { C: Journey,            label: 'المراحل', back: ['الرحلة', 'journey'] },
  'stage/:id':  { C: BeginnerStages,     label: 'مرحلة', back: ['الرحلة', 'journey'] },
  chat:         { C: Chat,                label: 'تكلّم مع بصير', back: ['الرحلة', 'journey'] },
  result:       { C: StageResult,        label: 'النتيجة', back: ['الرحلة', 'journey'], foot: 'game' },
  iresult:      { C: TrapResult,         label: 'النتيجة', back: ['الرحلة', 'journey'], foot: 'game' },
  istage:       { C: IntermediateStages, label: 'مرحلة', back: ['الرحلة', 'journey'] },
  openworld:    { C: OpenWorld,          label: 'محاكي السوق', back: ['الرحلة', 'journey'], foot: 'game' },
  plans:        { C: Plans,              label: 'الخطط', back: ['الرحلة', 'journey'] },
  news:         { C: NewsPortal,         label: 'بوابة الأخبار', back: ['الرحلة', 'journey'] },
  library:      { C: KnowledgeLibrary,   label: 'مكتبة المعرفة', back: ['الرحلة', 'journey'] },
  builder:      { C: StageBuilderScreen, label: 'ابنِ مرحلتك', back: ['المكتبة', 'library'] },
};

const FOOT = {
  num: 'كل الأرقام أمثلة توضيحية',
  game: 'تداول افتراضي بفلوس وهمية. ما فيه أي توصية أو نصيحة استثمارية.',
  learn: 'محتوى تعليمي للتوعية المالية. ما فيه أي توصية أو نصيحة استثمارية.',
};

/* Every screen ends with the same centred line. A route may pick a variant;
   anything without one gets the educational default. */
const footFor = (r) => FOOT[r.foot] || FOOT.learn;

const parse = () => {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')) || 'welcome';
  if (ROUTES[raw]) return { id: raw, arg: null };
  const m = raw.match(/^stage\/(.+)$/);
  if (m) return { id: 'stage/:id', arg: m[1] };
  return { id: 'welcome', arg: null };
};

export default function App() {
  const [route, setRoute] = React.useState(parse);
  const [customStage, setCustomStage] = React.useState(null);
  const player = usePlayer();
  const market = useMarket();

  React.useEffect(() => { market.load(); }, [market]);

  React.useEffect(() => {
    const h = () => setRoute(parse());
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);

  /* the coach dock can deep-link into the app */
  React.useEffect(() => {
    const onGo = (e) => go(e.detail);
    const onStage = (e) => { setCustomStage(e.detail); go('stage/custom'); };
    addEventListener('baseer:go', onGo);
    addEventListener('baseer:open-stage', onStage);
    return () => { removeEventListener('baseer:go', onGo); removeEventListener('baseer:open-stage', onStage); };
  });

  const go = React.useCallback((id, opts) => {
    if (opts?.custom) setCustomStage(opts.custom);

    let next;
    if (opts?.fly) {
      next = { id: 'stage/:id', arg: opts.fly };
    } else if (ROUTES[id]) {
      next = { id, arg: null };
    } else {
      // dynamic stage targets like 'stage/custom' or 'stage/b-team'
      const m = String(id).match(/^stage\/(.+)$/);
      if (m) next = { id: 'stage/:id', arg: m[1] };
      else {
        // unknown target: warn loudly instead of silently dumping on welcome
        console.warn(`[router] unknown route "${id}" — falling back to welcome`);
        next = { id: 'welcome', arg: null };
      }
    }

    try { history.replaceState(null, '', '#' + id); } catch { /* file:// */ }
    setRoute(next);
    scrollTo(0, 0);
  }, []);

  /* what the current screen just taught, handed to the result screen */
  const [lastOutcome, setLastOutcome] = React.useState(null);

  const onComplete = React.useCallback((stageId, stars, won, meta) => {
    if (stageId) player.award(stageId, stars);
    setLastOutcome({ stageId, stars, won, meta });
  }, [player]);

  const r = ROUTES[route.id] || ROUTES.welcome;
  const C = r.C;

  const stageArg =
    route.id === 'stage/:id' && route.arg === 'custom'
      ? (customStage || STAGE_BY_ID['b-team'])
      : (STAGE_BY_ID[route.arg] || STAGE_BY_ID['b-team']);

  /* route a stage to the right track renderer */
  const isIntermediate = stageArg?.kind === 'trap';
  const isExpert = stageArg?.kind === 'openworld' || stageArg?.kind === 'size-decision';

  let body;
  if (route.id === 'result') body = <StageResult stage={lastOutcome?.meta?.stage} won={!!lastOutcome?.won} stars={lastOutcome?.stars ?? 0} headline={lastOutcome?.meta?.headline} lesson={lastOutcome?.meta?.lesson} go={go} player={player} onComplete={() => {}} />;
  else if (route.id === 'iresult') body = <TrapResult stage={lastOutcome?.meta?.stage} won={!!lastOutcome?.won} stars={lastOutcome?.stars ?? 0} headline={lastOutcome?.meta?.headline} lesson={lastOutcome?.meta?.lesson} go={go} player={player} onComplete={() => {}} />;
  else if (route.id === 'stage/:id') {
    // agent-built stages carry their own shape, so they get their own player
    body = route.arg === 'custom'
      ? <CustomStage stage={customStage} go={go} player={player} onComplete={onComplete} />
      : isIntermediate
        ? <IntermediateStages stage={stageArg} go={go} player={player} onComplete={onComplete} market={market} />
        : <BeginnerStages stage={stageArg} go={go} player={player} onComplete={onComplete} />;
  } else {
    body = <C go={go} player={player} market={market} customStages={market.customStages} />;
  }

  const dark = false;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: dark ? 'var(--ink)' : 'var(--cream)' }}>
      {!r.noBar && (
        <TopBar onHome={() => go('welcome')} light={dark}>
          {r.step && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{r.label}</span>
          </div>}
          {r.back && (
            <Button variant="ghost" onClick={() => go(r.back[1])}
              style={{ minHeight: 44, padding: '0 20px', font: '700 16px/1 var(--f-sans)' }}>
              {r.back[0]}
            </Button>
          )}
        </TopBar>
      )}

      <div key={route.id + (route.arg || '')} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {body}
      </div>

      {/* last element on the page, centred, never fixed */}
      <p className="bs-disclaimer">{footFor(r)}</p>

      {!r.noBar && player.started && (
        <CoachDock
          player={player}
          market={market}
          company={market.meta[market.selected]?.ar}
          budget={player.investable || 1000000}
        />
      )}
    </div>
  );
}
