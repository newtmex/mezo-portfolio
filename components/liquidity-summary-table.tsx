import type { ManagerRangeDepthSummaryRow } from "@/lib/report/types";

export function LiquiditySummaryTable({ rows }: { rows: ManagerRangeDepthSummaryRow[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-100">Manager active liquidity % by pair</h2>
        <p className="text-xs text-zinc-500">
          Depth Δ % = (with − without) / with for the tight one-spacing band
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr className="border-b border-white/10">
              <th className="px-2 py-2 font-medium">Pair</th>
              <th className="px-2 py-2 font-medium">Manager active %</th>
              <th className="px-2 py-2 font-medium">Depth Δ % token0</th>
              <th className="px-2 py-2 font-medium">Depth Δ % token1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pair} className="border-b border-white/5 text-zinc-200">
                <td className="px-2 py-2.5 font-medium">{row.pair}</td>
                <td className="px-2 py-2.5 font-mono text-amber-200">{row.managerActivePct}</td>
                <td className="px-2 py-2.5 font-mono">{row.depthDiffToken0}</td>
                <td className="px-2 py-2.5 font-mono">{row.depthDiffToken1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
