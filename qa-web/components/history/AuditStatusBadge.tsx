import { cn } from '@/lib/utils'

interface AuditStatusBadgeProps {
  status: string
  className?: string
}

export function AuditStatusBadge({ status, className }: AuditStatusBadgeProps) {
  const s = status?.toLowerCase()

  const styles =
    s === 'completed' ? 'bg-accent-green/10 border-accent-green/25 text-accent-green' :
    s === 'running'   ? 'bg-accent-blue/10 border-accent-blue/25 text-accent-blue' :
    s === 'error'     ? 'bg-accent-red/10 border-accent-red/25 text-accent-red' :
                        'bg-s3 border-border text-faint'

  const dot =
    s === 'completed' ? 'bg-accent-green' :
    s === 'running'   ? 'bg-accent-blue animate-pulse' :
    s === 'error'     ? 'bg-accent-red' :
                        'bg-text-muted'

  const label =
    s === 'completed' ? 'Completed' :
    s === 'running'   ? 'Running' :
    s === 'error'     ? 'Failed' :
                        status

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider',
      styles, className
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
      {label}
    </span>
  )
}
