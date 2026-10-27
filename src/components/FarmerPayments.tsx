import { useMemo, useState } from 'react'
import { BadgeIndianRupee, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DemoDataset } from '../data/models'
import type { DashboardFilters } from '../lib/executiveDashboard'
import { downloadCsv } from '../lib/csv'
import { formatCurrency, formatDemoTimestamp, formatNumber } from '../lib/formatters'
import { calculatePaymentAgeing } from '../lib/calculations'
import { markFarmerPaymentPaid } from '../services/mockDataService'

function dateInRange(timestamp: string | null, range: DashboardFilters['dateRange']) {
  if (!timestamp) return false
  const parsed = Date.parse(timestamp)
  const reference = Date.parse('2026-10-27T09:00:00+05:30')
  const start = range === 'season' ? Date.parse('2026-09-01T00:00:00+05:30') : reference - (range === '7d' ? 7 : 30) * 86_400_000
  return Number.isFinite(parsed) && parsed >= start && parsed <= reference
}

function FarmerPayments({ data, filters, onDataChange, canMutate, demoUserId }: {
  data: DemoDataset
  filters: DashboardFilters
  onDataChange: (data: DemoDataset) => void
  canMutate: boolean
  demoUserId: string
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'pending' | 'paid' | 'failed'>('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const payments = useMemo(() => data.farmerPayments.filter((payment) => {
    const lot = data.procurementLots.find((item) => item.id === payment.procurementLotId)
    const farmer = data.farmers.find((item) => item.id === payment.farmerId)
    const searchText = [payment.id, payment.paymentReference, payment.procurementLotId, farmer?.name, farmer?.farmerCode].join(' ').toLocaleLowerCase()
    return Boolean(lot && (filters.districtId === 'all' || lot.districtId === filters.districtId) &&
      (filters.commodityId === 'all' || lot.commodityId === filters.commodityId) &&
      dateInRange(payment.acceptedAt, filters.dateRange) &&
      (status === 'all' || payment.status === status) &&
      (!search.trim() || searchText.includes(search.trim().toLocaleLowerCase())))
  }).sort((left, right) => Date.parse(right.acceptedAt ?? '') - Date.parse(left.acceptedAt ?? '')), [data, filters.commodityId, filters.dateRange, filters.districtId, search, status])
  const pendingTotal = payments.filter((payment) => payment.status === 'pending').reduce((total, payment) => total + payment.payableAmountINR, 0)
  const exportRows = [
    ['Payment ID', 'Farmer', 'Lot', 'District', 'Status', 'Payable INR', 'Accepted at', 'Due at', 'Paid at', 'Reference'],
    ...payments.map((payment) => [
      payment.id,
      data.farmers.find((farmer) => farmer.id === payment.farmerId)?.name ?? payment.farmerId,
      payment.procurementLotId,
      data.districts.find((district) => district.id === data.procurementLots.find((lot) => lot.id === payment.procurementLotId)?.districtId)?.name ?? '',
      payment.status,
      payment.payableAmountINR,
      payment.acceptedAt ?? 'Insufficient data',
      payment.dueAt ?? 'Insufficient data',
      payment.paidAt ?? 'Insufficient data',
      payment.paymentReference ?? '',
    ]),
  ]
  function confirmPaid(paymentId: string) {
    setError('')
    if (!window.confirm(`Mark ${paymentId} as paid in this synthetic demo?`)) return
    try {
      onDataChange(markFarmerPaymentPaid(data, paymentId, notes[paymentId] ?? '', demoUserId))
      setToast(`${paymentId} marked paid · simulated transfer`)
      setNotes((current) => ({ ...current, [paymentId]: '' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Payment could not be updated.')
    }
  }
  return <div className="operations-page">
    <section className="operations-intro"><div><p className="eyebrow">FARMER PAYMENTS · SYNTHETIC OBLIGATIONS</p><h2>Payment obligations linked to graded and accepted procurement.</h2><p>Payment references and statuses are simulated. No bank, treasury or government payment service is connected.</p></div><BadgeIndianRupee size={24} /></section>
    {toast && <div className="operations-toast" role="status">{toast}<button aria-label="Dismiss confirmation" onClick={() => setToast('')} type="button">×</button></div>}
    <section className="operations-metric-grid"><article className="operations-metric-card"><span className="operations-metric-label">Payment records in scope</span><strong>{formatNumber(payments.length)}</strong><small>Filtered synthetic obligations</small></article><article className="operations-metric-card is-warning"><span className="operations-metric-label">Pending payable</span><strong>{formatCurrency(pendingTotal)}</strong><small>{payments.filter((item) => item.status === 'pending').length} pending records</small></article></section>
    <section className="operations-panel"><div className="operations-panel-title"><div><p className="eyebrow">PAYMENT REGISTER</p><h2>Farmer payment obligations</h2></div><span>Configured SLA: {filters.paymentSlaHours ?? 72}h</span></div>
      <div className="oversight-toolbar"><label>Search payments<input aria-label="Search farmer payments" placeholder="Payment, lot, farmer or reference" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>Status<select aria-label="Payment status filter" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option></select></label><button className="subtle-button" onClick={() => downloadCsv('farmer-payments-demo.csv', exportRows)} type="button"><Download size={14} /> Export filtered CSV</button></div>
      {payments.length ? <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Payment / farmer</th><th>Linked lot</th><th>Accepted / due</th><th>Amount</th><th>Age / SLA</th><th>Status / action</th></tr></thead><tbody>{payments.map((payment) => {
        const farmer = data.farmers.find((item) => item.id === payment.farmerId)
        const ageing = calculatePaymentAgeing(payment, new Date('2026-10-27T09:00:00+05:30'))
        const elapsed = ageing.status === 'available' ? ageing.value.elapsedHours : null
        const withinSla = payment.status === 'paid' && elapsed !== null && elapsed <= (filters.paymentSlaHours ?? 72)
        return <tr key={payment.id}><td><strong>{payment.id}</strong><small>{farmer?.name ?? 'Farmer unavailable'} · {farmer?.farmerCode ?? ''}</small></td><td>{payment.procurementLotId}<small><Link className="trace-related-record-link" to={`/batch-traceability?search=${encodeURIComponent(payment.procurementLotId)}`}>Open lot trace</Link></small></td><td>{payment.acceptedAt ? formatDemoTimestamp(payment.acceptedAt) : 'Insufficient data'}<small>Due {payment.dueAt ? formatDemoTimestamp(payment.dueAt) : 'Insufficient data'}</small></td><td><strong>{formatCurrency(payment.payableAmountINR)}</strong>{payment.paymentReference && <small>{payment.paymentReference}</small>}</td><td>{elapsed === null ? 'Insufficient data' : `${formatNumber(elapsed)}h elapsed`}<small>{payment.status === 'paid' ? withinSla ? `Within ${filters.paymentSlaHours ?? 72}h SLA` : `Outside ${filters.paymentSlaHours ?? 72}h SLA` : ageing.status === 'available' && ageing.value.overdue ? 'Overdue' : 'Pending'}</small></td><td><strong>{payment.status}</strong>{canMutate && payment.status === 'pending' && <div className="payment-action"><input aria-label={`Payment note ${payment.id}`} maxLength={240} placeholder="Optional reason/note" value={notes[payment.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [payment.id]: event.target.value }))} /><button className="subtle-button" onClick={() => confirmPaid(payment.id)} type="button">Mark paid</button></div>}</td></tr>
      })}</tbody></table></div> : <p className="operations-empty">No payment obligations match the selected filters.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="operations-footnote">72-hour compliance applies to completed payments with valid acceptance and payment timestamps; incomplete dates are not treated as compliant. Payments created after grading use the configured demo SLA.</p>
    </section>
  </div>
}
export default FarmerPayments
