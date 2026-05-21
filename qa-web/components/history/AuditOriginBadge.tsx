import { GitBranch, MousePointer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditOriginBadgeProps {
  origin?: string
  className?: string
}

export function AuditOriginBadge({ origin, className }: AuditOriginBadgeProps) {
  const isWebhook = origin === 'github_push'

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-mono text-faint',
      className
    )}>
      {isWebhook
        ? <><GitBranch className="w-3 h-3" /> Webhook</>
        : <><MousePointer className="w-3 h-3" /> Manual</>
      }
    </span>
  )
}
