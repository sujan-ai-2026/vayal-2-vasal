import { demoDataset, demoReferenceTimestamp } from '../data/mockData'
import type {
  DemoDataset,
  InventoryBalance,
  Product,
  RetailInventoryBalance,
  ShipmentStatus,
} from '../data/models'

const STORAGE_KEY = 'vayal-to-vaasal-demo-v1'

export interface StockTransferRequest {
  balanceId: string
  destinationWarehouseId: string
  quantityKg: number
  note: string
  demoUserId?: string
}

export interface StockTransferResult {
  dataset: DemoDataset
  movementId: string
  sourceBalance: InventoryBalance
  destinationBalance: InventoryBalance
}

export interface RetailSaleRequest {
  retailInventoryBalanceId: string
  quantityUnits: number
  note: string
  demoUserId?: string
}

export interface ProcurementLotRequest {
  contractId: string
  quantityKg: number
  note: string
  demoUserId: string
}

export interface RetailSaleResult {
  dataset: DemoDataset
  transactionId: string
  transactionReference: string
  remainingUnits: number
}

const shipmentTransitions: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  planned: ['dispatched', 'exception'],
  dispatched: ['in-transit', 'delayed', 'exception'],
  'in-transit': ['delivered', 'delayed', 'exception'],
  delayed: ['in-transit', 'delivered', 'exception'],
  delivered: [],
  exception: [],
}

export function getAllowedShipmentTransitions(
  status: ShipmentStatus,
  hasDispatchedAt = status !== 'planned',
): readonly ShipmentStatus[] {
  if (status === 'exception') {
    return hasDispatchedAt ? ['in-transit', 'delayed'] : ['dispatched']
  }
  return shipmentTransitions[status]
}

function isDemoDataset(value: unknown): value is DemoDataset {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DemoDataset>
  return (
    Array.isArray(candidate.inventoryBalances) &&
    Array.isArray(candidate.stockMovements) &&
    Array.isArray(candidate.traceabilityEvents) &&
    Array.isArray(candidate.auditEvents) &&
    Array.isArray(candidate.shipments) &&
    Array.isArray(candidate.retailInventoryBalances) &&
    Array.isArray(candidate.salesTransactions)
  )
}

export function getDemoData(): DemoDataset {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return demoDataset

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!isDemoDataset(parsed)) {
      throw new Error('Stored demo records do not match the expected data shape.')
    }
    let dataset: DemoDataset = {
      ...parsed,
      shipmentStatusEvents: Array.isArray(parsed.shipmentStatusEvents)
        ? parsed.shipmentStatusEvents
        : [],
    }
    if (!Array.isArray(parsed.shipmentStatusEvents)) {
      dataset = reconcileLegacyDispatchBalances(dataset)
    }
    return {
      ...dataset,
      salesTransactions: dataset.salesTransactions.map((sale) => {
        const batch = dataset.processingBatches.find((candidate) => candidate.id === sale.processingBatchId)
        const product = dataset.products.find((candidate) => candidate.id === sale.productId)
        if (!batch || !product) return sale
        const allocation = calculateFarmerAllocation(
          dataset,
          batch.id,
          sale.soldQuantityUnits * product.packQuantityKg,
        )
        return { ...sale, farmerPaymentAllocatedINR: allocation === null ? null : Math.round(allocation * 100) / 100 }
      }),
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'Saved demo records could not be read. Reset the demo data to continue.',
        { cause: error },
      )
    }
    throw error
  }
}

export function saveDemoData(dataset: DemoDataset): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset))
}

export function appendDemoAuditEvent(
  dataset: DemoDataset,
  event: Omit<DemoDataset['auditEvents'][number], 'id' | 'occurredAt'>,
): DemoDataset {
  const updated: DemoDataset = {
    ...dataset,
    auditEvents: [
      ...dataset.auditEvents,
      {
        ...event,
        id: nextId('audit', dataset.auditEvents.map((item) => item.id)),
        occurredAt: demoReferenceTimestamp,
      },
    ],
  }
  saveDemoData(updated)
  return updated
}

