import { useMemo, useState } from 'react'
import { Download, MapPinned } from 'lucide-react'
import type { DemoDataset } from '../data/models'
import type { DemoSettings } from '../data/demoSettings'
import { pilotTargets, demoReferenceTimestamp } from '../data/mockData'
import { assessPilotTarget, calculateFarmerShareOfShelfPrice, calculatePaymentCompliance, calculateProcurementSummary, calculateQrTraceabilityCoverage, calculateStageWeightedLoss, reconcileInventory } from '../lib/calculations'
import { downloadCsv } from '../lib/csv'
import type { DashboardFilters } from '../lib/executiveDashboard'
import { formatCurrency, formatNumber, formatPercent } from '../lib/formatters'
import { getSettingTarget } from '../data/demoSettings'

function dateInScope(timestamp: string | null | undefined, range: DashboardFilters['dateRange']): boolean {
  if (!timestamp) return false
  const parsed = Date.parse(timestamp)
  const reference = Date.parse(demoReferenceTimestamp)
  const start = range === 'season' ? Date.parse('2026-09-01T00:00:00+05:30') : reference - (range === '7d' ? 7 : 30) * 86_400_000
  return Number.isFinite(parsed) && parsed >= start && parsed <= reference
}

type DistrictRow = {
  id: string
  name: string
  pilotStatus: string
  farmers: number
  volumeKg: number
  valueINR: number
  paymentCompliance: number | null
  inventoryKg: number
  processingKg: number
  lossPercent: number | null
  delayedShipments: number
  retailUnits: number
  qrCoverage: number | null
  targetProgress: number | null
}

