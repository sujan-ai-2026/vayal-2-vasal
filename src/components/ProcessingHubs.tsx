import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CircleAlert,
  Factory,
  PackageCheck,
  Wheat,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { calculateProcessingYield } from '../lib/calculations'
import { downloadCsv } from '../lib/csv'
import { COMMODITIES, type DashboardFilters } from '../lib/executiveDashboard'
import type { DemoDataset, ProcessingFacility } from '../data/models'
import { formatDemoTimestamp, formatNumber } from '../lib/formatters'

interface FacilityOverview {
  facility: ProcessingFacility
  batches: DemoDataset['processingBatches']
  inputKg: number
  outputKg: number
  lossKg: number
  sourceAcceptedKg: number
}

function inRange(timestamp: string, range: DashboardFilters['dateRange']): boolean {
  const timestampValue = Date.parse(timestamp)
  const referenceValue = Date.parse('2026-10-27T09:00:00+05:30')
  const start =
    range === 'season'
      ? Date.parse('2026-09-01T00:00:00+05:30')
      : referenceValue - (range === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000
  return Number.isFinite(timestampValue) && timestampValue >= start && timestampValue <= referenceValue
}

function ProcessingHubs({
  data,
  filters,
}: {
  data: DemoDataset
  filters: DashboardFilters
}) {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const facilities = useMemo<FacilityOverview[]>(() => {
    return data.processingFacilities
      .filter((facility) =>
        (filters.districtId === 'all' || facility.districtId === filters.districtId) &&
        (filters.commodityId === 'all' || facility.supportedCommodities.includes(filters.commodityId)),
      )
      .map((facility) => {
        const batches = data.processingBatches.filter((batch) => {
          const product = data.products.find((item) => item.id === batch.productId)
          return (
            batch.facilityId === facility.id &&
            product !== undefined &&
            (filters.commodityId === 'all' || product.commodityId === filters.commodityId) &&
            inRange(batch.processedAt, filters.dateRange)
          )
        })
        const inputKg = batches.reduce((total, batch) => total + batch.inputQuantityKg, 0)
        const outputKg = batches.reduce((total, batch) => total + batch.outputQuantityKg, 0)
        const sourceLotIds = new Set(batches.flatMap((batch) => batch.sourceLotIds))
        const sourceAcceptedKg = data.procurementLots
          .filter(
            (lot) =>
              sourceLotIds.has(lot.id) &&
              (filters.commodityId === 'all' || lot.commodityId === filters.commodityId),
          )
          .reduce((total, lot) => total + lot.acceptedQuantityKg, 0)
        return {
          facility,
          batches,
          inputKg,
          outputKg,
          lossKg: Math.max(inputKg - outputKg, 0),
          sourceAcceptedKg,
        }
      })
  }, [data, filters])

  const selected = facilities.find((item) => item.facility.id === selectedFacilityId) ?? null
  const totalInputKg = facilities.reduce((total, item) => total + item.inputKg, 0)
  const totalOutputKg = facilities.reduce((total, item) => total + item.outputKg, 0)
  const yields = facilities.flatMap((item) =>
    item.batches.map((batch) => calculateProcessingYield(batch))
      .filter((result) => result.status === 'available')
      .map((result) => result.value),
  )
  const overallYield = totalInputKg > 0 ? (totalOutputKg / totalInputKg) * 100 : null
  const districts = new Map(data.districts.map((district) => [district.id, district.name]))

  return (
    <div className="operations-page">
      <section className="operations-intro processing-intro">
        <div>
          <p className="eyebrow">SIMULATED FACILITIES · SYNTHETIC PRODUCTION RECORDS</p>
          <h2>Processing capacity, batch yield and input/output reconciliation.</h2>
          <p>
            Facilities and operating values are simulated for this prototype. Yield is accepted
            output quantity divided by recorded input quantity in comparable kilograms.
          </p>
        </div>
        <span className="operations-intro-icon"><Factory size={22} /></span>
      </section>

      <section className="operations-metric-grid" aria-label="Processing summary">
        <SummaryCard icon={Factory} label="Simulated facilities" value={formatNumber(facilities.length)} detail="Within selected district scope" />
        <SummaryCard icon={Wheat} label="Recorded batch input" value={`${(totalInputKg / 1000).toFixed(2)} MT`} detail="Batch-recorded processing input" />
        <SummaryCard icon={PackageCheck} label="Recorded output" value={`${(totalOutputKg / 1000).toFixed(2)} MT`} detail="Output quantity, not warehouse stock" />
        <SummaryCard icon={ArrowUpRight} label="Weighted processing yield" value={overallYield === null ? 'Insufficient data' : `${overallYield.toFixed(1)}%`} detail={yields.length ? `${yields.length} batches with valid input` : 'No comparable batch input'} />
      </section>

      <section className="operations-panel">
        <PanelTitle eyebrow="FACILITY REGISTER" title="Processing facilities" meta={`${facilities.length} facilities · simulated capacity`} />
        <div className="operations-panel-actions">
          <button className="subtle-button" onClick={() => downloadCsv('processing-facilities-demo.csv', [
            ['Facility ID', 'Facility', 'District', 'Supported commodities', 'Simulated daily capacity kg', 'Input kg', 'Output kg', 'Yield %', 'Processing loss kg', 'Batch references'],
            ...facilities.map((item) => [
              item.facility.id,
              item.facility.name,
              districts.get(item.facility.districtId) ?? item.facility.location,
              item.facility.supportedCommodities.join('; '),
              item.facility.dailyCapacityKg,
              item.inputKg,
              item.outputKg,
              item.inputKg > 0 ? (item.outputKg / item.inputKg) * 100 : 'Insufficient data',
              item.inputKg > 0 ? item.lossKg : 'Insufficient data',
              item.batches.map((batch) => batch.id).join('; '),
            ]),
          ])} type="button">Export filtered CSV</button>
        </div>
        {facilities.length > 0 ? (
          <div className="operations-table-wrap">
            <table className="operations-table processing-table">
              <thead>
                <tr>
                  <th scope="col">Facility / location</th>
                  <th scope="col">Commodities</th>
                  <th scope="col">Daily capacity</th>
                  <th scope="col">Input</th>
                  <th scope="col">Output</th>
                  <th scope="col">Yield</th>
                  <th scope="col">Processing loss</th>
                  <th scope="col">Production status</th>
                  <th scope="col"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((item) => {
                  const yieldPercent = item.inputKg > 0 ? (item.outputKg / item.inputKg) * 100 : null
                  const facilityDistrict = districts.get(item.facility.districtId) ?? item.facility.location
                  const batchReferences = item.batches.map((batch) => batch.outputReference).join(', ')
                  return (
                    <tr key={item.facility.id}>
                      <td>
                        <strong>{item.facility.name}</strong>
                        <small>{facilityDistrict} · {item.facility.location}</small>
                      </td>
                      <td>{item.facility.supportedCommodities.map((id) => COMMODITIES.find((commodity) => commodity.id === id)?.label ?? id).join(', ')}</td>
                      <td><strong>{formatNumber(item.facility.dailyCapacityKg)} kg</strong><small>Simulated / day</small></td>
                      <td><strong>{formatNumber(item.inputKg)} kg</strong><small>Accepted source lots: {formatNumber(item.sourceAcceptedKg)} kg</small></td>
                      <td><strong>{formatNumber(item.outputKg)} kg</strong><small>{batchReferences || 'No batch in range'}</small></td>
                      <td>{yieldPercent === null ? 'Insufficient data' : `${yieldPercent.toFixed(1)}%`}</td>
                      <td>
                        {item.inputKg > 0 ? `${formatNumber(item.lossKg)} kg` : 'Insufficient data'}
                        {item.inputKg > 0 && <small>Processing stage only</small>}
                      </td>
                      <td><span className={`operations-status status-${item.facility.operatingStatus === 'simulated-operational' ? 'available' : 'maintenance'}`}><i />{item.facility.operatingStatus === 'simulated-operational' ? 'Simulated operational' : 'Simulated maintenance'}</span><small>{item.batches.some((batch) => batch.status === 'exception') ? 'Batch exception present' : `${item.batches.length} batches in range`}</small></td>
                      <td><button className="subtle-button" onClick={() => setSelectedFacilityId(item.facility.id)} type="button">View</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <OperationsEmpty message="No processing facility matches the selected district and commodity." />}
        <p className="operations-footnote">
          Capacity and operating state are simulated. Processing loss is input minus accepted output; it is not transport or storage loss.
        </p>
      </section>

      <section className="operations-split">
        <article className="operations-panel">
          <PanelTitle eyebrow="BATCH RECONCILIATION" title="Accepted lot input → product output" meta="kg · shared records" />
          {facilities.some((facility) => facility.batches.length > 0) ? (
            <div className="batch-reconciliation-list">
              {facilities.flatMap((facility) => facility.batches.map((batch) => {
                const product = data.products.find((item) => item.id === batch.productId)
                const linkedLots = data.procurementLots.filter((lot) => batch.sourceLotIds.includes(lot.id))
                const acceptedLotKg = linkedLots.reduce((total, lot) => total + lot.acceptedQuantityKg, 0)
                const yieldResult = calculateProcessingYield(batch)
                const gapKg = acceptedLotKg - batch.inputQuantityKg
                return (
                  <div className="batch-reconciliation-row" key={batch.id}>
                    <span className="batch-recon-icon"><Boxes size={16} /></span>
                    <div className="batch-recon-main">
                      <strong>{batch.id} · {product?.name ?? 'Unknown product'}</strong>
                      <small>{facility.facility.name} · source lots {batch.sourceLotIds.join(', ') || 'not linked'}</small>
                    </div>
                    <div className="batch-recon-quantity"><small>Accepted source lots</small><strong>{formatNumber(acceptedLotKg)} kg</strong></div>
                    <div className="batch-recon-quantity"><small>Batch input → output</small><strong>{formatNumber(batch.inputQuantityKg)} → {formatNumber(batch.outputQuantityKg)} kg</strong></div>
                    <div className={`batch-recon-delta${gapKg === 0 ? ' delta-balanced' : ' delta-warning'}`}>
                      <small>Linked acceptance gap</small>
                      <strong>{gapKg > 0 ? '+' : ''}{formatNumber(gapKg)} kg</strong>
                    </div>
                    <span className={`batch-state batch-${batch.status}`}>{batch.status.replace('-', ' ')}</span>
                    <small className="batch-yield">{yieldResult.status === 'available' ? `${yieldResult.value.toFixed(1)}% yield` : 'Yield unavailable'}</small>
                  </div>
                )
              }))}
            </div>
          ) : <OperationsEmpty message="No processing batches match the selected date and filters." />}
        </article>
        <article className="operations-panel processing-activity-panel">
          <PanelTitle eyebrow="RECENT FACILITY ACTIVITY" title="Production and trace events" meta="Synthetic history" />
          <div className="operations-activity-list">
            {facilities.flatMap((facility) =>
              data.traceabilityEvents
                .filter((event) => facility.batches.some((batch) => batch.id === event.processingBatchId))
                .map((event) => ({ event, facility })),
            )
              .sort((left, right) => Date.parse(right.event.occurredAt) - Date.parse(left.event.occurredAt))
              .slice(0, 6)
              .map(({ event, facility }) => (
                <div className="operations-activity-row" key={event.id}>
                  <span className={`activity-marker${event.status === 'verified-demo-record' ? '' : ' activity-traceability'}`} />
                  <span><strong>{event.stage.replaceAll('-', ' ')}</strong><small>{event.processingBatchId} · {facility.facility.name} · {event.location}</small></span>
                  <time dateTime={event.occurredAt}>{formatDemoTimestamp(event.occurredAt)}</time>
                </div>
              ))}
            {facilities.every((facility) => facility.batches.length === 0) && (
              <OperationsEmpty message="No facility activity matches this scope." />
            )}
          </div>
          <p className="operations-footnote">Processing, freight, storage and retail are separate stages with separate loss records.</p>
        </article>
      </section>

      {selected && (
        <div className="operations-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedFacilityId(null) }}>
          <section aria-labelledby="facility-detail-title" aria-modal="true" className="operations-drawer" role="dialog">
            <div className="drawer-heading">
              <div><p className="eyebrow">FACILITY DETAIL · SIMULATED</p><h2 id="facility-detail-title">{selected.facility.name}</h2><p>{districts.get(selected.facility.districtId)} · {selected.facility.location}</p></div>
              <button aria-label="Close facility details" className="icon-button" onClick={() => setSelectedFacilityId(null)} type="button">×</button>
            </div>
            <div className="drawer-summary-grid">
              <SummaryCard icon={ArrowDownRight} label="Batch input" value={`${formatNumber(selected.inputKg)} kg`} detail="Recorded processing input" />
              <SummaryCard icon={PackageCheck} label="Batch output" value={`${formatNumber(selected.outputKg)} kg`} detail="Accepted output quantity" />
              <SummaryCard icon={Factory} label="Daily capacity" value={`${formatNumber(selected.facility.dailyCapacityKg)} kg`} detail="Simulated facility value" />
            </div>
            <div className="drawer-content">
              <h3>Production batches</h3>
              {selected.batches.length > 0 ? selected.batches.map((batch) => {
                const product = data.products.find((item) => item.id === batch.productId)
                const yieldResult = calculateProcessingYield(batch)
                const traceEvents = data.traceabilityEvents.filter((event) => event.processingBatchId === batch.id)
                return (
                  <article className="detail-batch-card" key={batch.id}>
                    <div className="detail-batch-title"><div><strong>{batch.id}</strong><small>{product?.name ?? 'Product unavailable'} · {product?.brandLabel ?? 'No brand label'}</small></div><span className={`batch-state batch-${batch.status}`}>{batch.status.replace('-', ' ')}</span></div>
                    <div className="batch-detail-stats"><span>Input <strong>{formatNumber(batch.inputQuantityKg)} kg</strong></span><span>Output <strong>{formatNumber(batch.outputQuantityKg)} kg</strong></span><span>Yield <strong>{yieldResult.status === 'available' ? `${yieldResult.value.toFixed(1)}%` : 'Insufficient data'}</strong></span></div>
                    <p>Source lots: {batch.sourceLotIds.join(', ') || 'No procurement lot linked'}</p>
                    <p>Input ref: {batch.sourceLotIds.join(', ') || '—'} · Output ref: {batch.outputReference}</p>
                    <div className="detail-trace-list">
                      {traceEvents.length ? traceEvents.map((event) => <span key={event.id} className={event.status === 'verified-demo-record' ? '' : 'trace-incomplete'}>{event.stage.replaceAll('-', ' ')} · {event.reference} · {formatDemoTimestamp(event.occurredAt)}</span>) : <span>No trace events are recorded for this batch.</span>}
                    </div>
                  </article>
                )
              }) : <OperationsEmpty message="No batches are available for this facility in the selected date and commodity scope." />}
              <p className="operations-footnote">The linked accepted procurement quantity and recorded batch input may differ. The difference is shown explicitly and is not silently reconciled.</p>
              <Link className="panel-action-link" to="/batch-traceability">Open batch traceability <ArrowRight size={14} /></Link>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}) {
  return <article className="operations-metric-card"><span className="operations-metric-icon"><Icon size={16} /></span><span className="operations-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function PanelTitle({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) {
  return <div className="operations-panel-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>
}

function OperationsEmpty({ message }: { message: string }) {
  return <div className="operations-empty"><CircleAlert size={18} /><p>{message}</p></div>
}

export default ProcessingHubs