function reconcileLegacyDispatchBalances(dataset: DemoDataset): DemoDataset {
  let inventoryBalances = dataset.inventoryBalances
  const stockMovements = [...dataset.stockMovements]
  for (const shipment of dataset.shipments) {
    if (
      shipment.status === 'planned' ||
      !shipment.dispatchedAt ||
      stockMovements.some((movement) =>
        movement.reference === shipment.id &&
        (movement.movementType === 'dispatch' || movement.movementType === 'transfer-out'),
      ) ||
      stockMovements.some((movement) =>
        movement.movementType === 'dispatch' &&
        movement.sourceWarehouseId === shipment.originWarehouseId &&
        shipment.processingBatchIds.includes(movement.processingBatchId) &&
        movement.quantityKg === shipment.dispatchQuantityKg &&
        movement.occurredAt === shipment.dispatchedAt,
      )
    ) continue

    let remainingKg = shipment.dispatchQuantityKg
    const sourceBalances = inventoryBalances.filter((balance) =>
      balance.warehouseId === shipment.originWarehouseId &&
      shipment.processingBatchIds.includes(balance.processingBatchId),
    )
    for (const balance of sourceBalances) {
      const usableKg = Math.max(
        0,
        balance.quantityOnHandKg - balance.reservedQuantityKg - balance.damagedQuantityKg,
      )
      const movedKg = Math.min(remainingKg, usableKg)
      if (movedKg <= 0) continue
      const updatedBalance: InventoryBalance = {
        ...balance,
        quantityOnHandKg: balance.quantityOnHandKg - movedKg,
        physicalCountKg:
          balance.physicalCountKg === null ? null : balance.physicalCountKg - movedKg,
      }
      inventoryBalances = inventoryBalances.map((entry) =>
        entry.id === balance.id ? updatedBalance : entry,
      )
      stockMovements.push({
        id: nextId('movement', stockMovements.map((movement) => movement.id)),
        processingBatchId: balance.processingBatchId,
        sourceWarehouseId: shipment.originWarehouseId,
        destinationWarehouseId: null,
        movementType: 'dispatch',
        quantityKg: movedKg,
        occurredAt: shipment.dispatchedAt,
        reference: shipment.id,
        note: 'Legacy demo shipment reconciled against source inventory.',
      })
      remainingKg -= movedKg
    }
    if (remainingKg > 0) {
      throw new Error(
        `Legacy shipment ${shipment.id} could not be reconciled: origin stock is short by ${remainingKg} kg.`,
      )
    }
  }
  return { ...dataset, inventoryBalances, stockMovements }
}

function nextId(prefix: string, ids: readonly string[]): string {
  let sequence = ids.length + 1
  let id = `${prefix}-${String(sequence).padStart(3, '0')}`
  while (ids.includes(id)) {
    sequence += 1
    id = `${prefix}-${String(sequence).padStart(3, '0')}`
  }
  return id
}

function validateBatchLinks(dataset: DemoDataset, batchIds: readonly string[], commodityId: string) {
  if (batchIds.length === 0) throw new Error('Shipment must reference at least one product batch.')
  const foundBatches = batchIds
    .map((id) => dataset.processingBatches.find((batch) => batch.id === id))
    .filter((batch): batch is DemoDataset['processingBatches'][number] => batch !== undefined)
  if (foundBatches.length !== batchIds.length) throw new Error('Shipment references a batch that is not available.')
  if (foundBatches.some((batch) => {
    const product = dataset.products.find((candidate) => candidate.id === batch.productId)
    return !product || product.commodityId !== commodityId
  })) {
    throw new Error('Shipment commodity must match every linked batch product.')
  }
  return foundBatches
}

