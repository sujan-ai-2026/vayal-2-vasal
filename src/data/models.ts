export type EntityId = string
export type ISODateTime = string

export type CommodityId = 'paddy' | 'millets' | 'groundnut' | 'gingelly' | 'pulses'
export type DistrictPilotStatus = 'proposed' | 'configurable' | 'not-in-pilot'
export type OrganisationType = 'PACS' | 'FPO'
export type ContractStatus = 'active' | 'completed' | 'draft'
export type LotStatus = 'received' | 'accepted' | 'partially-accepted' | 'rejected'
export type PaymentStatus = 'pending' | 'paid' | 'failed'
export type ShipmentStatus =
  | 'planned'
  | 'dispatched'
  | 'in-transit'
  | 'delivered'
  | 'delayed'
  | 'exception'
export type RetailStoreType = 'ration-shop' | 'cooperative-store'
export type TraceabilityStage =
  | 'procurement'
  | 'acceptance'
  | 'processing'
  | 'warehouse-receipt'
  | 'warehouse-transfer'
  | 'dispatch'
  | 'destination-receipt'
  | 'retail-sale'
export type DemoRole =
  | 'state-executive'
  | 'district-officer'
  | 'procurement-officer'
  | 'warehouse-operator'
export type DataSourceStatus = 'mock' | 'planned' | 'not-connected'
export type StockMovementType = 'receipt' | 'transfer-out' | 'transfer-in' | 'dispatch' | 'adjustment'

export interface District {
  id: EntityId
  name: string
  state: 'Tamil Nadu'
  pilotStatus: DistrictPilotStatus
  proposedCommodities: CommodityId[]
  configuredForDemo: boolean
}

export interface Farmer {
  id: EntityId
  name: string
  districtId: EntityId
  village: string
  pacsFpoId: EntityId
  farmerCode: string
}

export interface PacsFpo {
  id: EntityId
  name: string
  type: OrganisationType
  districtId: EntityId
  location: string
  syntheticMemberCount: number
}

export interface BuybackContract {
  id: EntityId
  farmerId: EntityId
  pacsFpoId: EntityId
  districtId: EntityId
  commodityId: CommodityId
  cropVariety: string
  contractedQuantityKg: number
  agreedPricePerKgINR: number
  signedAt: ISODateTime
  seasonLabel: string
  status: ContractStatus
}

export interface GradeAssessment {
  id: EntityId
  procurementLotId: EntityId
  assessedAt: ISODateTime
  grade: 'A' | 'B' | 'C' | 'rejected'
  acceptedQuantityKg: number
  rejectedQuantityKg: number
  rejectionReason: string | null
  assessedByDemoUserId: EntityId
}

export interface ProcurementLot {
  id: EntityId
  farmerId: EntityId
  contractId: EntityId
  pacsFpoId: EntityId
  districtId: EntityId
  commodityId: CommodityId
  cropVariety: string
  receivedQuantityKg: number
  acceptedQuantityKg: number
  rejectedQuantityKg: number
  contractedPricePerKgINR: number
  gradeAssessmentId: EntityId | null
  status: LotStatus
  arrivedAt: ISODateTime | null
  acceptedAt: ISODateTime | null
}

export interface FarmerPayment {
  id: EntityId
  farmerId: EntityId
  procurementLotId: EntityId
  acceptedAmountINR: number
  payableAmountINR: number
  acceptedAt: ISODateTime | null
  dueAt: ISODateTime | null
  status: PaymentStatus
  paymentMethod: 'NEFT' | 'UPI' | 'simulated-transfer' | null
  paymentReference: string | null
  paidAt: ISODateTime | null
}

export interface ProcessingFacility {
  id: EntityId
  name: string
  districtId: EntityId
  location: string
  supportedCommodities: CommodityId[]
  dailyCapacityKg: number
  operatingStatus: 'simulated-operational' | 'simulated-maintenance'
}

export interface ProcessingBatch {
  id: EntityId
  facilityId: EntityId
  productId: EntityId
  sourceLotIds: EntityId[]
  parentBatchIds: EntityId[]
  childBatchIds: EntityId[]
  inputQuantityKg: number
  outputQuantityKg: number
  processedAt: ISODateTime
  status: 'complete' | 'in-progress' | 'exception'
  outputReference: string
}

export interface Warehouse {
  id: EntityId
  name: string
  districtId: EntityId
  location: string
  capacityKg: number
  simulatedStatus: 'operational' | 'maintenance'
}

