import React from 'react';
import { TopBar } from '../../components/navigation/index.jsx';
import { Button } from '../../components/core/index.jsx';
import { CollageBand } from '../../components/brand/index.jsx';

/* ============================================================
   شاشة البداية — Welcome
   The first screen. One idea, one primary action, no chrome.
   ============================================================ */

export function Welcome({ go, player }) {
  const resume = player.started && player.level;
  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-7)', textAlign: 'center', padding: 'var(--space-6) var(--gutter-x) clamp(200px,34vh,320px)', animation: 'bs-in var(--dur-enter) var(--ease-enter) both' }}>
        <h1 style={{ font: 'var(--type-hero)', margin: 0, textWrap: 'balance' }}>
          فلوسك موجودة…<br />بس هل تشتغل؟
        </h1>
        <p style={{ font: 'var(--type-lead)', margin: 0, maxWidth: 620, color: 'var(--ink-muted)' }}>
          بصير محاكي سوق تاسي. تتداول بفلوس وهمية بأسعار حقيقية من ٢٠١٠ إلى ٢٠١٢،
          وبصير يراقبك ويشرح لك ليش اشتريت — قبل لا تكرر الخطأ على فلوسك الحقيقية.
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
          <Button onClick={() => go('choose')}>
            {resume ? 'كمّل رحلتك' : 'ابدأ رحلتك'}
          </Button>
          {resume && (
            <>
              <Button variant="ghost" onClick={() => go('journey')}>خريطة الرحلة</Button>
              <Button variant="ghost" onClick={() => go('library')}>تصفّح المكتبة</Button>
            </>
          )}
        </div>
      </div>
      <CollageBand />
    </div>
  );
}