export function updateShipmentStatus(
  dataset: DemoDataset,
  shipmentId: string,
  nextStatus: ShipmentStatus,
  note: string,
  demoUserId = 'user-warehouse',
): DemoDataset {
  const shipment = dataset.shipments.find((candidate) => candidate.id === shipmentId)
  if (!shipment) throw new Error('The selected shipment no longer exists.')
  if (!getAllowedShipmentTransitions(shipment.status, shipment.dispatchedAt !== null).includes(nextStatus)) {
    throw new Error(`Status cannot change from ${shipment.status.replace('-', ' ')} to ${nextStatus.replace('-', ' ')}.`)
  }
  if (
    (nextStatus === 'in-transit' || nextStatus === 'delayed' || nextStatus === 'delivered') &&
    shipment.dispatchedAt === null
  ) {
    throw new Error('Shipment must be dispatched before it can move in transit, be delayed or be delivered.')
  }
  if (!Number.isFinite(shipment.dispatchQuantityKg) || shipment.dispatchQuantityKg <= 0) {
    throw new Error('Shipment needs a positive dispatch quantity before its status can change.')
  }
  const batches = validateBatchLinks(dataset, shipment.processingBatchIds, shipment.commodityId)
  const occurredAt = demoReferenceTimestamp
  const sourceWarehouse = dataset.warehouses.find(
    (warehouse) => warehouse.id === shipment.originWarehouseId,
  )
  if (!sourceWarehouse) throw new Error('Shipment origin warehouse is not available.')

  let inventoryBalances = dataset.inventoryBalances
  let retailInventoryBalances = dataset.retailInventoryBalances
  const stockMovements = [...dataset.stockMovements]
  const traceabilityEvents = [...dataset.traceabilityEvents]
  const deliveredQuantityKg =
    shipment.deliveredQuantityKg ??
    Math.max(0, shipment.dispatchQuantityKg - (shipment.recordedLossKg ?? 0))
  if (
    !Number.isFinite(shipment.recordedLossKg ?? 0) ||
    (shipment.recordedLossKg ?? 0) < 0 ||
    (shipment.recordedLossKg ?? 0) > shipment.dispatchQuantityKg
  ) {
    throw new Error('Shipment loss must be a non-negative quantity no greater than dispatched stock.')
  }

  if (nextStatus === 'dispatched') {
    let remainingKg = shipment.dispatchQuantityKg
    const sourceBalances = dataset.inventoryBalances.filter(
      (balance) =>
        balance.warehouseId === shipment.originWarehouseId &&
        shipment.processingBatchIds.includes(balance.processingBatchId),
    )
    for (const balance of sourceBalances) {
      const usableKg =
        balance.quantityOnHandKg - balance.reservedQuantityKg - balance.damagedQuantityKg
      const movedKg = Math.min(remainingKg, Math.max(0, usableKg))
      if (movedKg <= 0) continue
      if (balance.physicalCountKg !== null && balance.physicalCountKg < movedKg) {
        throw new Error(`Physical count for ${balance.id} is below the quantity to dispatch.`)
      }
      const updatedBalance: InventoryBalance = {
        ...balance,
        quantityOnHandKg: balance.quantityOnHandKg - movedKg,
        physicalCountKg:
          balance.physicalCountKg === null ? null : balance.physicalCountKg - movedKg,
        lastUpdatedAt: occurredAt,
      }
      inventoryBalances = inventoryBalances.map((entry) =>
        entry.id === balance.id ? updatedBalance : entry,
      )
      stockMovements.push({
        id: nextId('movement', stockMovements.map((entry) => entry.id)),
        processingBatchId: balance.processingBatchId,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: null,
        movementType: 'dispatch',
        quantityKg: movedKg,
        occurredAt,
        reference: shipment.id,
        note: `Simulated dispatch for ${shipment.id}.`,
      })
      remainingKg -= movedKg
    }
    if (remainingKg > 0) {
      throw new Error(`Origin warehouse has ${shipment.dispatchQuantityKg - remainingKg} kg of usable stock; ${shipment.dispatchQuantityKg} kg is required.`)
    }
  }

  if (nextStatus === 'delivered' && deliveredQuantityKg > shipment.dispatchQuantityKg) {
    throw new Error('Delivered quantity cannot exceed the dispatch quantity.')
  }
  if (nextStatus === 'delivered' && shipment.destinationRetailStoreId) {
    const destinationStore = dataset.retailStores.find(
      (store) => store.id === shipment.destinationRetailStoreId,
    )
    if (!destinationStore) throw new Error('Shipment destination store is not available.')
    if (batches.some((batch) => {
      const product = dataset.products.find((candidate) => candidate.id === batch.productId)
      return !product || product.packQuantityKg <= 0
    })) {
      throw new Error('A linked batch does not have a valid product pack size.')
    }
    const products = batches
      .map((batch) => dataset.products.find((product) => product.id === batch.productId))
      .filter((product): product is Product => product !== undefined)
    if (products.length !== batches.length) {
      throw new Error('A shipment batch does not have a linked product.')
    }
    if (products.some((product) => product.id !== products[0]?.id)) {
      throw new Error('A store delivery must contain one product type so delivered kilograms can be converted to pack units.')
    }
    const product = products[0]
    if (!product || !Number.isInteger(deliveredQuantityKg / product.packQuantityKg)) {
      throw new Error('Delivered quantity does not resolve to whole retail pack units.')
    }
    const deliveredUnits = deliveredQuantityKg / product.packQuantityKg
    const unitsPerBatch = Math.floor(deliveredUnits / batches.length)
    const remainingUnits = deliveredUnits - unitsPerBatch * batches.length
    for (const [index, batch] of batches.entries()) {
      const receivedUnits = unitsPerBatch + (index === 0 ? remainingUnits : 0)
      const existing = retailInventoryBalances.find(
        (balance) =>
          balance.retailStoreId === destinationStore.id &&
          balance.productId === product.id &&
          balance.processingBatchId === batch.id,
      )
      const updated: RetailInventoryBalance = existing
        ? {
            ...existing,
            quantityOnHandUnits: existing.quantityOnHandUnits + receivedUnits,
            lastUpdatedAt: occurredAt,
          }
        : {
            id: nextId('retail-stock', retailInventoryBalances.map((balance) => balance.id)),
            retailStoreId: destinationStore.id,
            productId: product.id,
            processingBatchId: batch.id,
            quantityOnHandUnits: receivedUnits,
            lastUpdatedAt: occurredAt,
          }
      retailInventoryBalances = existing
        ? retailInventoryBalances.map((balance) => balance.id === existing.id ? updated : balance)
        : [...retailInventoryBalances, updated]
    }
  }
  if (nextStatus === 'delivered' && shipment.destinationWarehouseId) {
    const destinationWarehouse = dataset.warehouses.find(
      (warehouse) => warehouse.id === shipment.destinationWarehouseId,
    )
    if (!destinationWarehouse) throw new Error('Shipment destination warehouse is not available.')
    const received = dataset.inventoryBalances
      .filter((balance) =>
        balance.warehouseId === destinationWarehouse.id &&
        shipment.processingBatchIds.includes(balance.processingBatchId),
      )
      .reduce((total, balance) => total + balance.quantityOnHandKg, 0)
    if (received + deliveredQuantityKg > destinationWarehouse.capacityKg) {
      throw new Error('Delivered shipment exceeds available destination warehouse capacity.')
    }
    let remainingReceiptKg = deliveredQuantityKg
    for (const batchId of shipment.processingBatchIds) {
      const batchShareKg = deliveredQuantityKg / shipment.processingBatchIds.length
      const linkedBatch = batches.find((batch) => batch.id === batchId)
      const linkedProduct = linkedBatch && dataset.products.find((product) => product.id === linkedBatch.productId)
      if (!linkedProduct) throw new Error(`Shipment batch ${batchId} does not have a linked product.`)
      const existing = inventoryBalances.find(
        (balance) => balance.warehouseId === destinationWarehouse.id && balance.processingBatchId === batchId,
      )
      const balance: InventoryBalance = existing
        ? {
            ...existing,
            quantityOnHandKg: existing.quantityOnHandKg + batchShareKg,
            physicalCountKg: existing.physicalCountKg === null ? null : existing.physicalCountKg + batchShareKg,
            lastUpdatedAt: occurredAt,
          }
        : {
            id: nextId('inventory-receipt', inventoryBalances.map((item) => item.id)),
            warehouseId: destinationWarehouse.id,
            processingBatchId: batchId,
            commodityId: linkedProduct.commodityId,
            quantityOnHandKg: batchShareKg,
            reservedQuantityKg: 0,
            damagedQuantityKg: 0,
            physicalCountKg: batchShareKg,
            receivedAt: occurredAt,
            lastUpdatedAt: occurredAt,
          }
      inventoryBalances = existing
        ? inventoryBalances.map((item) => item.id === existing.id ? balance : item)
        : [...inventoryBalances, balance]
      stockMovements.push({
        id: nextId('movement', stockMovements.map((item) => item.id)),
        processingBatchId: batchId,
        sourceWarehouseId: null,
        destinationWarehouseId: destinationWarehouse.id,
        movementType: 'receipt',
        quantityKg: batchShareKg,
        occurredAt,
        reference: shipment.id,
        note: `Simulated destination receipt for ${shipment.id}.`,
      })
      remainingReceiptKg -= batchShareKg
    }
    if (Math.abs(remainingReceiptKg) > 0.0001) {
      throw new Error('Delivered quantity could not be allocated across linked batches.')
    }
  }

  const updatedShipment = {
    ...shipment,
    status: nextStatus,
    dispatchedAt: nextStatus === 'dispatched' ? occurredAt : shipment.dispatchedAt,
    actualArrivalAt: nextStatus === 'delivered' ? occurredAt : shipment.actualArrivalAt,
    deliveredQuantityKg: nextStatus === 'delivered' ? deliveredQuantityKg : shipment.deliveredQuantityKg,
  }
  if (
    nextStatus === 'dispatched' ||
    nextStatus === 'in-transit' ||
    nextStatus === 'delayed' ||
    nextStatus === 'exception'
  ) {
    for (const batchId of shipment.processingBatchIds) {
      traceabilityEvents.push({
        id: nextId('trace', traceabilityEvents.map((event) => event.id)),
        processingBatchId: batchId,
        stage: 'dispatch',
        occurredAt,
        organisationName: 'Prototype freight operations',
        location: sourceWarehouse.location,
        inputQuantityKg: shipment.dispatchQuantityKg / shipment.processingBatchIds.length,
        outputQuantityKg: null,
        relatedBatchIds: shipment.processingBatchIds,
        status: nextStatus === 'exception' ? 'exception' : 'verified-demo-record',
        reference: shipment.id,
        discrepancy: nextStatus === 'delayed' ? 'Simulated shipment marked delayed; no GPS data is used.' : null,
      })
    }
  }
  if (nextStatus === 'delivered') {
    for (const batchId of shipment.processingBatchIds) {
      const store = dataset.retailStores.find((candidate) => candidate.id === shipment.destinationRetailStoreId)
      traceabilityEvents.push({
        id: nextId('trace', traceabilityEvents.map((event) => event.id)),
        processingBatchId: batchId,
        stage: 'destination-receipt',
        occurredAt,
        organisationName: store?.name ?? 'Prototype destination warehouse',
        location: store?.location ?? dataset.warehouses.find((item) => item.id === shipment.destinationWarehouseId)?.location ?? 'Unspecified destination',
        inputQuantityKg: shipment.dispatchQuantityKg / shipment.processingBatchIds.length,
        outputQuantityKg: deliveredQuantityKg / shipment.processingBatchIds.length,
        relatedBatchIds: shipment.processingBatchIds,
        status: 'verified-demo-record',
        reference: shipment.id,
        discrepancy: shipment.recordedLossKg ? `${shipment.recordedLossKg} kg simulated freight loss recorded.` : null,
      })
    }
  }
  const statusEventId = nextId(
    'shipment-status',
    dataset.shipmentStatusEvents.map((event) => event.id),
  )
  const auditId = nextId('audit', dataset.auditEvents.map((event) => event.id))
  const updatedDataset: DemoDataset = {
    ...dataset,
    inventoryBalances,
    retailInventoryBalances,
    stockMovements,
    shipments: dataset.shipments.map((entry) => entry.id === shipment.id ? updatedShipment : entry),
    shipmentStatusEvents: [
      ...dataset.shipmentStatusEvents,
      {
        id: statusEventId,
        shipmentId: shipment.id,
        fromStatus: shipment.status,
        toStatus: nextStatus,
        occurredAt,
        note: note.trim() || `Simulated status changed to ${nextStatus.replace('-', ' ')}.`,
      },
    ],
    traceabilityEvents,
    auditEvents: [
      ...dataset.auditEvents,
      {
        id: auditId,
        occurredAt,
        demoUserId,
        action: 'Updated simulated shipment status',
        entityType: 'Shipment',
        entityId: shipment.id,
        previousValue: shipment.status,
        newValue: nextStatus,
        note: note.trim() || 'Status update recorded in the demo prototype.',
      },
    ],
  }
  saveDemoData(updatedDataset)
  return updatedDataset
}

