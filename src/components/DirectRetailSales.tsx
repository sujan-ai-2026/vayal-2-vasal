import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BadgeIndianRupee,
  CircleAlert,
  ClipboardList,
  Package,
  Search,
  ShoppingBasket,
  Store,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DemoDataset, RetailInventoryBalance } from '../data/models'
import { calculateFarmerShareOfShelfPrice } from '../lib/calculations'
import { type DashboardFilters } from '../lib/executiveDashboard'
import { formatCurrency, formatDemoTimestamp, formatNumber, formatPercent } from '../lib/formatters'
import { downloadCsv } from '../lib/csv'
import { recordRetailSale, type RetailSaleResult } from '../services/mockDataService'

const REFERENCE_TIME = new Date('2026-10-27T09:00:00+05:30')
const REORDER_THRESHOLD_UNITS = 30

function isWithinRange(timestamp: string, range: DashboardFilters['dateRange']): boolean {
  const parsed = Date.parse(timestamp)
  const reference = REFERENCE_TIME.getTime()
  const start = range === 'season'
    ? Date.parse('2026-09-01T00:00:00+05:30')
    : reference - (range === '7d' ? 7 : 30) * 86_400_000
  return Number.isFinite(parsed) && parsed >= start && parsed <= reference
}

function DirectRetailSales({
  data,
  filters,
  onDataChange,
  canMutate,
  demoUserId,
}: {
  data: DemoDataset
  filters: DashboardFilters
  onDataChange: (dataset: DemoDataset) => void
  canMutate: boolean
  demoUserId: string
}) {
  const [search, setSearch] = useState('')
  const [storeType, setStoreType] = useState<'all' | 'ration-shop' | 'cooperative-store'>('all')
  const [selectedBalanceId, setSelectedBalanceId] = useState<string | null>(null)
  const [saleBalanceId, setSaleBalanceId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('')
  const [saleNote, setSaleNote] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const districtNames = useMemo(
    () => new Map(data.districts.map((district) => [district.id, district.name])),
    [data.districts],
  )
  const scopedBalances = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return data.retailInventoryBalances.filter((balance) => {
      const store = data.retailStores.find((candidate) => candidate.id === balance.retailStoreId)
      const product = data.products.find((candidate) => candidate.id === balance.productId)
      const text = [
        store?.name,
        store?.storeCode,
        store?.location,
        product?.name,
        balance.processingBatchId,
        balance.id,
      ].join(' ').toLocaleLowerCase()
      return Boolean(
        store &&
        product &&
        (filters.districtId === 'all' || store.districtId === filters.districtId) &&
        (filters.commodityId === 'all' || product.commodityId === filters.commodityId) &&
        (storeType === 'all' || store.type === storeType) &&
        (!needle || text.includes(needle)),
      )
    })
  }, [data, filters, search, storeType])
  const scopedSales = useMemo(() => data.salesTransactions.filter((sale) => {
    const store = data.retailStores.find((candidate) => candidate.id === sale.retailStoreId)
    const product = data.products.find((candidate) => candidate.id === sale.productId)
    const text = [
      sale.reference,
      sale.processingBatchId,
      store?.name,
      product?.name,
    ].join(' ').toLocaleLowerCase()
    return Boolean(
      store &&
      product &&
      (filters.districtId === 'all' || store.districtId === filters.districtId) &&
      (filters.commodityId === 'all' || product.commodityId === filters.commodityId) &&
      isWithinRange(sale.soldAt, filters.dateRange) &&
      (storeType === 'all' || store.type === storeType) &&
      (!search.trim() || text.includes(search.trim().toLocaleLowerCase())),
    )
  }), [data, filters, search, storeType])

  const farmerShare = calculateFarmerShareOfShelfPrice(scopedSales, {
    batches: data.processingBatches,
    products: data.products,
    procurementLots: data.procurementLots,
    farmerPayments: data.farmerPayments,
  })
  const selectedBalance = data.retailInventoryBalances.find((balance) => balance.id === selectedBalanceId) ?? null
  const saleBalance = data.retailInventoryBalances.find((balance) => balance.id === saleBalanceId) ?? null
  const totalUnits = scopedBalances.reduce((total, balance) => total + balance.quantityOnHandUnits, 0)
  const shelfSalesValue = scopedSales.reduce(
    (total, sale) => total + sale.soldQuantityUnits * sale.retailPricePerUnitINR,
    0,
  )
  const lowStockCount = scopedBalances.filter(
    (balance) => balance.quantityOnHandUnits <= REORDER_THRESHOLD_UNITS,
  ).length
  const saleRowProducts = (balance: RetailInventoryBalance) => {
    const product = data.products.find((item) => item.id === balance.productId)
    const batch = data.processingBatches.find((item) => item.id === balance.processingBatchId)
    return { product, batch }
  }
  const salesForBalance = (balance: RetailInventoryBalance) => scopedSales
    .filter((sale) =>
      sale.retailStoreId === balance.retailStoreId &&
      sale.productId === balance.productId &&
      sale.processingBatchId === balance.processingBatchId,
    )
    .sort((left, right) => Date.parse(right.soldAt) - Date.parse(left.soldAt))

  function closeSale() {
    setSaleBalanceId(null)
    setQuantity('')
    setSaleNote('')
    setError('')
  }

  function confirmSale() {
    setError('')
    if (!saleBalance) {
      setError('The selected store stock record is no longer available.')
      return
    }
    try {
      const result: RetailSaleResult = recordRetailSale(data, {
        retailInventoryBalanceId: saleBalance.id,
        quantityUnits: Number(quantity),
        note: saleNote,
        demoUserId,
      })
      onDataChange(result.dataset)
      const transaction = result.dataset.salesTransactions.find((sale) => sale.id === result.transactionId)
      setToast(`${result.transactionReference} recorded · ${formatNumber(Number(quantity))} units sold${transaction?.farmerPaymentAllocatedINR === null ? ' · farmer attribution unavailable' : ''}`)
      closeSale()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The simulated sale could not be recorded.')
    }
  }

  const districtSales = data.districts
    .filter((district) => filters.districtId === 'all' || district.id === filters.districtId)
    .map((district) => {
      const sales = scopedSales.filter((sale) =>
        data.retailStores.find((store) => store.id === sale.retailStoreId)?.districtId === district.id,
      )
      return {
        district,
        stores: new Set(sales.map((sale) => sale.retailStoreId)).size,
        units: sales.reduce((total, sale) => total + sale.soldQuantityUnits, 0),
        value: sales.reduce((total, sale) => total + sale.soldQuantityUnits * sale.retailPricePerUnitINR, 0),
      }
    })
    .filter((row) => row.stores > 0 || (filters.districtId !== 'all' && row.district.id === filters.districtId))

  return (
    <div className="operations-page">
      <section className="operations-intro retail-intro">
        <div>
          <p className="eyebrow">PARTICIPATING DEMO STORES · SYNTHETIC POS RECORDS</p>
          <h2>State-brand availability, replenishment needs and recorded retail sales.</h2>
          <p>All store, price, stock and sales values are demo records. The Government of Tamil Nadu is the intended owner of any proposed platform and brand; this prototype does not imply endorsement or deployment.</p>
        </div>
        <span className="operations-intro-icon"><Store size={22} /></span>
      </section>

      {toast && <div className="operations-toast" role="status"><Package size={16} /><span>{toast}</span><button aria-label="Dismiss sale confirmation" onClick={() => setToast('')} type="button"><X size={14} /></button></div>}

      <section className="operations-metric-grid" aria-label="Retail summary">
        <SummaryCard icon={Store} label="Store / batch records" value={formatNumber(scopedBalances.length)} detail={`${new Set(scopedBalances.map((balance) => balance.retailStoreId)).size} participating stores`} />
        <SummaryCard icon={ShoppingBasket} label="Retail units on hand" value={formatNumber(totalUnits)} detail={`${lowStockCount} lines at or below ${REORDER_THRESHOLD_UNITS}-unit reorder threshold`} warning={lowStockCount > 0} />
        <SummaryCard icon={BadgeIndianRupee} label="Recorded shelf sales" value={formatCurrency(shelfSalesValue)} detail={`${formatNumber(scopedSales.length)} transactions in selected date range`} />
        <SummaryCard icon={ClipboardList} label="Farmer share of shelf price" value={farmerShare.status === 'available' ? formatPercent(farmerShare.value) : 'Insufficient data'} detail="Proposal target: at least 55% · not guaranteed" />
      </section>

      <section className="operations-panel">
        <PanelTitle eyebrow="STORE STOCK REGISTER" title="State-brand availability & replenishment" meta={`${scopedBalances.length} linked store/product/batch balances`} />
        <div className="operations-panel-actions">
          <button className="subtle-button" onClick={() => downloadCsv('retail-stock-demo.csv', [
            ['Store', 'Store code', 'District', 'Product', 'Product batch', 'Commodity', 'Units on hand', 'Pack size kg', 'Retail price per unit INR', 'Stock updated at'],
            ...scopedBalances.map((balance) => {
              const store = data.retailStores.find((item) => item.id === balance.retailStoreId)
              const product = data.products.find((item) => item.id === balance.productId)
              return [
                store?.name ?? 'Unknown store',
                store?.storeCode ?? 'Not recorded',
                districtNames.get(store?.districtId ?? '') ?? 'Unknown district',
                product?.name ?? 'Unknown product',
                balance.processingBatchId,
                product?.commodityId ?? 'Not recorded',
                balance.quantityOnHandUnits,
                product?.packQuantityKg ?? 'Insufficient data',
                product?.retailPricePerUnitINR ?? 'Insufficient data',
                balance.lastUpdatedAt,
              ]
            }),
          ])} type="button">Export filtered stock CSV</button>
        </div>
        <div className="operations-toolbar">
          <label className="operations-search"><Search size={14} /><span className="sr-only">Search retail records</span><input aria-label="Search retail records" onChange={(event) => setSearch(event.target.value)} placeholder="Search store, product, store code or batch" value={search} /></label>
          <label className="operations-filter-label">Store type
            <select aria-label="Store type filter" onChange={(event) => setStoreType(event.target.value as 'all' | 'ration-shop' | 'cooperative-store')} value={storeType}>
              <option value="all">All participating stores</option><option value="ration-shop">Ration shops</option><option value="cooperative-store">Cooperative stores</option>
            </select>
          </label>
        </div>
        {scopedBalances.length > 0 ? (
          <div className="operations-table-wrap">
            <table className="operations-table retail-table">
              <thead><tr><th>Participating store</th><th>Product / batch</th><th>Stock available</th><th>Retail price</th><th>Replenishment</th><th>Recent sales</th><th>Actions</th></tr></thead>
              <tbody>
                {scopedBalances.map((balance) => {
                  const store = data.retailStores.find((item) => item.id === balance.retailStoreId)
                  const product = data.products.find((item) => item.id === balance.productId)
                  const sales = salesForBalance(balance)
                  const low = balance.quantityOnHandUnits <= REORDER_THRESHOLD_UNITS
                  return (
                    <tr key={balance.id}>
                      <td><strong>{store?.name ?? 'Unknown store'}</strong><small>{store?.storeCode} · {districtNames.get(store?.districtId ?? '') ?? 'Unknown district'} · {store?.type === 'ration-shop' ? 'Ration shop' : 'Cooperative store'}</small></td>
                      <td><strong>{product?.name ?? 'Unknown product'}</strong><small>{product?.brandLabel ?? 'No brand label'} · {balance.processingBatchId} · {product?.packSizeLabel}</small></td>
                      <td><strong>{formatNumber(balance.quantityOnHandUnits)} units</strong><small>{formatNumber(balance.quantityOnHandUnits * (product?.packQuantityKg ?? 0))} kg equivalent · updated {formatDemoTimestamp(balance.lastUpdatedAt)}</small></td>
                      <td><strong>{product ? formatCurrency(product.retailPricePerUnitINR) : 'Insufficient data'}</strong><small>per {product?.packSizeLabel ?? 'unit'}</small></td>
                      <td>{low ? <span className={`stock-status ${balance.quantityOnHandUnits === 0 ? 'stock-discrepancy' : 'stock-unknown'}`}><i />{balance.quantityOnHandUnits === 0 ? 'Out of stock' : 'Replenishment needed'}</span> : <span className="stock-status stock-balanced"><i />Available</span>}<small>Demo reorder point: {REORDER_THRESHOLD_UNITS} units</small></td>
                      <td><strong>{formatNumber(sales.reduce((total, sale) => total + sale.soldQuantityUnits, 0))} units</strong><small>{formatCurrency(sales.reduce((total, sale) => total + sale.soldQuantityUnits * sale.retailPricePerUnitINR, 0))} shelf value</small></td>
                      <td><div className="inventory-row-actions"><button className="subtle-button" onClick={() => setSelectedBalanceId(balance.id)} type="button">Details</button>{canMutate && <button className="subtle-button transfer-button" disabled={balance.quantityOnHandUnits <= 0 || !product?.stateBrand} onClick={() => { setSaleBalanceId(balance.id); setError('') }} type="button">Record sale</button>}</div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <OperationsEmpty message="No participating store stock matches the selected district, commodity and search filters." />}
        <p className="operations-footnote">Retail stock is tracked in pack units by product batch and store. Replenishment threshold is an illustrative demo rule, not a procurement policy.</p>
      </section>

      <section className="operations-split">
        <article className="operations-panel">
          <PanelTitle eyebrow="DISTRICT SALES PERFORMANCE" title="Recorded sales by district" meta="Selected date range · synthetic transactions" />
          {districtSales.length > 0 ? <div className="district-sales-list">{districtSales.map(({ district, stores, units, value }) => (
            <div className="district-sales-row" key={district.id}><span className="district-pin" /><strong>{district.name}</strong><span>{formatNumber(stores)} stores</span><span>{formatNumber(units)} units</span><b>{formatCurrency(value)}</b></div>
          ))}</div> : <OperationsEmpty message="No sales are recorded for the current filter scope." />}
        </article>
        <article className="operations-panel farmer-share-panel">
          <PanelTitle eyebrow="FARMER SHARE · PROPOSAL TARGET" title="Attributed farmer payment vs shelf value" meta="Illustrative linked records only" />
          <div className="farmer-share-target">
            <span>Simulated actual</span><strong>{farmerShare.status === 'available' ? formatPercent(farmerShare.value) : 'Insufficient data'}</strong><span>Proposed target</span><b>≥55%</b>
          </div>
          <p>Attribution is calculated only where the sold product links to a processing batch, matching-commodity source lots and recorded paid farmer payments. Paid amount is allocated across recorded batch output by kilogram, then to sold pack quantity. This demo assumes homogeneous output and does not allocate processing costs, packaging, transport, taxes or overhead. Only sold units contribute; unsold inventory is excluded. It is not a guaranteed farmer return or a complete accounting measure.</p>
        </article>
      </section>

      <section className="operations-panel">
        <PanelTitle eyebrow="RECENT RETAIL TRANSACTIONS" title="Sales history" meta={`${scopedSales.length} transactions`} />
        <div className="operations-panel-actions">
          <button className="subtle-button" onClick={() => downloadCsv('retail-sales-demo.csv', [
            ['Transaction', 'Store', 'Product', 'Batch ID', 'Quantity units', 'Retail price per unit INR', 'Shelf value INR', 'Farmer payment attributed INR', 'Sold at'],
            ...scopedSales.map((sale) => [
              sale.reference,
              data.retailStores.find((item) => item.id === sale.retailStoreId)?.name ?? 'Unknown store',
              data.products.find((item) => item.id === sale.productId)?.name ?? 'Unknown product',
              sale.processingBatchId,
              sale.soldQuantityUnits,
              sale.retailPricePerUnitINR,
              sale.soldQuantityUnits * sale.retailPricePerUnitINR,
              sale.farmerPaymentAllocatedINR ?? 'Insufficient data',
              sale.soldAt,
            ]),
          ])} type="button">Export filtered sales CSV</button>
        </div>
        {scopedSales.length > 0 ? <div className="operations-table-wrap"><table className="operations-table retail-sales-table"><thead><tr><th>Transaction</th><th>Store</th><th>Product / batch</th><th>Quantity</th><th>Shelf value</th><th>Farmer payment attributed</th><th>Recorded at</th></tr></thead><tbody>
          {scopedSales.slice().sort((left, right) => Date.parse(right.soldAt) - Date.parse(left.soldAt)).slice(0, 10).map((sale) => {
            const store = data.retailStores.find((item) => item.id === sale.retailStoreId)
            const product = data.products.find((item) => item.id === sale.productId)
            return <tr key={sale.id}><td><strong>{sale.reference}</strong><small>{sale.id}</small></td><td>{store?.name ?? 'Unknown store'}</td><td><strong>{product?.name ?? 'Unknown product'}</strong><small>{sale.processingBatchId}</small></td><td>{formatNumber(sale.soldQuantityUnits)} units</td><td>{formatCurrency(sale.soldQuantityUnits * sale.retailPricePerUnitINR)}</td><td>{sale.farmerPaymentAllocatedINR === null ? 'Insufficient data' : formatCurrency(sale.farmerPaymentAllocatedINR)}</td><td>{formatDemoTimestamp(sale.soldAt)}</td></tr>
          })}
        </tbody></table></div> : <OperationsEmpty message="No sales transactions match the current date and search filters." />}
      </section>

      {selectedBalance && (
        <div className="operations-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBalanceId(null) }}>
          <section aria-labelledby="retail-detail-title" aria-modal="true" className="operations-drawer" role="dialog">
            <div className="drawer-heading"><div><p className="eyebrow">RETAIL DETAIL · DEMO STOCK</p><h2 id="retail-detail-title">{saleRowProducts(selectedBalance).product?.name ?? 'Product unavailable'}</h2><p>{data.retailStores.find((store) => store.id === selectedBalance.retailStoreId)?.name}</p></div><button aria-label="Close retail details" className="icon-button" onClick={() => setSelectedBalanceId(null)} type="button"><X size={18} /></button></div>
            <div className="inventory-detail-grid"><span>Store code<strong>{data.retailStores.find((store) => store.id === selectedBalance.retailStoreId)?.storeCode ?? 'Unavailable'}</strong></span><span>District<strong>{districtNames.get(data.retailStores.find((store) => store.id === selectedBalance.retailStoreId)?.districtId ?? '') ?? 'Unavailable'}</strong></span><span>Product batch<strong>{selectedBalance.processingBatchId}</strong></span><span>On hand<strong>{formatNumber(selectedBalance.quantityOnHandUnits)} units</strong></span><span>Retail price<strong>{formatCurrency(saleRowProducts(selectedBalance).product?.retailPricePerUnitINR ?? 0)} / unit</strong></span><span>Batch output<strong>{saleRowProducts(selectedBalance).batch ? `${formatNumber(saleRowProducts(selectedBalance).batch?.outputQuantityKg ?? 0)} kg` : 'Unavailable'}</strong></span></div>
            <div className="drawer-content"><h3>Sales for this store, product and batch</h3>{salesForBalance(selectedBalance).length ? salesForBalance(selectedBalance).map((sale) => <div className="movement-row" key={sale.id}><span className="movement-icon"><ShoppingBasket size={13} /></span><span><strong>{sale.reference}</strong><small>{formatNumber(sale.soldQuantityUnits)} units · {sale.processingBatchId}</small></span><b>{formatCurrency(sale.soldQuantityUnits * sale.retailPricePerUnitINR)}</b><time>{formatDemoTimestamp(sale.soldAt)}</time></div>) : <OperationsEmpty message="No sale history is recorded for this store/product/batch." />}
              <div className="trace-related-links"><span>Batch traceability</span><Link to={`/batch-traceability?search=${encodeURIComponent(selectedBalance.processingBatchId)}`}>Open {selectedBalance.processingBatchId}</Link></div>
            </div>
          </section>
        </div>
      )}

      {canMutate && saleBalance && (
        <div className="operations-overlay transfer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSale() }}>
          <section aria-labelledby="sale-confirm-title" aria-modal="true" className="transfer-dialog" role="dialog">
            <div className="drawer-heading"><div><p className="eyebrow">CONFIRM RETAIL SALE · SIMULATED</p><h2 id="sale-confirm-title">Record product sale</h2><p>{data.retailStores.find((store) => store.id === saleBalance.retailStoreId)?.name} · {saleBalance.processingBatchId}</p></div><button aria-label="Close sale dialog" className="icon-button" onClick={closeSale} type="button"><X size={18} /></button></div>
            <div className="transfer-available"><span>Available store stock</span><strong>{formatNumber(saleBalance.quantityOnHandUnits)} units</strong></div>
            <label className="operations-field">Quantity to sell<input aria-label="Quantity to sell" inputMode="numeric" min="1" max={saleBalance.quantityOnHandUnits} onChange={(event) => setQuantity(event.target.value)} placeholder="Enter whole units" step="1" type="number" value={quantity} /></label>
            {quantity && Number(quantity) > 0 && <div className="sale-confirm-summary"><span>Shelf value<strong>{formatCurrency(Number(quantity) * (saleRowProducts(saleBalance).product?.retailPricePerUnitINR ?? 0))}</strong></span><span>Remaining stock<strong>{formatNumber(Math.max(0, saleBalance.quantityOnHandUnits - Number(quantity)))} units</strong></span></div>}
            <label className="operations-field sale-note-field">Sale note<textarea maxLength={240} onChange={(event) => setSaleNote(event.target.value)} placeholder="Optional synthetic transaction note" rows={2} value={saleNote} /></label>
            <p className="transfer-rule-note"><ShoppingBasket size={15} />Confirming reduces this store/batch balance, records sales, creates a retail-sale traceability event and an audit entry.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="transfer-actions"><button className="subtle-button" onClick={closeSale} type="button">Cancel</button><button className="primary-button" disabled={!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0} onClick={confirmSale} type="button">Confirm sale</button></div>
          </section>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, detail, warning = false }: { icon: LucideIcon; label: string; value: string; detail: string; warning?: boolean }) {
  return <article className={`operations-metric-card${warning ? ' is-warning' : ''}`}><span className="operations-metric-icon"><Icon size={16} /></span><span className="operations-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function PanelTitle({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) {
  return <div className="operations-panel-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>
}

function OperationsEmpty({ message }: { message: string }) {
  return <div className="operations-empty"><CircleAlert size={18} /><p>{message}</p></div>
}

export default DirectRetailSales
