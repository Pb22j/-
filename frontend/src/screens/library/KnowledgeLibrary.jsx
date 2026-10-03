import React from 'react';
import { Piece, Button, Chip } from '../../components/core/index.jsx';
import { CoachBubble } from '../../components/assistant/index.jsx';
import * as knowledge from '../../agents/knowledgeAgent.js';
import { LEVELS } from '../../store/usePlayer.js';
import { n } from '../../lib/format.js';

/* ============================================================
   مكتبة المعرفة — Knowledge Library
   ------------------------------------------------------------
   The retrieval corpus made browsable: 25 condensed lessons, each
   with a summary, the principles, the pitfalls and one probe
   question. The ask panel goes through the knowledge agent, which
   cites the entry and the book it drew on, and the badge always
   states plainly whether a live model answered or the answer was
   composed offline from the same corpus.
   ============================================================ */

const LEVEL_AR = (l) => LEVELS[l]?.ar || l;

/** Where the answer came from — always visible, never implied. */
function SourceBadge({ source, blocked }) {
  const live = source === 'llm';
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
      {live
        ? <Chip color="green" cut={3}>الجواب من موديل حيّ</Chip>
        : <Chip color="faint" cut={3}>الجواب مركّب بدون اتصال</Chip>}
      <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
        {live
          ? 'ركّبته بصير عبر الموديل، والقاعدة تحته من المكتبة نفسها.'
          : 'ما فيه اتصال بالموديل، فركّبته بصير مباشرة من مقتطفات المكتبة. نفس المحتوى.'}
      </span>
      {blocked ? <Chip color="red" cut={2}>مقيّد</Chip> : null}
    </div>
  );
}

function AskPanel({ level, onAnswer, busy }) {
  const [q, setQ] = React.useState('');
  const submit = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || busy) return;
    onAnswer(text);
  };
  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ font: 'var(--type-label)' }}>اسأل بصير</span>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="اكتب سؤالك عن أي مبدأ، مثل: متى أبيع؟"
          style={{ background: 'transparent', border: '2px solid var(--line-strong)', borderRadius: 0, padding: '14px 16px', font: 'var(--type-body)', width: '100%' }} />
      </label>
      <Button type="submit" disabled={busy || !q.trim()}>
        {busy ? 'بصير يفكر' : 'اسأل'}
      </Button>
      <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)', paddingBottom: 14 }}>
        بيجاوب على مستوى {LEVEL_AR(level)}
      </span>
    </form>
  );
}

function Answer({ reply }) {
  return (
    <Piece color="orange" cut={4} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', animation: 'bs-in .35s var(--ease-enter) both' }}>
      <SourceBadge source={reply.source} blocked={reply.blocked} />

      <div style={{ display: 'flex', justifyContent: 'center', direction: 'ltr' }}>
        <CoachBubble speaker="بصير">{reply.text}</CoachBubble>
      </div>

      {reply.citations?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <strong style={{ font: 'var(--type-label)' }}>المصادر</strong>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {reply.citations.map((c, i) => (
              <li key={c.id} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'baseline', flexWrap: 'wrap', font: 'var(--type-caption)' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{n(i + 1)}</span>
                <span style={{ fontWeight: 700 }}>{c.title}</span>
                <span>{c.author}</span>
                <span style={{ color: 'var(--ink-muted)' }}>{c.source}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Piece>
  );
}

/** The reading sheet: the whole entry, opened in place. */
function ReadingSheet({ entry, onClose }) {
  return (
    <Piece color="cream" cut={3} lift style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', animation: 'bs-in .3s var(--ease-enter) both' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip color="blue" cut={3}>{LEVEL_AR(entry.level)}</Chip>
          {entry.tags?.filter((t) => /[\u0600-\u06FF]/.test(t)).slice(0, 3).map((t) => <Chip key={t} color="faint" cut={2}>{t}</Chip>)}
        </div>
        <h2 style={{ font: 'var(--type-headline)', margin: 0 }}>{entry.title}</h2>
        <p style={{ font: 'var(--type-caption)', margin: 0, color: 'var(--ink-muted)' }}>
          {entry.author} · {entry.source}
        </p>
      </header>

      <p style={{ font: 'var(--type-lead)', margin: 0 }}>{entry.summary}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <strong style={{ font: 'var(--type-label)' }}>المبادئ</strong>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {entry.principles?.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', font: 'var(--type-body)' }}>
                <span aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}>—</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <strong style={{ font: 'var(--type-label)' }}>الفخاخ</strong>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {entry.pitfalls?.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', font: 'var(--type-body)' }}>
                <span aria-hidden="true" style={{ flex: 'none', marginTop: 2, color: 'var(--red)', fontWeight: 700 }}>—</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {entry.probe && (
        <Piece color="faint" cut={2} style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: 'var(--type-label)', fontWeight: 700 }}>سؤال تامل على نفسك</span>
          <span style={{ font: 'var(--type-body)' }}>{entry.probe}</span>
        </Piece>
      )}

      <div>
        <Button variant="quiet" onClick={onClose}>رجع لقائمة المبادئ</Button>
      </div>
    </Piece>
  );
}

function EntryCard({ entry, onOpen }) {
  return (
    <button type="button" onClick={onOpen}
      style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'right' }}>
      <Piece color="cream" cut={2} lift style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0, height: '100%' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip color="blue" cut={3}>{LEVEL_AR(entry.level)}</Chip>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{entry.author}</span>
        </div>
        <strong style={{ font: 'var(--type-title)' }}>{entry.title}</strong>
        <span style={{ font: 'var(--type-body)', color: 'var(--ink-muted)' }}>{entry.summary}</span>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)', marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
          {entry.source} · افتح
        </span>
      </Piece>
    </button>
  );
}

