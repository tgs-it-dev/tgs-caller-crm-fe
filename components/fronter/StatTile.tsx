export function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate/20 bg-white px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  )
}
