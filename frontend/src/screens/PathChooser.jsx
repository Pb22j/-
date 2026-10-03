import React from 'react';
import { Button, Piece } from '../components/core/index.jsx';
import { usePlayer, TIERS } from '../store/usePlayer.js';
import { STAGES } from '../content/stages.js';
import { n } from '../lib/format.js';

/* ============================================================
   اختر مسارك — Path Chooser
   ------------------------------------------------------------
   The first real decision. Instead of funnelling everyone through one
   onboarding funnel, the learner states where they are. The quiz is
   offered as the "I don't know" exit and advises a level.
   ============================================================ */

const PATHS = [
  {
    id: 'beginner', color: 'green', cut: 2, tilt: -1,
    tag: 'من الصفر', title: 'مبتدئ',
    line: 'أبدأ من الصفر، أبني الأساس',
    body: 'ست مراحل على شكل ألعاب: التنويع، الاستمرارية، البيع من الخوف، الصبر. بدون مصطلحات ولا شارت.',
    bullets: ['٦ مراحل ألعاب', 'بدون توصيات ولا أسعار', 'تعلّم بالمخاطرة الصفرية'],
    count: STAGES.beginner.length,
  },
  {
    id: 'intermediate', color: 'blue', cut: 1, tilt: 1,
    tag: 'عندي أساس', title: 'متوسط',
    line: 'أعرف الشارت، أريد الفخاخ',
    body: 'ست مواقف واقعية تصير لكل مستثمر: فخ التوصية، السلة الواحدة، مطاردة القمة، اليوم الأسود، وين الوقف.',
    bullets: ['٦ فخاخ واقعية', 'بيانات تاسي الحقيقية', 'موجز بعد كل مرحلة'],
    count: STAGES.intermediate.length,
  },
  {
    id: 'expert', color: 'orange', cut: 3, tilt: -1,
    tag: 'جاهز للتداول', title: 'خبير',
    line: 'أريد السوق قدامي',
    body: 'محاكي تاسي الكامل ٢٠١٠–٢٠١٢: شارت شموع، لوحة أوامر، ساعة تقدّمها أنت يوم بعد يوم، ومؤشرات فنية كاملة.',
    bullets: ['تداول حر بفلوس وهمية', 'الساعة يمشي فيها للأمام فقط', 'مراقب صامت على كل قرار'],
    count: STAGES.expert.length,
  },
];

