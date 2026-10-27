import { demoReferenceTimestamp, pilotTargets } from '../data/mockData'
import type {
  CommodityId,
  DemoDataset,
  District,
  FarmerPayment,
  ProcurementLot,
} from '../data/models'
import {
  assessPilotTarget,
  calculateFarmerShareOfShelfPrice,
  calculateFreightDelayHours,
  calculatePaymentAgeing,
  calculatePaymentCompliance,
  calculateProcurementSummary,
  calculateQrTraceabilityCoverage,
  calculateStageWeightedLoss,
  calculateProcessingYield,
  reconcileInventory,
  type CalculationResult,
} from './calculations'

export type DashboardDistrictFilter = 'all' | string
export type DashboardCommodityFilter = 'all' | CommodityId
export type DashboardDateRange = '7d' | '30d' | 'season'

export interface DashboardFilters {
  districtId: DashboardDistrictFilter
  commodityId: DashboardCommodityFilter
  dateRange: DashboardDateRange
  paymentSlaHours?: number
  pilotTargetValues?: Record<string, number>
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertCategory =
  | 'payment'
  | 'grading'
  | 'inventory'
  | 'freight'
  | 'traceability'
  | 'processing'
  | 'retail'

export interface ExecutiveAlert {
  id: string
  severity: AlertSeverity
  category: AlertCategory
  entity: string
  entityId: string
  district: string
  age: string
  reason: string
  href: string
  occurredAt: string
}

export interface ActivityItem {
  id: string
  label: string
  entity: string
  district: string
  occurredAt: string
  href: string
  type: 'procurement' | 'payment' | 'processing' | 'freight' | 'inventory' | 'retail' | 'traceability' | 'audit'
  status: string
}

export interface TargetActual {
  id: string
  label: string
  target: string
  actual: string
  progressPercent: number | null
  achieved: boolean | null
  definition: string
}

export interface ExecutiveDashboardModel {
  referenceTime: Date
  latestUpdatedAt: string
  selectedDistrict: District | null
  dateRangeLabel: string
  contractedFarmers: number
  acceptedKg: CalculationResult<number>
  procurementValueINR: CalculationResult<number>
  paymentCompliance: CalculationResult<number>
  pendingPaymentsINR: number
  pendingPaymentsCount: number
  usableInventoryKg: CalculationResult<number>
  recordedLossPercent: CalculationResult<number>
  qrCoverage: CalculationResult<number>
  procurementTrend: Array<{ label: string; date: string; acceptedKg: number }>
  commodityVolumes: Array<{ commodityId: CommodityId; label: string; acceptedKg: number }>
  districtPerformance: Array<{
    districtId: string
    district: string
    pilotStatus: District['pilotStatus']
    farmers: number
    acceptedKg: number
    procurementValueINR: number
    paymentCompliance: CalculationResult<number>
    usableInventoryKg: number
    qrCoverage: CalculationResult<number>
  }>
  paymentDistribution: Array<{ status: string; count: number; amountINR: number }>
  inventoryByWarehouse: Array<Record<string, string | number>>
  inventoryCommodities: Array<{ id: CommodityId; label: string }>
  flow: Array<{ label: string; value: string; detail: string; href: string }>
  targets: TargetActual[]
  alerts: ExecutiveAlert[]
  activity: ActivityItem[]
  filteredCounts: {
    lots: number
    payments: number
    batches: number
    shipments: number
  }
}

export const COMMODITIES: Array<{ id: CommodityId; label: string }> = [
  { id: 'paddy', label: 'Paddy' },
  { id: 'millets', label: 'Millets' },
  { id: 'groundnut', label: 'Groundnut' },
  { id: 'gingelly', label: 'Gingelly' },
  { id: 'pulses', label: 'Pulses' },
]

export const DEMO_OPERATIONAL_THRESHOLDS = {
  paymentDueSoonHours: 12,
  processingYieldMinimumPercent: 80,
  retailReorderUnits: 30,
  stockDiscrepancyWarningKg: 1,
} as const

const SEASON_START = '2026-09-01T00:00:00+05:30'
const severityOrder: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function isWithinRange(timestamp: string | null | undefined, filters: DashboardFilters): boolean {
  if (!timestamp) return false
  const date = Date.parse(timestamp)
  if (!Number.isFinite(date)) return false
  const reference = Date.parse(demoReferenceTimestamp)
  const rangeStart =
    filters.dateRange === 'season'
      ? Date.parse(SEASON_START)
      : reference - (filters.dateRange === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000
  return date >= rangeStart && date <= reference
}

function districtMatches(districtId: string, filters: DashboardFilters): boolean {
  return filters.districtId === 'all' || districtId === filters.districtId
}

function commodityMatches(
  commodityId: CommodityId,
  filters: DashboardFilters,
): boolean {
  return filters.commodityId === 'all' || commodityId === filters.commodityId
}

function formatAge(timestamp: string, referenceTime: Date): string {
  const elapsedHours = Math.max(0, (referenceTime.getTime() - Date.parse(timestamp)) / 3_600_000)
  if (elapsedHours < 1) return 'Under 1h'
  if (elapsedHours < 48) return `${Math.floor(elapsedHours)}h`
  return `${Math.floor(elapsedHours / 24)}d`
}

function formatHours(hours: number): string {
  const absoluteHours = Math.abs(hours)
  if (absoluteHours < 1) return `${Math.round(absoluteHours * 60)}m`
  if (absoluteHours < 24) return `${Math.round(absoluteHours)}h`
  return `${Math.floor(absoluteHours / 24)}d ${Math.round(absoluteHours % 24)}h`
}

function formatDateKey(timestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp))
}

