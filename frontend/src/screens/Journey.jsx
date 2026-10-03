import React from 'react';
import { Button, Piece } from '../components/core/index.jsx';
import { StarRating } from '../components/progress/index.jsx';
import { useTween } from '../components/games/index.jsx';
import { n } from '../lib/format.js';
import { usePlayer, LEVELS } from '../store/usePlayer.js';
import { STAGES } from '../content/stages.js';

/* ============================================================
   خريطة الرحلة — Journey
   The hub. Shows the learner's track, stars earned, and every stage
   as a station on a path. Custom stages built by the agent appear
   here too.
   ============================================================ */

export function Journey({ go, player, customStages = [] }) {
  const tier = player.tier;
  const level = player.level || 'beginner';
  const track = STAGES[level] || STAGES.beginner;
  const total = Object.values(player.stars).reduce((a, b) => a + b, 0);
  const maxStars = track.reduce((a, s) => a + (s.maxStars || 5), 0);

  return (
    <div className="bs-screen scroll" style={{ gap: 'var(--space-7)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Piece color="faint" cut={2} style={{ alignSelf: 'flex-start', padding: '8px 18px', font: '700 15px/1.4 var(--f-sans)' }}>
            {LEVELS[level]?.ar || 'مبتدئ'}
          </Piece>
          <h1 style={{ font: 'var(--type-headline)', margin: 0 }}>خريطة الرحلة</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <StarRating value={total} max={maxStars || 5} size={38} label={`مجموع نجومك ${total}`} />
          <span style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>
            {total} من {maxStars || 5}
          </span>
        </div>
      </header>

      {player.investable > 0 && (
        <Piece color="cream" cut={3} lift style={{ padding: '18px 28px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ font: 'var(--type-label)' }}>محاكتك بـ</span>
          <strong style={{ font: '900 32px/1 var(--f-display)', fontVariantNumeric: 'tabular-nums' }}>{n(player.investable)} ريال</strong>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>فلوس وهمية — ما فيه تداول حقيقي.</span>
        </Piece>
      )}

      <ol style={{ display: 'flex', flexDirection: 'column', gap: 18, listStyle: 'none', margin: 0, padding: 0 }}>
        {track.map((s, i) => {
          const stars = player.stars[s.id] || 0;
          const locked = !!s.requires && !player.hasFeature(s.requires);
          return (
            <li key={s.id}>
              <button type="button" disabled={locked} onClick={() => go(`stage/${s.id}`)}
                style={{ border: 0, background: 'none', padding: 0, cursor: locked ? 'not-allowed' : 'pointer', width: '100%', textAlign: 'right', opacity: locked ? .55 : 1 }}>
                <Piece color={stars > 0 ? 'green' : 'cream'} cut={(i % 4) + 1} lift
                  style={{ padding: '22px 28px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ font: '900 34px/1 var(--f-display)', color: 'var(--ink-muted)', width: 40 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ font: '700 21px/1.4 var(--f-sans)' }}>{s.title}</span>
                    <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
                      {locked ? `يحتاج اشتراك ${s.requiresLabel || 'المحترف'}` : s.blurb}
                    </span>
                  </span>
                  <StarRating value={stars} max={s.maxStars || 5} size={26} label={`${stars} من ${s.maxStars || 5}`} />
                </Piece>
              </button>
            </li>
          );
        })}

        {customStages.length > 0 && (
          <li>
            <Piece color="orange" cut={3} style={{ padding: '18px 28px' }}>
              <span style={{ font: '700 18px/1.4 var(--f-sans)' }}>مراحل بناها بصير لك</span>
            </Piece>
          </li>
        )}
        {customStages.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => go('stage/custom', { custom: c })}
              style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'right' }}>
              <Piece color="orange" cut={2} lift style={{ padding: '22px 28px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ font: '700 21px/1.4 var(--f-sans)' }}>{c.title}</span>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{c.book} · {c.source}</span>
                </span>
                <StarRating value={player.customStars[c.id] || 0} max={5} size={26} label="نجوم" />
              </Piece>
            </button>
          </li>
        ))}
      </ol>

      {/* every destination reachable from the hub, per track */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
        <Button onClick={() => go(level === 'expert' ? 'openworld' : 'stages')}>
          {level === 'expert' ? 'ادخل محاكي السوق' : 'كمّل المراحل'}
        </Button>
        {level !== 'expert' && (
          <Button variant="ghost" onClick={() => go('openworld')}>جرّب السوق المفتوح</Button>
        )}
        <Button variant="ghost" onClick={() => go('library')}>مكتبة المعرفة</Button>
        <Button variant="ghost" onClick={() => go('news')}>بوابة الأخبار</Button>
        <Button variant="ghost" onClick={() => go('chat')}>اسأل بصير</Button>
        <Button variant="ghost" onClick={() => go('plans')}>بصير برو</Button>
        <Button variant="ghost" onClick={() => go('choose')}>غيّر المسار</Button>
      </div>
    </div>
  );
}
