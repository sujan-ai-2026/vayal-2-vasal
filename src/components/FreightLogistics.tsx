import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownRight,
  ArrowRight,
  CircleAlert,
  Clock3,
  MapPin,
  PackageCheck,
  Truck,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DemoDataset, Shipment, ShipmentStatus } from '../data/models'
import { calculateFreightDelayHours } from '../lib/calculations'
import { COMMODITIES, type DashboardFilters } from '../lib/executiveDashboard'
import { formatDemoTimestamp, formatNumber } from '../lib/formatters'
import { downloadCsv } from '../lib/csv'
import { getAllowedShipmentTransitions, updateShipmentStatus } from '../services/mockDataService'

const REFERENCE_TIME = new Date('2026-10-27T09:00:00+05:30')
const STATUS_LABELS: Record<ShipmentStatus, string> = {
  planned: 'Planned',
  dispatched: 'Dispatched',
  'in-transit': 'In Transit',
  delivered: 'Delivered',
  delayed: 'Delayed',
  exception: 'Exception',
}

function isWithinRange(timestamp: string | null, range: DashboardFilters['dateRange']): boolean {
  if (!timestamp) return false
  const parsed = Date.parse(timestamp)
  const reference = REFERENCE_TIME.getTime()
  const start = range === 'season'
    ? Date.parse('2026-09-01T00:00:00+05:30')
    : reference - (range === '7d' ? 7 : 30) * 86_400_000
  return Number.isFinite(parsed) && parsed >= start && parsed <= reference
}

function shipmentDistrictIds(data: DemoDataset, shipment: Shipment): string[] {
  const originId = data.warehouses.find((warehouse) => warehouse.id === shipment.originWarehouseId)?.districtId
  const destinationWarehouseId = data.warehouses.find(
    (warehouse) => warehouse.id === shipment.destinationWarehouseId,
  )?.districtId
  const destinationStoreId = data.retailStores.find(
    (store) => store.id === shipment.destinationRetailStoreId,
  )?.districtId
  return [originId, destinationWarehouseId, destinationStoreId].filter(
    (id): id is string => id !== undefined,
  )
}

