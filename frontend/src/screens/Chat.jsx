import React from 'react';
import { Button, Piece } from '../components/core/index.jsx';
import { CoachBubble, Assistant } from '../components/assistant/index.jsx';
import { StarRating } from '../components/progress/index.jsx';
import { orchestrator } from '../agents/index.js';
import { backendStatus, resetBackendProbe } from '../agents/llm.js';
import { usePlayer } from '../store/usePlayer.js';
import * as newsAgent from '../agents/newsAgent.js';

/* ============================================================
   الشات — Agent Chatbot
   ------------------------------------------------------------
   The agent fleet as a conversation. The learner picks who they want
   to talk to, or lets the orchestrator route. Every reply carries its
   citations, its source (live model vs composed offline), and — when
   the compliance chokepoint blocks it — the refusal itself.
   ============================================================ */

/* The lanes from the architecture: one fleet, tier is a policy input. */
export const AGENTS = [
  {
    id: 'auto', name: 'الموجّه', sub: 'يختار الوكيل المناسب', color: 'ink', icon: '◎',
    blurb: 'خلّه يوجّه — يشوف سؤالك ويكمّله بالوكيل المناسب.',
    starters: ['ما معنى التنويع؟', 'نبني مرحلة عن وقف الخسارة', 'وش الأخبار على سهمي؟', 'هل هذا صحيح: أركّز كل استثماري في بنك واحد'],
  },
  {
    id: 'knowledge', name: 'وكيل المعرفة', sub: 'أسئلة من كتب حقيقية', color: 'orange', icon: '؟',
    blurb: 'يسترجع من مكتبة ٢٥ درساً ويخبرك اسم الكتاب.',
    starters: ['متى أسأل عن حجم المركز؟', 'ما الفرق بين التنويع والتركيز؟'],
  },
  {
    id: 'stageBuilder', name: 'وكيل المراحل', sub: 'يبني لك مرحلة', color: 'green', icon: '＋',
    blurb: 'اقول له وش ما فهمت، يبني لك مرحلة تقدر تلعبها.',
    starters: ['ما فهمت الفومو، ابني لي مرحلة', 'نبني مرحلة عن التوزيع', 'نبني تحدي عن الصبر'],
  },
  {
    id: 'news', name: 'وكيل الأخبار', sub: 'أحداث من بياناتك', color: 'blue', icon: '▤',
    blurb: 'قصص مبنية على حركات حقيقية في بيانات تاسي ٢٠١٠–٢٠١٢.',
    starters: ['وش أهم خبر في البوابة؟', 'أخبار سهمي الحالي', 'وش صار في قطاع الاتصالات؟'],
  },
  {
    id: 'verify', name: 'المدقّق', sub: 'يتحقق من كلامك', color: 'red', icon: '✓',
    blurb: 'يعطيك رأيه في دعوى ما سمعتها — ويقول لك حتى لو غلط.',
    starters: ['هل التنويع يغني عن كل شي؟', 'هل الصبر دايماً صح؟', 'هل أكبر سهم دائماً أفضل؟'],
  },
];

const TYPING = 'بصير يفكر…';