function formatTrendLabel(date: string, dateRange: DashboardDateRange): string {
  const parsed = new Date(`${date}T12:00:00+05:30`)
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    ...(dateRange === '7d' ? { weekday: 'short' as const } : { day: 'numeric' as const, month: 'short' as const }),
  }).format(parsed)
}

function paymentScope(
  payment: FarmerPayment,
  dataset: DemoDataset,
): { districtId: string; commodityId: CommodityId; lot: ProcurementLot } | null {
  const lot = dataset.procurementLots.find((candidate) => candidate.id === payment.procurementLotId)
  return lot
    ? { districtId: lot.districtId, commodityId: lot.commodityId, lot }
    : null
}

export function getLatestDemoTimestamp(dataset: DemoDataset): string {
  const timestamps = [
    ...dataset.buybackContracts.map((record) => record.signedAt),
    ...dataset.procurementLots.flatMap((record) => [record.arrivedAt, record.acceptedAt]),
    ...dataset.gradeAssessments.map((record) => record.assessedAt),
    ...dataset.farmerPayments.flatMap((record) => [record.acceptedAt, record.paidAt]),
    ...dataset.processingBatches.map((record) => record.processedAt),
    ...dataset.inventoryBalances.map((record) => record.lastUpdatedAt),
    ...dataset.stockMovements.map((record) => record.occurredAt),
    ...dataset.shipments.flatMap((record) => [record.dispatchedAt, record.actualArrivalAt]),
    ...dataset.shipmentStatusEvents.map((record) => record.occurredAt),
    ...dataset.salesTransactions.map((record) => record.soldAt),
    ...dataset.traceabilityEvents.map((record) => record.occurredAt),
    ...dataset.auditEvents.map((record) => record.occurredAt),
  ]
    .filter((timestamp): timestamp is string => timestamp !== null)
    .map((timestamp) => ({ timestamp, parsed: Date.parse(timestamp) }))
    .filter((record) => Number.isFinite(record.parsed))
    .sort((left, right) => right.parsed - left.parsed)

  return timestamps[0]?.timestamp ?? demoReferenceTimestamp
}

