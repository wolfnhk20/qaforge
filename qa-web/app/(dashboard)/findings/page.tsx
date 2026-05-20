import FindingsTable from '@/components/dashboard/FindingsTable'
import ReportViewer from '@/components/dashboard/ReportViewer'

export default function FindingsPage() {
  return (
    <div className="p-4 sm:p-5 lg:p-6 space-y-4">
      <div>
        <h1 className="text-[16px] sm:text-[18px] font-semibold text-ink">Findings Explorer</h1>
        <p className="text-[12px] text-faint mt-1">
          Behavioral gaps detected by probe execution across your repository surface
        </p>
      </div>
      <FindingsTable />
      {/* Report below findings — no fullHeight, let it be natural */}
      <ReportViewer />
    </div>
  )
}
