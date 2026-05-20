import ReportViewer from '@/components/dashboard/ReportViewer'

export default function ReportsPage() {
  return (
    <div className="p-4 sm:p-5 lg:p-6 space-y-4">
      <div>
        <h1 className="text-[16px] sm:text-[18px] font-semibold text-ink">Audit Reports</h1>
        <p className="text-[12px] text-faint mt-1">
          Narrative engineering output synthesized from the agent pipeline
        </p>
      </div>
      <ReportViewer />
    </div>
  )
}
