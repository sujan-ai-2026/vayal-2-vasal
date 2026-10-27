import {
  ClipboardCheck,
  Factory,
  IndianRupee,
  PackageCheck,
  Sprout,
  Store,
  Truck,
  UserRound,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { DemoRole, DemoDataset } from './models'

export type AboutStageId =
  | 'farmer'
  | 'sourcing'
  | 'grading'
  | 'processing'
  | 'storage'
  | 'freight'
  | 'retail'
  | 'payments'

export interface AboutWorkflowStage {
  id: AboutStageId
  title: string
  description: string
  responsibility: string
  path: string
  icon: LucideIcon
  countLabel: string
  count: (data: DemoDataset) => number
  position: { x: number; y: number }
  branch?: boolean
}

export const ABOUT_WORKFLOW_STAGES: readonly AboutWorkflowStage[] = [
  {
    id: 'farmer',
    title: 'Farmer & contract',
    description: 'A synthetic farmer profile is linked to a buy-back contract and a PACS/FPO.',
    responsibility: 'Farmer and procurement organisation',
    path: '/farm-sourcing',
    icon: UserRound,
    countLabel: 'farmer profiles',
    count: (data) => data.farmers.length,
    position: { x: 0, y: 48 },
  },
  {
    id: 'sourcing',
    title: 'Farm sourcing',
    description: 'The contracted crop is received and recorded as a procurement lot.',
    responsibility: 'Procurement team',
    path: '/farm-sourcing',
    icon: Sprout,
    countLabel: 'procurement lots',
    count: (data) => data.procurementLots.length,
    position: { x: 225, y: 48 },
  },
  {
    id: 'grading',
    title: 'Grading & acceptance',
    description: 'A grade assessment records accepted and rejected quantities and any rejection reason.',
    responsibility: 'Procurement and grading team',
    path: '/farm-sourcing',
    icon: ClipboardCheck,
    countLabel: 'grade assessments',
    count: (data) => data.gradeAssessments.length,
    position: { x: 450, y: 48 },
  },
  {
    id: 'processing',
    title: 'Processing',
    description: 'Accepted lots may become one or more processed product batches.',
    responsibility: 'Processing facility',
    path: '/processing-hubs',
    icon: Factory,
    countLabel: 'processing batches',
    count: (data) => data.processingBatches.length,
    position: { x: 675, y: 48 },
  },
  {
    id: 'storage',
    title: 'Storage',
    description: 'Warehouse balances and stock movements represent point-in-time physical stock.',
    responsibility: 'Warehouse operator',
    path: '/storage-inventory',
    icon: Warehouse,
    countLabel: 'inventory balances',
    count: (data) => data.inventoryBalances.length,
    position: { x: 675, y: 288 },
  },
  {
    id: 'freight',
    title: 'Freight',
    description: 'Shipments connect dispatches to destinations; routes and status are simulated.',
    responsibility: 'Logistics and warehouse teams',
    path: '/freight-logistics',
    icon: Truck,
    countLabel: 'shipments',
    count: (data) => data.shipments.length,
    position: { x: 450, y: 288 },
  },
  {
    id: 'retail',
    title: 'Retail & sales',
    description: 'A participating store holds product batches and records synthetic sales.',
    responsibility: 'Participating retail store',
    path: '/direct-retail-sales',
    icon: Store,
    countLabel: 'sales transactions',
    count: (data) => data.salesTransactions.length,
    position: { x: 225, y: 288 },
  },
  {
    id: 'payments',
    title: 'Farmer payment',
    description: 'Acceptance creates a payment obligation; the proposed 72-hour SLA is measured from acceptance.',
    responsibility: 'Payment operations',
    path: '/farmer-payments',
    icon: IndianRupee,
    countLabel: 'payment records',
    count: (data) => data.farmerPayments.length,
    position: { x: 0, y: 288 },
    branch: true,
  },
] as const

export const ABOUT_MAIN_FLOW: readonly AboutStageId[] = [
  'farmer',
  'sourcing',
  'grading',
  'processing',
  'storage',
  'freight',
  'retail',
]

export const ABOUT_ROLE_DETAILS: Record<DemoRole, { title: string; responsibility: string }> = {
  'state-executive': {
    title: 'State executive',
    responsibility: 'Statewide KPIs, district comparisons, reports and exceptions.',
  },
  'district-officer': {
    title: 'District officer',
    responsibility: 'District operations and performance.',
  },
  'procurement-officer': {
    title: 'Procurement officer',
    responsibility: 'Contracts, lots, grading and payment obligations.',
  },
  'warehouse-operator': {
    title: 'Warehouse operator',
    responsibility: 'Inventory, stock transfers and shipments.',
  },
}

export const ABOUT_PERMISSION_ROWS: {
  area: string
  permissions: Record<DemoRole, string>
}[] = [
  {
    area: 'Statewide overview, district comparisons, reports and exceptions',
    permissions: {
      'state-executive': 'Named role need',
      'district-officer': 'Not defined',
      'procurement-officer': 'Not defined',
      'warehouse-operator': 'Not defined',
    },
  },
  {
    area: 'District operations and performance',
    permissions: {
      'state-executive': 'Not defined',
      'district-officer': 'Named role need',
      'procurement-officer': 'Not defined',
      'warehouse-operator': 'Not defined',
    },
  },
  {
    area: 'Contracts, lots, grading and payment obligations',
    permissions: {
      'state-executive': 'Not defined',
      'district-officer': 'Not defined',
      'procurement-officer': 'Named role need',
      'warehouse-operator': 'Not defined',
    },
  },
  {
    area: 'Inventory, stock transfers and shipments',
    permissions: {
      'state-executive': 'Not defined',
      'district-officer': 'Not defined',
      'procurement-officer': 'Not defined',
      'warehouse-operator': 'Named role need',
    },
  },
  {
    area: 'Specific create, edit, approval and cross-district access policy',
    permissions: {
      'state-executive': 'Not defined',
      'district-officer': 'Not defined',
      'procurement-officer': 'Not defined',
      'warehouse-operator': 'Not defined',
    },
  },
]

export const ABOUT_ROLE_ORDER: readonly DemoRole[] = [
  'state-executive',
  'district-officer',
  'procurement-officer',
  'warehouse-operator',
]

export const ABOUT_SUPPORT_STAGE = {
  title: 'Traceability & prototype audit trail',
  description:
    'Traceability events relate to sourcing, grading, processing, warehouse movements, shipments and sales. This is a cross-cutting record of modeled events—not a physical supply-chain step or proof of authenticity.',
  path: '/batch-traceability',
  icon: PackageCheck,
}
