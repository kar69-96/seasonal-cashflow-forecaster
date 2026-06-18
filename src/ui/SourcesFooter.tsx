// Page footer: the public benchmarks the synthetic ledger is parameterized from.
const SOURCES: { label: string; detail: string; href: string }[] = [
  {
    label: "USDA NASS — Chickens & Eggs",
    detail: "production, layer counts & monthly price path",
    href: "https://quickstats.nass.usda.gov",
  },
  {
    label: "USDA AMS — Egg Markets Overview",
    detail: "wholesale egg prices & volatility",
    href: "https://www.ams.usda.gov/market-news/egg-market-news-reports",
  },
  {
    label: "USDA ERS — Feed Grains Database",
    detail: "feed cost (~65% of total cost)",
    href: "https://www.ers.usda.gov/data-products/feed-grains-database",
  },
  {
    label: "Iowa State Ag Decision Maker",
    detail: "extension layer enterprise budgets & cost calendar",
    href: "https://www.extension.iastate.edu/agdm/",
  },
];

export function SourcesFooter() {
  return (
    <footer className="mt-10 border-t border-stone-200 pt-6">
      <p className="text-xs text-stone-500">
        Sample data — no real farm. Cost structure, prices, and seasonality are
        parameterized from public benchmarks:
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {SOURCES.map((s) => (
          <li key={s.href} className="text-xs">
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-green-800 underline decoration-stone-300 underline-offset-2 hover:decoration-green-700"
            >
              {s.label}
            </a>
            <span className="text-stone-400"> — {s.detail}</span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