function calculateFarmerAllocation(
  dataset: DemoDataset,
  processingBatchId: string,
  soldQuantityKg: number,
): number | null {
  const batch = dataset.processingBatches.find((candidate) => candidate.id === processingBatchId)
  const product = batch && dataset.products.find((candidate) => candidate.id === batch.productId)
  if (!batch || !product || batch.outputQuantityKg <= 0) return null
  const sourceLots = dataset.procurementLots.filter(
    (lot) => batch.sourceLotIds.includes(lot.id) && lot.commodityId === product.commodityId,
  )
  if (sourceLots.length === 0) return null
  const paidAmount = dataset.farmerPayments
    .filter((payment) =>
      payment.status === 'paid' &&
      payment.paidAt !== null &&
      sourceLots.some((lot) => lot.id === payment.procurementLotId),
    )
    .reduce((total, payment) => total + payment.payableAmountINR, 0)
  if (paidAmount <= 0) return null
  return (paidAmount * Math.min(soldQuantityKg, batch.outputQuantityKg)) / batch.outputQuantityKg
}

export function recordRetailSale(
  dataset: DemoDataset,
  request: RetailSaleRequest,
): RetailSaleResult {
  const balance = dataset.retailInventoryBalances.find(
    (candidate) => candidate.id === request.retailInventoryBalanceId,
  )
  if (!balance) throw new Error('The selected retail stock record no longer exists.')
  if (!Number.isInteger(request.quantityUnits) || request.quantityUnits <= 0) {
    throw new Error('Enter a positive whole number of retail units.')
  }
  if (!Number.isFinite(balance.quantityOnHandUnits) || balance.quantityOnHandUnits < request.quantityUnits) {
    throw new Error('Sale quantity exceeds available store stock.')
  }
  const store = dataset.retailStores.find((candidate) => candidate.id === balance.retailStoreId)
  const product = dataset.products.find((candidate) => candidate.id === balance.productId)
  const batch = dataset.processingBatches.find((candidate) => candidate.id === balance.processingBatchId)
  if (!store || !product || !batch || batch.productId !== product.id) {
    throw new Error('Retail stock must reference a valid store, product and matching processing batch.')
  }
  if (!product.stateBrand) throw new Error('Sales recording is limited to proposed state-brand demo products.')
  const cumulativeBatchSalesKg = dataset.salesTransactions
    .filter((sale) => sale.processingBatchId === batch.id)
    .reduce((total, sale) => total + sale.soldQuantityUnits * product.packQuantityKg, 0)
  const requestedSaleKg = request.quantityUnits * product.packQuantityKg
  if (cumulativeBatchSalesKg + requestedSaleKg > batch.outputQuantityKg) {
    throw new Error('Sale quantity exceeds the remaining recorded output for this batch.')
  }
  const paidAttribution = calculateFarmerAllocation(
    dataset,
    batch.id,
    requestedSaleKg,
  )
  const transactionId = nextId('sale', dataset.salesTransactions.map((sale) => sale.id))
  const transactionReference = `DEMO-POS-${String(dataset.salesTransactions.length + 1).padStart(3, '0')}`
  const occurredAt = demoReferenceTimestamp
  const remainingUnits = balance.quantityOnHandUnits - request.quantityUnits
  const updatedDataset: DemoDataset = {
    ...dataset,
    retailInventoryBalances: dataset.retailInventoryBalances.map((entry) =>
      entry.id === balance.id
        ? { ...entry, quantityOnHandUnits: remainingUnits, lastUpdatedAt: occurredAt }
        : entry,
    ),
    salesTransactions: [
      ...dataset.salesTransactions,
      {
        id: transactionId,
        retailStoreId: store.id,
        productId: product.id,
        processingBatchId: batch.id,
        soldQuantityUnits: request.quantityUnits,
        retailPricePerUnitINR: product.retailPricePerUnitINR,
        farmerPaymentAllocatedINR: paidAttribution === null
          ? null
          : Math.round(paidAttribution * 100) / 100,
        soldAt: occurredAt,
        reference: transactionReference,
      },
    ],
    traceabilityEvents: [
      ...dataset.traceabilityEvents,
      {
        id: nextId('trace', dataset.traceabilityEvents.map((event) => event.id)),
        processingBatchId: batch.id,
        stage: 'retail-sale',
        occurredAt,
        organisationName: store.name,
        location: store.location,
        inputQuantityKg: request.quantityUnits * product.packQuantityKg,
        outputQuantityKg: request.quantityUnits * product.packQuantityKg,
        relatedBatchIds: [batch.id],
        status: 'verified-demo-record',
        reference: transactionReference,
        discrepancy: null,
      },
    ],
    auditEvents: [
      ...dataset.auditEvents,
      {
        id: nextId('audit', dataset.auditEvents.map((event) => event.id)),
        occurredAt,
        demoUserId: request.demoUserId ?? 'user-district',
        action: 'Recorded simulated state-brand retail sale',
        entityType: 'SalesTransaction',
        entityId: transactionId,
        previousValue: `${balance.quantityOnHandUnits} units`,
        newValue: `${remainingUnits} units; ₹${(request.quantityUnits * product.retailPricePerUnitINR).toLocaleString('en-IN')} shelf value`,
        note: request.note.trim() || 'Inventory decreased and synthetic sale recorded.',
      },
    ],
  }
  saveDemoData(updatedDataset)
  return { dataset: updatedDataset, transactionId, transactionReference, remainingUnits }
}