function makeAlerts(
  dataset: DemoDataset,
  filters: DashboardFilters,
  referenceTime: Date,
): ExecutiveAlert[] {
  const districtById = new Map(dataset.districts.map((district) => [district.id, district.name]))
  const warehouseById = new Map(dataset.warehouses.map((warehouse) => [warehouse.id, warehouse]))
  const batchById = new Map(dataset.processingBatches.map((batch) => [batch.id, batch]))
  const facilityById = new Map(dataset.processingFacilities.map((facility) => [facility.id, facility]))
  const alerts: ExecutiveAlert[] = []

  for (const payment of dataset.farmerPayments) {
    const scope = paymentScope(payment, dataset)
    if (
      !scope ||
      !districtMatches(scope.districtId, filters) ||
      !commodityMatches(scope.commodityId, filters) ||
      !isWithinRange(payment.acceptedAt, filters) ||
      payment.status === 'paid'
    ) {
      continue
    }

    const ageing = calculatePaymentAgeing(payment, referenceTime)
    if (payment.status === 'failed') {
      alerts.push({
        id: `alert-${payment.id}`,
        severity: 'high',
        category: 'payment',
        entity: `Payment ${payment.id}`,
        entityId: payment.id,
        district: districtById.get(scope.districtId) ?? 'Unknown district',
        age: payment.acceptedAt
          ? `Accepted ${formatAge(payment.acceptedAt, referenceTime)}`
          : 'Age unavailable',
        reason: 'Simulated payment failed and remains unpaid.',
        href: '/farmer-payments',
        occurredAt: payment.acceptedAt ?? demoReferenceTimestamp,
      })
    } else if (ageing.status === 'available' && (ageing.value.overdue || ageing.value.hoursUntilDue <= DEMO_OPERATIONAL_THRESHOLDS.paymentDueSoonHours)) {
      if (!payment.acceptedAt) continue
      alerts.push({
        id: `alert-${payment.id}`,
        severity: ageing.value.overdue ? 'critical' : 'medium',
        category: 'payment',
        entity: `Payment ${payment.id}`,
        entityId: payment.id,
        district: districtById.get(scope.districtId) ?? 'Unknown district',
        age: ageing.value.overdue
          ? `Accepted ${formatAge(payment.acceptedAt, referenceTime)} · ${formatHours(ageing.value.hoursUntilDue)} overdue`
          : `Accepted ${formatAge(payment.acceptedAt, referenceTime)} · due in ${formatHours(ageing.value.hoursUntilDue)}`,
        reason: ageing.value.overdue
          ? 'The 72-hour payment deadline has passed.'
          : `Payment is within the ${DEMO_OPERATIONAL_THRESHOLDS.paymentDueSoonHours}-hour due-soon window.`,
        href: '/farmer-payments',
        occurredAt: payment.acceptedAt ?? demoReferenceTimestamp,
      })
    }
  }

  for (const lot of dataset.procurementLots) {
    const grade = dataset.gradeAssessments.find((assessment) => assessment.id === lot.gradeAssessmentId)
    const reason = grade?.rejectionReason
    if (
      lot.rejectedQuantityKg <= 0 ||
      !districtMatches(lot.districtId, filters) ||
      !commodityMatches(lot.commodityId, filters) ||
      !isWithinRange(grade?.assessedAt ?? lot.arrivedAt, filters)
    ) {
      continue
    }

    alerts.push({
      id: `alert-${lot.id}`,
      severity: lot.status === 'rejected' ? 'high' : 'medium',
      category: 'grading',
      entity: `Lot ${lot.id}`,
      entityId: lot.id,
      district: districtById.get(lot.districtId) ?? 'Unknown district',
      age: grade ? formatAge(grade.assessedAt, referenceTime) : 'Age unavailable',
      reason: `${lot.rejectedQuantityKg.toLocaleString('en-IN')} kg rejected during grading${reason ? `: ${reason}` : '.'}`,
      href: '/farm-sourcing',
      occurredAt: grade?.assessedAt ?? lot.arrivedAt ?? demoReferenceTimestamp,
    })
  }

  for (const balance of dataset.inventoryBalances) {
    const warehouse = warehouseById.get(balance.warehouseId)
    const reconciliation = reconcileInventory(balance)
    if (
      !warehouse ||
      !districtMatches(warehouse.districtId, filters) ||
      !commodityMatches(balance.commodityId, filters) ||
      reconciliation.status !== 'available' ||
      reconciliation.value.physicalVarianceKg === null ||
      Math.abs(reconciliation.value.physicalVarianceKg) < DEMO_OPERATIONAL_THRESHOLDS.stockDiscrepancyWarningKg
    ) {
      continue
    }

    alerts.push({
      id: `alert-${balance.id}`,
      severity: Math.abs(reconciliation.value.physicalVarianceKg) > 500 ? 'high' : 'medium',
      category: 'inventory',
      entity: `Stock ${balance.id} · ${warehouse.name}`,
      entityId: balance.id,
      district: districtById.get(warehouse.districtId) ?? 'Unknown district',
      age: formatAge(balance.lastUpdatedAt, referenceTime),
      reason: `Physical count differs from the ledger by ${reconciliation.value.physicalVarianceKg > 0 ? '+' : ''}${reconciliation.value.physicalVarianceKg.toLocaleString('en-IN')} kg.`,
      href: '/storage-inventory',
      occurredAt: balance.lastUpdatedAt,
    })
  }

  for (const shipment of dataset.shipments) {
    const origin = warehouseById.get(shipment.originWarehouseId)
    const store = dataset.retailStores.find((candidate) => candidate.id === shipment.destinationRetailStoreId)
    const destinationWarehouse = dataset.warehouses.find(
      (warehouse) => warehouse.id === shipment.destinationWarehouseId,
    )
    const endpointDistricts = [
      origin?.districtId,
      destinationWarehouse?.districtId,
      store?.districtId,
    ].filter((districtId): districtId is string => districtId !== undefined)
    const districtId =
      filters.districtId !== 'all'
        ? endpointDistricts.find((id) => id === filters.districtId)
        : endpointDistricts[0]
    const delay = calculateFreightDelayHours(shipment, referenceTime)
    const overdue = delay.status === 'available' && delay.value > 0
    if (
      !districtId ||
      !commodityMatches(shipment.commodityId, filters) ||
      !isWithinRange(shipment.dispatchedAt ?? shipment.expectedArrivalAt, filters) ||
      (
        shipment.status !== 'delayed' &&
        shipment.status !== 'exception' &&
        !overdue
      )
    ) {
      continue
    }

    alerts.push({
      id: `alert-${shipment.id}`,
      severity:
        shipment.status === 'exception' ||
        (delay.status === 'available' && delay.value > 24)
          ? 'high'
          : 'medium',
      category: 'freight',
      entity: `Shipment ${shipment.id}`,
      entityId: shipment.id,
      district: districtById.get(districtId) ?? 'Unknown district',
      age: shipment.expectedArrivalAt
        ? delay.status === 'available' && delay.value > 0
          ? `${formatHours(delay.value)} overdue`
          : formatAge(shipment.dispatchedAt ?? shipment.expectedArrivalAt, referenceTime)
        : 'Age unavailable',
      reason:
        shipment.status === 'exception'
          ? 'Shipment is marked as a simulated exception; no live GPS data is used.'
          : shipment.status === 'delayed'
            ? 'Shipment is marked delayed; verify synthetic arrival and quantity records.'
            : 'Expected arrival has passed; simulated movement has no live GPS position.',
      href: '/freight-logistics',
      occurredAt: shipment.dispatchedAt ?? demoReferenceTimestamp,
    })
  }

  const missingEvents = dataset.traceabilityEvents.filter((event) => {
    const batch = batchById.get(event.processingBatchId)
    const facility = batch ? facilityById.get(batch.facilityId) : undefined
    const destinationStore = dataset.retailInventoryBalances
      .filter((balance) => balance.processingBatchId === event.processingBatchId)
      .map((balance) =>
        dataset.retailStores.find((store) => store.id === balance.retailStoreId),
      )
      .find((store) => store !== undefined)
    const affectedDistrictId = destinationStore?.districtId ?? facility?.districtId
    return (
      event.status === 'missing-scan' &&
      affectedDistrictId !== undefined &&
      districtMatches(affectedDistrictId, filters) &&
      Boolean(batch && commodityMatches(dataset.products.find((product) => product.id === batch.productId)?.commodityId ?? 'paddy', filters)) &&
      isWithinRange(event.occurredAt, filters)
    )
  })

  for (const event of missingEvents) {
    const batch = batchById.get(event.processingBatchId)
    const facility = batch ? facilityById.get(batch.facilityId) : undefined
    const destinationStore = dataset.retailInventoryBalances
      .filter((balance) => balance.processingBatchId === event.processingBatchId)
      .map((balance) =>
        dataset.retailStores.find((store) => store.id === balance.retailStoreId),
      )
      .find((store) => store !== undefined)
    const affectedDistrictId = destinationStore?.districtId ?? facility?.districtId
    alerts.push({
      id: `alert-${event.id}`,
      severity: 'high',
      category: 'traceability',
      entity: `Batch ${event.processingBatchId}`,
      entityId: event.processingBatchId,
      district: affectedDistrictId ? districtById.get(affectedDistrictId) ?? 'Unknown district' : 'Unknown district',
      age: `Scan missing · ${formatAge(event.occurredAt, referenceTime)}`,
      reason: event.discrepancy ?? 'A required traceability scan is missing.',
      href: '/batch-traceability',
      occurredAt: event.occurredAt,
    })
  }

  for (const batch of dataset.processingBatches) {
    const facility = facilityById.get(batch.facilityId)
    const product = dataset.products.find((candidate) => candidate.id === batch.productId)
    const yieldResult = calculateProcessingYield(batch)
    if (
      !facility ||
      !product ||
      !districtMatches(facility.districtId, filters) ||
      !commodityMatches(product.commodityId, filters) ||
      !isWithinRange(batch.processedAt, filters) ||
      yieldResult.status !== 'available' ||
      yieldResult.value >= DEMO_OPERATIONAL_THRESHOLDS.processingYieldMinimumPercent
    ) {
      continue
    }

    alerts.push({
      id: `alert-${batch.id}`,
      severity: 'medium',
      category: 'processing',
      entity: `Batch ${batch.id} · ${facility.name}`,
      entityId: batch.id,
      district: districtById.get(facility.districtId) ?? 'Unknown district',
      age: formatAge(batch.processedAt, referenceTime),
      reason: `Recorded yield ${yieldResult.value.toFixed(1)}% is below the ${DEMO_OPERATIONAL_THRESHOLDS.processingYieldMinimumPercent}% demo threshold.`,
      href: '/processing-hubs',
      occurredAt: batch.processedAt,
    })
  }

  for (const balance of dataset.retailInventoryBalances) {
    const store = dataset.retailStores.find((candidate) => candidate.id === balance.retailStoreId)
    const product = dataset.products.find((candidate) => candidate.id === balance.productId)
    if (
      !store ||
      !product ||
      !districtMatches(store.districtId, filters) ||
      !commodityMatches(product.commodityId, filters) ||
      !isWithinRange(balance.lastUpdatedAt, filters) ||
      balance.quantityOnHandUnits > DEMO_OPERATIONAL_THRESHOLDS.retailReorderUnits
    ) {
      continue
    }

    alerts.push({
      id: `alert-${balance.id}`,
      severity: balance.quantityOnHandUnits === 0 ? 'high' : 'medium',
      category: 'retail',
      entity: `${product.name} · ${store.name}`,
      entityId: balance.id,
      district: districtById.get(store.districtId) ?? 'Unknown district',
      age: formatAge(balance.lastUpdatedAt, referenceTime),
      reason:
        balance.quantityOnHandUnits === 0
          ? 'No demo units are available at the store.'
          : `${balance.quantityOnHandUnits} demo units remain; reorder threshold is ${DEMO_OPERATIONAL_THRESHOLDS.retailReorderUnits}.`,
      href: '/direct-retail-sales',
      occurredAt: balance.lastUpdatedAt,
    })
  }

  return alerts.sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  )
}

