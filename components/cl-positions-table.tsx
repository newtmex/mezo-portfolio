import type { ManagerClPositionValue } from "@/lib/report/types";
import { formatAmount, formatUsd } from "@/lib/utils";

export function ClPositionsTable({
  rows,
  total,
}: {
  rows: ManagerClPositionValue[];
  total: number | null;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Manager CL positions</h2>
          <p className="text-xs text-zinc-500">Wallet + gauge-staked NFTs</p>
        </div>
        <p className="font-mono text-sm text-amber-200">{formatUsd(total)}</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No manager CL positions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-white/10">
                <th className="px-2 py-2 font-medium">Pair</th>
                <th className="px-2 py-2 font-medium">NFT</th>
                <th className="px-2 py-2 font-medium">Staked</th>
                <th className="px-2 py-2 font-medium">Range</th>
                <th className="px-2 py-2 font-medium">In range</th>
                <th className="px-2 py-2 font-medium">Token0</th>
                <th className="px-2 py-2 font-medium">Token1</th>
                <th className="px-2 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.pair}-${row.tokenId}`}
                  className="border-b border-white/5 text-zinc-200"
                >
                  <td className="px-2 py-2.5">{row.pair}</td>
                  <td className="px-2 py-2.5 font-mono">#{row.tokenId}</td>
                  <td className="px-2 py-2.5">
                    <span
                      className={
                        row.staked
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                          : "rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400"
                      }
                    >
                      {row.staked ? "yes" : "no"}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs">
                    [{row.tickLower}, {row.tickUpper})
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className={
                        row.inRange
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      {row.inRange ? "yes" : "no"}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs">
                    {formatAmount(row.amount0)} {row.symbol0}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs">
                    {formatAmount(row.amount1)} {row.symbol1}
                  </td>
                  <td className="px-2 py-2.5 font-mono">{formatUsd(row.valueMusd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