export function receiveProcurementLot(
  dataset: DemoDataset,
  request: ProcurementLotRequest,
): DemoDataset {
  const contract = dataset.buybackContracts.find((item) => item.id === request.contractId)
  if (!contract) throw new Error('Select an existing buy-back contract.')
  if (contract.status !== 'active') throw new Error('Only active contracts can receive a new lot.')
  if (!Number.isInteger(request.quantityKg) || request.quantityKg <= 0) {
    throw new Error('Received quantity must be a positive whole number of kilograms.')
  }
  const alreadyReceived = dataset.procurementLots
    .filter((lot) => lot.contractId === contract.id)
    .reduce((sum, lot) => sum + lot.receivedQuantityKg, 0)
  if (alreadyReceived + request.quantityKg > contract.contractedQuantityKg) {
    throw new Error(`Quantity exceeds the contract balance of ${Math.max(0, contract.contractedQuantityKg - alreadyReceived)} kg.`)
  }
  const farmer = dataset.farmers.find((item) => item.id === contract.farmerId)
  if (!farmer) throw new Error('The contract farmer is not available.')
  const id = nextId('lot', dataset.procurementLots.map((lot) => lot.id))
  const updated: DemoDataset = {
    ...dataset,
    procurementLots: [...dataset.procurementLots, {
      id,
      farmerId: contract.farmerId,
      contractId: contract.id,
      pacsFpoId: contract.pacsFpoId,
      districtId: contract.districtId,
      commodityId: contract.commodityId,
      cropVariety: contract.cropVariety,
      receivedQuantityKg: request.quantityKg,
      acceptedQuantityKg: 0,
      rejectedQuantityKg: 0,
      contractedPricePerKgINR: contract.agreedPricePerKgINR,
      gradeAssessmentId: null,
      status: 'received',
      arrivedAt: demoReferenceTimestamp,
      acceptedAt: null,
    }],
    auditEvents: [...dataset.auditEvents, {
      id: nextId('audit', dataset.auditEvents.map((event) => event.id)),
      occurredAt: demoReferenceTimestamp,
      demoUserId: request.demoUserId,
      action: 'Recorded synthetic procurement lot receipt',
      entityType: 'ProcurementLot',
      entityId: id,
      previousValue: null,
      newValue: `${request.quantityKg} kg received · ${contract.id}`,
      note: request.note.trim() || 'Synthetic receiving entry for prototype workflow.',
    }],
  }
  saveDemoData(updated)
  return updated
}

