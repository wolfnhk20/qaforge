import AuditLauncher from '@/components/dashboard/AuditLauncher'
import FindingsTable from '@/components/dashboard/FindingsTable'
import PipelineView from '@/components/dashboard/PipelineView'
import RepoSelector from '@/components/dashboard/RepoSelector'
import ReportViewer from '@/components/dashboard/ReportViewer'
import TerminalLogs from '@/components/dashboard/TerminalLogs'

export default function DashboardPage() {
  return (
    <div className="p-5 lg:p-6 grid gap-4">
      {/* Primary grid: control + execution side-by-side */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        {/* Left column: config + launcher + pipeline */}
        <div className="grid gap-4 content-start">
          <RepoSelector />
          <AuditLauncher />
          <PipelineView />
        </div>
        {/* Right column: logs + findings preview */}
        <div className="grid gap-4 content-start">
          <TerminalLogs />
          <FindingsTable compact />
        </div>
      </div>

      {/* Full-width report */}
      <ReportViewer />
    </div>
  )
}
