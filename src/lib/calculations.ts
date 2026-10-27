import type {
  FarmerPayment,
  InventoryBalance,
  PilotTarget,
  Product,
  ProcessingBatch,
  ProcurementLot,
  SalesTransaction,
  Shipment,
  TraceabilityEvent,
  Warehouse,
} from '../data/models'

export type CalculationResult<T> =
  | { status: 'available'; value: T }
  | { status: 'insufficient-data'; value: null; reason: string }

export interface ProcurementSummary {
  receivedKg: number
  acceptedKg: number
  rejectedKg: number
  acceptedValueINR: number
}

export interface PaymentAgeing {
  elapsedHours: number
  hoursUntilDue: number
  overdue: boolean
}

export interface PaymentCompliance {
  compliantPaidPayments: number
  eligiblePaidPayments: number
  compliancePercent: number
}

export interface InventoryReconciliation {
  usableQuantityKg: number
  componentTotalKg: number
  physicalVarianceKg: number | null
}

export interface InventoryAgeing {
  agedQuantityKg: number
  unknownAgeQuantityKg: number
}

export interface FarmerShareContext {
  batches: readonly ProcessingBatch[]
  products: readonly Product[]
  procurementLots: readonly ProcurementLot[]
  farmerPayments: readonly FarmerPayment[]
}

export interface LossByStage {
  procurementRejectionPercent: CalculationResult<number>
  processingLossPercent: CalculationResult<number>
  freightLossPercent: CalculationResult<number>
}

export interface TargetAssessment {
  actual: number
  target: number
  direction: PilotTarget['direction']
  progressPercent: number
  achieved: boolean
}

function available<T>(value: T): CalculationResult<T> {
  return { status: 'available', value }
}

function insufficient<T>(reason: string): CalculationResult<T> {
  return { status: 'insufficient-data', value: null, reason }
}

function timestampValue(value: string | null | undefined): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function calculateProcurementSummary(
  lots: readonly ProcurementLot[],
): CalculationResult<ProcurementSummary> {
  if (lots.length === 0) return insufficient('No procurement lots are in scope.')

  return available(
    lots.reduce<ProcurementSummary>(
      (summary, lot) => ({
        receivedKg: summary.receivedKg + lot.receivedQuantityKg,
        acceptedKg: summary.acceptedKg + lot.acceptedQuantityKg,
        rejectedKg: summary.rejectedKg + lot.rejectedQuantityKg,
        acceptedValueINR:
          summary.acceptedValueINR +
          lot.acceptedQuantityKg * lot.contractedPricePerKgINR,
      }),
      { receivedKg: 0, acceptedKg: 0, rejectedKg: 0, acceptedValueINR: 0 },
    ),
  )
}

export function calculatePaymentAgeing(
  payment: FarmerPayment,
  referenceTime: Date,
): CalculationResult<PaymentAgeing> {
  const acceptedAt = timestampValue(payment.acceptedAt)
  const referenceAt = timestampValue(referenceTime.toISOString())
  const dueAt = timestampValue(payment.dueAt)
  const paidAt = timestampValue(payment.paidAt)

  if (acceptedAt === null || dueAt === null || referenceAt === null) {
    return insufficient('Acceptance, due or reference timestamp is missing or invalid.')
  }
  if (payment.status === 'paid' && paidAt === null) {
    return insufficient('A paid record needs a valid payment timestamp.')
  }

  const effectiveEnd = payment.status === 'paid' ? paidAt : referenceAt
  if (effectiveEnd === null || effectiveEnd < acceptedAt) {
    return insufficient('Payment timestamps are not in chronological order.')
  }

  const elapsedHours = (effectiveEnd - acceptedAt) / 3_600_000
  const hoursUntilDue = (dueAt - referenceAt) / 3_600_000
  return available({
    elapsedHours,
    hoursUntilDue,
    overdue: payment.status !== 'paid' && payment.status !== 'failed' && hoursUntilDue < 0,
  })
}

