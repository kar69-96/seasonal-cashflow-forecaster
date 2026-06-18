# Seasonal Cashflow Forecaster

A probabilistic cashflow forecaster for seasonal farm operations, built as an Ambrook demo. It answers the one question a rancher and a lender both care about: **what's the probability I run out of cash before my next big revenue event, and how large a credit line bridges the gap?**

## What it does

**The model** A pasture-raised egg farm hits a spring grow-out cash valley — heavy feed, depressed revenue — before holiday-season egg prices lift cash into the fall. The right answer to "will I make it" isn't a line, it's a distribution. The engine decomposes a 5-year ledger (~9,000 transactions, 50k hens) into recurring obligations, seasonal flows, and payment timing, then runs 5,000 Monte Carlo paths to produce P(shortfall), the trough date, and a 95th-percentile credit line.

**Live scenarios** Drag egg price, feed cost, and payment delay, or switch on a credit line — each change re-runs the simulation in a Web Worker and animates the fan chart. There's no LLM in the loop; the value is the math.

The engine (`src/engine/*`) is pure TypeScript — no React, no DOM — fully unit-tested. Seed data is synthetic but parameterized from public USDA/extension benchmarks (see `src/data/seed.ts`).

## Top features

**Correlated risk** A shared "year-quality" factor moves feed, utilities, and labor together, so a bad year hits everything at once. The projection bands show real risk instead of noise that cancels out.

**Credit line modeled day by day** Drawdowns, repayments, and interest are simulated daily — so "this line covers 95% of scenarios" is an actual number, not a guess.

**Fast and reproducible** Fixed costs get computed once; only the genuinely uncertain stuff gets simulated. Every one of the 5,000 paths is seeded, so runs are fully reproducible.

## Quickstart

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine tests (Vitest)
npm run build    # production build
```
