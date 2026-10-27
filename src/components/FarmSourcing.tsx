import { useMemo, useState, type FormEvent } from 'react'
import { Download, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DemoDataset } from '../data/models'
import { COMMODITIES, type DashboardFilters } from '../lib/executiveDashboard'
import { downloadCsv } from '../lib/csv'
import { formatCurrency, formatDemoTimestamp, formatNumber } from '../lib/formatters'
import { assessProcurementLot, receiveProcurementLot } from '../services/mockDataService'

function inRange(timestamp: string | null, range: DashboardFilters['dateRange']) {
  if (!timestamp) return false
  const parsed = Date.parse(timestamp)
  const reference = Date.parse('2026-10-27T09:00:00+05:30')
  const start = range === 'season' ? Date.parse('2026-09-01T00:00:00+05:30') : reference - (range === '7d' ? 7 : 30) * 86_400_000
  return Number.isFinite(parsed) && parsed >= start && parsed <= reference
}

function FarmSourcing({ data, filters, onDataChange, canMutate, demoUserId, paymentSlaHours }: {
  data: DemoDataset
  filters: DashboardFilters
  onDataChange: (data: DemoDataset) => void
  canMutate: boolean
  demoUserId: string
  paymentSlaHours: number
}) {
  const [search, setSearch] = useState('')
  const [contractId, setContractId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [receiptNote, setReceiptNote] = useState('')
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)
  const [grade, setGrade] = useState<'A' | 'B' | 'C' | 'rejected'>('A')
  const [accepted, setAccepted] = useState('')
  const [rejected, setRejected] = useState('')
  const [gradeNote, setGradeNote] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const lots = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return data.procurementLots.filter((lot) => {
      const farmer = data.farmers.find((item) => item.id === lot.farmerId)
      const organisation = data.pacsFpos.find((item) => item.id === lot.pacsFpoId)
      return (filters.districtId === 'all' || lot.districtId === filters.districtId) &&
        (filters.commodityId === 'all' || lot.commodityId === filters.commodityId) &&
        inRange(lot.acceptedAt ?? lot.arrivedAt, filters.dateRange) &&
        [lot.id, lot.cropVariety, farmer?.name, farmer?.farmerCode, organisation?.name].some((value) => value?.toLocaleLowerCase().includes(needle))
    }).sort((a, b) => Date.parse(b.arrivedAt ?? '') - Date.parse(a.arrivedAt ?? ''))
  }, [data, filters, search])
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null
  const activeContracts = data.buybackContracts.filter((contract) =>
    contract.status === 'active' &&
    (filters.districtId === 'all' || contract.districtId === filters.districtId) &&
    (filters.commodityId === 'all' || contract.commodityId === filters.commodityId),
  )

  function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!window.confirm(`Record ${formatNumber(Number(quantity))} kg against ${contractId}? This creates a synthetic procurement lot.`)) return
    try {
      onDataChange(receiveProcurementLot(data, { contractId, quantityKg: Number(quantity), note: receiptNote, demoUserId }))
      setToast('Synthetic procurement lot received and added to shared records.')
      setQuantity('')
      setReceiptNote('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not receive the demo lot.')
    }
  }

  function submitGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedLot) return
    setError('')
    const acceptedKg = Number(accepted)
    const rejectedKg = Number(rejected)
    if (!window.confirm(`Confirm ${formatNumber(acceptedKg)} kg accepted and ${formatNumber(rejectedKg)} kg rejected for ${selectedLot.id}? A pending payment obligation is created for accepted quantity.`)) return
    try {
      onDataChange(assessProcurementLot(data, selectedLot.id, grade, acceptedKg, rejectedKg, gradeNote, demoUserId, paymentSlaHours))
      setToast(`Grade recorded for ${selectedLot.id}. Payment obligation created for accepted produce, if any.`)
      setSelectedLotId(null)
      setAccepted('')
      setRejected('')
      setGradeNote('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record the grade assessment.')
    }
  }

  const exportRows = [
    ['Lot ID', 'Farmer', 'Organisation', 'District', 'Commodity', 'Variety', 'Received kg', 'Accepted kg', 'Rejected kg', 'Status', 'Reference price INR/kg'],
    ...lots.map((lot) => [
      lot.id,
      data.farmers.find((farmer) => farmer.id === lot.farmerId)?.name ?? lot.farmerId,
      data.pacsFpos.find((org) => org.id === lot.pacsFpoId)?.name ?? lot.pacsFpoId,
      data.districts.find((district) => district.id === lot.districtId)?.name ?? lot.districtId,
      COMMODITIES.find((item) => item.id === lot.commodityId)?.label ?? lot.commodityId,
      lot.cropVariety,
      lot.receivedQuantityKg,
      lot.acceptedQuantityKg,
      lot.rejectedQuantityKg,
      lot.status,
      lot.contractedPricePerKgINR,
    ]),
  ]

  return <div className="operations-page">
    <section className="operations-intro"><div><p className="eyebrow">FARM SOURCING · SYNTHETIC PROCUREMENT</p><h2>Contract-linked lot receipts, grade assessments and accepted quantities.</h2><p>All farmer, contract, lot, grading and price information is synthetic demo data. No live procurement system is connected.</p></div><Sprout size={24} /></section>
    {toast && <div className="operations-toast" role="status">{toast}<button aria-label="Dismiss confirmation" onClick={() => setToast('')} type="button">×</button></div>}
    {canMutate && <details className="operations-panel sourcing-create-panel"><summary>Receive a procurement lot</summary><form className="sourcing-form" onSubmit={submitReceipt}>
      <label className="operations-field">Active buy-back contract<select onChange={(event) => setContractId(event.target.value)} required value={contractId}><option value="">Select contract</option>{activeContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.id} · {data.farmers.find((farmer) => farmer.id === contract.farmerId)?.name} · {COMMODITIES.find((item) => item.id === contract.commodityId)?.label}</option>)}</select></label>
      <label className="operations-field">Received quantity<input aria-label="Received quantity in kilograms" max={contractId ? data.buybackContracts.find((contract) => contract.id === contractId)?.contractedQuantityKg : undefined} min="1" required step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      <label className="operations-field">Receipt note<input aria-label="Receipt note" maxLength={240} value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} /></label>
      <button className="primary-button" disabled={!contractId || !quantity} type="submit">Confirm synthetic receipt</button>
    </form></details>}
    <section className="operations-panel"><div className="operations-panel-title"><div><p className="eyebrow">PROCUREMENT REGISTER</p><h2>Lots and grading</h2></div><span>{lots.length} filtered lots · shared records</span></div>
      <div className="oversight-toolbar"><label>Search lots<input aria-label="Search procurement lots" placeholder="Lot, farmer, PACS/FPO or crop" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="subtle-button" onClick={() => downloadCsv('procurement-lots-demo.csv', exportRows)} type="button"><Download size={14} /> Export filtered CSV</button></div>
      {lots.length ? <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Lot / farmer</th><th>PACS / FPO</th><th>Commodity / district</th><th>Received</th><th>Accepted / rejected</th><th>Reference value</th><th>Status / action</th></tr></thead><tbody>{lots.map((lot) => {
        const farmer = data.farmers.find((item) => item.id === lot.farmerId)
        const organisation = data.pacsFpos.find((item) => item.id === lot.pacsFpoId)
        return <tr key={lot.id}><td><strong>{lot.id}</strong><small>{farmer?.name ?? 'Farmer unavailable'} · {farmer?.farmerCode ?? ''}</small><Link className="trace-related-record-link" to={`/batch-traceability?search=${encodeURIComponent(lot.id)}`}>Trace linked batch</Link></td><td>{organisation?.name ?? 'Organisation unavailable'}</td><td>{COMMODITIES.find((item) => item.id === lot.commodityId)?.label ?? lot.commodityId}<small>{data.districts.find((district) => district.id === lot.districtId)?.name}</small></td><td>{formatNumber(lot.receivedQuantityKg)} kg<small>{lot.arrivedAt ? formatDemoTimestamp(lot.arrivedAt) : 'Time not recorded'}</small></td><td>{formatNumber(lot.acceptedQuantityKg)} / {formatNumber(lot.rejectedQuantityKg)} kg</td><td>{formatCurrency(lot.acceptedQuantityKg * lot.contractedPricePerKgINR)}</td><td><strong>{lot.status}</strong>{canMutate && !lot.gradeAssessmentId && <button className="subtle-button" onClick={() => { setSelectedLotId(lot.id); setAccepted(String(lot.receivedQuantityKg)); setRejected('0'); setError('') }} type="button">Assess grade</button>}</td></tr>
      })}</tbody></table></div> : <p className="operations-empty">No procurement lots match the current filters.</p>}
      <p className="operations-footnote">Contract price × accepted quantity is a synthetic reference value, not a live payment or market quotation.</p>
    </section>
    {error && !selectedLot && <p className="form-error" role="alert">{error}</p>}
    {selectedLot && <div className="operations-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLotId(null) }}><section className="transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="grade-dialog-title"><div className="drawer-heading"><div><p className="eyebrow">DEMO GRADE ASSESSMENT</p><h2 id="grade-dialog-title">{selectedLot.id}</h2><p>Received {formatNumber(selectedLot.receivedQuantityKg)} kg</p></div><button className="icon-button" aria-label="Close grading dialog" onClick={() => setSelectedLotId(null)} type="button">×</button></div><form className="sourcing-form" onSubmit={submitGrade}><label className="operations-field">Grade<select value={grade} onChange={(event) => setGrade(event.target.value as typeof grade)}><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="rejected">Rejected</option></select></label><label className="operations-field">Accepted quantity (kg)<input aria-label="Accepted quantity kg" min="0" required step="1" type="number" value={accepted} onChange={(event) => setAccepted(event.target.value)} /></label><label className="operations-field">Rejected quantity (kg)<input aria-label="Rejected quantity kg" min="0" required step="1" type="number" value={rejected} onChange={(event) => setRejected(event.target.value)} /></label><label className="operations-field">Rejection reason / note<textarea aria-label="Rejection reason or note" maxLength={240} required={Number(rejected) > 0} rows={2} value={gradeNote} onChange={(event) => setGradeNote(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit">Confirm grading</button></form></section></div>}
  </div>
}

export default FarmSourcing
