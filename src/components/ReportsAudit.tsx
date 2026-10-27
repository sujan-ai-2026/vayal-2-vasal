import { useMemo, useState } from 'react'
import { Download, FileClock, Printer } from 'lucide-react'
import type { DemoDataset } from '../data/models'
import type { DashboardFilters } from '../lib/executiveDashboard'
import { buildExecutiveDashboard } from '../lib/executiveDashboard'
import { downloadCsv } from '../lib/csv'
import { formatCurrency, formatDemoTimestamp, formatNumber, formatPercent } from '../lib/formatters'

const REPORTS = ['Procurement summary', 'Farmer payment compliance', 'Inventory & stock movements', 'Processing & loss reconciliation', 'Freight performance', 'Retail sales', 'Traceability coverage', 'District pilot performance', 'Prototype audit trail'] as const
type ReportName = (typeof REPORTS)[number]

function dateMatches(timestamp: string | null | undefined, range: DashboardFilters['dateRange']): boolean {
  if (!timestamp) return false
  const parsed = Date.parse(timestamp)
  const reference = Date.parse('2026-10-27T09:00:00+05:30')
  const start = range === 'season' ? Date.parse('2026-09-01T00:00:00+05:30') : reference - (range === '7d' ? 7 : 30) * 86_400_000
  return Number.isFinite(parsed) && parsed >= start && parsed <= reference
}

function getEntityDistrict(data: DemoDataset, id: string): string | undefined {
  const lot = data.procurementLots.find((item) => item.id === id)
  if (lot) return lot.districtId
  const payment = data.farmerPayments.find((item) => item.id === id)
  if (payment) return data.procurementLots.find((lotItem) => lotItem.id === payment.procurementLotId)?.districtId
  const balance = data.inventoryBalances.find((item) => item.id === id)
  if (balance) return data.warehouses.find((warehouse) => warehouse.id === balance.warehouseId)?.districtId
  const movement = data.stockMovements.find((item) => item.id === id)
  if (movement) return data.warehouses.find((warehouse) => warehouse.id === (movement.sourceWarehouseId ?? movement.destinationWarehouseId))?.districtId
  const sale = data.salesTransactions.find((item) => item.id === id)
  if (sale) return data.retailStores.find((store) => store.id === sale.retailStoreId)?.districtId
  const shipment = data.shipments.find((item) => item.id === id)
  if (shipment) return data.warehouses.find((warehouse) => warehouse.id === shipment.originWarehouseId)?.districtId
  const batch = data.processingBatches.find((item) => item.id === id)
  if (batch) return data.processingFacilities.find((facility) => facility.id === batch.facilityId)?.districtId
  return data.retailStores.find((item) => item.id === id)?.districtId
}

