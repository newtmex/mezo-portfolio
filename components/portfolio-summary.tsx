import { formatUsd } from "@/lib/utils";
import type { ManagerRangeDepthPayload } from "@/lib/report/types";

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-zinc-50">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function PortfolioSummary({ data }: { data: ManagerRangeDepthPayload }) {
  const avgShare =
    data.summary.length === 0
      ? "n/a"
      : (() => {
          const bps = data.summary
            .map((row) => (row.managerActiveBps == null ? null : Number(row.managerActiveBps)))
            .filter((v): v is number => v != null && Number.isFinite(v));
          if (bps.length === 0) return "n/a";
          const avg = bps.reduce((a, b) => a + b, 0) / bps.length;
          return `${(avg / 100).toFixed(2)}%`;
        })();

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi
        label="Portfolio"
        value={formatUsd(data.holdings.portfolioTotalMusd)}
        hint="Tokens + CL positions"
      />
      <Kpi label="Token balances" value={formatUsd(data.holdings.tokenTotalMusd)} />
      <Kpi label="CL positions" value={formatUsd(data.holdings.clTotalMusd)} />
      <Kpi label="Avg portfolio active %" value={avgShare} hint="Across all pools" />
      <Kpi
        label="MEZO emissions / day"
        value={data.emissions.mezoPerDay == null ? "n/a" : `${data.emissions.mezoPerDay.toFixed(2)} MEZO`}
        hint={formatUsd(data.emissions.valueMusdPerDay) + " / day"}
      />
    </section>
  );
}
