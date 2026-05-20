import AuditLauncher from '@/components/dashboard/AuditLauncher'
import FindingsTable from '@/components/dashboard/FindingsTable'
import PipelineView from '@/components/dashboard/PipelineView'
import RepoSelector from '@/components/dashboard/RepoSelector'
import ReportViewer from '@/components/dashboard/ReportViewer'
import TerminalLogs from '@/components/dashboard/TerminalLogs'

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="grid gap-6">
          <RepoSelector />
          <AuditLauncher />
          <PipelineView />
        </div>
        <div className="grid gap-6">
          <TerminalLogs />
          <FindingsTable compact />
        </div>
      </div>

      <ReportViewer />
    </div>
  )
}
