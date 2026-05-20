import PipelineView from '@/components/dashboard/PipelineView'
import TerminalLogs from '@/components/dashboard/TerminalLogs'
import AuditLauncher from '@/components/dashboard/AuditLauncher'

export default function AuditsPage() {
  return (
    <div className="p-4 sm:p-5 lg:p-6 grid gap-4">
      <div className="mb-1">
        <h1 className="text-[16px] sm:text-[18px] font-semibold text-ink">Audit Execution</h1>
        <p className="text-[12px] text-faint mt-1">Trigger and monitor the LangGraph multi-agent audit pipeline</p>
      </div>
      <AuditLauncher />
      <PipelineView />
      <TerminalLogs />
    </div>
  )
}
