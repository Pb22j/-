import React from 'react';
import { AmountField } from '../../components/forms/index.jsx';
import { ObligationField } from '../../components/forms/index.jsx';
import { Button } from '../../components/core/index.jsx';
import { Piece } from '../../components/core/index.jsx';
import { n } from '../../lib/format.js';

/* ============================================================
   كم راتبك؟ — Salary
   Turns a number into a plan. The margin screen that follows is the
   lesson: what you invest is what is LEFT, not what you earn.
   ============================================================ */

export function Salary({ go, player }) {
  const salary = Number(String(player.salary).replace(/[^0-9]/g, '')) || 0;
  const ob = player.obligations;
  const rent = Number(ob.rent) || 0, loan = Number(ob.loan) || 0, exp = Number(ob.expenses) || 0;
  const fixed = rent + loan + exp;
  const free = Math.max(0, salary - fixed);
  const suggested = Math.round((free * 0.7) / 1000) * 1000;

  return (
    <div className="bs-screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', textAlign: 'center' }}>
        <h1 style={{ font: 'var(--type-headline)', margin: 0 }}>كم راتبك الشهري؟</h1>
        <p style={{ font: 'var(--type-lead)', margin: 0, color: 'var(--ink-muted)', maxWidth: 540 }}>
          ما نبي دقة. ادخل الرقم التقريبي، ونحسب لك هامشك الحر.
        </p>
      </div>

      <div style={{ width: 'min(760px, 100%)' }}>
        <AmountField
          id="salary" ariaLabel="الراتب الشهري" placeholder="0"
          value={player.salary} onChange={(v) => player.setSalary(v)}
        />
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        <ObligationField label="إيجار" value={ob.rent} onChange={(v) => player.setObligation('rent', v)} placeholder="0" width={220} />
        <ObligationField label="قسط قرض" value={ob.loan} onChange={(v) => player.setObligation('loan', v)} placeholder="0" width={220} />
        <ObligationField label="مصروفات أسرة" value={ob.expenses} onChange={(v) => player.setObligation('expenses', v)} placeholder="0" width={220} />
      </div>

      {salary > 0 && (
        <Piece color="faint" cut={2} style={{ padding: '18px 34px', display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline' }}>
          <span style={{ font: 'var(--type-label)' }}>دخل صافي متبقٍ</span>
          <strong style={{ font: '900 34px/1 var(--f-display)', fontVariantNumeric: 'tabular-nums' }}>{n(free)} ريال</strong>
          <span style={{ font: 'var(--type-caption)', opacity: .8 }}>
            {fixed > salary ? 'التزاماتك أكثر من راتبك — راجع الأرقام.' : `من ${n(salary)} ريال`}
          </span>
        </Piece>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button disabled={salary <= 0} onClick={() => go('margin')}>
          {salary > 0 ? `هامشي الحر ${n(free)} ريال` : 'اكتب راتبك'}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
   هامشك الحر — Margin
   The core beginner lesson, stated as a number: you invest from what
   is left, not from what you earn.
   ============================================================ */

export function Margin({ go, player }) {
  const salary = Number(String(player.salary).replace(/[^0-9]/g, '')) || 0;
  const ob = player.obligations;
  const fixed = (Number(ob.rent) || 0) + (Number(ob.loan) || 0) + (Number(ob.expenses) || 0);
  const free = Math.max(0, salary - fixed);
  const pct = free > 0 ? player.investable / free : 0;
  const good = pct > 0 && pct <= 0.3;

  return (
    <div className="bs-screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', textAlign: 'center' }}>
        <h1 style={{ font: 'var(--type-headline)', margin: 0 }}>وش الحين؟</h1>
        <p style={{ font: 'var(--type-lead)', margin: 0, color: 'var(--ink-muted)', maxWidth: 560 }}>
          عندك <strong style={{ color: 'var(--ink)' }}>{n(free)} ريال</strong> كل شهر ما تروح على التزاماتك.
          كم منها تبي تحط في السوق؟
        </p>
      </div>

      <div style={{ width: 'min(760px, 100%)' }}>
        <AmountField
          id="investable" ariaLabel="المبلغ للاستثمار" unit="ريال شهرياً" placeholder="0"
          value={player.investable} onChange={(v) => player.setInvestable(Number(String(v).replace(/[^0-9]/g, '')))}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[10, 20, 30].map((p) => {
          const amt = Math.round((free * (p / 100)) / 1000) * 1000;
          return (
            <button key={p} type="button" onClick={() => player.setInvestable(amt)}
              style={{
                border: '2px solid var(--line-strong)', background: player.investable === amt ? 'var(--blue)' : 'transparent',
                color: player.investable === amt ? 'var(--cream)' : 'var(--ink)',
                padding: '16px 24px', cursor: 'pointer', font: '700 17px/1.4 var(--f-sans)',
              }}>
              {p}% · {n(amt)} ريال
            </button>
          );
        })}
      </div>

      {player.investable > 0 && (
        <Piece color={good ? 'green' : 'orange'} cut={good ? 3 : 2} tilt={good ? -1 : 1}
          style={{ padding: '22px 34px', maxWidth: 640, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ font: 'var(--type-label)' }}>
            {good ? 'مبلغ معقول' : pct > 0.3 ? 'حذار — مبالغ كبيرة على راتب' : 'مبلغ صغير، وأفعاله تتراكم ببطء'}
          </span>
          <span style={{ font: 'var(--type-bubble)' }}>
            {good
              ? `${pct.toFixed(0)}% من هامشك. هذا اللي تقدر تتحمل خسارته وتقدر تستمر عليه سنين.`
              : pct > 0.3
                ? 'تحسب نفسها تقدر تصمد، لكن أول شهر هبوط يحسسك إنك غلطان وتبيع كل شي.'
                : 'الانتظام أهم من المبلغ. مية ريال كل شهر أقوى من ألفي ريال مرة وحدة ثم توقّف.'}
          </span>
        </Piece>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button disabled={player.investable <= 0} onClick={() => go('quiz')}>كمّل</Button>
      </div>
    </div>
  );
}
