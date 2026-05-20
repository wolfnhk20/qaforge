import FindingsTable from '@/components/dashboard/FindingsTable'
import ReportViewer from '@/components/dashboard/ReportViewer'

export default function FindingsPage() {
  return (
    <div className="p-5 lg:p-6 grid gap-4">
      <div className="mb-2">
        <h1 className="text-[18px] font-semibold text-ink">Findings Explorer</h1>
        <p className="text-[12px] text-faint mt-1">Behavioral gaps detected by probe execution across your repository surface</p>
      </div>
      <FindingsTable />
      <ReportViewer compact />
    </div>
  )
}