function makeActivity(
  dataset: DemoDataset,
  filters: DashboardFilters,
): ActivityItem[] {
  const districtById = new Map(dataset.districts.map((district) => [district.id, district.name]))
  const lotActivities: ActivityItem[] = dataset.procurementLots.flatMap((lot) => {
    if (
      !districtMatches(lot.districtId, filters) ||
      !commodityMatches(lot.commodityId, filters) ||
      !isWithinRange(lot.acceptedAt ?? lot.arrivedAt, filters)
    ) {
      return []
    }
    const timestamp = lot.acceptedAt ?? lot.arrivedAt
    if (!timestamp) return []
    return [{
      id: `activity-${lot.id}`,
      label: lot.status === 'rejected' ? 'Grading exception recorded' : 'Procurement lot accepted',
      entity: `Lot ${lot.id} · ${lot.acceptedQuantityKg.toLocaleString('en-IN')} kg accepted`,
      district: districtById.get(lot.districtId) ?? 'Unknown district',
      occurredAt: timestamp,
      href: '/farm-sourcing',
      type: 'procurement',
      status: lot.status,
    }]
  })

  const paymentActivities: ActivityItem[] = dataset.farmerPayments.flatMap((payment) => {
    const scope = paymentScope(payment, dataset)
    if (
      !scope ||
      !districtMatches(scope.districtId, filters) ||
      !commodityMatches(scope.commodityId, filters) ||
      !isWithinRange(payment.paidAt ?? payment.acceptedAt, filters)
    ) {
      return []
    }
    const timestamp = payment.paidAt ?? payment.acceptedAt
    if (!timestamp) return []
    return [{
      id: `activity-${payment.id}`,
      label: payment.status === 'paid' ? 'Farmer payment recorded' : `Payment ${payment.status}`,
      entity: `Payment ${payment.id} · ₹${payment.payableAmountINR.toLocaleString('en-IN')}`,
      district: districtById.get(scope.districtId) ?? 'Unknown district',
      occurredAt: timestamp,
      href: '/farmer-payments',
      type: 'payment',
      status: payment.status,
    }]
  })

  const batchActivities: ActivityItem[] = dataset.processingBatches.flatMap((batch) => {
    const facility = dataset.processingFacilities.find((candidate) => candidate.id === batch.facilityId)
    const product = dataset.products.find((candidate) => candidate.id === batch.productId)
    if (
      !facility ||
      !product ||
      !districtMatches(facility.districtId, filters) ||
      !commodityMatches(product.commodityId, filters) ||
      !isWithinRange(batch.processedAt, filters)
    ) {
      return []
    }
    return [{
      id: `activity-${batch.id}`,
      label: batch.status === 'exception' ? 'Processing exception recorded' : 'Processing batch updated',
      entity: `Batch ${batch.id} · ${batch.outputQuantityKg.toLocaleString('en-IN')} kg output`,
      district: districtById.get(facility.districtId) ?? 'Unknown district',
      occurredAt: batch.processedAt,
      href: '/processing-hubs',
      type: 'processing',
      status: batch.status,
    }]
  })

  const traceActivities: ActivityItem[] = dataset.traceabilityEvents.flatMap((event) => {
    const batch = dataset.processingBatches.find((candidate) => candidate.id === event.processingBatchId)
    const facility = batch
      ? dataset.processingFacilities.find((candidate) => candidate.id === batch.facilityId)
      : undefined
    const product = batch
      ? dataset.products.find((candidate) => candidate.id === batch.productId)
      : undefined
    if (
      !facility ||
      !product ||
      !districtMatches(facility.districtId, filters) ||
      !commodityMatches(product.commodityId, filters) ||
      !isWithinRange(event.occurredAt, filters) ||
      event.status === 'verified-demo-record'
    ) {
      return []
    }
    return [{
      id: `activity-${event.id}`,
      label: event.status === 'missing-scan' ? 'Traceability scan missing' : 'Traceability exception recorded',
      entity: `Batch ${event.processingBatchId}`,
      district: districtById.get(facility.districtId) ?? 'Unknown district',
      occurredAt: event.occurredAt,
      href: '/batch-traceability',
      type: 'traceability',
      status: event.status,
    }]
  })

  const movementActivities: ActivityItem[] = dataset.stockMovements.flatMap((movement) => {
    const batch = dataset.processingBatches.find(
      (candidate) => candidate.id === movement.processingBatchId,
    )
    const product = batch
      ? dataset.products.find((candidate) => candidate.id === batch.productId)
      : undefined
    const source = dataset.warehouses.find(
      (warehouse) => warehouse.id === movement.sourceWarehouseId,
    )
    const destination = dataset.warehouses.find(
      (warehouse) => warehouse.id === movement.destinationWarehouseId,
    )
    const scopedDistrictIds = [source?.districtId, destination?.districtId].filter(
      (id): id is string => id !== undefined,
    )
    if (
      !batch ||
      !product ||
      !isWithinRange(movement.occurredAt, filters) ||
      !commodityMatches(product.commodityId, filters) ||
      (filters.districtId !== 'all' && !scopedDistrictIds.includes(filters.districtId))
    ) {
      return []
    }

    const sourceName = source ? districtById.get(source.districtId) ?? source.location : 'Origin'
    const destinationName = destination
      ? districtById.get(destination.districtId) ?? destination.location
      : 'Dispatch'
    const districtLabel =
      filters.districtId !== 'all'
        ? districtById.get(filters.districtId) ?? 'Selected district'
        : source?.districtId !== destination?.districtId
          ? `${sourceName} → ${destinationName}`
          : sourceName
    return [{
      id: `activity-${movement.id}`,
      label: movement.movementType === 'transfer-out' ? 'Warehouse stock transfer recorded' : 'Warehouse stock movement recorded',
      entity: `${movement.reference} · ${movement.quantityKg.toLocaleString('en-IN')} kg · batch ${movement.processingBatchId}`,
      district: districtLabel,
      occurredAt: movement.occurredAt,
      href: '/storage-inventory',
      type: 'inventory',
      status: movement.movementType,
    }]
  })

  const shipmentActivities: ActivityItem[] = dataset.shipmentStatusEvents.flatMap((event) => {
    const shipment = dataset.shipments.find((candidate) => candidate.id === event.shipmentId)
    if (
      !shipment ||
      !isWithinRange(event.occurredAt, filters) ||
      !commodityMatches(shipment.commodityId, filters)
    ) return []
    const districtIds = [
      dataset.warehouses.find((warehouse) => warehouse.id === shipment.originWarehouseId)?.districtId,
      dataset.warehouses.find((warehouse) => warehouse.id === shipment.destinationWarehouseId)?.districtId,
      dataset.retailStores.find((store) => store.id === shipment.destinationRetailStoreId)?.districtId,
    ].filter((districtId): districtId is string => districtId !== undefined)
    if (filters.districtId !== 'all' && !districtIds.includes(filters.districtId)) return []
    const districtId = filters.districtId !== 'all' ? filters.districtId : districtIds[0]
    return [{
      id: `activity-${event.id}`,
      label: `Shipment status changed to ${event.toStatus.replace('-', ' ')}`,
      entity: `Shipment ${event.shipmentId} · ${event.note}`,
      district: districtId ? districtById.get(districtId) ?? 'Unknown district' : 'Statewide',
      occurredAt: event.occurredAt,
      href: '/freight-logistics',
      type: 'freight',
      status: event.toStatus,
    }]
  })

  const retailActivities: ActivityItem[] = dataset.salesTransactions.flatMap((sale) => {
    const store = dataset.retailStores.find((candidate) => candidate.id === sale.retailStoreId)
    const product = dataset.products.find((candidate) => candidate.id === sale.productId)
    if (
      !store ||
      !product ||
      !districtMatches(store.districtId, filters) ||
      !commodityMatches(product.commodityId, filters) ||
      !isWithinRange(sale.soldAt, filters)
    ) return []
    return [{
      id: `activity-${sale.id}`,
      label: 'Retail sale recorded',
      entity: `${sale.reference} · ${product.name} · ${sale.soldQuantityUnits.toLocaleString('en-IN')} units`,
      district: districtById.get(store.districtId) ?? 'Unknown district',
      occurredAt: sale.soldAt,
      href: '/direct-retail-sales',
      type: 'retail',
      status: 'synthetic sale',
    }]
  })

  const auditActivities: ActivityItem[] = dataset.auditEvents.flatMap((event) => {
    const movement = dataset.stockMovements.find((record) => record.id === event.entityId)
    const movementWarehouse = movement
      ? dataset.warehouses.find(
          (warehouse) =>
            warehouse.id === movement.sourceWarehouseId ||
            warehouse.id === movement.destinationWarehouseId,
        )
      : undefined
    const districtId =
      dataset.procurementLots.find((lot) => lot.id === event.entityId)?.districtId ??
      dataset.farmerPayments
        .map((payment) => paymentScope(payment, dataset))
        .find((scope) => scope?.lot.id === event.entityId)?.districtId ??
      dataset.salesTransactions
        .map((sale) => ({
          sale,
          districtId: dataset.retailStores.find((candidate) => candidate.id === sale.retailStoreId)?.districtId,
        }))
        .find(({ sale }) => sale.id === event.entityId || sale.reference === event.entityId)?.districtId ??
      movementWarehouse?.districtId
    if (
      !isWithinRange(event.occurredAt, filters) ||
      (filters.districtId !== 'all' && districtId !== filters.districtId)
    ) {
      return []
    }
    return [{
      id: `activity-${event.id}`,
      label: event.action,
      entity: `${event.entityType} ${event.entityId}`,
      district: districtId ? districtById.get(districtId) ?? 'Unknown district' : 'Statewide',
      occurredAt: event.occurredAt,
      href: '/reports-audit',
      type: 'audit',
      status: 'prototype audit trail',
    }]
  })

  return [...lotActivities, ...paymentActivities, ...batchActivities, ...traceActivities, ...movementActivities, ...shipmentActivities, ...retailActivities, ...auditActivities]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, 7)
}

