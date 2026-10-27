import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  Boxes,
  Check,
  CircleAlert,
  ClipboardCheck,
  Package,
  Warehouse,
  type LucideIcon,
  X,
} from 'lucide-react'
import { calculateInventoryAgeing, calculateWarehouseUtilisation, reconcileInventory } from '../lib/calculations'
import { COMMODITIES, type DashboardFilters } from '../lib/executiveDashboard'
import type { DemoDataset, InventoryBalance } from '../data/models'
import { formatDemoTimestamp, formatNumber } from '../lib/formatters'
import { downloadCsv } from '../lib/csv'
import { transferInventory, type StockTransferResult } from '../services/mockDataService'

const REFERENCE_TIME = new Date('2026-10-27T09:00:00+05:30')
const AGEING_THRESHOLD_DAYS = 30

function usableQuantity(balance: InventoryBalance): number | null {
  const result = reconcileInventory(balance)
  return result.status === 'available' ? result.value.usableQuantityKg : null
}

function StorageInventory({
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
  const [selectedBalanceId, setSelectedBalanceId] = useState<string | null>(null)
  const [transferBalanceId, setTransferBalanceId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('')
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')

  const districts = new Map(data.districts.map((district) => [district.id, district.name]))
  const warehouses = useMemo(
    () => data.warehouses.filter((warehouse) => filters.districtId === 'all' || warehouse.districtId === filters.districtId),
    [data.warehouses, filters.districtId],
  )
  const balances = useMemo(
    () => data.inventoryBalances.filter((balance) => {
      const warehouse = data.warehouses.find((item) => item.id === balance.warehouseId)
      return Boolean(
        warehouse &&
        (filters.districtId === 'all' || warehouse.districtId === filters.districtId) &&
        (filters.commodityId === 'all' || balance.commodityId === filters.commodityId),
      )
    }),
    [data.inventoryBalances, data.warehouses, filters.commodityId, filters.districtId],
  )
  const totalOnHand = balances.reduce((total, balance) => total + balance.quantityOnHandKg, 0)
  const reserved = balances.reduce((total, balance) => total + balance.reservedQuantityKg, 0)
  const damaged = balances.reduce((total, balance) => total + balance.damagedQuantityKg, 0)
  const usable = balances.reduce((total, balance) => {
    const result = reconcileInventory(balance)
    return total + (result.status === 'available' ? result.value.usableQuantityKg : 0)
  }, 0)
  const ageing = calculateInventoryAgeing(balances, REFERENCE_TIME, AGEING_THRESHOLD_DAYS)
  const selectedBalance = balances.find((balance) => balance.id === selectedBalanceId) ?? null
  const transferBalance = data.inventoryBalances.find((balance) => balance.id === transferBalanceId) ?? null

  const commoditySummary = COMMODITIES.map((commodity) => ({
    ...commodity,
    quantityKg: balances.filter((balance) => balance.commodityId === commodity.id).reduce((total, balance) => total + balance.quantityOnHandKg, 0),
    usableKg: balances.filter((balance) => balance.commodityId === commodity.id).reduce((total, balance) => {
      const result = reconcileInventory(balance)
      return total + (result.status === 'available' ? result.value.usableQuantityKg : 0)
    }, 0),
  })).filter((commodity) => commodity.quantityKg > 0)

  const getBalanceProduct = (balance: InventoryBalance) => {
    const batch = data.processingBatches.find((item) => item.id === balance.processingBatchId)
    return batch ? data.products.find((product) => product.id === batch.productId) : undefined
  }
  const getDiscrepancy = (balance: InventoryBalance) => {
    const result = reconcileInventory(balance)
    return result.status === 'available' ? result.value.physicalVarianceKg : null
  }
  const warehouseMovementHistory = (balance: InventoryBalance) =>
    data.stockMovements
      .filter((movement) => movement.processingBatchId === balance.processingBatchId && (
        movement.sourceWarehouseId === balance.warehouseId ||
        movement.destinationWarehouseId === balance.warehouseId
      ))
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))

  function closeTransfer() {
    setTransferBalanceId(null)
    setQuantity('')
    setDestinationWarehouseId('')
    setTransferNote('')
    setFormError('')
  }

  function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!transferBalance) {
      setFormError('The selected inventory balance is no longer available.')
      return
    }

    try {
      const result: StockTransferResult = transferInventory(data, {
        balanceId: transferBalance.id,
        destinationWarehouseId,
        quantityKg: Number(quantity),
        note: transferNote,
        demoUserId,
      })
      onDataChange(result.dataset)
      setToast(`${formatNumber(Number(quantity))} kg transferred · ${result.movementId}`)
      closeTransfer()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The simulated stock transfer failed.')
    }
  }

  return (
    <div className="operations-page">
      <section className="operations-intro inventory-intro">
        <div>
          <p className="eyebrow">WAREHOUSE STOCK · POINT-IN-TIME SNAPSHOT</p>
          <h2>Know what is on hand, usable, reserved, damaged and in transit between stores.</h2>
          <p>Stock balances are physical inventory snapshots; they are not cumulative procurement or processing throughput.</p>
        </div>
        <span className="operations-intro-icon"><Warehouse size={22} /></span>
      </section>

      {toast && (
        <div className="operations-toast" role="status">
          <Check size={16} /><span>{toast}</span><button aria-label="Dismiss transfer confirmation" onClick={() => setToast('')} type="button"><X size={14} /></button>
        </div>
      )}

      <section className="operations-metric-grid inventory-metric-grid" aria-label="Inventory summary">
        <SummaryCard icon={Boxes} label="Total stock on hand" value={`${(totalOnHand / 1000).toFixed(2)} MT`} detail={`${formatNumber(balances.length)} batch balances`} />
        <SummaryCard icon={Package} label="Usable stock" value={`${(usable / 1000).toFixed(2)} MT`} detail="On hand less reserved and damaged" />
        <SummaryCard icon={ClipboardCheck} label="Reserved stock" value={`${(reserved / 1000).toFixed(2)} MT`} detail="Allocated, not available to transfer" />
        <SummaryCard icon={CircleAlert} label="Damaged stock" value={`${(damaged / 1000).toFixed(2)} MT`} detail="Not included in usable stock" />
      </section>

      <section className="operations-panel">
        <PanelTitle eyebrow="WAREHOUSE REGISTER" title="Warehouse stock and capacity" meta="Physical stock snapshot · synthetic" />
        <div className="operations-panel-actions">
          <button className="subtle-button" onClick={() => downloadCsv('warehouse-inventory-demo.csv', [
            ['Warehouse ID', 'Warehouse', 'District', 'Commodity', 'Batch ID', 'On hand kg', 'Reserved kg', 'Damaged kg', 'Usable kg', 'Last update', 'Variance kg'],
            ...balances.flatMap((balance) => {
              const warehouse = data.warehouses.find((item) => item.id === balance.warehouseId)
              if (!warehouse) return []
              const reconciliation = reconcileInventory(balance)
              return [[
                warehouse.id,
                warehouse.name,
                districts.get(warehouse.districtId) ?? warehouse.location,
                balance.commodityId,
                balance.processingBatchId,
                balance.quantityOnHandKg,
                balance.reservedQuantityKg,
                balance.damagedQuantityKg,
                reconciliation.status === 'available' ? reconciliation.value.usableQuantityKg : 'Insufficient data',
                balance.lastUpdatedAt ?? 'Not recorded',
                reconciliation.status === 'available' ? reconciliation.value.physicalVarianceKg ?? 'Insufficient data' : 'Insufficient data',
              ]]
            }),
          ])} type="button">Export filtered CSV</button>
        </div>
        {warehouses.length > 0 ? (
          <div className="operations-table-wrap">
            <table className="operations-table inventory-table">
              <thead>
                <tr>
                  <th scope="col">Warehouse / district</th>
                  <th scope="col">Commodity / batch</th>
                  <th scope="col">Capacity / utilised</th>
                  <th scope="col">On hand</th>
                  <th scope="col">Usable / reserved / damaged</th>
                  <th scope="col">Last update</th>
                  <th scope="col">Discrepancy</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.flatMap((warehouse) => {
                  const warehouseBalances = balances.filter((balance) => balance.warehouseId === warehouse.id)
                  const utilisation = calculateWarehouseUtilisation(warehouse, warehouseBalances)
                  if (warehouseBalances.length === 0) {
                    return [
                      <tr key={`${warehouse.id}-empty`}>
                        <td><strong>{warehouse.name}</strong><small>{warehouse.id} · {districts.get(warehouse.districtId)} · {warehouse.location}</small></td>
                        <td>No stock balance in selected commodity scope</td>
                        <td><strong>{formatNumber(warehouse.capacityKg)} kg</strong><small>{utilisation.status === 'available' ? `${utilisation.value.toFixed(1)}% utilised · 0 kg in scope` : 'Capacity unavailable'}</small></td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td><span className="stock-status stock-unknown">No count</span></td>
                        <td>—</td>
                      </tr>,
                    ]
                  }
                  return warehouseBalances.map((balance) => {
                    const reconciliation = reconcileInventory(balance)
                    const discrepancy = getDiscrepancy(balance)
                    const product = getBalanceProduct(balance)
                    return (
                      <tr key={balance.id}>
                        <td><strong>{warehouse.name}</strong><small>{warehouse.id} · {districts.get(warehouse.districtId)} · {warehouse.location}</small></td>
                        <td><strong>{product?.name ?? COMMODITIES.find((item) => item.id === balance.commodityId)?.label ?? balance.commodityId}</strong><small>{COMMODITIES.find((item) => item.id === balance.commodityId)?.label} · {balance.processingBatchId}</small></td>
                        <td><strong>{formatNumber(warehouse.capacityKg)} kg</strong><small>{utilisation.status === 'available' ? `${utilisation.value.toFixed(1)}% utilised · ${formatNumber(warehouseBalances.reduce((total, entry) => total + entry.quantityOnHandKg, 0))} kg` : 'Capacity unavailable'}</small></td>
                        <td><strong>{formatNumber(balance.quantityOnHandKg)} kg</strong></td>
                        <td>{reconciliation.status === 'available' ? `${formatNumber(reconciliation.value.usableQuantityKg)} / ${formatNumber(balance.reservedQuantityKg)} / ${formatNumber(balance.damagedQuantityKg)} kg` : 'Insufficient data'}</td>
                        <td>{formatDemoTimestamp(balance.lastUpdatedAt)}</td>
                        <td>{discrepancy === null ? <span className="stock-status stock-unknown">Not counted</span> : Math.abs(discrepancy) > 0 ? <span className="stock-status stock-discrepancy"><i />{discrepancy > 0 ? '+' : ''}{formatNumber(discrepancy)} kg</span> : <span className="stock-status stock-balanced"><i />Balanced</span>}</td>
                        <td><div className="inventory-row-actions"><button className="subtle-button" onClick={() => setSelectedBalanceId(balance.id)} type="button">Details</button>{canMutate && <button className="subtle-button transfer-button" disabled={reconciliation.status !== 'available' || reconciliation.value.usableQuantityKg <= 0} onClick={() => { setTransferBalanceId(balance.id); setDestinationWarehouseId(data.warehouses.find((candidate) => candidate.id !== warehouse.id)?.id ?? '') }} type="button">Transfer</button>}</div></td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
        ) : <OperationsEmpty message="No warehouse matches the selected district and commodity filters." />}
        <p className="operations-footnote">Capacity utilisation is based on on-hand stock, not throughput. A physical count is compared with the ledger snapshot; “Not counted” means no physical count is available.</p>
      </section>

      <section className="operations-split inventory-split">
        <article className="operations-panel">
          <PanelTitle eyebrow="STOCK COMPOSITION" title="Commodity and district balances" meta="On-hand / usable · kg" />
          {commoditySummary.length > 0 ? (
            <div className="commodity-stock-list">
              {commoditySummary.map((commodity) => (
                <div className="commodity-stock-row" key={commodity.id}>
                  <span className={`commodity-stock-mark commodity-${commodity.id}`} />
                  <strong>{commodity.label}</strong>
                  <span>On hand <b>{formatNumber(commodity.quantityKg)} kg</b></span>
                  <span>Usable <b>{formatNumber(commodity.usableKg)} kg</b></span>
                </div>
              ))}
            </div>
          ) : <OperationsEmpty message="No commodity stock matches the current filters." />}
          <div className="district-stock-summary">
            {warehouses.reduce<Array<{ districtId: string; name: string; onHand: number; usable: number }>>((result, warehouse) => {
              const district = result.find((item) => item.districtId === warehouse.districtId)
              const warehouseBalances = balances.filter((balance) => balance.warehouseId === warehouse.id)
              const onHand = warehouseBalances.reduce((total, balance) => total + balance.quantityOnHandKg, 0)
              const usableKg = warehouseBalances.reduce((total, balance) => {
                const reconciliation = reconcileInventory(balance)
                return total + (reconciliation.status === 'available' ? reconciliation.value.usableQuantityKg : 0)
              }, 0)
              if (district) {
                district.onHand += onHand
                district.usable += usableKg
              } else {
                result.push({ districtId: warehouse.districtId, name: districts.get(warehouse.districtId) ?? warehouse.location, onHand, usable: usableKg })
              }
              return result
            }, []).map((district) => (
              <div className="district-stock-row" key={district.districtId}><span className="district-pin" /><strong>{district.name}</strong><span>{formatNumber(district.onHand)} kg on hand</span><small>{formatNumber(district.usable)} kg usable</small></div>
            ))}
          </div>
        </article>

        <article className="operations-panel">
          <PanelTitle eyebrow="STOCK AGEING" title="Age profile of usable stock" meta={`${AGEING_THRESHOLD_DAYS}+ days`} />
          {ageing.status === 'available' ? (
            <div className="ageing-summary">
              <div><strong>{(ageing.value.agedQuantityKg / 1000).toFixed(2)} MT</strong><span>Usable stock received {AGEING_THRESHOLD_DAYS}+ days ago</span></div>
              <div><strong>{(ageing.value.unknownAgeQuantityKg / 1000).toFixed(2)} MT</strong><span>Usable stock with unknown receipt age</span></div>
              <p>Age is derived from the recorded warehouse receipt timestamp and fixed demo reference date. It is not inferred from last-update time.</p>
            </div>
          ) : <OperationsEmpty message={ageing.reason} />}
          <div className="movement-history">
            <div className="movement-history-heading"><h3>Recent stock movements</h3><span>{formatNumber(data.stockMovements.filter((movement) => balances.some((balance) => balance.processingBatchId === movement.processingBatchId)).length)} records</span></div>
            {data.stockMovements
              .filter((movement) => balances.some((balance) => balance.processingBatchId === movement.processingBatchId))
              .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
              .slice(0, 5)
              .map((movement) => (
                <div className="movement-row" key={movement.id}>
                  <span className={`movement-icon movement-${movement.movementType}`}><ArrowLeftRight size={13} /></span>
                  <span><strong>{movement.movementType.replace('-', ' ')}</strong><small>{movement.reference} · {movement.sourceWarehouseId ?? 'Origin'} → {movement.destinationWarehouseId ?? 'Dispatch'}</small></span>
                  <b>{formatNumber(movement.quantityKg)} kg</b>
                  <time>{formatDemoTimestamp(movement.occurredAt)}</time>
                </div>
              ))}
          </div>
        </article>
      </section>

      {selectedBalance && (
        <div className="operations-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBalanceId(null) }}>
          <section aria-labelledby="inventory-detail-title" aria-modal="true" className="operations-drawer" role="dialog">
            <div className="drawer-heading">
              <div><p className="eyebrow">INVENTORY DETAIL · DEMO BALANCE</p><h2 id="inventory-detail-title">{getBalanceProduct(selectedBalance)?.name ?? selectedBalance.commodityId}</h2><p>{data.warehouses.find((warehouse) => warehouse.id === selectedBalance.warehouseId)?.name}</p></div>
              <button aria-label="Close inventory details" className="icon-button" onClick={() => setSelectedBalanceId(null)} type="button"><X size={18} /></button>
            </div>
            <div className="inventory-detail-grid">
              <span>Batch<strong>{selectedBalance.processingBatchId}</strong></span>
              <span>On hand<strong>{formatNumber(selectedBalance.quantityOnHandKg)} kg</strong></span>
              <span>Usable<strong>{formatNumber(usableQuantity(selectedBalance) ?? 0)} kg</strong></span>
              <span>Reserved / damaged<strong>{formatNumber(selectedBalance.reservedQuantityKg)} / {formatNumber(selectedBalance.damagedQuantityKg)} kg</strong></span>
              <span>Received<strong>{selectedBalance.receivedAt ? formatDemoTimestamp(selectedBalance.receivedAt) : 'Age unavailable'}</strong></span>
              <span>Last updated<strong>{formatDemoTimestamp(selectedBalance.lastUpdatedAt)}</strong></span>
            </div>
            <div className="drawer-content">
              <h3>Stock movement history</h3>
              {warehouseMovementHistory(selectedBalance).length ? warehouseMovementHistory(selectedBalance).map((movement) => (
                <div className="movement-row" key={movement.id}>
                  <span className={`movement-icon movement-${movement.movementType}`}><ArrowLeftRight size={13} /></span>
                  <span><strong>{movement.movementType.replace('-', ' ')}</strong><small>{movement.reference} · {movement.sourceWarehouseId ?? 'Origin'} → {movement.destinationWarehouseId ?? 'Dispatch'}</small></span>
                  <b>{formatNumber(movement.quantityKg)} kg</b>
                  <time>{formatDemoTimestamp(movement.occurredAt)}</time>
                </div>
              )) : <OperationsEmpty message="No stock movements are recorded for this balance." />}
              <div className="trace-related-links"><span>Batch traceability</span><Link to={`/batch-traceability?search=${encodeURIComponent(selectedBalance.processingBatchId)}`}>Open {selectedBalance.processingBatchId}</Link></div>
            </div>
          </section>
        </div>
      )}

      {canMutate && transferBalance && (
        <div className="operations-overlay transfer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTransfer() }}>
          <section aria-labelledby="transfer-title" aria-modal="true" className="transfer-dialog" role="dialog">
            <div className="drawer-heading">
              <div><p className="eyebrow">CONFIRM STOCK TRANSFER · SIMULATED</p><h2 id="transfer-title">Move usable inventory</h2><p>{data.warehouses.find((warehouse) => warehouse.id === transferBalance.warehouseId)?.name} · {transferBalance.processingBatchId}</p></div>
              <button aria-label="Close transfer dialog" className="icon-button" onClick={closeTransfer} type="button"><X size={18} /></button>
            </div>
            <div className="transfer-available">
              <span>Available usable stock</span>
              <strong>{formatNumber(usableQuantity(transferBalance) ?? 0)} kg</strong>
            </div>
            <form onSubmit={submitTransfer}>
              <label className="operations-field">Destination warehouse
                <select onChange={(event) => setDestinationWarehouseId(event.target.value)} required value={destinationWarehouseId}>
                  <option value="">Select destination</option>
                  {data.warehouses.filter((warehouse) => warehouse.id !== transferBalance.warehouseId).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {districts.get(warehouse.districtId)}</option>)}
                </select>
              </label>
              <label className="operations-field">Quantity to transfer
                <span className="quantity-input-wrap"><input inputMode="numeric" min="1" onChange={(event) => setQuantity(event.target.value)} placeholder="Enter whole kg" required step="1" type="number" value={quantity} /><small>kg</small></span>
              </label>
              <label className="operations-field">Reason / note
                <textarea maxLength={240} onChange={(event) => setTransferNote(event.target.value)} placeholder="Optional transfer note" rows={2} value={transferNote} />
              </label>
              <div className="transfer-rule-note"><CircleAlert size={15} /><span>Confirming decreases source stock and adds the same quantity to the destination for this batch. Reserved and damaged stock cannot be transferred.</span></div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="transfer-actions"><button className="subtle-button" onClick={closeTransfer} type="button">Cancel</button><button className="primary-button" type="submit"><Check size={14} />Confirm transfer</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}) {
  return <article className="operations-metric-card"><span className="operations-metric-icon"><Icon size={16} /></span><span className="operations-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function PanelTitle({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) {
  return <div className="operations-panel-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>
}

function OperationsEmpty({ message }: { message: string }) {
  return <div className="operations-empty"><CircleAlert size={18} /><p>{message}</p></div>
}

export default StorageInventory
