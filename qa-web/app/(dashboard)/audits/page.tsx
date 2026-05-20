import AuditLauncher from '@/components/dashboard/AuditLauncher'
import PipelineView from '@/components/dashboard/PipelineView'
import RepoSelector from '@/components/dashboard/RepoSelector'
import TerminalLogs from '@/components/dashboard/TerminalLogs'

export default function AuditsPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <RepoSelector />
        <AuditLauncher />
      </div>
      <PipelineView />
      <TerminalLogs />
    </div>
  )
}