function ReportsAudit({ data, filters }: { data: DemoDataset; filters: DashboardFilters }) {
  const [report, setReport] = useState<ReportName>(REPORTS[0])
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState(0)
  const [ascending, setAscending] = useState(true)
  const [page, setPage] = useState(0)
  const model = useMemo(() => buildExecutiveDashboard(data, filters), [data, filters])
  const rows = useMemo((): Array<[string, string, string, string]> => {
    if (report === 'Procurement summary') return data.procurementLots.filter((lot) => (filters.districtId === 'all' || lot.districtId === filters.districtId) && (filters.commodityId === 'all' || lot.commodityId === filters.commodityId) && dateMatches(lot.acceptedAt ?? lot.arrivedAt, filters.dateRange)).map((lot) => [lot.id, lot.status, `${formatNumber(lot.acceptedQuantityKg)} kg`, formatCurrency(lot.acceptedQuantityKg * lot.contractedPricePerKgINR)])
    if (report === 'Farmer payment compliance') return data.farmerPayments.filter((payment) => {
      const district = getEntityDistrict(data, payment.id)
      const lot = data.procurementLots.find((candidate) => candidate.id === payment.procurementLotId)
      return (filters.districtId === 'all' || district === filters.districtId) && (filters.commodityId === 'all' || lot?.commodityId === filters.commodityId) && dateMatches(payment.acceptedAt, filters.dateRange)
    }).map((payment) => {
      const elapsed = payment.acceptedAt && payment.paidAt ? (Date.parse(payment.paidAt) - Date.parse(payment.acceptedAt)) / 3_600_000 : null
      return [payment.id, payment.status, formatCurrency(payment.payableAmountINR), elapsed === null ? 'Insufficient data' : `${formatNumber(elapsed)}h · ${elapsed <= (filters.paymentSlaHours ?? 72) ? 'within SLA' : 'outside SLA'}`]
    })
    if (report === 'Inventory & stock movements') return data.stockMovements.filter((item) => {
      const batch = data.processingBatches.find((candidate) => candidate.id === item.processingBatchId)
      const commodityId = data.products.find((product) => product.id === batch?.productId)?.commodityId
      return (filters.districtId === 'all' || getEntityDistrict(data, item.id) === filters.districtId) &&
        (filters.commodityId === 'all' || commodityId === filters.commodityId) &&
        dateMatches(item.occurredAt, filters.dateRange)
    }).map((item) => [item.id, item.movementType, `${formatNumber(item.quantityKg)} kg`, item.note])
    if (report === 'Processing & loss reconciliation') return data.processingBatches.filter((batch) => (filters.districtId === 'all' || getEntityDistrict(data, batch.id) === filters.districtId) && (filters.commodityId === 'all' || data.products.find((product) => product.id === batch.productId)?.commodityId === filters.commodityId) && dateMatches(batch.processedAt, filters.dateRange)).map((batch) => [batch.id, batch.status, `${formatNumber(batch.inputQuantityKg)} kg input`, `${formatNumber(Math.max(0, batch.inputQuantityKg - batch.outputQuantityKg))} kg recorded processing loss`])
    if (report === 'Freight performance') return data.shipments.filter((item) => (filters.districtId === 'all' || getEntityDistrict(data, item.id) === filters.districtId) && (filters.commodityId === 'all' || item.commodityId === filters.commodityId) && dateMatches(item.dispatchedAt, filters.dateRange)).map((item) => [item.id, item.status, `${formatNumber(item.dispatchQuantityKg)} kg`, item.actualArrivalAt ? formatDemoTimestamp(item.actualArrivalAt) : 'Arrival not recorded'])
    if (report === 'Retail sales') return data.salesTransactions.filter((item) => (filters.districtId === 'all' || getEntityDistrict(data, item.retailStoreId) === filters.districtId) && (filters.commodityId === 'all' || data.products.find((product) => product.id === item.productId)?.commodityId === filters.commodityId) && dateMatches(item.soldAt, filters.dateRange)).map((item) => [item.reference, item.processingBatchId, `${formatNumber(item.soldQuantityUnits)} units`, formatCurrency(item.soldQuantityUnits * item.retailPricePerUnitINR)])
    if (report === 'Traceability coverage') return data.processingBatches.filter((batch) => (filters.districtId === 'all' || getEntityDistrict(data, batch.id) === filters.districtId) && (filters.commodityId === 'all' || data.products.find((product) => product.id === batch.productId)?.commodityId === filters.commodityId) && dateMatches(batch.processedAt, filters.dateRange)).map((batch) => {
      const events = data.traceabilityEvents.filter((event) => event.processingBatchId === batch.id)
      return [batch.id, data.products.find((product) => product.id === batch.productId)?.name ?? 'Product unavailable', `${events.filter((event) => event.status === 'verified-demo-record').length} recorded events`, events.some((event) => event.status === 'missing-scan') ? 'Incomplete · missing scan' : events.some((event) => event.status === 'exception') ? 'Exception recorded' : 'Modeled events recorded']
    })
    if (report === 'District pilot performance') return model.districtPerformance.filter((item) => filters.districtId === 'all' || item.districtId === filters.districtId).map((item) => [item.district, item.pilotStatus, `${formatNumber(item.acceptedKg)} kg accepted`, item.paymentCompliance.status === 'available' ? formatPercent(item.paymentCompliance.value) : 'Insufficient data'])
    return data.auditEvents.filter((event) => {
      return (filters.districtId === 'all' || getEntityDistrict(data, event.entityId) === filters.districtId) && dateMatches(event.occurredAt, filters.dateRange)
    }).slice().sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).map((event) => [
      `${event.id} · ${formatDemoTimestamp(event.occurredAt)}`,
      `${data.demoUsers.find((user) => user.id === event.demoUserId)?.displayName ?? 'Unknown demo user'} / ${data.demoUsers.find((user) => user.id === event.demoUserId)?.role ?? 'unknown role'}`,
      `${event.action} · ${event.entityType} ${event.entityId}`,
      [event.previousValue ? `From: ${event.previousValue}` : '', event.newValue ? `To: ${event.newValue}` : '', event.note].filter(Boolean).join(' · '),
    ])
  }, [data, filters, model, report])
  const headers = report === 'Prototype audit trail' ? ['Event / timestamp', 'Demo user / role', 'Action / entity', 'Previous / new value / reason'] : ['Record ID', 'Status / reference', 'Quantity / value', 'Detail']
  const filteredRows = rows.filter((row) => row.some((cell) => cell.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
  const sortedRows = [...filteredRows].sort((left, right) => left[sortColumn].localeCompare(right[sortColumn]) * (ascending ? 1 : -1))
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return <div className="oversight-page">
    <section className="operations-intro"><div><p className="eyebrow">REPORTS · PROTOTYPE AUDIT TRAIL</p><h2>Operational reports from shared synthetic records.</h2><p>Filters follow the shell date range, district and commodity scope. Use print to create a print-friendly report.</p></div><FileClock size={24} /></section>
    <section className="operations-panel oversight-panel">
      <div className="print-report-title"><strong>Vayal-to-Vaasal · Synthetic demo report</strong><h2>{report}</h2><p>{filters.districtId === 'all' ? 'All districts' : data.districts.find((district) => district.id === filters.districtId)?.name} · {filters.dateRange} · {filters.commodityId} · DEMO DATA</p></div>
      <div className="oversight-toolbar"><label>Report view<select aria-label="Report view" onChange={(event) => { setReport(event.target.value as ReportName); setPage(0) }} value={report}>{REPORTS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Search report rows<input aria-label="Search report rows" onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Search current report" value={search} /></label><span className="oversight-scope">Scope: {filters.districtId === 'all' ? 'All districts' : data.districts.find((district) => district.id === filters.districtId)?.name} · {filters.dateRange} · {filters.commodityId}</span><button className="subtle-button" onClick={() => downloadCsv(`${report.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-demo.csv`, [headers, ...filteredRows])} type="button"><Download size={14} /> Export filtered CSV</button><button className="subtle-button" onClick={() => window.print()} type="button"><Printer size={14} /> Print</button></div>
      {report === 'Prototype audit trail' && <p className="audit-disclaimer">Prototype audit trail only. Records are synthetic and locally persisted where supported; this is not immutable storage, cryptographic verification, or regulatory certification.</p>}
      <div className="operations-table-wrap"><table className="operations-table oversight-table"><thead><tr>{headers.map((header, index) => <th key={header}><button className="table-sort-button" onClick={() => { if (sortColumn === index) setAscending((value) => !value); else { setSortColumn(index); setAscending(true) } }} type="button">{header}</button></th>)}</tr></thead><tbody>{pageRows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
      {filteredRows.length === 0 && <p className="operations-empty">No records match this report scope or search.</p>}
      <div className="report-pagination"><span>{filteredRows.length} matching records</span><button className="subtle-button" disabled={currentPage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button">Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button className="subtle-button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} type="button">Next</button></div>
      <p className="operations-footnote">{filteredRows.length} simulated report rows · No live integrations.</p>
    </section>
  </div>
}

export default ReportsAudit
