import React from 'react';
import { Button, Piece } from '../components/core/index.jsx';
import { useTween } from '../components/games/index.jsx';

/* ============================================================
   اختبار المستوى — Level Quiz
   Three questions, deliberately about behaviour rather than numbers.
   The result routes the learner to one of the three tracks.
   ============================================================ */

export const QUESTIONS = [
  {
    id: 'q1',
    q: 'قرأت إن سهم معيّن راح يرتفع. وش تسوي؟',
    options: [
      { label: 'أشتري الحين قبل ما يطلع', score: 0, why: 'هذا يدخل على السعر بعد ما الخبر انتشر — تماماً ما يفعله الشاطر.' },
      { label: 'أبحث عن قوائم الشركة المالية أول', score: 2, why: 'الخبر يعطيك القصة، والقوائم تعطيك الأرقام.' },
      { label: 'أنتظر وأراقب', score: 1, why: 'ممتاز، بس ابحث بعد — المراقبة بلا بحث ناقصة.' },
    ],
  },
  {
    id: 'q2',
    q: 'عندي ٥٠٠٠٠ ريال. وين تحطها؟',
    options: [
      { label: 'سهم واحد أعرفه كويس', score: 0, why: 'السهم الواحد يمكن يكسب لك كويس… ويمكن يهدم عليك كل شي بنفس اليوم.' },
      { label: 'أسهم من ٣ قطاعات مختلفة', score: 2, why: 'هذا هو التنويع: ترتبط عوائدهم سلباً فيخففون الخسارة عن بعض.' },
      { label: 'نصها سهم، ونصفها كاش', score: 1, why: 'نص ممتاز، بس الكاش الزايد ما يشتغل لحاله.' },
    ],
  },
  {
    id: 'q3',
    q: 'السهم اللي أشتريه نزل ١٥% اليوم. وش تسوي؟',
    options: [
      { label: 'أبيع فوراً قبل لا ينزل أكثر', score: 0, why: 'هذا بيع من الخوف. أنت تبيع لأن السعر نزل، لا لأن سبب الشراء تغيّر.' },
      { label: 'أراجع: هل سبب شرائي ما زال موجود؟', score: 2, why: 'هذا السؤال الصح. إذا السبب واقف، أنت تملك أصلاً لا سعراً.' },
      { label: 'أضيف لمتوسط السهم', score: 1, why: 'زيادة صفقة بدون ما تفكّر — تفكير مطلوب.' },
    ],
  },
];

const LEVEL_AR = { beginner: 'مبتدئ', intermediate: 'متوسط', expert: 'خبير' };
const LEVEL_WHY = {
  beginner: 'ما تشيلك العيب — كل محترف بدأ من هنا. بنبدأ بالأساسيات على شكل مراحل، ومخاطرتك صفر.',
  intermediate: 'عندك أساس، وهذا أخطر مكان: تعرف شكل الفخ وتحس إنك آمن. بنوديك لمرحلة الفخاخ الواقعية.',
  expert: 'واضح إنك تعرف السوق. بنعطيك العالم المفتوح ببيانات تاسي الحقيقية ٢٠١٠–٢٠١٢ تطارد فيها السوق بنفسك.',
};

export function LevelQuiz({ go, player }) {
  const [answers, setAnswers] = React.useState({});
  const total = QUESTIONS.length;
  const done = Object.keys(answers).length >= total;
  const score = QUESTIONS.reduce((a, q) => a + (answers[q.id]?.score || 0), 0);
  const max = total * 2;
  const level = score >= 5 ? 'expert' : score >= 3 ? 'intermediate' : 'beginner';
  const pctAnswered = (Object.keys(answers).length / total) * 100;

  const pick = (qid, oi) => setAnswers((a) => ({ ...a, [qid]: { score: QUESTIONS.find((q) => q.id === qid).options[oi].score, oi } }));

  return (
    <div className="bs-screen" style={{ gap: 'var(--space-7)', maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <Piece color="faint" cut={2} style={{ padding: '8px 18px', font: '700 15px/1.4 var(--f-sans)' }}>
          السؤال {Math.min(Object.keys(answers).length + 1, total)} من {total}
        </Piece>
      </div>

      {QUESTIONS.map((q) => (
        <section key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <h2 style={{ font: 'var(--type-title)', margin: 0 }}>{q.q}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {q.options.map((o, oi) => {
              const chosen = answers[q.id]?.oi === oi;
              return (
                <button key={oi} type="button" onClick={() => pick(q.id, oi)}
                  style={{
                    textAlign: 'right', cursor: 'pointer', border: 0, padding: 0, background: 'none',
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                  }}>
                  <Piece as="span" color={chosen ? 'blue' : 'cream'} cut={(oi % 4) + 1} lift={chosen}
                    style={{ width: 44, height: 44, flex: 'none', display: 'grid', placeItems: 'center', font: '700 20px/1 var(--f-sans)' }}>
                    {chosen ? '✓' : '＋'}
                  </Piece>
                  <span style={{ font: 'var(--type-body)', paddingTop: 8 }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {done && (
        <>
          <Piece color={level === 'expert' ? 'orange' : level === 'intermediate' ? 'blue' : 'green'} cut={2} tilt={-1}
            style={{ padding: '26px 34px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ font: 'var(--type-label)' }}>
              جبت {score} من {max} — نصيحتي لك: <strong>{LEVEL_AR}</strong>
            </span>
            <span style={{ font: 'var(--type-lead)' }}>{LEVEL_WHY[level]}</span>
          </Piece>

          {/* per-question reasoning, so the advice is earned rather than announced */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {QUESTIONS.map((q) => {
              const chosen = q.options[answers[q.id]?.oi];
              return (
                <div key={q.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', boxShadow: 'inset 0 0 0 2px var(--line)' }}>
                  <span style={{ flex: 'none', width: 8, height: 8, marginTop: 8, background: chosen.score === 2 ? 'var(--green)' : 'var(--orange)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ font: '700 15px/1.5 var(--f-sans)' }}>{q.q}</span>
                    <span style={{ font: '500 15px/1.6 var(--f-text)', color: 'var(--ink-muted)' }}>اخترت «{chosen.label}» — {chosen.why}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Piece color="faint" cut={2} style={{ padding: '16px 22px' }}>
            <span style={{ font: '500 16px/1.6 var(--f-text)' }}>
              {level === 'expert'
                ? 'نصيحة بصير: ابدأ من العالم المفتوح، لكن راقب قواعد المراقب الصامت أول أسبوع — هي اللي تعلّمك قبل ما تكلّف.'
                : 'نصيحة بصير: لو حسيت إن المرحلة صعبة عليك، تقدر تنزل مستوى أو ترجع للاختبار وقت ما تشاء.'}
            </span>
          </Piece>
        </>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 'auto' }}>
        {done ? (
          <>
            <Button onClick={() => { player.setLevel(level); player.setQuizScore(score); go(level === 'expert' ? 'openworld' : 'journey'); }}>
              ادخل مسار {LEVEL_AR}
            </Button>
            <Button variant="ghost" onClick={() => setAnswers({})}>أعد الاختبار</Button>
            <Button variant="ghost" onClick={() => go('choose')}>اختار مسار ثاني</Button>
          </>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 160, alignSelf: 'center', height: 6, background: 'var(--line)' }}>
              <div style={{ width: `${pctAnswered}%`, height: '100%', background: 'var(--blue)', transition: 'width .3s' }} />
            </div>
            <Button disabled onClick>جاوب كل الأسئلة</Button>
          </>
        )}
      </div>
    </div>
  );
}
