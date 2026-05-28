import type { ApproachComparisonRow } from "@/lib/types";

type ApproachComparisonTableProps = {
  rows: ApproachComparisonRow[];
};

export default function ApproachComparisonTable({ rows }: ApproachComparisonTableProps) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#e8e4dc] bg-white">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#e8e4dc] bg-[#faf8f5]">
            <th className="px-4 py-3 font-semibold text-[#3d4540]">アプローチ</th>
            <th className="px-4 py-3 font-semibold text-[#3d4540]">タイミング</th>
            <th className="px-4 py-3 font-semibold text-[#3d4540]">単位</th>
            <th className="px-4 py-3 font-semibold text-[#3d4540]">不可逆行動への対応</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.approach}-${i}`}
              className={`border-b border-[#f0ede6] last:border-0 ${
                row.highlight ? "bg-[#f7f4ef]" : ""
              }`}
            >
              <td className="px-4 py-3 font-medium text-[#1a1f1c]">{row.approach}</td>
              <td className="px-4 py-3 text-[#4a524a]">{row.timing}</td>
              <td className="px-4 py-3 text-[#4a524a]">{row.unit}</td>
              <td className="px-4 py-3 text-[#4a524a]">{row.irreversible}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
