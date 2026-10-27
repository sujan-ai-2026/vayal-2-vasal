import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowDown,
  ArrowRight,
  CircleAlert,
  Copy,
  GitBranch,
  Link2,
  PackageCheck,
  QrCode,
  Search,
  Wheat,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import type {
  CommodityId,
  DemoDataset,
  ProcessingBatch,
  TraceabilityEvent,
  TraceabilityStage,
} from '../data/models'
import { COMMODITIES, type DashboardFilters } from '../lib/executiveDashboard'
import { formatDemoTimestamp, formatNumber } from '../lib/formatters'
import { downloadCsv } from '../lib/csv'

type ChainStage =
  | 'farmer'
  | 'pacs-fpo'
  | 'grading'
  | 'processing'
  | 'warehouse-receipt'
  | 'shipment'
  | 'destination'
  | 'retail-sale'

interface ChainEvent {
  id: string
  stage: ChainStage
  occurredAt: string | null
  organisation: string
  location: string
  inputKg: number | null
  outputKg: number | null
  relatedBatchIds: string[]
  status: 'recorded' | 'verified-demo-record' | 'missing-scan' | 'exception'
  reference: string
  discrepancy: string | null
  sortOrder: number
  href: string
}

interface BatchTraceModel {
  batch: ProcessingBatch
  product: DemoDataset['products'][number] | undefined
  facility: DemoDataset['processingFacilities'][number] | undefined
  districtName: string
  qrIdentifier: string
  events: ChainEvent[]
  missingCount: number
  exceptionCount: number
  linkedBatches: string[]
}

const STAGE_ORDER: ChainStage[] = [
  'farmer',
  'pacs-fpo',
  'grading',
  'processing',
  'warehouse-receipt',
  'shipment',
  'destination',
  'retail-sale',
]

const STAGE_LABEL: Record<ChainStage, string> = {
  farmer: 'Farmer',
  'pacs-fpo': 'PACS / FPO',
  grading: 'Grading & acceptance',
  processing: 'Processing',
  'warehouse-receipt': 'Warehouse receipt',
  shipment: 'Shipment',
  destination: 'Destination warehouse / store',
  'retail-sale': 'Retail sale',
}

const TRACE_STAGE_TO_CHAIN: Partial<Record<TraceabilityStage, ChainStage>> = {
  procurement: 'farmer',
  acceptance: 'grading',
  processing: 'processing',
  'warehouse-receipt': 'warehouse-receipt',
  'warehouse-transfer': 'warehouse-receipt',
  dispatch: 'shipment',
  'destination-receipt': 'destination',
  'retail-sale': 'retail-sale',
}

function qrIdentifier(batch: ProcessingBatch): string {
  return `VTV-QR-${batch.outputReference}`
}

function resolveQrIdentifier(value: string): string | null {
  const token = value.trim()
  if (!token) return null
  const direct = /^(?:VTV:BATCH:|VTV-QR-)?(.+)$/i.exec(token)
  return direct?.[1]?.trim() ?? null
}

function commodityLabel(commodityId: CommodityId): string {
  return COMMODITIES.find((commodity) => commodity.id === commodityId)?.label ?? commodityId
}

function eventHref(stage: ChainStage, entityId: string): string {
  const query = encodeURIComponent(entityId)
  if (stage === 'farmer' || stage === 'pacs-fpo' || stage === 'grading') {
    return `/farm-sourcing?search=${query}`
  }
  if (stage === 'processing') return `/processing-hubs?search=${query}`
  if (stage === 'warehouse-receipt') return `/storage-inventory?search=${query}`
  if (stage === 'shipment' || stage === 'destination') return `/freight-logistics?search=${query}`
  if (stage === 'retail-sale') return `/direct-retail-sales?search=${query}`
  return `/batch-traceability?search=${query}`
}

function mapRecordedEvent(event: TraceabilityEvent): ChainEvent {
  const stage = TRACE_STAGE_TO_CHAIN[event.stage] ?? 'processing'
  return {
    id: event.id,
    stage,
    occurredAt: event.occurredAt,
    organisation: event.organisationName,
    location: event.location,
    inputKg: event.inputQuantityKg,
    outputKg: event.outputQuantityKg,
    relatedBatchIds: event.relatedBatchIds,
    status: event.status,
    reference: event.reference,
    discrepancy: event.discrepancy,
    sortOrder: STAGE_ORDER.indexOf(stage),
    href: eventHref(stage, event.reference),
  }
}