export function PathChooser({ go, player }) {
  const pick = (id) => {
    if (player.level !== id) player.setLevel(id);
    player.markSeen(`path:${id}`);
    go(id === 'expert' ? 'openworld' : 'journey');
  };

  return (
    <div className="bs-screen scroll" style={{ alignItems: 'center', gap: 'var(--space-7)', maxWidth: 1180, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <Piece color="faint" cut={2} style={{ padding: '8px 18px', font: '700 15px/1.4 var(--f-sans)' }}>
          وين تحب تبدأ؟
        </Piece>
        <h1 style={{ font: 'var(--type-headline)', margin: 0, textWrap: 'balance' }}>
          اختار مسارك، وبصير يكمّل معك
        </h1>
        <p style={{ font: 'var(--type-lead)', margin: 0, maxWidth: 640, color: 'var(--ink-muted)' }}>
          ثلاث مسارات بثلاثة مستويات. تقدر تغيّر رأيك وقت ما تشاء، وما في قرار نهائي.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, width: '100%' }}>
        {PATHS.map((p) => (
          <PathCard key={p.id} p={p} onOpen={() => pick(p.id)} current={player.level === p.id} />
        ))}
      </div>

      {/* the quiz as the "not sure" exit */}
      <Piece color="ink" cut={2} lift style={{ padding: '24px 30px', width: '100%', display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <span style={{ font: 'var(--type-caption)', color: 'var(--cream)', opacity: .8 }}>ما تدري؟</span>
          <strong style={{ display: 'block', font: '700 22px/1.4 var(--f-sans)', color: 'var(--cream)' }}>
            خليه يقيّم مستواك
          </strong>
          <span style={{ font: '500 15px/1.6 var(--f-text)', color: 'var(--cream)', opacity: .85 }}>
            ثلاث أسئلة عن سلوكك — ما عن أرقامك — وبصير يوجّهك للمسار المناسب.
          </span>
        </div>
        <Button onClick={() => go('quiz')} style={{ background: 'var(--orange)', color: 'var(--ink)' }}>
          جرّب الاختبار
        </Button>
      </Piece>

      {/* subscription, on the same first screen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, width: '100%' }}>
        <Piece color="cream" cut={3} lift style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>بعد ما تتخرّج</span>
          <strong style={{ font: 'var(--type-title)', margin: 0 }}>بصير برو</strong>
          <span style={{ font: 'var(--type-body)' }}>
            تتبّع السوق بلا حدود · تحليل فني كامل · بوابة الأخبار المالية · تبني مراحل خاصة مع بصير.
          </span>
          <div>
            <Button variant="ghost" style={{ minHeight: 46, padding: '0 22px', font: '700 15px/1 var(--f-sans)' }} onClick={() => go('plans')}>
              شوف الخطط — من {n(TIERS[1].price)} ريال
            </Button>
          </div>
        </Piece>

        <Piece color="cream" cut={2} lift style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>قبل ما تبدأ</span>
          <strong style={{ font: 'var(--type-title)', margin: 0 }}>اسأل بصير</strong>
          <span style={{ font: 'var(--type-body)' }}>
            خمسة وكلاء: المعرفة، بناء المراحل، الأخبار، المدقّق، والمراقب الصامت — يردّون على أسئلتك بمبدأ لا بقرار.
          </span>
          <div>
            <Button variant="ghost" style={{ minHeight: 46, padding: '0 22px', font: '700 15px/1 var(--f-sans)' }} onClick={() => go('chat')}>
              افتح الشات
            </Button>
          </div>
        </Piece>
      </div>

    </div>
  );
}

function PathCard({ p, onOpen, current }) {
  return (
    <Piece color={current ? p.color : 'cream'} cut={p.cut} lift tilt={p.tilt}
      style={{ padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{
          padding: '4px 12px', font: '700 13px/1.4 var(--f-sans)',
          background: current ? 'var(--cream)' : 'var(--ink-faint)',
          color: current ? 'var(--ink)' : 'var(--ink-muted)',
        }}>{p.tag}</span>
        <span style={{ font: 'var(--type-caption)', color: current ? 'var(--cream)' : 'var(--ink-muted)' }}>
          {p.count} {p.count === 1 ? 'محاكاة' : 'مراحل'}
        </span>
      </div>

      <strong style={{ font: 'var(--type-title)', margin: 0, color: current ? 'var(--cream)' : 'var(--ink)' }}>{p.title}</strong>
      <span style={{ font: '500 16px/1.6 var(--f-text)', color: current ? 'var(--cream)' : 'var(--ink-muted)' }}>{p.line}</span>
      <p style={{ font: '400 16px/1.7 var(--f-text)', margin: 0, color: current ? 'var(--cream)' : 'var(--text-body)' }}>{p.body}</p>

      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {p.bullets.map((b) => (
          <li key={b} style={{ display: 'flex', gap: 8, alignItems: 'baseline', font: '500 14px/1.5 var(--f-sans)', color: current ? 'var(--cream)' : 'var(--ink-muted)' }}>
            <span style={{ width: 7, height: 7, flex: 'none', background: current ? 'var(--cream)' : 'var(--blue)' }} />
            {b}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <Button
          onClick={onOpen}
          style={{ background: current ? 'var(--ink)' : 'var(--blue)', color: current ? 'var(--cream)' : 'var(--cream)', width: '100%' }}
        >
          {current ? 'كمّل هنا' : `ادخل كـ${p.id === 'beginner' ? 'مبتدئ' : p.id === 'intermediate' ? 'متوسط' : 'خبير'}`}
        </Button>
      </div>
    </Piece>
  );
}
