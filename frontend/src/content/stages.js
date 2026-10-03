/* ============================================================
   محتوى المراحل — Stage registry
   ------------------------------------------------------------
   The three tracks. Each stage declares the principle it teaches and
   which corpus entry backs it, so the coach and the knowledge agent
   speak about the same thing the stage is drilling.

   beginner      — metaphors and games, no real prices
   intermediate  — sim-real scenarios built from real market traps
   expert        — the open-world simulator over real TASI data
   ============================================================ */

export const STAGES = {
  /* ---------------- Mبتدئ ---------------- */
  beginner: [
    {
      id: 'b-team',
      title: 'النجم ولا الفريق؟',
      blurb: 'عندك ١٠ ملايين — تحطها كلها على لاعب واحد ولا توزّعها؟',
      maxStars: 5,
      concept: 'concentration',
      kind: 'team-vs-star',
      budget: 10000000,
    },
    {
      id: 'b-day27',
      title: 'اليوم السابع والعشرين',
      blurb: 'مرّ ٢٧ يوماً وكل يوم تقول «بكرة أسوي شي» — وش يصير؟',
      maxStars: 5,
      concept: 'compounding',
      kind: 'day27',
    },
    {
      id: 'b-family',
      title: 'التراجع اليومي',
      blurb: 'شدّ على السهم يوميا ويسوء. كل يوم أسوأ من اللي قبله.',
      maxStars: 5,
      concept: 'panic-sell',
      kind: 'family',
    },
    {
      id: 'b-coaster',
      title: 'الموجة الهائلة',
      blurb: 'السهم يطلع ويهبط بجنون. الناس حولك يبيعون ويشترون.',
      maxStars: 5,
      concept: 'loss-aversion',
      kind: 'coaster',
    },
    {
      id: 'b-ice',
      title: 'آلة الزمن',
      blurb: 'ارجع قبل ٣٠ يوم وشوف وش كنت تسوي. الجواب يوجع.',
      maxStars: 5,
      concept: 'loss-aversion',
      kind: 'ice',
    },
    {
      id: 'b-arena',
      title: 'ساحة التذبذب',
      blurb: 'آخر اختبار: عينك على الأرقام وأنت بوسط موجة.',
      maxStars: 5,
      concept: 'position-sizing',
      kind: 'arena',
    },
  ],

  /* ---------------- متوسط ---------------- */
  intermediate: [
    {
      id: 'i-recommendation',
      title: 'فخ التوصية',
      blurb: 'منشور مشهور يقولك «ادخل الحين». السهم يطلع يومين وينهار.',
      maxStars: 5,
      concept: 'news-trap',
      kind: 'trap',
      trap: 'recommendation',
    },
    {
      id: 'i-basket',
      title: 'السلة الواحدة',
      blurb: 'محفظتك كلها بنوك — وأخبار الاقتصاد تطلع سيئة.',
      maxStars: 5,
      concept: 'diversification',
      kind: 'trap',
      trap: 'sector',
    },
    {
      id: 'i-fomo',
      title: 'مطاردة القمة',
      blurb: 'السهم صعد ثماني جلسات متتالية. الكل يقول ادخل.',
      maxStars: 5,
      concept: 'fomo',
      kind: 'trap',
      trap: 'chase',
    },
    {
      id: 'i-panic',
      title: 'اليوم الأسود',
      blurb: 'السهم نزل ١٤٪ اليوم ونزّلت كل شي.',
      maxStars: 5,
      concept: 'panic-sell',
      kind: 'trap',
      trap: 'panic',
    },
    {
      id: 'i-stop',
      title: 'وين الوقف؟',
      blurb: 'نفس الدخول، نفس التحليل — بس بدون نقطة وقف.',
      maxStars: 5,
      concept: 'position-sizing',
      kind: 'trap',
      trap: 'stop',
    },
    {
      id: 'i-read',
      title: 'شوف القصة',
      blurb: 'قبل ما تدخل، اقرأ صفحة واحدة: ماذا يعلن الشركة بالضبط؟',
      maxStars: 5,
      concept: 'financial-statements',
      kind: 'trap',
      trap: 'news',
    },
  ],

  /* ---------------- خبير ---------------- */
  expert: [
    {
      id: 'e-openworld',
      title: 'العالم المفتوح',
      blurb: 'بيانات تاسي الحقيقية ٢٠١٠–٢٠١٢، وأنت تقرر كل صفقة.',
      maxStars: 5,
      concept: 'market-efficiency',
      kind: 'openworld',
    },
  ],
};

/** Flat lookup by id, across all tracks. */
export const STAGE_BY_ID = Object.fromEntries(
  Object.values(STAGES).flat().map((s) => [s.id, s])
);

export const TRACKS = [
  { id: 'beginner', ar: 'مبتدئ', blurb: 'أساسيات على شكل ألعاب', icon: '←' },
  { id: 'intermediate', ar: 'متوسط', blurb: 'فخاخ السوق الواقعية', icon: '←' },
  { id: 'expert', ar: 'خبير', blurb: 'محاكي tاسي الحقيقي', icon: '←' },
];
