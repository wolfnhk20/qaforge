'use client'

import { useAudit } from '@/hooks/useAudit'
import AuditLauncher from '@/components/dashboard/AuditLauncher'
import FindingsTable from '@/components/dashboard/FindingsTable'
import PipelineView from '@/components/dashboard/PipelineView'
import RepoSelector from '@/components/dashboard/RepoSelector'
import ReportViewer from '@/components/dashboard/ReportViewer'
import TerminalLogs from '@/components/dashboard/TerminalLogs'
import { RecentAudits } from '@/components/history/RecentAudits'

export default function DashboardPage() {
  const { phase } = useAudit()
  const hasAuditRun = phase !== 'idle'

  return (
    <div className="p-4 sm:p-5 lg:p-6 space-y-4">
      {/* Two-column grid on xl+, single column below */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* Left: config → launcher */}
        <div className="space-y-4">
          <RepoSelector />
          <AuditLauncher />
          {/* Recent history — always visible on dashboard */}
          <RecentAudits />
        </div>
        {/* Right: terminal → compact findings */}
        <div className="space-y-4">
          <TerminalLogs />
          {hasAuditRun && <FindingsTable compact />}
        </div>
      </div>

      {/* Multi-Agent Pipeline takes both columns */}
      {hasAuditRun && <PipelineView />}

      {/* Full-width report */}
      {hasAuditRun && <ReportViewer />}
    </div>
  )
}
