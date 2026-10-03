import React from 'react';
import { Assistant, CoachBubble, AssistantTip } from '../components/assistant/index.jsx';
import { Button, Piece } from '../components/core/index.jsx';
import { orchestrator } from '../agents/index.js';
import { useUI } from '../store/useUI.js';

/* ============================================================
   ركن بصير — Coach Dock
   ------------------------------------------------------------
   The floating assistant. Always present, never in the way.

     collapsed  → the orb + a one-line tip
     open       → a chat panel wired to the orchestrator, which routes
                  to the knowledge / stage-builder / news agents.

   Every answer is rendered exactly as the compliance middleware
   returned it. Blocked replies show the refusal, not the original.
   ============================================================ */

const AGENT_LABEL = {
  knowledge: 'بصير · المعرفة',
  knowledgeAgent: 'بصير · المعرفة',
  stageBuilder: 'بصير · بناء المراحل',
  news: 'بصير · الأخبار',
  coach: 'بصير · المراقب',
};

const STARTERS = [
  'ما معنى التنويع؟',
  'متى أبيع؟',
  'نبني مرحلة عن وقف الخسارة',
  'وش الأخبار على سهمي؟',
  'هل هذا صحيح: سعر السهم راح يطلع',
];

export function CoachDock({ player, market, company, budget }) {
  const ui = useUI();
  const open = ui.agentOpen;
  const setOpen = (v) => {
    if (typeof v === 'function') ui.toggleAgent();
    else v ? ui.openAgent() : ui.closeAgent();
  };
  const [state, setState] = React.useState('idle');
  const [text, setText] = React.useState('');
  const [log, setLog] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log, open]);

  const send = async (q) => {
    const question = String(q ?? text).trim();
    if (!question || busy) return;
    setText('');
    setBusy(true);
    setState('speaking');
    setLog((l) => [...l, { who: 'me', text: question }]);

    const res = await orchestrator.ask(question, {
      level: player.level || 'beginner',
      tier: player.tier,
      company,
      budget,
      portfolio: market?.portfolio?.(),
    });

    setState('listening');
    setBusy(false);
    setLog((l) => [...l, {
      who: 'agent',
      agent: res.agent,
      text: res.text,
      citations: res.citations || [],
      blocked: !!res.blocked,
      gated: !!res.gated,
      stage: res.stage || null,
      source: res.source,
      onOpenStage: res.stage ? () => { setOpen(false); window.dispatchEvent(new CustomEvent('baseer:open-stage', { detail: res.stage })); } : null,
    }]);
  };

  const last = log[log.length - 1];
  const tip = !open
    ? (state === 'speaking' ? 'أسمعك… اسأل اللي ببالك' : 'بصير معك — اضغط عليه')
    : null;

  return (
    <>
      {/* orb */}
      <div style={{ position: 'fixed', left: 'clamp(16px,3vw,40px)', bottom: 'clamp(16px,3vw,40px)', zIndex: 60, display: 'flex', alignItems: 'flex-end', gap: 14, flexDirection: 'row' }}>
        {!open && tip && (
          <div dir="rtl">
            <AssistantTip>{tip}</AssistantTip>
          </div>
        )}
        <Assistant
          state={state}
          onClick={() => { setOpen((o) => !o); setState('listening'); }}
          label={open ? 'أغلق المحادثة مع بصير' : 'تكلّم مع بصير'}
        />
      </div>

      {/* panel */}
      {open && (
        <div
          dir="rtl"
          style={{
            position: 'fixed', left: 'clamp(16px,3vw,40px)', bottom: 'clamp(100px,12vw,124px)',
            zIndex: 59, width: 'min(460px, calc(100vw - 32px))',
            maxHeight: 'min(70vh, 640px)', display: 'flex', flexDirection: 'column',
            animation: 'bs-in .3s ease both',
          }}
        >
          <Piece color="ink" cut={2} lift style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            {/* header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderBottom: '2px solid rgba(242,239,227,.2)' }}>
              <strong style={{ font: '700 17px/1.4 var(--f-sans)', color: 'var(--cream)' }}>بصير</strong>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق"
                style={{ border: 0, background: 'none', color: 'var(--cream)', cursor: 'pointer', font: '700 18px/1 var(--f-sans)', padding: 6 }}>
                ✕
              </button>
            </div>

            {/* log */}
            <div className="scroll" style={{ flex: 1, minHeight: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--cream)' }}>
              {log.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>جرّب تسألني:</span>
                  {STARTERS.map((s, i) => (
                    <button key={i} type="button" onClick={() => send(s)}
                      style={{
                        textAlign: 'right', border: '2px solid var(--line-strong)', background: 'transparent',
                        padding: '10px 16px', cursor: 'pointer', font: '500 15px/1.5 var(--f-sans)', color: 'var(--ink)',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {log.map((m, i) => m.who === 'me' ? (
                <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                  <Piece color="blue" cut={3} style={{ padding: '12px 20px', font: '500 17px/1.6 var(--f-text)' }}>
                    {m.text}
                  </Piece>
                </div>
              ) : (
                <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '94%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CoachBubble
                    color={m.blocked ? 'red' : m.agent === 'stageBuilder' ? 'green' : 'orange'}
                    cut={4}
                    speaker={AGENT_LABEL[m.agent] || 'بصير'}
                  >
                    {m.text}
                  </CoachBubble>

                  {m.gated && (
                    <div>
                      <Button variant="ghost" style={{ minHeight: 44, font: '700 15px/1 var(--f-sans)', padding: '0 20px' }} onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('baseer:go', { detail: 'plans' })); }}>
                        شوف الخطط
                      </Button>
                    </div>
                  )}

                  {m.onOpenStage && (
                    <div>
                      <Button style={{ minHeight: 44, font: '700 15px/1 var(--f-sans)', padding: '0 20px' }} onClick={m.onOpenStage}>
                        العب المرحلة
                      </Button>
                    </div>
                  )}

                  {(m.citations?.length > 0 || m.source) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {m.citations.slice(0, 3).map((c, k) => (
                        <span key={k} style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
                          {k > 0 && '· '}{c.title}{c.author ? ` — ${c.author}` : ''}
                        </span>
                      ))}
                      {m.source && (
                        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
                          {m.source === 'llm' ? ' · نموذج حي' : ' · ' + 'بدون اتصال'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {busy && (
                <div style={{ alignSelf: 'flex-start' }}>
                  <Piece color="faint" cut={2} style={{ padding: '12px 20px', font: 'var(--type-caption)' }}>بصير يفكر…</Piece>
                </div>
              )}

              <div style={{ alignSelf: 'flex-start' }}>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('baseer:go', { detail: 'chat' }))}
                  style={{
                    background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
                    font: '700 14px/1 var(--f-sans)', color: 'var(--blue)',
                    textDecoration: 'underline', textUnderlineOffset: 6, textDecorationThickness: 2,
                  }}
                >
                  افتح الشات الكامل واختر الوكيل
                </button>
              </div>

              <div ref={endRef} />
            </div>

            {/* composer */}
            <form onSubmit={(e) => { e.preventDefault(); send(); }}
              style={{ display: 'flex', gap: 8, padding: 12, borderTop: '2px solid var(--line)' }}>
              <input
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder="اسأل بصير…"
                style={{
                  all: 'unset', flex: 1, minWidth: 0, padding: '10px 14px',
                  boxShadow: 'inset 0 0 0 2px var(--line-strong)', font: '500 16px/1.5 var(--f-text)',
                }}
              />
              <Button type="submit" disabled={busy || !text.trim()} style={{ minHeight: 46, padding: '0 24px', font: '700 15px/1 var(--f-sans)' }}>
                أرسل
              </Button>
            </form>
          </Piece>
        </div>
      )}
    </>
  );
}
