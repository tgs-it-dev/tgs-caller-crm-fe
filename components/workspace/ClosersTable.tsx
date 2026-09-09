export type Closer = {
  id: string
  name: string
  dateRange: string
  status: string
}

export const MOCK_CLOSERS: Closer[] = [
  { id: '1', name: 'Mubeen N.', dateRange: '08.08.2026', status: 'Completed' },
  { id: '2', name: 'Ayesha K.', dateRange: '08.08.2026', status: 'Available' },
  { id: '3', name: 'Omar R.', dateRange: '08.09.2026', status: 'Available' },
  { id: '4', name: 'Sara L.', dateRange: '08.09.2026', status: 'On Call' },
  { id: '5', name: 'Daniel P.', dateRange: '08.10.2026', status: 'Available' },
  { id: '6', name: 'Nina V.', dateRange: '08.10.2026', status: 'Completed' },
  { id: '7', name: 'Chris T.', dateRange: '08.11.2026', status: 'Available' },
  { id: '8', name: 'Elena M.', dateRange: '08.11.2026', status: 'On Call' },
  { id: '9', name: 'Hassan J.', dateRange: '08.12.2026', status: 'Available' },
  { id: '10', name: 'Priya S.', dateRange: '08.12.2026', status: 'Completed' },
  { id: '11', name: 'Leo W.', dateRange: '08.13.2026', status: 'Available' },
  { id: '12', name: 'Maya C.', dateRange: '08.13.2026', status: 'Available' },
]

export function ClosersTable({ closers }: { closers: Closer[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate/20 text-left text-xs font-medium text-slate">
          <th className="pb-2 font-medium">Name</th>
          <th className="pb-2 font-medium">Date Range</th>
          <th className="pb-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {closers.map((closer) => (
          <tr key={closer.id} className="border-b border-slate/10 last:border-0">
            <td className="py-2.5 text-ink">{closer.name}</td>
            <td className="py-2.5 text-ink">{closer.dateRange}</td>
            <td className="py-2.5 font-medium text-status-green">{closer.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