function FreightLogistics({
  data,
  filters,
  onDataChange,
  canMutate,
  demoUserId,
}: {
  data: DemoDataset
  filters: DashboardFilters
  onDataChange: (dataset: DemoDataset) => void
  canMutate: boolean
  demoUserId: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ShipmentStatus>('all')
  const [pendingStatus, setPendingStatus] = useState<ShipmentStatus | null>(null)
  const [changeNote, setChangeNote] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const districtNames = useMemo(
    () => new Map(data.districts.map((district) => [district.id, district.name])),
    [data.districts],
  )
  const shipments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return data.shipments.filter((shipment) => {
      const districts = shipmentDistrictIds(data, shipment)
      const batches = shipment.processingBatchIds.join(' ')
      const origin = data.warehouses.find((item) => item.id === shipment.originWarehouseId)
      const destination = data.warehouses.find((item) => item.id === shipment.destinationWarehouseId)
      const store = data.retailStores.find((item) => item.id === shipment.destinationRetailStoreId)
      const text = [
        shipment.id,
        shipment.vehicleReference,
        shipment.carrierReference,
        batches,
        origin?.name,
        destination?.name,
        store?.name,
      ].join(' ').toLocaleLowerCase()
      return (
        (filters.districtId === 'all' || districts.includes(filters.districtId)) &&
        (filters.commodityId === 'all' || shipment.commodityId === filters.commodityId) &&
        isWithinRange(shipment.dispatchedAt ?? shipment.expectedArrivalAt, filters.dateRange) &&
        (statusFilter === 'all' || shipment.status === statusFilter) &&
        (!needle || text.includes(needle))
      )
    }).sort((left, right) =>
      Date.parse(right.dispatchedAt ?? right.expectedArrivalAt ?? '') -
      Date.parse(left.dispatchedAt ?? left.expectedArrivalAt ?? ''),
    )
  }, [data, filters, search, statusFilter])

  const selected = data.shipments.find((shipment) => shipment.id === selectedId) ?? null
  const overdueShipments = shipments.filter((shipment) => {
    if (shipment.status === 'delivered' || !shipment.expectedArrivalAt) return false
    const delay = calculateFreightDelayHours(shipment, REFERENCE_TIME)
    return delay.status === 'available' && delay.value > 0
  })
  const delayedHours = (shipment: Shipment) => {
    const result = calculateFreightDelayHours(shipment, REFERENCE_TIME)
    return result.status === 'available' ? result.value : null
  }
  const districtName = (districtId: string | undefined) =>
    districtId ? districtNames.get(districtId) ?? 'Unknown district' : null
  const locationName = (shipment: Shipment, side: 'origin' | 'destination') => {
    if (side === 'origin') {
      return data.warehouses.find((warehouse) => warehouse.id === shipment.originWarehouseId)?.name
        ?? 'Origin unavailable'
    }
    return data.warehouses.find((warehouse) => warehouse.id === shipment.destinationWarehouseId)?.name
      ?? data.retailStores.find((store) => store.id === shipment.destinationRetailStoreId)?.name
      ?? 'Destination unavailable'
  }

  function applyStatusChange() {
    if (!selected || !pendingStatus) return
    setError('')
    try {
      const updated = updateShipmentStatus(data, selected.id, pendingStatus, changeNote, demoUserId)
      onDataChange(updated)
      setToast(`${selected.id} · ${STATUS_LABELS[pendingStatus]} recorded`)
      setPendingStatus(null)
      setChangeNote('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Shipment status could not be updated.')
    }
  }

  function timeline(shipment: Shipment) {
    const baseEvents: Array<{ label: string; occurredAt: string | null; note: string }> = [
      { label: 'Dispatched', occurredAt: shipment.dispatchedAt, note: 'Simulated dispatch time; no GPS tracking.' },
      { label: 'Expected arrival', occurredAt: shipment.expectedArrivalAt, note: 'Recorded expected timestamp.' },
      { label: 'Delivered', occurredAt: shipment.actualArrivalAt, note: shipment.deliveredQuantityKg === null ? 'Awaiting destination receipt.' : `${formatNumber(shipment.deliveredQuantityKg)} kg recorded at destination.` },
    ].filter((event) => event.occurredAt)
    const statusEvents = data.shipmentStatusEvents
      .filter((event) => event.shipmentId === shipment.id)
      .map((event) => ({
        label: STATUS_LABELS[event.toStatus],
        occurredAt: event.occurredAt,
        note: event.note,
      }))
    const byTimestamp = new Map<string, { label: string; occurredAt: string; note: string }>()
    for (const event of [...baseEvents, ...statusEvents]) {
      if (event.occurredAt) byTimestamp.set(`${event.label}-${event.occurredAt}`, { ...event, occurredAt: event.occurredAt })
    }
    return [...byTimestamp.values()].sort(
      (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
    )
  }

  return (
    <div className="operations-page">
      <section className="operations-intro freight-intro">
        <div>
          <p className="eyebrow">SIMULATED FREIGHT · NO LIVE GPS TRACKING</p>
          <h2>Dispatch, arrival and recorded freight discrepancies across the pilot routes.</h2>
          <p>Route lines and shipment statuses are synthetic planning records. They do not represent vehicle location or live movement.</p>
        </div>
        <span className="operations-intro-icon"><Truck size={22} /></span>
      </section>

      {toast && <div className="operations-toast" role="status"><PackageCheck size={16} /><span>{toast}</span><button aria-label="Dismiss confirmation" onClick={() => setToast('')} type="button"><X size={14} /></button></div>}

      <section className="operations-metric-grid" aria-label="Freight summary">
        <SummaryCard icon={Truck} label="Shipments in scope" value={formatNumber(shipments.length)} detail="Synthetic dispatch records" />
        <SummaryCard icon={Clock3} label="Overdue arrivals" value={formatNumber(overdueShipments.length)} detail="Expected timestamp has passed" warning={overdueShipments.length > 0} />
        <SummaryCard icon={ArrowDownRight} label="Recorded freight loss" value={`${formatNumber(shipments.reduce((total, shipment) => total + (shipment.recordedLossKg ?? 0), 0))} kg`} detail="Loss/discrepancy recorded in shipment records" />
        <SummaryCard icon={PackageCheck} label="Delivered quantity" value={`${formatNumber(shipments.reduce((total, shipment) => total + (shipment.deliveredQuantityKg ?? 0), 0))} kg`} detail="Synthetic destination quantity" />
      </section>

      <section className="operations-panel">
        <PanelTitle eyebrow="SHIPMENT REGISTER" title="Freight & logistics" meta={`${shipments.length} records · simulated status`} />
        <div className="operations-panel-actions">
          <button className="subtle-button" onClick={() => downloadCsv('freight-shipments-demo.csv', [
            ['Shipment ID', 'Origin warehouse', 'Destination', 'Districts', 'Batch IDs', 'Commodity', 'Dispatch kg', 'Delivered kg', 'Status', 'Vehicle', 'Carrier', 'Dispatched at', 'Expected arrival', 'Actual arrival', 'Recorded loss kg'],
            ...shipments.map((shipment) => [
              shipment.id,
              locationName(shipment, 'origin'),
              locationName(shipment, 'destination'),
              shipmentDistrictIds(data, shipment).map((id) => districtName(id)).join('; '),
              shipment.processingBatchIds.join('; '),
              shipment.commodityId,
              shipment.dispatchQuantityKg,
              shipment.deliveredQuantityKg ?? 'Not recorded',
              STATUS_LABELS[shipment.status],
              shipment.vehicleReference,
              shipment.carrierReference,
              shipment.dispatchedAt ?? 'Not recorded',
              shipment.expectedArrivalAt ?? 'Not recorded',
              shipment.actualArrivalAt ?? 'Not recorded',
              shipment.recordedLossKg ?? 'Not recorded',
            ]),
          ])} type="button">Export filtered CSV</button>
        </div>
        <div className="operations-toolbar">
          <label className="operations-search"><span className="sr-only">Search shipments</span><input aria-label="Search shipments" onChange={(event) => setSearch(event.target.value)} placeholder="Search shipment, batch, vehicle, carrier or location" value={search} /></label>
          <label className="operations-filter-label">Status
            <select aria-label="Shipment status filter" onChange={(event) => setStatusFilter(event.target.value as 'all' | ShipmentStatus)} value={statusFilter}>
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        </div>
        {shipments.length > 0 ? (
          <div className="operations-table-wrap">
            <table className="operations-table freight-table">
              <thead><tr><th>Shipment / route</th><th>Batch / commodity</th><th>Dispatch</th><th>Expected / actual</th><th>Status / delay</th><th>Quantity / loss</th><th>Vehicle / carrier</th><th>Details</th></tr></thead>
              <tbody>
                {shipments.map((shipment) => {
                  const districts = shipmentDistrictIds(data, shipment)
                  const delay = delayedHours(shipment)
                  return (
                    <tr key={shipment.id}>
                      <td><strong>{shipment.id}</strong><small>{districtName(districts[0]) ?? 'Unknown'} → {districtName(districts[1] ?? districts[0]) ?? 'Unknown'}</small><small>{locationName(shipment, 'origin')} → {locationName(shipment, 'destination')}</small></td>
                      <td><strong>{shipment.processingBatchIds.join(', ')}</strong><small>{COMMODITIES.find((item) => item.id === shipment.commodityId)?.label ?? shipment.commodityId}</small></td>
                      <td>{shipment.dispatchedAt ? formatDemoTimestamp(shipment.dispatchedAt) : 'Not dispatched'}</td>
                      <td><strong>{shipment.expectedArrivalAt ? formatDemoTimestamp(shipment.expectedArrivalAt) : 'Not set'}</strong><small>{shipment.actualArrivalAt ? `Actual ${formatDemoTimestamp(shipment.actualArrivalAt)}` : 'No actual arrival recorded'}</small></td>
                      <td><span className={`operations-status status-${shipment.status}`}><i />{STATUS_LABELS[shipment.status]}</span><small>{delay !== null && delay > 0 && shipment.status !== 'delivered' ? `${formatNumber(delay)}h overdue` : 'Simulated movement'}</small></td>
                      <td><strong>{formatNumber(shipment.dispatchQuantityKg)} kg dispatched</strong><small>{shipment.deliveredQuantityKg === null ? 'Delivered qty not recorded' : `${formatNumber(shipment.deliveredQuantityKg)} kg received`} · {shipment.recordedLossKg === null ? 'Loss n/a' : `${formatNumber(shipment.recordedLossKg)} kg loss`}</small></td>
                      <td><strong>{shipment.vehicleReference}</strong><small>{shipment.carrierReference}</small></td>
                      <td><button className="subtle-button" onClick={() => { setSelectedId(shipment.id); setError('') }} type="button">View</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <OperationsEmpty message="No shipment records match the selected date, district, commodity and search filters." />}
        <p className="operations-footnote">All vehicle, carrier, route and movement-status information is synthetic. Overdue flags use the expected-arrival timestamp and fixed demo reference time.</p>
      </section>

      <section className="operations-panel route-panel">
        <PanelTitle eyebrow="PILOT CORRIDOR VIEW" title="Route overview · simulated, not GPS" meta="No geographic precision implied" />
        <div className="route-overview">
          {shipments.slice(0, 4).map((shipment) => (
            <button className="route-strip" key={shipment.id} onClick={() => setSelectedId(shipment.id)} type="button">
              <span className="route-point"><MapPin size={14} /><strong>{locationName(shipment, 'origin')}</strong></span>
              <span className="route-line"><i /><small>{shipment.id} · {formatNumber(shipment.dispatchQuantityKg)} kg</small><ArrowRight size={13} /></span>
              <span className="route-point"><MapPin size={14} /><strong>{locationName(shipment, 'destination')}</strong></span>
              <span className={`batch-state batch-${shipment.status}`}>{STATUS_LABELS[shipment.status]}</span>
            </button>
          ))}
          {shipments.length === 0 && <OperationsEmpty message="No route records are in the current filter scope." />}
        </div>
      </section>

      {selected && (
        <div className="operations-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !pendingStatus) setSelectedId(null) }}>
          <section aria-labelledby="shipment-detail-title" aria-modal="true" className="operations-drawer" role="dialog">
            <div className="drawer-heading">
              <div><p className="eyebrow">SHIPMENT DETAIL · SYNTHETIC RECORD</p><h2 id="shipment-detail-title">{selected.id}</h2><p>{locationName(selected, 'origin')} → {locationName(selected, 'destination')}</p></div>
              <button aria-label="Close shipment details" className="icon-button" onClick={() => { setSelectedId(null); setPendingStatus(null) }} type="button"><X size={18} /></button>
            </div>
            <div className="inventory-detail-grid shipment-detail-grid">
              <span>Status<strong>{STATUS_LABELS[selected.status]}</strong></span>
              <span>Commodity<strong>{COMMODITIES.find((item) => item.id === selected.commodityId)?.label ?? selected.commodityId}</strong></span>
              <span>Related batches<strong>{selected.processingBatchIds.join(', ')}</strong></span>
              <span>Dispatch quantity<strong>{formatNumber(selected.dispatchQuantityKg)} kg</strong></span>
              <span>Delivered / loss<strong>{selected.deliveredQuantityKg === null ? 'Unrecorded' : `${formatNumber(selected.deliveredQuantityKg)} kg`} / {selected.recordedLossKg === null ? 'n/a' : `${formatNumber(selected.recordedLossKg)} kg`}</strong></span>
              <span>Vehicle / carrier<strong>{selected.vehicleReference} · {selected.carrierReference}</strong></span>
              <span>Dispatch<strong>{selected.dispatchedAt ? formatDemoTimestamp(selected.dispatchedAt) : 'Not dispatched'}</strong></span>
              <span>Expected / actual<strong>{selected.expectedArrivalAt ? formatDemoTimestamp(selected.expectedArrivalAt) : 'Not set'} / {selected.actualArrivalAt ? formatDemoTimestamp(selected.actualArrivalAt) : 'Not recorded'}</strong></span>
            </div>
            <div className="route-drawer-visual">
              <span><MapPin size={15} />{locationName(selected, 'origin')}</span><i /><span><MapPin size={15} />{locationName(selected, 'destination')}</span>
              <small>Simulated corridor · not a map or GPS position</small>
            </div>
            <div className="drawer-content">
              <h3>Shipment timeline</h3>
              <div className="shipment-timeline">
                {timeline(selected).length > 0 ? timeline(selected).map((event, index) => <div className="timeline-row" key={`${event.label}-${event.occurredAt}-${index}`}><i /><span><strong>{event.label}</strong><small>{event.note}</small><time>{formatDemoTimestamp(event.occurredAt)}</time></span></div>) : <OperationsEmpty message="No shipment timestamps have been recorded." />}
              </div>
              {canMutate && getAllowedShipmentTransitions(selected.status, selected.dispatchedAt !== null).length > 0 ? (
                <div className="shipment-status-actions">
                  <h3>Record simulated status change</h3>
                  <div>{getAllowedShipmentTransitions(selected.status, selected.dispatchedAt !== null).map((status) => <button className="subtle-button" key={status} onClick={() => { setPendingStatus(status); setError('') }} type="button">{STATUS_LABELS[status]}</button>)}</div>
                </div>
              ) : <p className="operations-footnote">Delivered shipments are final in this demo workflow.</p>}
              <div className="trace-related-links">
                <span>Batch traceability</span>
                {selected.processingBatchIds.map((batchId) => <Link key={batchId} to={`/batch-traceability?search=${encodeURIComponent(batchId)}`}>Open {batchId}</Link>)}
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
            {pendingStatus && (
              <div className="status-confirm-card" role="alertdialog" aria-label="Confirm shipment status change">
                <strong>Confirm status change to {STATUS_LABELS[pendingStatus]}?</strong>
                <p>This records an audit event and updates shared inventory or retail receipt records where applicable.</p>
                <label className="operations-field">Reason / note<textarea maxLength={240} onChange={(event) => setChangeNote(event.target.value)} rows={2} value={changeNote} /></label>
                <div className="transfer-actions"><button className="subtle-button" onClick={() => setPendingStatus(null)} type="button">Cancel</button><button className="primary-button" onClick={applyStatusChange} type="button">Confirm status</button></div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, detail, warning = false }: { icon: LucideIcon; label: string; value: string; detail: string; warning?: boolean }) {
  return <article className={`operations-metric-card${warning ? ' is-warning' : ''}`}><span className="operations-metric-icon"><Icon size={16} /></span><span className="operations-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function PanelTitle({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) {
  return <div className="operations-panel-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>
}

function OperationsEmpty({ message }: { message: string }) {
  return <div className="operations-empty"><CircleAlert size={18} /><p>{message}</p></div>
}

export default FreightLogistics