export function assessProcurementLot(
  dataset: DemoDataset,
  lotId: string,
  grade: 'A' | 'B' | 'C' | 'rejected',
  acceptedQuantityKg: number,
  rejectedQuantityKg: number,
  note: string,
  demoUserId: string,
  paymentSlaHours: number,
): DemoDataset {
  const lot = dataset.procurementLots.find((item) => item.id === lotId)
  if (!lot) throw new Error('The selected procurement lot no longer exists.')
  if (lot.gradeAssessmentId) throw new Error('This lot has already been graded; use the existing assessment record.')
  if (![acceptedQuantityKg, rejectedQuantityKg].every((quantity) => Number.isInteger(quantity) && quantity >= 0)) {
    throw new Error('Accepted and rejected quantities must be non-negative whole kilograms.')
  }
  if (acceptedQuantityKg + rejectedQuantityKg !== lot.receivedQuantityKg) {
    throw new Error('Accepted and rejected quantities must reconcile exactly to the received quantity.')
  }
  if ((acceptedQuantityKg === 0 && grade !== 'rejected') || (acceptedQuantityKg > 0 && grade === 'rejected')) {
    throw new Error('Choose a rejected grade only when no quantity is accepted.')
  }
  if (rejectedQuantityKg > 0 && !note.trim()) {
    throw new Error('Enter a rejection reason before recording rejected produce.')
  }
  if (!Number.isInteger(paymentSlaHours) || paymentSlaHours < 1 || paymentSlaHours > 240) {
    throw new Error('Configured payment SLA must be between 1 and 240 hours.')
  }
  const assessmentId = nextId('grade', dataset.gradeAssessments.map((assessment) => assessment.id))
  const acceptedAt = acceptedQuantityKg > 0 ? demoReferenceTimestamp : null
  const dueAt = acceptedAt
    ? new Date(Date.parse(acceptedAt) + paymentSlaHours * 3_600_000).toISOString()
    : null
  const paymentId = acceptedQuantityKg > 0
    ? nextId('payment', dataset.farmerPayments.map((payment) => payment.id))
    : null
  const status = acceptedQuantityKg === 0 ? 'rejected' : rejectedQuantityKg > 0 ? 'partially-accepted' : 'accepted'
  const updated: DemoDataset = {
    ...dataset,
    gradeAssessments: [...dataset.gradeAssessments, {
      id: assessmentId,
      procurementLotId: lot.id,
      assessedAt: demoReferenceTimestamp,
      grade,
      acceptedQuantityKg,
      rejectedQuantityKg,
      rejectionReason: rejectedQuantityKg > 0 ? note.trim() : null,
      assessedByDemoUserId: demoUserId,
    }],
    procurementLots: dataset.procurementLots.map((item) => item.id === lot.id ? {
      ...item,
      acceptedQuantityKg,
      rejectedQuantityKg,
      gradeAssessmentId: assessmentId,
      status,
      acceptedAt,
    } : item),
    farmerPayments: paymentId && dueAt ? [...dataset.farmerPayments, {
      id: paymentId,
      farmerId: lot.farmerId,
      procurementLotId: lot.id,
      acceptedAmountINR: acceptedQuantityKg * lot.contractedPricePerKgINR,
      payableAmountINR: acceptedQuantityKg * lot.contractedPricePerKgINR,
      acceptedAt,
      dueAt,
      status: 'pending',
      paymentMethod: null,
      paymentReference: null,
      paidAt: null,
    }] : dataset.farmerPayments,
    auditEvents: [...dataset.auditEvents, {
      id: nextId('audit', dataset.auditEvents.map((event) => event.id)),
      occurredAt: demoReferenceTimestamp,
      demoUserId,
      action: 'Recorded synthetic procurement grade assessment',
      entityType: 'ProcurementLot',
      entityId: lot.id,
      previousValue: `${lot.status} · ${lot.acceptedQuantityKg} kg accepted`,
      newValue: `${status} · ${acceptedQuantityKg} kg accepted · ${rejectedQuantityKg} kg rejected${paymentId ? ` · payment ${paymentId} created` : ''}`,
      note: note.trim() || 'Synthetic grade assessment recorded.',
    }],
  }
  saveDemoData(updated)
  return updated
}

