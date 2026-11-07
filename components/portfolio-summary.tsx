import { formatAmount, formatUsd } from "@/lib/utils";
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

export function PortfolioSummary({
  data,
  aero,
}: {
  data: ManagerRangeDepthPayload;
  aero?: {
    aeroPerDay: number | null;
    aeroValueUsdPerDay: number | null;
  } | null;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi
        label="Portfolio"
        value={formatUsd(data.holdings.portfolioTotalMusd)}
        hint="Tokens + CL positions"
      />
      <Kpi label="Token balances" value={formatUsd(data.holdings.tokenTotalMusd)} />
      <Kpi label="CL positions" value={formatUsd(data.holdings.clTotalMusd)} />
      <Kpi
        label="AERO emissions / day"
        value={aero?.aeroPerDay == null ? "n/a" : `${formatAmount(aero.aeroPerDay, 5)} AERO`}
        hint={`${formatUsd(aero?.aeroValueUsdPerDay ?? null)} / day · Base MUSD/MEZO`}
      />
      <Kpi
        label="MEZO emissions / day"
        value={data.emissions.mezoPerDay == null ? "n/a" : `${data.emissions.mezoPerDay.toFixed(2)} MEZO`}
        hint={formatUsd(data.emissions.valueMusdPerDay) + " / day"}
      />
    </section>
  );
}
