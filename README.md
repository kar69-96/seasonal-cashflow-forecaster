# Seasonal Cashflow Forecaster

A probabilistic cashflow forecaster for seasonal farm operations.
Built for irregular cash flows:
**what's the probability I run out of cash before my next big revenue event, and how large a credit line bridges the gap?**

<img width="1205" height="660" alt="image" src="https://github.com/user-attachments/assets/7c4dd239-f895-4829-8de3-1082e784efa4" />


## What it does

**The model** A pasture-raised egg farm hits a spring grow-out cash valley, before holiday-season egg prices lift cash into the fall. The engine decomposes a sample 5-year ledger (~9,000 transactions, 50k hens) into recurring obligations, seasonal flows, and payment timing, then runs 5,000 Monte Carlo paths to produce P(shortfall), the trough date, and a 95th-percentile credit line.

**Live scenarios** Drag egg price, feed cost, and payment delay, or switch on a credit line: each change re-runs the simulation in a Web Worker and animates the fan chart. There's no LLM in the loop; the value is the math.


## Top features

**Correlated risk** A shared "year-quality" factor moves feed, utilities, and labor together, results are normalized. The projection bands aim to reduce noise and display a distribution of probabilities. 

**Credit line modeled day by day** Drawdowns, repayments, and interest are simulated daily.

**Fast and reproducible** Fixed costs get computed once; only the uncertain stuff gets simulated. Every one of the 5,000 paths is seeded, so runs are fully reproducible.

## Quickstart

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine tests (Vitest)
npm run build    # production build
```