export function KnowledgeLibrary({ go, player }) {
  const level = player.level || 'beginner';
  const [allLevels, setAllLevels] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [openId, setOpenId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [reply, setReply] = React.useState(null);

  const list = allLevels ? knowledge.browse(null) : knowledge.browse(level);

  const shown = React.useMemo(() => {
    const term = q.trim();
    if (!term) return list;
    return list.filter((e) =>
      e.title.includes(term)
      || e.summary.includes(term)
      || (e.tags || []).some((t) => t.includes(term))
      || e.author.includes(term));
  }, [list, q]);

  const ask = async (question) => {
    setBusy(true);
    try {
      setReply(await knowledge.ask(question, { level }));
    } finally {
      setBusy(false);
    }
  };

  const open = openId ? knowledge.read(openId) : null;

  return (
    <div className="bs-screen scroll" style={{ gap: 'var(--space-6)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Chip color="orange" cut={3} lift style={{ alignSelf: 'flex-start' }}>مكتبة المعرفة</Chip>
        <h1 style={{ font: 'var(--type-headline)', margin: 0 }}>مبادئ تقرأها قبل أي قرار</h1>
        <p style={{ font: 'var(--type-lead)', margin: 0, color: 'var(--ink-muted)', maxWidth: 700 }}>
          ملخصات مبادئ من كتب مستثمرة، مكتوبة للسوق السعودي. بصير يشرح المبدأ ويقول لك مصدره، وما يوصيك بشراء ولا ببيع.
        </p>
      </header>

      <AskPanel level={level} onAnswer={ask} busy={busy} />
      {reply && <Answer reply={reply} />}

      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => setAllLevels((v) => !v)} aria-pressed={allLevels ? 'true' : 'false'}
          style={{
            border: 0, background: 'none', padding: 0, cursor: 'pointer',
            font: 'var(--type-label)', fontWeight: 700,
            color: allLevels ? 'var(--blue)' : 'var(--ink-muted)',
            textDecoration: 'underline', textUnderlineOffset: 6, textDecorationThickness: 2,
          }}>
          {allLevels ? 'تعرض كل المستويات' : `تعرض مستوى ${LEVEL_AR(level)} فقط`}
        </button>

        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر في العناوين والوسوم والملخصات"
          style={{ flex: '1 1 260px', minWidth: 0, background: 'transparent', border: '2px solid var(--line-strong)', borderRadius: 0, padding: '12px 16px', font: 'var(--type-body)' }} />

        <span className="num" style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
          {n(shown.length)} مبدأ
        </span>
      </div>

      {open
        ? <ReadingSheet entry={open} onClose={() => setOpenId(null)} />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
            {shown.map((e) => <EntryCard key={e.id} entry={e} onOpen={() => setOpenId(e.id)} />)}
          </div>
        )}

      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="quiet" onClick={() => go('journey')}>ارجع للرحلة</Button>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
          المبادئ للتعلّم فقط، وما فيها توصية ولا هدف سعري.
        </span>
      </div>

    </div>
  );
}