export function calculatePaymentCompliance(
  payments: readonly FarmerPayment[],
  slaHours = 72,
): CalculationResult<PaymentCompliance> {
  const eligible = payments.filter(
    (payment) =>
      payment.status === 'paid' &&
      timestampValue(payment.acceptedAt) !== null &&
      timestampValue(payment.paidAt) !== null,
  )

  if (eligible.length === 0) {
    return insufficient('No completed payments have valid acceptance and payment timestamps.')
  }

  const compliantPaidPayments = eligible.filter((payment) => {
    const acceptedAt = timestampValue(payment.acceptedAt)
    const paidAt = timestampValue(payment.paidAt)
    return acceptedAt !== null && paidAt !== null && paidAt >= acceptedAt && paidAt - acceptedAt <= slaHours * 3_600_000
  }).length

  return available({
    compliantPaidPayments,
    eligiblePaidPayments: eligible.length,
    compliancePercent: (compliantPaidPayments / eligible.length) * 100,
  })
}

export function reconcileInventory(
  balance: InventoryBalance,
): CalculationResult<InventoryReconciliation> {
  const { quantityOnHandKg, reservedQuantityKg, damagedQuantityKg, physicalCountKg } = balance
  if (
    ![quantityOnHandKg, reservedQuantityKg, damagedQuantityKg].every(
      (quantity) => Number.isFinite(quantity) && quantity >= 0,
    ) ||
    reservedQuantityKg + damagedQuantityKg > quantityOnHandKg
  ) {
    return insufficient('Inventory quantities are invalid or exceed the on-hand balance.')
  }

  const usableQuantityKg = quantityOnHandKg - reservedQuantityKg - damagedQuantityKg
  return available({
    usableQuantityKg,
    componentTotalKg: usableQuantityKg + reservedQuantityKg + damagedQuantityKg,
    physicalVarianceKg:
      physicalCountKg === null ? null : physicalCountKg - quantityOnHandKg,
  })
}

export function calculateInventoryAgeing(
  balances: readonly InventoryBalance[],
  referenceTime: Date,
  thresholdDays: number,
): CalculationResult<InventoryAgeing> {
  if (!Number.isFinite(thresholdDays) || thresholdDays < 0) {
    return insufficient('Ageing threshold must be a non-negative number of days.')
  }
  if (balances.length === 0) {
    return insufficient('No inventory balances are in scope.')
  }
  if (!Number.isFinite(referenceTime.getTime())) {
    return insufficient('A valid reference timestamp is required to calculate inventory age.')
  }

  const thresholdTimestamp = referenceTime.getTime() - thresholdDays * 24 * 60 * 60 * 1000
  let agedQuantityKg = 0
  let unknownAgeQuantityKg = 0

  for (const balance of balances) {
    const usable = reconcileInventory(balance)
    if (usable.status !== 'available') return insufficient(usable.reason)
    const receivedAt = timestampValue(balance.receivedAt)
    if (balance.receivedAt && receivedAt === null) {
      return insufficient(`Inventory balance ${balance.id} has an invalid receipt timestamp.`)
    }
    if (receivedAt !== null && receivedAt > referenceTime.getTime()) {
      return insufficient(`Inventory balance ${balance.id} has a receipt timestamp after the reference time.`)
    }
    if (receivedAt === null) {
      unknownAgeQuantityKg += usable.value.usableQuantityKg
    } else if (receivedAt <= thresholdTimestamp) {
      agedQuantityKg += usable.value.usableQuantityKg
    }
  }

  return available({ agedQuantityKg, unknownAgeQuantityKg })
}

export function calculateWarehouseUtilisation(
  warehouse: Warehouse,
  balances: readonly InventoryBalance[],
): CalculationResult<number> {
  if (!Number.isFinite(warehouse.capacityKg) || warehouse.capacityKg <= 0) {
    return insufficient('Warehouse capacity must be greater than zero.')
  }

  const warehouseBalances = balances.filter((balance) => balance.warehouseId === warehouse.id)
  if (warehouseBalances.some((balance) =>
    !Number.isFinite(balance.quantityOnHandKg) || balance.quantityOnHandKg < 0,
  )) {
    return insufficient('Warehouse on-hand quantities are invalid.')
  }

  const onHandKg = warehouseBalances.reduce((total, balance) => total + balance.quantityOnHandKg, 0)
  return available((onHandKg / warehouse.capacityKg) * 100)
}