export interface InventoryBalance {
  id: EntityId
  warehouseId: EntityId
  processingBatchId: EntityId
  commodityId: CommodityId
  quantityOnHandKg: number
  reservedQuantityKg: number
  damagedQuantityKg: number
  physicalCountKg: number | null
  receivedAt: ISODateTime | null
  lastUpdatedAt: ISODateTime
}

export interface StockMovement {
  id: EntityId
  processingBatchId: EntityId
  sourceWarehouseId: EntityId | null
  destinationWarehouseId: EntityId | null
  movementType: StockMovementType
  quantityKg: number
  occurredAt: ISODateTime
  reference: string
  note: string
}

export interface Shipment {
  id: EntityId
  processingBatchIds: EntityId[]
  originWarehouseId: EntityId
  destinationWarehouseId: EntityId | null
  destinationRetailStoreId: EntityId | null
  commodityId: CommodityId
  dispatchQuantityKg: number
  deliveredQuantityKg: number | null
  vehicleReference: string
  carrierReference: string
  dispatchedAt: ISODateTime | null
  expectedArrivalAt: ISODateTime | null
  actualArrivalAt: ISODateTime | null
  status: ShipmentStatus
  recordedLossKg: number | null
}

export interface ShipmentStatusEvent {
  id: EntityId
  shipmentId: EntityId
  fromStatus: ShipmentStatus
  toStatus: ShipmentStatus
  occurredAt: ISODateTime
  note: string
}

export interface RetailStore {
  id: EntityId
  name: string
  type: RetailStoreType
  districtId: EntityId
  location: string
  storeCode: string
}

export interface Product {
  id: EntityId
  name: string
  commodityId: CommodityId
  brandLabel: string
  packSizeLabel: string
  packQuantityKg: number
  retailPricePerUnitINR: number
  stateBrand: boolean
}

export interface RetailInventoryBalance {
  id: EntityId
  retailStoreId: EntityId
  productId: EntityId
  processingBatchId: EntityId
  quantityOnHandUnits: number
  lastUpdatedAt: ISODateTime
}

export interface SalesTransaction {
  id: EntityId
  retailStoreId: EntityId
  productId: EntityId
  processingBatchId: EntityId
  soldQuantityUnits: number
  retailPricePerUnitINR: number
  farmerPaymentAllocatedINR: number | null
  soldAt: ISODateTime
  reference: string
}

export interface TraceabilityEvent {
  id: EntityId
  processingBatchId: EntityId
  stage: TraceabilityStage
  occurredAt: ISODateTime
  organisationName: string
  location: string
  inputQuantityKg: number | null
  outputQuantityKg: number | null
  relatedBatchIds: EntityId[]
  status: 'verified-demo-record' | 'missing-scan' | 'exception'
  reference: string
  discrepancy: string | null
}

export interface DemoUser {
  id: EntityId
  displayName: string
  role: DemoRole
  districtId: EntityId | null
}

export interface AuditEvent {
  id: EntityId
  occurredAt: ISODateTime
  demoUserId: EntityId
  action: string
  entityType: string
  entityId: EntityId
  previousValue: string | null
  newValue: string | null
  note: string
}

export interface DataSource {
  id: EntityId
  name: string
  purpose: string
  expectedData: string[]
  status: DataSourceStatus
  lastSimulatedSyncAt: ISODateTime | null
  exampleIssue: string | null
}

export interface PilotTarget {
  id: string
  label: string
  metric: string
  displayTarget: string
  value: number
  unit: 'percent' | 'hours'
  direction: 'minimum' | 'maximum'
}

export interface DemoDataset {
  districts: District[]
  farmers: Farmer[]
  pacsFpos: PacsFpo[]
  buybackContracts: BuybackContract[]
  procurementLots: ProcurementLot[]
  gradeAssessments: GradeAssessment[]
  farmerPayments: FarmerPayment[]
  processingFacilities: ProcessingFacility[]
  processingBatches: ProcessingBatch[]
  warehouses: Warehouse[]
  inventoryBalances: InventoryBalance[]
  stockMovements: StockMovement[]
  shipments: Shipment[]
  shipmentStatusEvents: ShipmentStatusEvent[]
  retailStores: RetailStore[]
  products: Product[]
  retailInventoryBalances: RetailInventoryBalance[]
  salesTransactions: SalesTransaction[]
  traceabilityEvents: TraceabilityEvent[]
  demoUsers: DemoUser[]
  auditEvents: AuditEvent[]
  dataSources: DataSource[]
}