function buildBatchEvents(dataset: DemoDataset, batch: ProcessingBatch): ChainEvent[] {
  const events: ChainEvent[] = []
  for (const lotId of batch.sourceLotIds) {
    const lot = dataset.procurementLots.find((candidate) => candidate.id === lotId)
    if (!lot) continue
    const farmer = dataset.farmers.find((candidate) => candidate.id === lot.farmerId)
    const pacsFpo = dataset.pacsFpos.find((candidate) => candidate.id === lot.pacsFpoId)
    const assessment = dataset.gradeAssessments.find(
      (candidate) => candidate.id === lot.gradeAssessmentId,
    )
    if (farmer) {
      events.push({
        id: `source-farmer-${lot.id}`,
        stage: 'farmer',
        occurredAt: lot.arrivedAt,
        organisation: farmer.name,
        location: `${farmer.village}, ${dataset.districts.find((district) => district.id === farmer.districtId)?.name ?? 'Unknown district'}`,
        inputKg: lot.receivedQuantityKg,
        outputKg: lot.acceptedQuantityKg,
        relatedBatchIds: [batch.id],
        status: lot.status === 'rejected' ? 'exception' : 'recorded',
        reference: lot.id,
        discrepancy: lot.rejectedQuantityKg > 0
          ? `${formatNumber(lot.rejectedQuantityKg)} kg rejected from received produce.`
          : null,
        sortOrder: STAGE_ORDER.indexOf('farmer'),
        href: eventHref('farmer', lot.id),
      })
    }
    if (pacsFpo) {
      events.push({
        id: `source-organisation-${lot.id}`,
        stage: 'pacs-fpo',
        occurredAt: lot.arrivedAt,
        organisation: pacsFpo.name,
        location: pacsFpo.location,
        inputKg: lot.receivedQuantityKg,
        outputKg: lot.acceptedQuantityKg,
        relatedBatchIds: [batch.id],
        status: 'recorded',
        reference: lot.id,
        discrepancy: null,
        sortOrder: STAGE_ORDER.indexOf('pacs-fpo'),
        href: eventHref('pacs-fpo', lot.id),
      })
    }
    if (assessment) {
      events.push({
        id: `grade-${assessment.id}`,
        stage: 'grading',
        occurredAt: assessment.assessedAt,
        organisation: pacsFpo?.name ?? 'Demo grading record',
        location: pacsFpo?.location ?? farmer?.village ?? 'Location unavailable',
        inputKg: assessment.acceptedQuantityKg + assessment.rejectedQuantityKg,
        outputKg: assessment.acceptedQuantityKg,
        relatedBatchIds: [batch.id],
        status: assessment.grade === 'rejected' ? 'exception' : 'verified-demo-record',
        reference: assessment.id,
        discrepancy: assessment.rejectionReason,
        sortOrder: STAGE_ORDER.indexOf('grading'),
        href: eventHref('grading', lot.id),
      })
    }
  }

  const facility = dataset.processingFacilities.find((candidate) => candidate.id === batch.facilityId)
  events.push({
    id: `processing-${batch.id}`,
    stage: 'processing',
    occurredAt: batch.processedAt,
    organisation: facility?.name ?? 'Processing facility unavailable',
    location: facility?.location ?? 'Location unavailable',
    inputKg: batch.inputQuantityKg,
    outputKg: batch.outputQuantityKg,
    relatedBatchIds: [...new Set([...batch.parentBatchIds, ...batch.childBatchIds])],
    status: batch.status === 'exception' ? 'exception' : 'recorded',
    reference: batch.outputReference,
    discrepancy: batch.status === 'exception' ? 'Processing batch is marked exception.' : null,
    sortOrder: STAGE_ORDER.indexOf('processing'),
    href: eventHref('processing', batch.id),
  })

  for (const movement of dataset.stockMovements.filter(
    (candidate) => candidate.processingBatchId === batch.id &&
      (candidate.movementType === 'receipt' || candidate.movementType === 'transfer-in'),
  )) {
    const warehouse = dataset.warehouses.find(
      (candidate) => candidate.id === movement.destinationWarehouseId,
    )
    events.push({
      id: movement.id,
      stage: 'warehouse-receipt',
      occurredAt: movement.occurredAt,
      organisation: warehouse?.name ?? 'Warehouse receipt record',
      location: warehouse?.location ?? 'Location unavailable',
      inputKg: movement.quantityKg,
      outputKg: movement.quantityKg,
      relatedBatchIds: [batch.id],
      status: 'verified-demo-record',
      reference: movement.reference,
      discrepancy: movement.note,
      sortOrder: STAGE_ORDER.indexOf('warehouse-receipt'),
      href: eventHref('warehouse-receipt', batch.id),
    })
  }

  for (const balance of dataset.inventoryBalances.filter(
    (candidate) => candidate.processingBatchId === batch.id,
  )) {
    if (events.some((event) =>
      event.stage === 'warehouse-receipt' &&
      event.reference === balance.id,
    )) continue
    const warehouse = dataset.warehouses.find((candidate) => candidate.id === balance.warehouseId)
    events.push({
      id: `receipt-${balance.id}`,
      stage: 'warehouse-receipt',
      occurredAt: balance.receivedAt,
      organisation: warehouse?.name ?? 'Warehouse balance',
      location: warehouse?.location ?? 'Location unavailable',
      inputKg: null,
      outputKg: balance.quantityOnHandKg,
      relatedBatchIds: [batch.id],
      status: balance.receivedAt ? 'recorded' : 'missing-scan',
      reference: balance.id,
      discrepancy: balance.receivedAt ? null : 'Warehouse receipt timestamp is not recorded.',
      sortOrder: STAGE_ORDER.indexOf('warehouse-receipt'),
      href: eventHref('warehouse-receipt', balance.id),
    })
  }

  for (const shipment of dataset.shipments.filter(
    (candidate) => candidate.processingBatchIds.includes(batch.id),
  )) {
    const statusEvents = dataset.shipmentStatusEvents.filter(
      (event) => event.shipmentId === shipment.id,
    )
    if (shipment.dispatchedAt) {
      events.push({
        id: `dispatch-${shipment.id}-${batch.id}`,
        stage: 'shipment',
        occurredAt: shipment.dispatchedAt,
        organisation: shipment.carrierReference,
        location: dataset.warehouses.find((item) => item.id === shipment.originWarehouseId)?.location ?? 'Origin unavailable',
        inputKg: shipment.dispatchQuantityKg / shipment.processingBatchIds.length,
        outputKg: null,
        relatedBatchIds: shipment.processingBatchIds,
        status: shipment.status === 'exception' ? 'exception' : 'verified-demo-record',
        reference: shipment.id,
        discrepancy: shipment.status === 'delayed'
          ? 'Shipment is delayed in simulated status records; no live GPS data.'
          : shipment.recordedLossKg === null ? null : `${formatNumber(shipment.recordedLossKg)} kg recorded freight loss for shipment.`,
        sortOrder: STAGE_ORDER.indexOf('shipment'),
        href: eventHref('shipment', shipment.id),
      })
    } else {
      events.push({
        id: `missing-dispatch-${shipment.id}-${batch.id}`,
        stage: 'shipment',
        occurredAt: shipment.expectedArrivalAt,
        organisation: shipment.carrierReference,
        location: dataset.warehouses.find((item) => item.id === shipment.originWarehouseId)?.location ?? 'Origin unavailable',
        inputKg: shipment.dispatchQuantityKg,
        outputKg: null,
        relatedBatchIds: shipment.processingBatchIds,
        status: 'missing-scan',
        reference: shipment.id,
        discrepancy: 'No dispatch timestamp is recorded.',
        sortOrder: STAGE_ORDER.indexOf('shipment'),
        href: eventHref('shipment', shipment.id),
      })
    }
    for (const change of statusEvents) {
      events.push({
        id: change.id,
        stage: 'shipment',
        occurredAt: change.occurredAt,
        organisation: shipment.carrierReference,
        location: `${shipment.vehicleReference} · simulated status`,
        inputKg: null,
        outputKg: null,
        relatedBatchIds: shipment.processingBatchIds,
        status: change.toStatus === 'exception' ? 'exception' : 'recorded',
        reference: shipment.id,
        discrepancy: change.note,
        sortOrder: STAGE_ORDER.indexOf('shipment'),
        href: eventHref('shipment', shipment.id),
      })
    }
    if (shipment.status === 'delivered' && shipment.actualArrivalAt) {
      const store = dataset.retailStores.find(
        (candidate) => candidate.id === shipment.destinationRetailStoreId,
      )
      const warehouse = dataset.warehouses.find(
        (candidate) => candidate.id === shipment.destinationWarehouseId,
      )
      events.push({
        id: `destination-${shipment.id}-${batch.id}`,
        stage: 'destination',
        occurredAt: shipment.actualArrivalAt,
        organisation: store?.name ?? warehouse?.name ?? 'Destination record',
        location: store?.location ?? warehouse?.location ?? 'Location unavailable',
        inputKg: shipment.dispatchQuantityKg / shipment.processingBatchIds.length,
        outputKg: (shipment.deliveredQuantityKg ?? 0) / shipment.processingBatchIds.length,
        relatedBatchIds: shipment.processingBatchIds,
        status: 'verified-demo-record',
        reference: shipment.id,
        discrepancy: shipment.recordedLossKg ? `${formatNumber(shipment.recordedLossKg)} kg freight loss recorded.` : null,
        sortOrder: STAGE_ORDER.indexOf('destination'),
        href: eventHref('destination', shipment.id),
      })
    }
  }

  for (const sale of dataset.salesTransactions.filter(
    (candidate) => candidate.processingBatchId === batch.id,
  )) {
    const store = dataset.retailStores.find((candidate) => candidate.id === sale.retailStoreId)
    const product = dataset.products.find((candidate) => candidate.id === sale.productId)
    events.push({
      id: sale.id,
      stage: 'retail-sale',
      occurredAt: sale.soldAt,
      organisation: store?.name ?? 'Retail store unavailable',
      location: store?.location ?? 'Location unavailable',
      inputKg: sale.soldQuantityUnits * (product?.packQuantityKg ?? 0),
      outputKg: sale.soldQuantityUnits * (product?.packQuantityKg ?? 0),
      relatedBatchIds: [sale.processingBatchId],
      status: 'verified-demo-record',
      reference: sale.reference,
      discrepancy: null,
      sortOrder: STAGE_ORDER.indexOf('retail-sale'),
      href: eventHref('retail-sale', sale.reference),
    })
  }

  const recorded = dataset.traceabilityEvents
    .filter((event) => event.processingBatchId === batch.id)
    .map(mapRecordedEvent)
  events.push(...recorded)

  const presentStages = new Set(events
    .filter((event) => event.status !== 'missing-scan')
    .map((event) => event.stage))
  for (const stage of STAGE_ORDER) {
    if (presentStages.has(stage)) continue
    events.push({
      id: `missing-${batch.id}-${stage}`,
      stage,
      occurredAt: null,
      organisation: 'Not recorded',
      location: 'Not recorded',
      inputKg: null,
      outputKg: null,
      relatedBatchIds: [],
      status: 'missing-scan',
      reference: `MISSING-${batch.id}-${stage.toUpperCase()}`,
      discrepancy: `No ${STAGE_LABEL[stage].toLocaleLowerCase()} record is available for this batch.`,
      sortOrder: STAGE_ORDER.indexOf(stage),
      href: eventHref(stage, batch.id),
    })
  }

  return events.sort((left, right) => {
    const leftTime = left.occurredAt ? Date.parse(left.occurredAt) : Number.POSITIVE_INFINITY
    const rightTime = right.occurredAt ? Date.parse(right.occurredAt) : Number.POSITIVE_INFINITY
    return leftTime - rightTime || left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
  })
}