export function calculateProcessingYield(
  batch: ProcessingBatch,
): CalculationResult<number> {
  if (
    !Number.isFinite(batch.inputQuantityKg) ||
    !Number.isFinite(batch.outputQuantityKg) ||
    batch.inputQuantityKg <= 0 ||
    batch.outputQuantityKg < 0
  ) {
    return insufficient('Comparable input and output quantities are required.')
  }
  return available((batch.outputQuantityKg / batch.inputQuantityKg) * 100)
}

export function calculateFreightDelayHours(
  shipment: Shipment,
  referenceTime: Date,
): CalculationResult<number> {
  const expectedAt = timestampValue(shipment.expectedArrivalAt)
  if (expectedAt === null) return insufficient('Expected arrival timestamp is missing or invalid.')

  const actualAt =
    shipment.status === 'delivered'
      ? timestampValue(shipment.actualArrivalAt)
      : timestampValue(referenceTime.toISOString())
  if (actualAt === null) {
    return insufficient('A delivered shipment needs a valid actual arrival timestamp.')
  }
  return available((actualAt - expectedAt) / 3_600_000)
}

export function calculateStageLosses(
  lots: readonly ProcurementLot[],
  batches: readonly ProcessingBatch[],
  shipments: readonly Shipment[],
): LossByStage {
  const receivedKg = lots.reduce((total, lot) => total + lot.receivedQuantityKg, 0)
  const rejectionKg = lots.reduce((total, lot) => total + lot.rejectedQuantityKg, 0)
  const processingInputKg = batches.reduce((total, batch) => total + batch.inputQuantityKg, 0)
  const processingOutputKg = batches.reduce((total, batch) => total + batch.outputQuantityKg, 0)
  const dispatchKg = shipments.reduce((total, shipment) => total + shipment.dispatchQuantityKg, 0)
  const recordedFreightLossKg = shipments.reduce(
    (total, shipment) => total + (shipment.recordedLossKg ?? 0),
    0,
  )

  return {
    procurementRejectionPercent:
      lots.length === 0 || receivedKg <= 0
        ? insufficient('No valid received procurement quantity is in scope.')
        : available((rejectionKg / receivedKg) * 100),
    processingLossPercent:
      batches.length === 0 || processingInputKg <= 0 || processingOutputKg > processingInputKg
        ? insufficient('Comparable, reconciled processing input and output are required.')
        : available(((processingInputKg - processingOutputKg) / processingInputKg) * 100),
    freightLossPercent:
      shipments.length === 0 || dispatchKg <= 0
        ? insufficient('No valid dispatched shipment quantity is in scope.')
        : available((recordedFreightLossKg / dispatchKg) * 100),
  }
}

export function calculateStageWeightedLoss(
  lots: readonly ProcurementLot[],
  batches: readonly ProcessingBatch[],
  shipments: readonly Shipment[],
): CalculationResult<number> {
  const stageLosses = calculateStageLosses(lots, batches, shipments)
  const lossKg =
    lots.reduce((total, lot) => total + lot.rejectedQuantityKg, 0) +
    batches.reduce(
      (total, batch) => total + Math.max(batch.inputQuantityKg - batch.outputQuantityKg, 0),
      0,
    ) +
    shipments.reduce((total, shipment) => total + (shipment.recordedLossKg ?? 0), 0)
  const inputKg =
    lots.reduce((total, lot) => total + lot.receivedQuantityKg, 0) +
    batches.reduce((total, batch) => total + batch.inputQuantityKg, 0) +
    shipments.reduce((total, shipment) => total + shipment.dispatchQuantityKg, 0)

  if (
    inputKg <= 0 ||
    ![
      stageLosses.procurementRejectionPercent,
      stageLosses.processingLossPercent,
      stageLosses.freightLossPercent,
    ].some((result) => result.status === 'available')
  ) {
    return insufficient('No valid stage-specific input quantities are in scope.')
  }
  return available((lossKg / inputKg) * 100)
}