export function markFarmerPaymentPaid(
  dataset: DemoDataset,
  paymentId: string,
  note: string,
  demoUserId: string,
): DemoDataset {
  const payment = dataset.farmerPayments.find((item) => item.id === paymentId)
  if (!payment) throw new Error('The selected payment no longer exists.')
  if (payment.status !== 'pending') throw new Error('Only pending payments can be marked paid.')
  if (!payment.acceptedAt || !payment.dueAt) throw new Error('Payment acceptance or due timestamp is missing.')
  const updated: DemoDataset = {
    ...dataset,
    farmerPayments: dataset.farmerPayments.map((item) => item.id === payment.id ? {
      ...item,
      status: 'paid',
      paymentMethod: 'simulated-transfer',
      paymentReference: `DEMO-PAY-${payment.id.toUpperCase()}`,
      paidAt: demoReferenceTimestamp,
    } : item),
    auditEvents: [...dataset.auditEvents, {
      id: nextId('audit', dataset.auditEvents.map((event) => event.id)),
      occurredAt: demoReferenceTimestamp,
      demoUserId,
      action: 'Marked synthetic farmer payment paid',
      entityType: 'FarmerPayment',
      entityId: payment.id,
      previousValue: payment.status,
      newValue: 'paid · simulated transfer',
      note: note.trim() || 'Synthetic payment confirmation recorded.',
    }],
  }
  saveDemoData(updated)
  return updated
}

export function getDemoReferenceDate(): Date {
  return new Date(demoReferenceTimestamp)
}