export function Chat({ go, player, market }) {
  const playerStore = usePlayer();
  const p = player || playerStore;
  const [agent, setAgent] = React.useState('auto');
  const [log, setLog] = React.useState([]);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [live, setLive] = React.useState(null);
  const endRef = React.useRef(null);
  const boxRef = React.useRef(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log, busy]);

  const probe = React.useCallback(async () => {
    resetBackendProbe();
    setLive(null);
  }, []);
  React.useEffect(() => { probe(); }, [probe]);

  const active = AGENTS.find((a) => a.id === agent) || AGENTS[0];

  const send = async (raw) => {
    const question = String(raw ?? text).trim();
    if (!question || busy) return;
    setText('');
    setBusy(true);
    setLog((l) => [...l, { who: 'me', text: question, at: new Date().toLocaleTimeString('en-GB') }]);

    let res;
    try {
      res = await orchestrator.ask(question, {
        level: p.level || 'beginner',
        tier: p.tier,
        agent,                                   // explicit pick overrides routing
        company: market?.meta?.[market.selected]?.ar,
        companyId: market?.selected,
        budget: p.investable || 1000000,
        portfolio: market?.portfolio?.(),
        stories: market?.ready ? newsFor(market) : [],
      });
    } catch (e) {
      res = { agent: 'knowledge', text: 'صار خلل بسيط عندي. جرّب سؤال ثاني.', error: String(e?.message || e) };
    }

    setBusy(false);
    setLog((l) => [...l, {
      who: 'agent',
      agent: res.agent,
      intent: res.intent,
      text: res.text,
      citations: res.citations || [],
      blocked: !!res.blocked,
      gated: !!res.gated,
      verdict: res.verdict || null,
      stage: res.stage || null,
      source: res.source,
      at: new Date().toLocaleTimeString('en-GB'),
    }]);
  };

  const onOpenStage = (stage) => {
    go('stage/custom', { custom: stage });
  };

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'row' }}>
      {/* ——— agent roster ——— */}
      <aside
        className="scroll"
        style={{
          width: 264, flex: 'none', borderInlineEnd: '2px solid var(--line)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 16px 12px', borderBottom: '2px solid var(--line)' }}>
          <strong style={{ font: '700 17px/1.4 var(--f-sans)', display: 'block' }}>الوكلاء</strong>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>أسطول بصير</span>
        </div>
        {AGENTS.map((a) => {
          const on = a.id === agent;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAgent(a.id)}
              style={{
                textAlign: 'right', border: 0, background: on ? 'var(--ink)' : 'transparent',
                color: on ? 'var(--cream)' : 'var(--ink)', cursor: 'pointer',
                padding: '14px 16px', borderBottom: '1px solid var(--line)',
                display: 'flex', gap: 12, alignItems: 'center',
              }}
            >
              <span style={{
                width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center',
                background: on ? 'var(--cream)' : 'var(--ink-faint)',
                color: on ? 'var(--ink)' : 'var(--ink)',
                font: '700 17px/1 var(--f-display)',
              }}>{a.icon}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ font: '700 15px/1.3 var(--f-sans)' }}>{a.name}</span>
                <span style={{ font: 'var(--type-caption)', opacity: .8 }}>{a.sub}</span>
              </span>
            </button>
          );
        })}

        <div style={{ marginTop: 'auto', padding: '14px 16px', borderTop: '2px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%',
              background: live === true ? 'var(--green)' : live === false ? 'var(--orange)' : 'var(--line-strong)',
            }} />
            <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
              {live === true ? 'نموذج حي متصل' : live === false ? 'بدون اتصال — ردود مركّبة' : 'جارٍ الفحص…'}
            </span>
          </div>
          <button type="button" onClick={probe}
            style={{ background: 'transparent', border: '2px solid var(--line-strong)', padding: '8px 12px', cursor: 'pointer', font: '700 13px/1 var(--f-sans)', color: 'var(--ink)', width: '100%' }}>
            إعادة الفحص
          </button>
        </div>
      </aside>

      {/* ——— conversation ——— */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <header style={{ padding: '16px 22px', borderBottom: '2px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Assistant state={busy ? 'speaking' : 'listening'} size={40} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <strong style={{ font: '700 19px/1.3 var(--f-sans)', display: 'block' }}>{active.name}</strong>
            <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{active.blurb}</span>
          </div>
          <Button variant="ghost" style={{ minHeight: 40, padding: '0 16px', font: '700 14px/1 var(--f-sans)' }} onClick={() => go('library')}>
            المكتبة
          </Button>
        </header>

        <div ref={boxRef} className="scroll" style={{ flex: 1, minHeight: 0, padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {log.length === 0 && (
            <div style={{ margin: 'auto', maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
              {/* the greeting is a real message, not a placeholder — it enters
                  the transcript so the conversation has a proper opener */}
              <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '4px 12px', background: 'var(--orange)', color: 'var(--cream)',
                  font: '700 13px/1.4 var(--f-sans)', alignSelf: 'flex-start',
                }}>
                  {AGENTS.find((a) => a.id === 'auto')?.name}
                </div>
                <div style={{ padding: '18px 24px', background: 'var(--cream)', boxShadow: 'inset 0 0 0 2px var(--line-strong)', font: '500 18px/1.75 var(--f-text)', textAlign: 'right' }}>
                  هلا وسهلا معك بصير.
                  <br />
                  أنا هنا أعلّمك كيف تقرر بنفسك — ما أقرر عنك، وما أعطيك توصية شراء أو بيع.
                  <br />
                  اسألني أي شي، أو اختر وكيل من اليمين، أو اطلب مني نبني لك مرحلة.
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {(active.starters || []).map((s, i) => (
                  <button key={i} type="button" onClick={() => send(s)}
                    style={{ border: '2px solid var(--line-strong)', background: 'transparent', color: 'var(--ink)', padding: '11px 16px', cursor: 'pointer', font: '500 15px/1.4 var(--f-sans)', textAlign: 'right' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {log.map((m, i) => m.who === 'me' ? (
            <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              <Piece color="blue" cut={3} style={{ padding: '13px 20px', font: '500 17px/1.65 var(--f-text)' }}>{m.text}</Piece>
              <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{m.at}</span>
            </div>
          ) : (
            <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '4px 12px', font: '700 13px/1.4 var(--f-sans)',
                  background: m.blocked ? 'var(--red)' : 'var(--orange)', color: 'var(--cream)',
                }}>
                  {AGENTS.find((a) => a.id === m.agent)?.name || 'بصير'}
                </span>
                <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{m.at}</span>
              </div>

              <div style={{ padding: '18px 24px', background: 'var(--cream)', boxShadow: 'inset 0 0 0 2px var(--line-strong)', font: '500 18px/1.75 var(--f-text)' }}>
                {m.text}
              </div>

              {m.gated && (
                <Button style={{ minHeight: 44, padding: '0 20px', font: '700 15px/1 var(--f-sans)' }} onClick={() => go('plans')}>
                  شوف الخطط
                </Button>
              )}

              {m.stage && (
                <Button variant="ghost" style={{ minHeight: 44, padding: '0 20px', font: '700 15px/1 var(--f-sans)' }} onClick={() => onOpenStage(m.stage)}>
                  العب المرحلة
                </Button>
              )}

              {m.verdict?.support?.length > 0 && (
                <div style={{ padding: '12px 16px', boxShadow: 'inset 0 0 0 2px var(--line)', font: 'var(--type-caption)' }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>المدقّق:</strong>
                  {m.verdict.support.map((c) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>{c.title}</span>
                      <span style={{ color: 'var(--ink-muted)' }}>{c.author} — {c.source}</span>
                    </div>
                  ))}
                </div>
              )}

              {(m.citations?.length > 0 || m.source) && (
                /* the source sits BELOW the answer, on its own line, never
                   inside the message body */
                <div style={{
                  display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
                  paddingInlineStart: 4, borderInlineStart: '2px solid var(--line)',
                  font: 'var(--type-caption)', color: 'var(--ink-muted)',
                }}>
                  {m.citations.length > 0 && (
                    <span>المصدر: {m.citations.slice(0, 3).map((c) => c.title).join('، ')}</span>
                  )}
                  {m.source && (
                    <span style={{ padding: '2px 8px', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                      {m.source === 'llm' ? 'نموذج حي' : 'مركّب بدون اتصال'}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Assistant state="speaking" size={34} />
              <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{TYPING}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: '2px solid var(--line)', background: 'var(--cream)' }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`اكتب سؤالك لـ${active.name}…`}
            style={{
              all: 'unset', flex: 1, minWidth: 0, padding: '14px 18px',
              boxShadow: 'inset 0 0 0 2px var(--line-strong)',
              font: '500 17px/1.5 var(--f-text)',
            }}
          />
          <Button type="submit" disabled={busy || !text.trim()} style={{ minHeight: 52, padding: '0 26px' }}>
            أرسل
          </Button>
        </form>
      </main>
    </div>
  );
}

function newsFor(market) {
  try { return newsAgent.generate(market.series, market.meta, { limit: 24, minMove: 3.2 }); }
  catch { return []; }
}