export function calculateFarmerShareOfShelfPrice(
  sales: readonly SalesTransaction[],
  context: FarmerShareContext,
): CalculationResult<number> {
  let attributedFarmerPaymentINR = 0
  let shelfValueINR = 0
  let comparableSales = 0
  for (const sale of sales) {
    if (
      !Number.isFinite(sale.soldQuantityUnits) ||
      sale.soldQuantityUnits <= 0 ||
      !Number.isFinite(sale.retailPricePerUnitINR) ||
      sale.retailPricePerUnitINR <= 0
    ) continue
    const batch = context.batches.find((candidate) =>
      candidate.id === sale.processingBatchId && candidate.productId === sale.productId,
    )
    const product = context.products.find((candidate) => candidate.id === sale.productId)
    if (!batch || !product || !Number.isFinite(product.packQuantityKg) || product.packQuantityKg <= 0) continue
    const sourceLots = context.procurementLots.filter(
      (lot) => batch.sourceLotIds.includes(lot.id) && lot.commodityId === product.commodityId,
    )
    if (sourceLots.length === 0 || batch.outputQuantityKg <= 0) continue
    const paidAmountINR = context.farmerPayments
      .filter((payment) =>
        payment.status === 'paid' &&
        payment.paidAt !== null &&
        sourceLots.some((lot) => lot.id === payment.procurementLotId),
      )
      .reduce((total, payment) => total + payment.payableAmountINR, 0)
    const soldQuantityKg = sale.soldQuantityUnits * product.packQuantityKg
    if (paidAmountINR <= 0 || soldQuantityKg > batch.outputQuantityKg) continue
    const allocated = (paidAmountINR * soldQuantityKg) / batch.outputQuantityKg
    if (
      sale.farmerPaymentAllocatedINR === null ||
      !Number.isFinite(sale.farmerPaymentAllocatedINR) ||
      Math.abs(sale.farmerPaymentAllocatedINR - allocated) > 0.02
    ) continue
    attributedFarmerPaymentINR += allocated
    shelfValueINR += sale.soldQuantityUnits * sale.retailPricePerUnitINR
    comparableSales += 1
  }
  if (comparableSales === 0 || shelfValueINR <= 0) {
    return insufficient('No sales have comparable farmer-payment attribution and shelf value.')
  }

  return available((attributedFarmerPaymentINR / shelfValueINR) * 100)
}

const requiredTraceStages: TraceabilityEvent['stage'][] = [
  'procurement',
  'acceptance',
  'processing',
  'warehouse-receipt',
  'dispatch',
  'destination-receipt',
  'retail-sale',
]

export function calculateQrTraceabilityCoverage(
  batches: readonly ProcessingBatch[],
  products: readonly Product[],
  events: readonly TraceabilityEvent[],
): CalculationResult<number> {
  const stateBrandBatchIds = batches
    .filter((batch) => products.some((product) => product.id === batch.productId && product.stateBrand))
    .map((batch) => batch.id)

  if (stateBrandBatchIds.length === 0) {
    return insufficient('No state-brand product batches are available for traceability assessment.')
  }

  const completeBatches = stateBrandBatchIds.filter((batchId) => {
    const validStages = new Set(
      events
        .filter(
          (event) =>
            event.processingBatchId === batchId && event.status === 'verified-demo-record',
        )
        .map((event) => event.stage),
    )
    return requiredTraceStages.every((stage) => validStages.has(stage))
  }).length

  return available((completeBatches / stateBrandBatchIds.length) * 100)
}

export function assessPilotTarget(
  actual: number | null,
  target: PilotTarget,
): CalculationResult<TargetAssessment> {
  if (actual === null || !Number.isFinite(actual) || !Number.isFinite(target.value)) {
    return insufficient('A valid actual and proposal target are required for comparison.')
  }

  const achieved =
    target.direction === 'minimum' ? actual >= target.value : actual <= target.value
  const progressPercent =
    target.direction === 'minimum'
      ? target.value === 0
        ? 100
        : Math.min((actual / target.value) * 100, 100)
      : actual <= target.value
        ? 100
        : actual === 0
          ? 100
          : Math.min((target.value / actual) * 100, 100)

  return available({
    actual,
    target: target.value,
    direction: target.direction,
    progressPercent,
    achieved,
  })
}

export function formatCalculation<T>(
  result: CalculationResult<T>,
  formatValue: (value: T) => string,
): string {
  return result.status === 'available' ? formatValue(result.value) : 'Insufficient data'
}
