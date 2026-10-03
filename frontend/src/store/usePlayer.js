import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* Player profile: onboarding data, level, tier, per-stage stars.
   Two tiers: free (beginner + intermediate + library + coach) and
   expert (open-world + real-time data + news + technicals + stage builder). */

export const TIERS = [
  {
    id: 'free', ar: 'المجاني', price: 0, color: 'faint', cut: 2, featured: false,
    pitch: 'لمن يبي يبدأ',
    features: [
      'كل المراحل التعليمية (مبتدئ + متوسط)',
      'محاكي السوق العالمي لمدة محدودة',
      'مكتبة المعرفة الكاملة',
      'بصير المرشد الذكي',
    ],
  },
  {
    id: 'expert', ar: 'الخبير', price: 129, color: 'orange', cut: 3, featured: true,
    pitch: 'للجاد اللي يبني استراتيجية',
    features: [
      'كل اللي في المجاني',
      'بيانات السوق الفعلية لحظياً',
      'تحليل فني كامل (RSI · MACD · بولنجر · ATR)',
      'بوابة الأخبار المالية الموثقة',
      'بناء مراحل خاصة مع بصير',
      'محاكاة أحداث الشركات (توسّع · نتائج · اندماج)',
      'جلسة سؤال وجواب مع بصير',
    ],
  },
];

export const FEATURES = {
  stages: 'free',
  openworld: 'expert',
  coach: 'free',
  library: 'free',
  analysis: 'expert',
  news: 'expert',
  stageBuilder: 'expert',
  events: 'expert',
  backtest: 'expert',
  signals: 'expert',
};

const RANK = { free: 0, expert: 1 };

export const LEVEL_AR = { beginner: 'مبتدئ', intermediate: 'متوسط', expert: 'خبير' };
export const LEVELS = { beginner: { id: 'beginner', ar: 'مبتدئ' }, intermediate: { id: 'intermediate', ar: 'متوسط' }, expert: { id: 'expert', ar: 'خبير' } };

export const usePlayer = create(
  persist(
    (set, get) => ({
      started: false,
      salary: '',
      obligations: { rent: '', loan: '', expenses: '' },
      investable: 0,
      level: null,
      quizScore: 0,
      stars: {},
      customStars: {},
      tier: 'free',
      seen: {},

      start: (patch) => set({ started: true, ...patch }),
      setSalary: (v) => set({ salary: v }),
      setObligation: (k, v) => set((s) => ({ obligations: { ...s.obligations, [k]: v } })),
      setInvestable: (v) => set({ investable: v }),
      setLevel: (l) => set({ level: l }),
      setQuizScore: (v) => set({ quizScore: v }),

      award: (stageId, stars) => set((s) => {
        const cur = s.stars[stageId] || 0;
        const next = Math.max(cur, stars);
        if (next === cur) return {};
        return { stars: { ...s.stars, [stageId]: next } };
      }),
      awardCustom: (id, stars) => set((s) => ({ customStars: { ...s.customStars, [id]: stars } })),
      totalStars: () => Object.values(get().stars).reduce((a, b) => a + b, 0),

      setTier: (t) => set({ tier: t }),
      hasFeature: (key) => {
        const need = FEATURES[key];
        if (!need) return true;
        return RANK[get().tier] >= RANK[need];
      },
      minTierFor: (key) => FEATURES[key] || 'free',

      markSeen: (id) => set((s) => ({ seen: { ...s.seen, [id]: true } })),

      reset: () => set({
        started: false, salary: '', obligations: { rent: '', loan: '', expenses: '' },
        investable: 0, level: null, quizScore: 0, stars: {}, customStars: {}, tier: 'free', seen: {},
      }),
    }),
    { name: 'baseer-player' }
  )
);