function DistrictPerformance({ data, filters, settings, onDistrictSelect }: { data: DemoDataset; filters: DashboardFilters; settings: DemoSettings; onDistrictSelect: (districtId: string) => void }) {
  const [sortKey, setSortKey] = useState<keyof DistrictRow>('volumeKg')
  const [ascending, setAscending] = useState(false)
  const [search, setSearch] = useState('')
  const rows = useMemo(() => data.districts.map((district): DistrictRow => {
    const lots = data.procurementLots.filter((lot) => lot.districtId === district.id && (filters.commodityId === 'all' || lot.commodityId === filters.commodityId) && dateInScope(lot.acceptedAt ?? lot.arrivedAt, filters.dateRange))
    const lotIds = new Set(lots.map((lot) => lot.id))
    const payments = data.farmerPayments.filter((payment) => lotIds.has(payment.procurementLotId))
    const batches = data.processingBatches.filter((batch) => {
      const facility = data.processingFacilities.find((item) => item.id === batch.facilityId)
      const product = data.products.find((item) => item.id === batch.productId)
      return facility?.districtId === district.id && product && (filters.commodityId === 'all' || product.commodityId === filters.commodityId) && dateInScope(batch.processedAt, filters.dateRange)
    })
    const inventory = data.inventoryBalances.filter((balance) =>
      data.warehouses.find((warehouse) => warehouse.id === balance.warehouseId)?.districtId === district.id &&
      (filters.commodityId === 'all' || balance.commodityId === filters.commodityId),
    )
    const inventoryKg = inventory.reduce((sum, balance) => {
      const result = reconcileInventory(balance)
      return sum + (result.status === 'available' ? result.value.usableQuantityKg : 0)
    }, 0)
    const shipments = data.shipments.filter((shipment) => data.warehouses.find((warehouse) => warehouse.id === shipment.originWarehouseId)?.districtId === district.id && (filters.commodityId === 'all' || shipment.commodityId === filters.commodityId) && dateInScope(shipment.dispatchedAt, filters.dateRange))
    const sales = data.salesTransactions.filter((sale) => data.retailStores.find((store) => store.id === sale.retailStoreId)?.districtId === district.id && (filters.commodityId === 'all' || data.products.find((product) => product.id === sale.productId)?.commodityId === filters.commodityId) && dateInScope(sale.soldAt, filters.dateRange))
    const lotsSummary = calculateProcurementSummary(lots)
    const compliance = calculatePaymentCompliance(payments, settings.paymentSlaHours)
    const loss = calculateStageWeightedLoss(lots, batches, shipments)
    const traceBatches = batches.filter((batch) => data.products.find((product) => product.id === batch.productId)?.stateBrand)
    const qr = calculateQrTraceabilityCoverage(traceBatches, data.products, data.traceabilityEvents)
    const qrTarget = pilotTargets.find((item) => item.id === 'qr-traceability')
    const qrAssessment = qrTarget && qr.status === 'available'
      ? assessPilotTarget(qr.value, { ...qrTarget, value: getSettingTarget(qrTarget, settings) })
      : null
    const farmerSales = sales.filter((sale) => data.processingBatches.some((batch) => batch.id === sale.processingBatchId && batches.some((scoped) => scoped.id === batch.id)))
    const farmerShare = calculateFarmerShareOfShelfPrice(farmerSales, {
      batches: data.processingBatches,
      products: data.products,
      procurementLots: data.procurementLots,
      farmerPayments: data.farmerPayments,
    })
    const farmerShareTarget = pilotTargets.find((item) => item.id === 'farmer-share')
    const farmerShareAssessment = farmerShareTarget && farmerShare.status === 'available'
      ? assessPilotTarget(farmerShare.value, { ...farmerShareTarget, value: getSettingTarget(farmerShareTarget, settings) })
      : null
    const paymentTarget = {
      id: 'payment-compliance',
      label: 'Payments within configured SLA',
      metric: 'payment-compliance',
      displayTarget: '100%',
      value: 100,
      unit: 'percent' as const,
      direction: 'minimum' as const,
    }
    const paymentAssessment = compliance.status === 'available'
      ? assessPilotTarget(compliance.value.compliancePercent, paymentTarget)
      : null
    const targetProgressValues = [qrAssessment, farmerShareAssessment, paymentAssessment]
      .flatMap((assessment) => assessment?.status === 'available' ? [assessment.value.progressPercent] : [])
    return {
      id: district.id, name: district.name, pilotStatus: district.pilotStatus,
      farmers: new Set(data.buybackContracts.filter((contract) => contract.districtId === district.id && contract.status === 'active' && (filters.commodityId === 'all' || contract.commodityId === filters.commodityId) && dateInScope(contract.signedAt, filters.dateRange)).map((contract) => contract.farmerId)).size,
      volumeKg: lotsSummary.status === 'available' ? lotsSummary.value.acceptedKg : 0,
      valueINR: lotsSummary.status === 'available' ? lotsSummary.value.acceptedValueINR : 0,
      paymentCompliance: compliance.status === 'available' ? compliance.value.compliancePercent : null,
      inventoryKg,
      processingKg: batches.reduce((sum, batch) => sum + batch.inputQuantityKg, 0),
      lossPercent: loss.status === 'available' ? loss.value : null,
      delayedShipments: shipments.filter((shipment) => shipment.status === 'delayed' || (shipment.expectedArrivalAt && Date.parse(shipment.expectedArrivalAt) < Date.parse(demoReferenceTimestamp) && shipment.status !== 'delivered')).length,
      retailUnits: sales.reduce((sum, sale) => sum + sale.soldQuantityUnits, 0),
      qrCoverage: qr.status === 'available' ? qr.value : null,
      targetProgress: targetProgressValues.length > 0
        ? targetProgressValues.reduce((sum, progress) => sum + progress, 0) / targetProgressValues.length
        : null,
    }
  }), [data, filters.commodityId, filters.dateRange, settings])

  const visible = rows.filter((row) =>
    (filters.districtId === 'all' || row.id === filters.districtId) &&
    (settings.districtScopeIds.includes(row.id) || row.pilotStatus === 'proposed') &&
    row.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  ).sort((left, right) => {
    const a = left[sortKey], b = right[sortKey]
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
    return (typeof a === 'string' ? a.localeCompare(String(b)) : Number(a) - Number(b)) * (ascending ? 1 : -1)
  })
  const exportRows = [
    ['District', 'Pilot status', 'Contracted farmers', 'Accepted procurement kg', 'Value INR', 'Payment compliance %', 'Usable inventory kg', 'Processing input kg', 'Recorded loss %', 'Delayed shipments', 'Retail units', 'QR coverage %', 'QR target progress %'],
    ...visible.map((row) => [row.name, row.pilotStatus, row.farmers, row.volumeKg, row.valueINR, row.paymentCompliance ?? 'Insufficient data', row.inventoryKg, row.processingKg, row.lossPercent ?? 'Insufficient data', row.delayedShipments, row.retailUnits, row.qrCoverage ?? 'Insufficient data', row.targetProgress ?? 'Insufficient data']),
  ]

  return <div className="oversight-page">
    <section className="operations-intro"><div><p className="eyebrow">DISTRICT PERFORMANCE · SYNTHETIC RECORDS</p><h2>Compare pilot operations using the same linked demo records.</h2><p>Only configured pilot districts are shown. Geographic display is intentionally a table, not a map.</p></div><MapPinned size={24} /></section>
    <section className="operations-panel oversight-panel">
      <div className="oversight-toolbar"><label>Search district<input aria-label="Search district" onChange={(event) => setSearch(event.target.value)} placeholder="District name" value={search} /></label><span className="oversight-scope">Commodity scope: {filters.commodityId === 'all' ? 'All commodities' : filters.commodityId}</span><button className="subtle-button" onClick={() => downloadCsv('district-performance-demo.csv', exportRows)} type="button"><Download size={14} /> Export filtered CSV</button></div>
      <div className="operations-table-wrap"><table className="operations-table oversight-table"><thead><tr>{([
        ['name', 'District'], ['farmers', 'Contracted farmers'], ['volumeKg', 'Accepted procurement'], ['valueINR', 'Procurement value'], ['paymentCompliance', 'Payment compliance'], ['inventoryKg', 'Usable inventory'], ['processingKg', 'Processing input'], ['lossPercent', 'Recorded loss'], ['delayedShipments', 'Shipment delays'], ['retailUnits', 'Retail units'], ['qrCoverage', 'QR coverage'], ['targetProgress', 'Measured target progress'],
      ] as Array<[keyof DistrictRow, string]>).map(([key, title]) => <th key={key}><button className="table-sort-button" onClick={() => { if (sortKey === key) setAscending((value) => !value); else { setSortKey(key); setAscending(false) } }} type="button">{title}</button></th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><button className="district-drilldown" onClick={() => onDistrictSelect(row.id)} type="button">{row.name}</button><small>{row.pilotStatus.replace('-', ' ')} pilot</small></td><td>{formatNumber(row.farmers)}</td><td>{formatNumber(row.volumeKg / 1000)} MT</td><td>{formatCurrency(row.valueINR)}</td><td>{row.paymentCompliance === null ? 'Insufficient data' : formatPercent(row.paymentCompliance)}</td><td>{formatNumber(row.inventoryKg / 1000)} MT</td><td>{formatNumber(row.processingKg / 1000)} MT</td><td>{row.lossPercent === null ? 'Insufficient data' : formatPercent(row.lossPercent)}</td><td>{row.delayedShipments}</td><td>{formatNumber(row.retailUnits)}</td><td>{row.qrCoverage === null ? 'Insufficient data' : formatPercent(row.qrCoverage)}</td><td>{row.targetProgress === null ? 'Insufficient data' : `${formatNumber(row.targetProgress)}%`}</td></tr>)}</tbody></table></div>
      {visible.length === 0 && <p className="operations-empty">No configured pilot districts match this filter.</p>}
      <p className="operations-footnote">All values are simulated for demo purposes. Inventory is current usable balance; processing is cumulative input throughput. Payment compliance uses the configured {settings.paymentSlaHours}-hour SLA.</p>
    </section>
  </div>
}

export default DistrictPerformance
