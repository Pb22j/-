import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* Market + trading engine (Open World / expert mode).
   Data comes from public/data/market_data.json — real TASI OHLCV 2010-2012. */

const START_CASH = 250000;
/** Session the clock opens on, so the chart has history but there is runway. */
export const START_AT = 60;
/** Commission per side, in basis points (15.5 bps per the spec). */
export const COMMISSION_BPS = 15.5;
/** T+2 settlement — orders placed today settle two trading days later. */
export const SETTLE_DAYS = 2;

export const useMarket = create(
  persist(
    (set, get) => ({
      ready: false,
      meta: {},
      order: [],
      series: {},
      range: null,

      selected: 'AlRajhi_Bank',
      cursor: {},                 // companyId -> index of the current day
      cash: START_CASH,
      holdings: {},               // companyId -> { shares, avgCost }
      trades: [],                 // { id, companyId, side, shares, price, day, time }
      journal: [],                // coach warnings raised against this run
      customStages: [],           // stages produced by the stage-builder agent

      /* ---------- loading ---------- */
      load: async () => {
        if (get().ready) return;
        const res = await fetch('/data/market_data.json');
        const payload = await res.json();
        // Open on day 60, not day 0: the chart needs some history to be a chart,
        // and there are still ~685 sessions left to walk forward.
        const cursor = {};
        payload.order.forEach((id) => {
          const len = payload.data[id].length;
          cursor[id] = Math.min(START_AT, Math.max(0, len - 1));
        });
        set({
          ready: true,
          meta: payload.meta,
          order: payload.order,
          series: payload.data,
          range: payload.range,
          cursor,
        });
      },

      /* ---------- selectors ---------- */
      bars: (id = get().selected) => get().series[id] || [],
      metaOf: (id = get().selected) => get().meta[id] || {},
      barsUpTo: (id = get().selected) => {
        const s = get().series[id] || [];
        return s.slice(0, (get().cursor[id] ?? s.length - 1) + 1);
      },
      currentBar: (id = get().selected) => {
        const s = get().series[id] || [];
        return s[get().cursor[id] ?? s.length - 1] || null;
      },
      history: (id = get().selected, count = 30) => get().barsUpTo(id).slice(-count),
      startDate: (id = get().selected) => (get().series[id]?.[0]?.time ?? ''),
      endDate: (id = get().selected) => (get().series[id]?.[get().cursor[id] ?? 0]?.time ?? ''),
      finished: (id = get().selected) => {
        const s = get().series[id] || [];
        return (get().cursor[id] ?? 0) >= s.length - 1;
      },

      /** Saudi Exchange: closed Friday + Saturday. */
      isTradingDay: (bar) => {
        if (!bar?.time) return false;
        const d = new Date(bar.time);
        const dow = d.getUTCDay();   // 0=Sun … 5=Fri, 6=Sat
        return dow !== 5 && dow !== 6;
      },

      /* ---------- portfolio ---------- */
      positions: () => {
        const { holdings, series, cursor } = get();
        return Object.entries(holdings)
          .filter(([, h]) => h.shares > 0)
          .map(([id, h]) => {
            const bars = series[id] || [];
            const last = bars[cursor[id] ?? bars.length - 1];
            const price = last?.close ?? h.avgCost;
            const value = h.shares * price;
            const cost = h.shares * h.avgCost;
            return {
              id, ...h, price, value, cost,
              pnl: value - cost,
              pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
            };
          });
      },
      portfolio: () => {
        const { cash } = get();
        const pos = get().positions();
        const mv = pos.reduce((a, p) => a + p.value, 0);
        const cost = pos.reduce((a, p) => a + p.cost, 0);
        const total = cash + mv;
        /* locked cash: orders placed but T+2 not yet settled (illiquid until then) */
        const pending = get().trades.filter((t) => !t.settled)
          .reduce((a, t) => a + (t.commission || 0), 0);
        return {
          cash, marketValue: mv, total, cost,
          pnl: mv - cost,
          pnlPct: cost > 0 ? ((mv - cost) / cost) * 100 : 0,
          totalPnl: total - START_CASH,
          totalPnlPct: ((total - START_CASH) / START_CASH) * 100,
          count: pos.length,
          /* HHI-style concentration: 0 = perfectly spread, 1 = single stock */
          concentration: mv > 0 ? pos.reduce((a, p) => a + (p.value / mv) ** 2, 0) : 0,
          topWeight: mv > 0 ? Math.max(...pos.map((p) => p.value / mv)) * 100 : 0,
          /* total commission taken so far, and locked in pending settlement */
          commissionPaid: get().trades.reduce((a, t) => a + (t.commission || 0), 0),
          pendingCommission: pending,
          pendingCount: get().trades.filter((t) => !t.settled).length,
        };
      },

      /* ---------- actions ---------- */
      select: (id) => set({ selected: id }),

      advanceDay: (id = get().selected) => {
        const { cursor, series } = get();
        const max = series[id]?.length ?? 1;
        let i = cursor[id] ?? 0;
        /* skip Fri + Sat — Saudi Exchange closed on these days */
        while (i < max - 1 && !get().isTradingDay(series[id]?.[i + 1])) i++;
        if (i < max - 1) {
          set((s) => ({
            cursor: { ...s.cursor, [id]: i + 1 },
            /* T+2 settlement: any trade placed two or more sessions ago
               gets its commission deducted here, marks itself settled */
            trades: s.trades.map((t) => {
              if (t.settled || t.companyId !== id) return t;
              if (i + 1 - (t.barIndex ?? i) >= SETTLE_DAYS) {
                return { ...t, settled: true, settledDay: (series[id]?.[i + 1]?.time || '') };
              }
              return t;
            }),
          }));
        }
      },

      rewindTo: (id, dayIndex) => set((s) => ({ cursor: { ...s.cursor, [id]: Math.max(0, dayIndex) } })),

      /** Returns { ok, error } so the UI can show a piece-level rejection. */
      placeOrder: (id, side, shares) => {
        const { cash, holdings, series, cursor } = get();
        const bars = series[id] || [];
        const bar = bars[cursor[id] ?? bars.length - 1];
        if (!bar) return { ok: false, error: 'لا توجد بيانات لهذا اليوم' };
        if (!Number.isFinite(shares) || shares <= 0) return { ok: false, error: 'أدخل عدد أسهم صحيح' };

        const price = bar.close;
        const name = get().meta[id]?.ar || id;
        const held = holdings[id] || { shares: 0, avgCost: 0 };

        if (side === 'BUY') {
          const cost = shares * price;
          if (cost > cash + 1e-6) return { ok: false, error: `الرصيد النقدي ما يكفي — تحتاج ${Math.ceil(cost).toLocaleString('en-US')} ريال` };
          const commission = +(cost * COMMISSION_BPS / 10000).toFixed(2);
          const newShares = held.shares + shares;
          const newCost = (held.avgCost * held.shares + cost) / newShares;
          set((s) => ({
            cash: s.cash - cost - commission,
            holdings: { ...s.holdings, [id]: { shares: newShares, avgCost: +newCost.toFixed(4) } },
            trades: [...s.trades, {
              id: `${s.trades.length + 1}`, companyId: id, name, side, shares,
              price: +price.toFixed(2), commission,
              barIndex: (cursor[id] ?? 0), day: bar.time, time: bar.time,
              settled: false,
            }],
          }));
          return { ok: true };
        }

        if (side === 'SELL') {
          if (shares > held.shares) return { ok: false, error: `ما عندك ${shares} سهم — تملك ${held.shares}` };
          const proceeds = shares * price;
          const commission = +(proceeds * COMMISSION_BPS / 10000).toFixed(2);
          const newShares = held.shares - shares;
          const next = { ...s_holdings(get) };
          if (newShares <= 0) delete next[id]; else next[id] = { shares: newShares, avgCost: held.avgCost };
          set((s) => ({
            cash: s.cash + proceeds - commission,
            holdings: next,
            trades: [...s.trades, {
              id: `${s.trades.length + 1}`, companyId: id, name, side, shares,
              price: +price.toFixed(2), commission,
              barIndex: (cursor[id] ?? 0), day: bar.time, time: bar.time,
              settled: false,
            }],
          }));
          return { ok: true };
        }
        return { ok: false, error: 'أمر غير معروف' };
      },

      reset: () => set({
        cash: START_CASH, holdings: {}, trades: [], journal: [],
        cursor: Object.fromEntries(get().order.map((id) => [id, Math.min(START_AT, Math.max(0, (get().series[id]?.length ?? 1) - 1))])),
      }),

      addJournal: (entry) => set((s) => ({ journal: [entry, ...s.journal].slice(0, 40) })),
      addCustomStage: (stage) => set((s) => ({ customStages: [stage, ...s.customStages] })),
    }),
    {
      name: 'baseer-market',
      partialize: (s) => ({
        selected: s.selected,
        cursor: s.cursor,
        cash: s.cash,
        holdings: s.holdings,
        trades: s.trades,
        customStages: s.customStages,
        journal: s.journal,
      }),
    }
  )
);

/* helper kept out of the store closure for readability */
function s_holdings(get) { return { ...get().holdings }; }