function buildBatchModels(dataset: DemoDataset, filters: DashboardFilters): BatchTraceModel[] {
  return dataset.processingBatches.flatMap((batch) => {
    const product = dataset.products.find((candidate) => candidate.id === batch.productId)
    const facility = dataset.processingFacilities.find((candidate) => candidate.id === batch.facilityId)
    const lot = dataset.procurementLots.find((candidate) => batch.sourceLotIds.includes(candidate.id))
    const districtId = facility?.districtId ?? lot?.districtId
    const districtName = dataset.districts.find((district) => district.id === districtId)?.name ?? 'Unknown district'
    if (
      (filters.districtId !== 'all' && districtId !== filters.districtId) ||
      (filters.commodityId !== 'all' && product?.commodityId !== filters.commodityId)
    ) return []
    const events = buildBatchEvents(dataset, batch)
    return [{
      batch,
      product,
      facility,
      districtName,
      qrIdentifier: qrIdentifier(batch),
      events,
      missingCount: events.filter((event) => event.status === 'missing-scan').length,
      exceptionCount: events.filter((event) => event.status === 'exception').length,
      linkedBatches: [...new Set([...batch.parentBatchIds, ...batch.childBatchIds])],
    }]
  })
}

function BatchTraceability({
  data,
  filters,
}: {
  data: DemoDataset
  filters: DashboardFilters
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') ?? searchParams.get('qr') ?? ''
  const [search, setSearch] = useState(initialSearch)
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [scanValue, setScanValue] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const models = useMemo(() => buildBatchModels(data, filters), [data, filters])
  const filtered = useMemo(() => {
    const needle = submittedSearch.trim().toLocaleLowerCase()
    if (!needle) return models
    const qrResolvedId = resolveQrIdentifier(needle)
    return models.filter((model) => {
      const sourceLots = model.batch.sourceLotIds.map((id) =>
        data.procurementLots.find((lot) => lot.id === id),
      )
      const sourcePeople = sourceLots.flatMap((lot) => {
        if (!lot) return []
        const farmer = data.farmers.find((candidate) => candidate.id === lot.farmerId)
        const organisation = data.pacsFpos.find((candidate) => candidate.id === lot.pacsFpoId)
        return [farmer?.name, farmer?.farmerCode, organisation?.name, lot.id, lot.cropVariety]
      })
      const body = [
        model.batch.id,
        model.batch.outputReference,
        model.qrIdentifier,
        model.product?.name,
        model.product?.brandLabel,
        model.districtName,
        model.facility?.name,
        commodityLabel(model.product?.commodityId ?? 'paddy'),
        model.batch.parentBatchIds.join(' '),
        model.batch.childBatchIds.join(' '),
        model.events.map((event) => [event.id, event.reference, event.organisation, event.location].join(' ')).join(' '),
        sourcePeople.join(' '),
      ].join(' ').toLocaleLowerCase()
      return body.includes(needle) || (qrResolvedId !== null && qrResolvedId.toLocaleLowerCase() === model.batch.id.toLocaleLowerCase())
    })
  }, [data, models, submittedSearch])

  const selected =
    filtered.find((model) => model.batch.id === selectedBatchId) ??
    (filtered.length === 1 ? filtered[0] ?? null : null)

  function runSearch(value = search) {
    const resolved = resolveQrIdentifier(value) ?? value.trim()
    setSearch(value)
    setSubmittedSearch(resolved)
    setSelectedBatchId(null)
    setScanMessage('')
    const next = new URLSearchParams(searchParams)
    if (value.trim()) {
      next.set(value.trim().toLocaleUpperCase().startsWith('VTV-QR-') ? 'qr' : 'search', value.trim())
      if (!value.trim().toLocaleUpperCase().startsWith('VTV-QR-')) next.delete('qr')
    } else {
      next.delete('search')
      next.delete('qr')
    }
    setSearchParams(next, { replace: true })
  }

  function scanQr() {
    const resolved = resolveQrIdentifier(scanValue)
    if (!resolved) {
      setScanMessage('Enter or scan a demo QR identifier to resolve a product batch.')
      return
    }
    const match = models.find((model) =>
      [model.batch.id, model.batch.outputReference, model.qrIdentifier]
        .some((value) => value.toLocaleLowerCase() === scanValue.trim().toLocaleLowerCase() ||
          value.toLocaleLowerCase() === resolved.toLocaleLowerCase()),
    )
    if (!match) {
      setScanMessage(`Unknown demo QR identifier: ${scanValue.trim()}`)
      setSearch(scanValue)
      setSubmittedSearch(scanValue)
      setSelectedBatchId(null)
      return
    }
    setScanMessage(`Resolved to ${match.batch.id} · ${match.product?.name ?? 'Product unavailable'}`)
    setSearch(match.batch.id)
    setSubmittedSearch(match.batch.id)
    setSelectedBatchId(match.batch.id)
    setSearchParams({ search: match.batch.id })
  }

  async function copyQrIdentifier(identifier: string) {
    try {
      await navigator.clipboard.writeText(identifier)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (error) {
      setScanMessage(error instanceof Error ? `Could not copy QR identifier: ${error.message}` : 'Could not copy QR identifier.')
    }
  }

  const relatedSearchItems = selected
    ? [
        ...selected.batch.sourceLotIds.map((id) => ({ id, label: `Lot ${id}` })),
        ...data.shipments.filter((shipment) => shipment.processingBatchIds.includes(selected.batch.id)).map((shipment) => ({ id: shipment.id, label: `Shipment ${shipment.id}` })),
        ...data.inventoryBalances.filter((balance) => balance.processingBatchId === selected.batch.id).map((balance) => ({ id: balance.id, label: `Warehouse ${balance.id}` })),
        ...data.retailInventoryBalances.filter((balance) => balance.processingBatchId === selected.batch.id).map((balance) => ({ id: balance.id, label: `Retail ${balance.id}` })),
      ]
    : []
  const linkedShipments = selected
      ? data.shipments.filter((shipment) => shipment.processingBatchIds.includes(selected.batch.id))
      : []

  return (
    <div className="operations-page traceability-page">
      <section className="operations-intro traceability-intro">
        <div>
          <p className="eyebrow">SHARED RECORD CHAIN · SYNTHETIC DEMO</p>
          <h2>Follow product batches from farm sourcing through processing, storage, freight and retail.</h2>
          <p>Events are assembled from shared demo records. A QR identifier helps locate a record; it does not prove authenticity or provide cryptographic verification. Missing steps remain visibly unverified.</p>
        </div>
        <span className="operations-intro-icon"><Link2 size={22} /></span>
      </section>

      <section className="trace-search-panel">
        <form className="trace-search-form" onSubmit={(event) => { event.preventDefault(); runSearch() }}>
          <label className="trace-search-input"><Search size={16} /><span className="sr-only">Search traceability records</span><input aria-label="Search batch, QR, lot, commodity or district" onChange={(event) => setSearch(event.target.value)} placeholder="Batch ID, QR identifier, procurement lot, product, commodity or district" value={search} /><button className="primary-button" type="submit">Search</button></label>
        </form>
        <div className="trace-qr-entry">
          <div className="trace-qr-caption"><QrCode size={16} /><span><strong>Demo QR scan / lookup</strong><small>Paste a VTV-QR identifier or batch QR payload</small></span></div>
          <label className="trace-scan-input"><span className="sr-only">QR identifier</span><input aria-label="QR identifier" onChange={(event) => setScanValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); scanQr() } }} placeholder="VTV-QR-DEMO-RICE-THJ-001" value={scanValue} /><button className="subtle-button" onClick={scanQr} type="button">Resolve QR</button></label>
          {scanMessage && <p className={`trace-scan-message${scanMessage.startsWith('Unknown') || scanMessage.startsWith('Enter') ? ' is-warning' : ''}`} role="status">{scanMessage}</p>}
        </div>
      </section>

      <div className="trace-results-layout">
        <section className="operations-panel trace-batch-list">
          <PanelTitle eyebrow="PRODUCT BATCHES" title="Traceability search results" meta={`${filtered.length} of ${models.length} batches`} />
          <div className="operations-panel-actions">
            <button className="subtle-button" onClick={() => downloadCsv('batch-traceability-demo.csv', [
              ['Batch ID', 'QR identifier', 'Product', 'Commodity', 'District', 'Event ID', 'Stage', 'Timestamp', 'Organisation', 'Location', 'Input kg', 'Output kg', 'Status', 'Reference', 'Discrepancy'],
              ...filtered.flatMap((model) => model.events.map((event) => [
                model.batch.id,
                model.qrIdentifier,
                model.product?.name ?? 'Product unavailable',
                model.product?.commodityId ?? 'Not recorded',
                model.districtName,
                event.id,
                STAGE_LABEL[event.stage],
                event.occurredAt ?? 'Not recorded',
                event.organisation,
                event.location,
                event.inputKg ?? 'Not recorded',
                event.outputKg ?? 'Not recorded',
                event.status,
                event.reference,
                event.discrepancy ?? '',
              ])),
            ])} type="button">Export filtered chain CSV</button>
          </div>
          {filtered.length > 0 ? filtered.map((model) => (
            <button className={`trace-batch-option${selected?.batch.id === model.batch.id ? ' is-selected' : ''}`} key={model.batch.id} onClick={() => setSelectedBatchId(model.batch.id)} type="button">
              <span className="trace-batch-icon"><Wheat size={15} /></span>
              <span className="trace-batch-copy"><strong>{model.batch.id}</strong><small>{model.product?.name ?? 'Product unavailable'} · {commodityLabel(model.product?.commodityId ?? 'paddy')}</small><small>{model.districtName} · {model.batch.outputReference}</small></span>
              <span className={`trace-integrity-chip${model.missingCount ? ' is-missing' : ''}${model.exceptionCount ? ' has-exception' : ''}`} aria-label={`${model.missingCount} missing events and ${model.exceptionCount} exceptions`}>{model.missingCount ? `${model.missingCount} missing` : 'Recorded'}{model.exceptionCount ? ` · ${model.exceptionCount} exception` : ''}</span>
            </button>
          )) : <OperationsEmpty message={submittedSearch ? 'No batch matches that identifier or search term. Check the value or clear search.' : 'No product batches are available in the selected district and commodity scope.'} />}
        </section>

        {selected ? (
          <section aria-labelledby="trace-detail-title" className="operations-panel trace-detail-panel">
            <div className="trace-detail-heading">
              <div><p className="eyebrow">BATCH TRACE · SYNTHETIC RECORDS</p><h2 id="trace-detail-title">{selected.product?.name ?? 'Product batch'}</h2><p>{selected.batch.id} · {selected.districtName} · {commodityLabel(selected.product?.commodityId ?? 'paddy')}</p></div>
              <span className={`trace-integrity-chip${selected.missingCount ? ' is-missing' : ''}${selected.exceptionCount ? ' has-exception' : ''}`}>{selected.missingCount ? `${selected.missingCount} missing step${selected.missingCount === 1 ? '' : 's'}` : 'All modeled stages have records'}{selected.exceptionCount ? ` · ${selected.exceptionCount} exception` : ''}</span>
            </div>
            <div className="trace-batch-metrics"><span>Batch reference<strong>{selected.batch.outputReference}</strong></span><span>Input → output<strong>{formatNumber(selected.batch.inputQuantityKg)} → {formatNumber(selected.batch.outputQuantityKg)} kg</strong></span><span>Processing status<strong>{selected.batch.status.replace('-', ' ')}</strong></span><span>Linked lots<strong>{selected.batch.sourceLotIds.length ? selected.batch.sourceLotIds.join(', ') : 'Not linked'}</strong></span></div>

            <div className="trace-qr-card">
              <QRCodeSVG aria-label={`Demo QR code for ${selected.batch.id}`} includeMargin size={92} value={`VTV:BATCH:${selected.batch.id}`} />
              <div><p className="eyebrow">DEMO QR IDENTIFIER</p><strong>{selected.qrIdentifier}</strong><small>QR lookup only · no authenticity or cryptographic proof</small><button className="subtle-button" onClick={() => void copyQrIdentifier(selected.qrIdentifier)} type="button"><Copy size={12} />{copied ? 'Copied' : 'Copy identifier'}</button></div>
            </div>

            {(selected.linkedBatches.length > 0 || selected.batch.sourceLotIds.length > 1 || linkedShipments.length > 1) && (
              <div className="batch-lineage-panel">
                <h3><GitBranch size={14} />Batch lineage · split / merge relationships</h3>
                <div>
                  {selected.batch.parentBatchIds.length > 0 && <span>Parent batches: {selected.batch.parentBatchIds.map((id) => <button key={id} onClick={() => { setSearch(id); setSubmittedSearch(id); setSelectedBatchId(id) }} type="button">{id}</button>)}</span>}
                  {selected.batch.childBatchIds.length > 0 && <span>Child batches: {selected.batch.childBatchIds.map((id) => <button key={id} onClick={() => { setSearch(id); setSubmittedSearch(id); setSelectedBatchId(id) }} type="button">{id}</button>)}</span>}
                  {selected.batch.sourceLotIds.length > 1 && <span>Multiple recorded source lots: {selected.batch.sourceLotIds.join(', ')}</span>}
                  {linkedShipments.length > 1 && <span>Multiple dispatch records reference this batch: {linkedShipments.map((shipment) => shipment.id).join(', ')}. These are shipment records, not separate child batch IDs.</span>}
                </div>
              </div>
            )}
            {relatedSearchItems.length > 0 && <div className="trace-related-links"><span>Open from linked records</span>{relatedSearchItems.map((item) => <Link key={`${item.label}-${item.id}`} to={`/batch-traceability?search=${encodeURIComponent(item.id)}`}>{item.label}</Link>)}</div>}

            <div className="trace-chain-heading"><div><p className="eyebrow">CHRONOLOGICAL CHAIN</p><h3>Available journey events</h3></div><span>{selected.events.length} event records / gaps</span></div>
            <ol className="trace-event-list">
              {selected.events.map((event, index) => (
                <li className={`trace-event-row trace-status-${event.status}`} key={`${event.id}-${index}`}>
                  <span className="trace-event-marker" aria-hidden="true">{event.status === 'missing-scan' ? <CircleAlert size={13} /> : <PackageCheck size={13} />}</span>
                  <article>
                    <div className="trace-event-title"><div><small>{STAGE_LABEL[event.stage]}</small><h4>{event.organisation}</h4></div><span className={`trace-event-status trace-event-status-${event.status}`} role="status">{event.status === 'verified-demo-record' ? 'Verified demo record' : event.status === 'missing-scan' ? 'Missing scan' : event.status === 'exception' ? 'Exception' : 'Recorded'}</span></div>
                    <div className="trace-event-metadata"><span>Event ID<strong>{event.id}</strong></span><span>Timestamp<strong>{event.occurredAt ? formatDemoTimestamp(event.occurredAt) : 'Not recorded'}</strong></span><span>Location<strong>{event.location}</strong></span><span>Input / output<strong>{event.inputKg === null ? '—' : `${formatNumber(event.inputKg)} kg`} / {event.outputKg === null ? '—' : `${formatNumber(event.outputKg)} kg`}</strong></span><span>Related batches<strong>{event.relatedBatchIds.length ? event.relatedBatchIds.join(', ') : 'None recorded'}</strong></span><span>Reference<strong>{event.reference || 'Not recorded'}</strong></span></div>
                    {event.discrepancy && <p className={`trace-event-discrepancy${event.status === 'missing-scan' || event.status === 'exception' ? ' is-warning' : ''}`}>{event.discrepancy}</p>}
                    <Link className="trace-open-record" to={event.href}>Open related record <ArrowRight size={12} /></Link>
                  </article>
                  {index < selected.events.length - 1 && <span className="trace-event-connector" aria-hidden="true"><ArrowDown size={12} /></span>}
                </li>
              ))}
            </ol>
            <p className="operations-footnote">These QR identifiers are lookup aids only. Events come from synthetic records; missing or unavailable records are not treated as verified.</p>
          </section>
        ) : (
          <section className="operations-panel trace-empty-detail">
            <OperationsEmpty message={submittedSearch ? 'No exact batch selected. Choose a matching result, search a batch ID, or resolve its demo QR identifier.' : 'Choose a batch from the list or search by batch, lot, product, commodity or district to open its chronological chain.'} />
          </section>
        )}
      </div>
    </div>
  )
}

function PanelTitle({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) {
  return <div className="operations-panel-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>
}

function OperationsEmpty({ message }: { message: string }) {
  return <div className="operations-empty"><CircleAlert size={18} /><p>{message}</p></div>
}

export default BatchTraceability