export function transferInventory(
  dataset: DemoDataset,
  request: StockTransferRequest,
): StockTransferResult {
  const source = dataset.inventoryBalances.find((balance) => balance.id === request.balanceId)
  if (!source) throw new Error('The selected source inventory record no longer exists.')
  if (!Number.isFinite(request.quantityKg) || request.quantityKg <= 0) {
    throw new Error('Enter a transfer quantity greater than 0 kg.')
  }
  if (!Number.isInteger(request.quantityKg)) {
    throw new Error('Transfer quantities must be entered as whole kilograms.')
  }
  if (!request.destinationWarehouseId) {
    throw new Error('Select a destination warehouse.')
  }
  if (source.warehouseId === request.destinationWarehouseId) {
    throw new Error('Source and destination warehouses must be different.')
  }
  if (!dataset.warehouses.some((warehouse) => warehouse.id === source.warehouseId)) {
    throw new Error('The source warehouse is not available in the demo data.')
  }
  const destinationWarehouse = dataset.warehouses.find(
    (warehouse) => warehouse.id === request.destinationWarehouseId,
  )
  if (!destinationWarehouse) throw new Error('Select a valid destination warehouse.')
  if (source.quantityOnHandKg - source.reservedQuantityKg - source.damagedQuantityKg < request.quantityKg) {
    throw new Error('Transfer quantity exceeds available usable stock.')
  }
  if (source.physicalCountKg !== null && source.physicalCountKg < request.quantityKg) {
    throw new Error('Transfer quantity exceeds the source warehouse physical count.')
  }
  const destinationOnHandKg = dataset.inventoryBalances
    .filter((balance) => balance.warehouseId === destinationWarehouse.id)
    .reduce((total, balance) => total + balance.quantityOnHandKg, 0)
  if (destinationOnHandKg + request.quantityKg > destinationWarehouse.capacityKg) {
    throw new Error('Transfer quantity exceeds available destination warehouse capacity.')
  }

  let movementSequence = dataset.stockMovements.length + 1
  let movementId = `movement-transfer-${String(movementSequence).padStart(3, '0')}`
  while (dataset.stockMovements.some((movement) => movement.id === movementId)) {
    movementSequence += 1
    movementId = `movement-transfer-${String(movementSequence).padStart(3, '0')}`
  }
  const occurredAt = demoReferenceTimestamp
  const sourceBalance: InventoryBalance = {
    ...source,
    quantityOnHandKg: source.quantityOnHandKg - request.quantityKg,
    physicalCountKg:
      source.physicalCountKg === null ? null : source.physicalCountKg - request.quantityKg,
    lastUpdatedAt: occurredAt,
  }
  const existingDestination = dataset.inventoryBalances.find(
    (balance) =>
      balance.warehouseId === destinationWarehouse.id &&
      balance.processingBatchId === source.processingBatchId,
  )
  const destinationBalance: InventoryBalance = existingDestination
    ? {
        ...existingDestination,
        quantityOnHandKg: existingDestination.quantityOnHandKg + request.quantityKg,
        physicalCountKg:
          existingDestination.physicalCountKg === null
            ? null
            : existingDestination.physicalCountKg + request.quantityKg,
        lastUpdatedAt: occurredAt,
      }
    : {
        id: `inventory-${movementId}`,
        warehouseId: destinationWarehouse.id,
        processingBatchId: source.processingBatchId,
        commodityId: source.commodityId,
        quantityOnHandKg: request.quantityKg,
        reservedQuantityKg: 0,
        damagedQuantityKg: 0,
        physicalCountKg: request.quantityKg,
        receivedAt: occurredAt,
        lastUpdatedAt: occurredAt,
      }

  const sourceWarehouse = dataset.warehouses.find(
    (warehouse) => warehouse.id === source.warehouseId,
  )
  const product = dataset.products.find((candidate) =>
    dataset.processingBatches.some(
      (batch) => batch.id === source.processingBatchId && batch.productId === candidate.id,
    ),
  )
  if (!sourceWarehouse || !product) {
    throw new Error('The inventory record is missing a linked warehouse or product.')
  }

  const updatedDataset: DemoDataset = {
    ...dataset,
    inventoryBalances: dataset.inventoryBalances.map((balance) => {
      if (balance.id === sourceBalance.id) return sourceBalance
      if (existingDestination && balance.id === existingDestination.id) return destinationBalance
      return balance
    }).concat(existingDestination ? [] : [destinationBalance]),
    stockMovements: [
      ...dataset.stockMovements,
      {
        id: movementId,
        processingBatchId: source.processingBatchId,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        movementType: 'transfer-out',
        quantityKg: request.quantityKg,
        occurredAt,
        reference: movementId,
        note: request.note.trim() || 'Simulated warehouse stock transfer.',
      },
    ],
    traceabilityEvents: [
      ...dataset.traceabilityEvents,
      {
        id: `trace-${movementId}`,
        processingBatchId: source.processingBatchId,
        stage: 'warehouse-transfer',
        occurredAt,
        organisationName: 'Prototype warehouse operations',
        location: `${sourceWarehouse.location} → ${destinationWarehouse.location}`,
        inputQuantityKg: request.quantityKg,
        outputQuantityKg: request.quantityKg,
        relatedBatchIds: [source.processingBatchId],
        status: 'verified-demo-record',
        reference: movementId,
        discrepancy: null,
      },
    ],
    auditEvents: [
      ...dataset.auditEvents,
      {
        id: `audit-${movementId}`,
        occurredAt,
        demoUserId: request.demoUserId ?? 'user-warehouse',
        action: 'Recorded simulated warehouse stock transfer',
        entityType: 'StockMovement',
        entityId: movementId,
        previousValue: `${source.quantityOnHandKg} kg at ${sourceWarehouse.name}`,
        newValue: `${sourceBalance.quantityOnHandKg} kg at source; ${destinationBalance.quantityOnHandKg} kg at ${destinationWarehouse.name}`,
        note: request.note.trim() || 'Stock moved without changing system-wide quantity.',
      },
    ],
  }

  saveDemoData(updatedDataset)
  return { dataset: updatedDataset, movementId, sourceBalance, destinationBalance }
}

export function resetDemoData(): DemoDataset {
  window.localStorage.removeItem(STORAGE_KEY)
  return demoDataset
}
