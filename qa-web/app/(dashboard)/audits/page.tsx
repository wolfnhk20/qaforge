'use client'

import { useState } from 'react'
import { useAuditHistory } from '@/hooks/useAuditHistory'
import { AuditHistoryTable } from '@/components/history/AuditHistoryTable'
import { AuditDetailPanel } from '@/components/history/AuditDetailPanel'
import type { AuditHistoryRecord } from '@/types'

export default function AuditsPage() {
  const { audits, isLoading, isError, isFetching, refetch } = useAuditHistory()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const selectedRecord = audits.find((a) => a.id === selectedId) ?? null

  function handleSelect(id: number) {
    setSelectedId(prev => prev === id ? null : id)
  }

  return (
    <div className="p-4 sm:p-5 lg:p-6 space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-[16px] sm:text-[18px] font-semibold text-ink">Audit History</h1>
        <p className="text-[12px] text-faint mt-1">
          Browse all persisted audit executions from Supabase. Click a row to inspect findings, logs, and the generated report.
        </p>
      </div>

      {/* Split layout when an audit is selected */}
      <div className={selectedRecord
        ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 items-start'
        : 'grid grid-cols-1 gap-4'
      }>
        {/* Master list */}
        <AuditHistoryTable
          audits={audits}
          selectedId={selectedId}
          onSelect={handleSelect}
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          onRefresh={refetch}
        />

        {/* Detail panel — slides in when row is selected */}
        {selectedRecord && (
          <AuditDetailPanel
            record={selectedRecord}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}