export function buildExecutiveDashboard(
  dataset: DemoDataset,
  filters: DashboardFilters,
): ExecutiveDashboardModel {
  const referenceTime = new Date(demoReferenceTimestamp)
  const districts = dataset.districts.filter((district) =>
    districtMatches(district.id, filters),
  )
  const selectedDistrict =
    filters.districtId === 'all'
      ? null
      : dataset.districts.find((district) => district.id === filters.districtId) ?? null
  const lots = dataset.procurementLots.filter(
    (lot) =>
      districtMatches(lot.districtId, filters) &&
      commodityMatches(lot.commodityId, filters) &&
      isWithinRange(lot.acceptedAt ?? lot.arrivedAt, filters),
  )
  const summary = calculateProcurementSummary(lots)
  const scopedPayments = dataset.farmerPayments.filter((payment) => {
    const scope = paymentScope(payment, dataset)
    return Boolean(
      scope &&
        districtMatches(scope.districtId, filters) &&
        commodityMatches(scope.commodityId, filters) &&
        isWithinRange(payment.acceptedAt, filters),
    )
  })
  const scopedBatches = dataset.processingBatches.filter((batch) => {
    const facility = dataset.processingFacilities.find((candidate) => candidate.id === batch.facilityId)
    const product = dataset.products.find((candidate) => candidate.id === batch.productId)
    return Boolean(
      facility &&
        product &&
        districtMatches(facility.districtId, filters) &&
        commodityMatches(product.commodityId, filters) &&
        isWithinRange(batch.processedAt, filters),
    )
  })
  const scopedShipments = dataset.shipments.filter((shipment) => {
    const origin = dataset.warehouses.find((warehouse) => warehouse.id === shipment.originWarehouseId)
    const store = dataset.retailStores.find((candidate) => candidate.id === shipment.destinationRetailStoreId)
    const districtId = origin?.districtId ?? store?.districtId
    return Boolean(
      districtId &&
        districtMatches(districtId, filters) &&
        commodityMatches(shipment.commodityId, filters) &&
        isWithinRange(shipment.dispatchedAt, filters),
    )
  })
  const scopedSales = dataset.salesTransactions.filter((sale) => {
    const store = dataset.retailStores.find((candidate) => candidate.id === sale.retailStoreId)
    const product = dataset.products.find((candidate) => candidate.id === sale.productId)
    return Boolean(
      store &&
        product &&
        districtMatches(store.districtId, filters) &&
        commodityMatches(product.commodityId, filters) &&
        isWithinRange(sale.soldAt, filters),
    )
  })

  const scopedInventory = dataset.inventoryBalances.filter((balance) => {
    const warehouse = dataset.warehouses.find((candidate) => candidate.id === balance.warehouseId)
    return Boolean(
      warehouse &&
        districtMatches(warehouse.districtId, filters) &&
        commodityMatches(balance.commodityId, filters),
    )
  })
  const usableInventoryKg = scopedInventory.reduce((total, balance) => {
    const reconciliation = reconcileInventory(balance)
    return total + (reconciliation.status === 'available' ? reconciliation.value.usableQuantityKg : 0)
  }, 0)
  const usableInventoryResult: CalculationResult<number> =
    scopedInventory.length === 0
      ? { status: 'insufficient-data', value: null, reason: 'No warehouse inventory is in scope.' }
      : { status: 'available', value: usableInventoryKg }

  const recordedLossPercent = calculateStageWeightedLoss(lots, scopedBatches, scopedShipments)

  const farmerShare = calculateFarmerShareOfShelfPrice(scopedSales, {
    batches: dataset.processingBatches,
    products: dataset.products,
    procurementLots: dataset.procurementLots,
    farmerPayments: dataset.farmerPayments,
  })
  const qrCoverage = calculateQrTraceabilityCoverage(
    scopedBatches,
    dataset.products,
    dataset.traceabilityEvents,
  )
  const compliance = calculatePaymentCompliance(scopedPayments, filters.paymentSlaHours ?? 72)
  const activeContracts = dataset.buybackContracts.filter(
    (contract) =>
      contract.status === 'active' &&
      districtMatches(contract.districtId, filters) &&
      commodityMatches(contract.commodityId, filters),
  )
  const contractedFarmers = new Set(activeContracts.map((contract) => contract.farmerId)).size
  const configuredTarget = (id: string) => {
    const target = pilotTargets.find((candidate) => candidate.id === id)
    return target ? { ...target, value: filters.pilotTargetValues?.[id] ?? target.value } : undefined
  }
  const farmerShareTarget = configuredTarget('farmer-share')
  const farmerShareAssessment =
    farmerShare.status === 'available' && farmerShareTarget
      ? assessPilotTarget(farmerShare.value, farmerShareTarget)
      : null
  const qrTarget = configuredTarget('qr-traceability')
  const qrAssessment =
    qrCoverage.status === 'available' && qrTarget
      ? assessPilotTarget(qrCoverage.value, qrTarget)
      : null
  const acceptedKg: CalculationResult<number> =
    summary.status === 'available'
      ? { status: 'available', value: summary.value.acceptedKg }
      : summary
  const procurementValueINR: CalculationResult<number> =
    summary.status === 'available'
      ? { status: 'available', value: summary.value.acceptedValueINR }
      : summary
  const paymentCompliance: CalculationResult<number> =
    compliance.status === 'available'
      ? { status: 'available', value: compliance.value.compliancePercent }
      : compliance

  const dailyVolumes = new Map<string, number>()
  for (const lot of lots) {
    if (!lot.acceptedAt) continue
    const day = formatDateKey(lot.acceptedAt)
    dailyVolumes.set(day, (dailyVolumes.get(day) ?? 0) + lot.acceptedQuantityKg)
  }
  const procurementTrend = [...dailyVolumes.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, accepted]) => ({
      label: formatTrendLabel(date, filters.dateRange),
      date,
      acceptedKg: accepted,
    }))

  const commodityVolumes = COMMODITIES.map((commodity) => ({
    commodityId: commodity.id,
    label: commodity.label,
    acceptedKg: lots
      .filter((lot) => lot.commodityId === commodity.id)
      .reduce((total, lot) => total + lot.acceptedQuantityKg, 0),
  })).filter((item) => item.acceptedKg > 0)

  const districtPerformance = districts.map((district) => {
    const districtContracts = dataset.buybackContracts.filter(
      (contract) =>
        contract.status === 'active' &&
        contract.districtId === district.id &&
        commodityMatches(contract.commodityId, filters),
    )
    const districtLots = lots.filter((lot) => lot.districtId === district.id)
    const districtPayments = scopedPayments.filter((payment) => {
      const scope = paymentScope(payment, dataset)
      return scope?.districtId === district.id
    })
    const districtCompliance = calculatePaymentCompliance(districtPayments, filters.paymentSlaHours ?? 72)
    const districtInventory = scopedInventory.filter((balance) =>
      dataset.warehouses.some(
        (warehouse) => warehouse.id === balance.warehouseId && warehouse.districtId === district.id,
      ),
    )
    const inventoryTotal = districtInventory.reduce((total, balance) => {
      const reconciliation = reconcileInventory(balance)
      return total + (reconciliation.status === 'available' ? reconciliation.value.usableQuantityKg : 0)
    }, 0)
    const districtBatches = scopedBatches.filter((batch) =>
      dataset.processingFacilities.some(
        (facility) => facility.id === batch.facilityId && facility.districtId === district.id,
      ),
    )
    const districtEvents = dataset.traceabilityEvents.filter((event) => {
      const batch = districtBatches.find((candidate) => candidate.id === event.processingBatchId)
      return Boolean(batch)
    })
    return {
      districtId: district.id,
      district: district.name,
      pilotStatus: district.pilotStatus,
      farmers: new Set(districtContracts.map((contract) => contract.farmerId)).size,
      acceptedKg: districtLots.reduce((total, lot) => total + lot.acceptedQuantityKg, 0),
      procurementValueINR: districtLots.reduce(
        (total, lot) => total + lot.acceptedQuantityKg * lot.contractedPricePerKgINR,
        0,
      ),
      paymentCompliance:
        districtCompliance.status === 'available'
          ? { status: 'available' as const, value: districtCompliance.value.compliancePercent }
          : districtCompliance,
      usableInventoryKg: inventoryTotal,
      qrCoverage: calculateQrTraceabilityCoverage(districtBatches, dataset.products, districtEvents),
    }
  })

  const paymentDistribution = ['paid', 'pending', 'failed'].map((status) => {
    const payments = scopedPayments.filter((payment) => payment.status === status)
    return {
      status: status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending' : 'Failed',
      count: payments.length,
      amountINR: payments.reduce((total, payment) => total + payment.payableAmountINR, 0),
    }
  })

  const inventoryCommodities = COMMODITIES.filter((commodity) =>
    scopedInventory.some((balance) => balance.commodityId === commodity.id),
  )
  const inventoryByWarehouse = dataset.warehouses
    .filter((warehouse) => districtMatches(warehouse.districtId, filters))
    .map((warehouse) => {
      const row: Record<string, string | number> = { warehouse: warehouse.name.replace(' Warehouse', '') }
      for (const commodity of inventoryCommodities) {
        row[commodity.id] = scopedInventory
          .filter(
            (balance) =>
              balance.warehouseId === warehouse.id && balance.commodityId === commodity.id,
          )
          .reduce((total, balance) => {
            const reconciliation = reconcileInventory(balance)
            return total + (reconciliation.status === 'available' ? reconciliation.value.usableQuantityKg : 0)
          }, 0)
      }
      return row
    })

  const pendingPayments = scopedPayments.filter((payment) => payment.status !== 'paid')
  const sourceAcceptedKg = lots.reduce((total, lot) => total + lot.acceptedQuantityKg, 0)
  const processedOutputKg = scopedBatches.reduce((total, batch) => total + batch.outputQuantityKg, 0)
  const retailSoldKg = scopedSales.reduce((total, sale) => {
    const product = dataset.products.find((candidate) => candidate.id === sale.productId)
    return total + sale.soldQuantityUnits * (product?.packQuantityKg ?? 0)
  }, 0)

  const targets: TargetActual[] = [
    {
      id: 'farmer-income',
      label: 'Contracted farmer income increase',
      target: `${filters.pilotTargetValues?.['farmer-income'] ?? 15}–25%`,
      actual: 'Insufficient data',
      progressPercent: null,
      achieved: null,
      definition: 'A comparable farmer-income baseline is not present in the synthetic records.',
    },
    {
      id: 'farmer-share',
      label: 'Farmer share of shelf price',
      target: farmerShareTarget ? `≥${farmerShareTarget.value}%` : '≥55%',
      actual: farmerShare.status === 'available' ? `${farmerShare.value.toFixed(1)}%` : 'Insufficient data',
      progressPercent: farmerShareAssessment?.status === 'available'
        ? farmerShareAssessment.value.progressPercent
        : null,
      achieved: farmerShareAssessment?.status === 'available'
        ? farmerShareAssessment.value.achieved
        : null,
      definition: 'Attributed farmer payment for sold units divided by the corresponding recorded shelf value. Synthetic allocation only.',
    },
    {
      id: 'grain-loss',
      label: 'Grain loss reduction',
      target: `${filters.pilotTargetValues?.['grain-loss'] ?? 25}–40%`,
      actual: 'Insufficient data',
      progressPercent: null,
      achieved: null,
      definition: 'No comparable pre-pilot loss baseline exists, so reduction cannot be calculated.',
    },
    {
      id: 'payment-sla',
      label: `Payments completed within ${filters.paymentSlaHours ?? 72} hours`,
      target: `100% within ${filters.paymentSlaHours ?? 72}h`,
      actual: paymentCompliance.status === 'available' ? `${paymentCompliance.value.toFixed(1)}%` : 'Insufficient data',
      progressPercent:
        paymentCompliance.status === 'available'
          ? Math.min(paymentCompliance.value, 100)
          : null,
      achieved: paymentCompliance.status === 'available' ? paymentCompliance.value >= 100 : null,
      definition: `Share of completed, timestamp-valid payments recorded no later than ${filters.paymentSlaHours ?? 72} hours after acceptance.`,
    },
    {
      id: 'qr-traceability',
      label: 'QR-traceable state-brand batches',
      target: qrTarget ? `${qrTarget.value}%` : '100%',
      actual: qrCoverage.status === 'available' ? `${qrCoverage.value.toFixed(1)}%` : 'Insufficient data',
      progressPercent: qrAssessment?.status === 'available'
        ? qrAssessment.value.progressPercent
        : null,
      achieved: qrAssessment?.status === 'available'
        ? qrAssessment.value.achieved
        : null,
      definition: 'Share of in-scope state-brand product batches with all required chain stages represented by verified demo events.',
    },
  ]

  return {
    referenceTime,
    latestUpdatedAt: getLatestDemoTimestamp(dataset),
    selectedDistrict,
    dateRangeLabel:
      filters.dateRange === '7d'
        ? 'Last 7 days'
        : filters.dateRange === '30d'
          ? 'Last 30 days'
          : 'Pilot season to date',
    contractedFarmers,
    acceptedKg,
    procurementValueINR,
    paymentCompliance,
    pendingPaymentsINR: pendingPayments.reduce((total, payment) => total + payment.payableAmountINR, 0),
    pendingPaymentsCount: pendingPayments.length,
    usableInventoryKg: usableInventoryResult,
    recordedLossPercent,
    qrCoverage,
    procurementTrend,
    commodityVolumes,
    districtPerformance,
    paymentDistribution,
    inventoryByWarehouse,
    inventoryCommodities,
    flow: [
      {
        label: 'Farm sourcing',
        value: `${(sourceAcceptedKg / 1000).toFixed(2)} MT`,
        detail: `${lots.length} accepted / graded lots`,
        href: '/farm-sourcing',
      },
      {
        label: 'Processing',
        value: `${(processedOutputKg / 1000).toFixed(2)} MT`,
        detail: `${scopedBatches.length} synthetic batches`,
        href: '/processing-hubs',
      },
      {
        label: 'Storage & freight',
        value: usableInventoryResult.status === 'available'
          ? `${(usableInventoryResult.value / 1000).toFixed(2)} MT`
          : 'Insufficient data',
        detail: `${scopedShipments.length} dispatch records`,
        href: '/storage-inventory',
      },
      {
        label: 'Direct retail',
        value: `${retailSoldKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`,
        detail: `${scopedSales.length} synthetic sales`,
        href: '/direct-retail-sales',
      },
    ],
    targets,
    alerts: makeAlerts(dataset, filters, referenceTime),
    activity: makeActivity(dataset, filters),
    filteredCounts: {
      lots: lots.length,
      payments: scopedPayments.length,
      batches: scopedBatches.length,
      shipments: scopedShipments.length,
    },
  }
}
