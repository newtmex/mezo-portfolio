import type { ManagerTokenHolding } from "@/lib/report/types";
import { formatAmount, formatUsd, shortenAddress } from "@/lib/utils";

export function TokenHoldingsTable({
  rows,
  total,
}: {
  rows: ManagerTokenHolding[];
  total: number | null;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Portfolio token balances</h2>
          <p className="text-xs text-zinc-500">Mezo API mUSD prices</p>
        </div>
        <p className="font-mono text-sm text-amber-200">{formatUsd(total)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr className="border-b border-white/10">
              <th className="px-2 py-2 font-medium">Token</th>
              <th className="px-2 py-2 font-medium">Amount</th>
              <th className="px-2 py-2 font-medium">Price</th>
              <th className="px-2 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.address} className="border-b border-white/5 text-zinc-200">
                <td className="px-2 py-2.5">
                  <div className="font-medium">{row.symbol}</div>
                  <div className="font-mono text-[11px] text-zinc-500">
                    {shortenAddress(row.address)}
                  </div>
                </td>
                <td className="px-2 py-2.5 font-mono">{formatAmount(row.amount)}</td>
                <td className="px-2 py-2.5 font-mono">
                  {row.priceMusd == null ? "n/a" : formatUsd(row.priceMusd)}
                </td>
                <td className="px-2 py-2.5 font-mono text-zinc-100">
                  {formatUsd(row.valueMusd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
