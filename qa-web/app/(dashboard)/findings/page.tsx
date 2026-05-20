import FindingsTable from '@/components/dashboard/FindingsTable'
import ReportViewer from '@/components/dashboard/ReportViewer'

export default function FindingsPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <FindingsTable />
      <ReportViewer compact />
    </div>
  )
}
