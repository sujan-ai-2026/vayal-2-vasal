import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  BadgeIndianRupee,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Factory,
  GitBranch,
  PackageCheck,
  ScanLine,
  Sprout,
  Truck,
  Warehouse,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'
import type { DemoDataset } from '../data/models'
import {
  COMMODITIES,
  DEMO_OPERATIONAL_THRESHOLDS,
  buildExecutiveDashboard,
  type DashboardFilters,
  type ExecutiveAlert,
} from '../lib/executiveDashboard'
import type { CalculationResult } from '../lib/calculations'
import { formatCurrency, formatDemoTimestamp, formatNumber } from '../lib/formatters'

const chartTooltipStyle = {
  border: '1px solid #e4e8df',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgb(34 49 36 / 10%)',
  fontSize: 11,
}

const paymentColors: Record<string, string> = {
  Paid: '#64845a',
  Pending: '#d4ad57',
  Failed: '#b66b52',
}

const severityCopy: Record<ExecutiveAlert['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const alertIcons: Record<ExecutiveAlert['category'], LucideIcon> = {
  payment: BadgeIndianRupee,
  grading: Wheat,
  inventory: Warehouse,
  freight: Truck,
  traceability: ScanLine,
  processing: Factory,
  retail: PackageCheck,
}

function metricText<T>(
  result: CalculationResult<T>,
  render: (value: T) => string,
): string {
  return result.status === 'available' ? render(result.value) : 'Insufficient data'
}

function KpiCard({
  href,
  icon: Icon,
  label,
  value,
  detail,
  definition,
  className = '',
}: {
  href: string
  icon: LucideIcon
  label: string
  value: string
  detail: string
  definition: string
  className?: string
}) {
  return (
    <Link
      className={`executive-kpi ${className}`}
      title={definition}
      to={href}
      aria-label={`${label}: ${value}. ${definition}`}
    >
      <div className="kpi-topline">
        <span className="kpi-icon"><Icon aria-hidden="true" size={17} /></span>
        <span className="kpi-label">{label}</span>
        <span className="kpi-info" aria-label="Metric definition" title={definition}>i</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-bottomline">
        <span>{detail}</span>
        <ChevronRight aria-hidden="true" size={14} />
      </div>
    </Link>
  )
}

function PanelHeader({
  kicker,
  title,
  meta,
}: {
  kicker: string
  title: string
  meta?: string
}) {
  return (
    <div className="executive-panel-header">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {meta && <span className="executive-panel-meta">{meta}</span>}
    </div>
  )
}

function ExecutiveOverview({
  data,
  filters,
}: {
  data: DemoDataset
  filters: DashboardFilters
}) {
  const model = buildExecutiveDashboard(data, filters)
  const paymentTotal = model.paymentDistribution.reduce((total, entry) => total + entry.count, 0)
  const chartCommodityIds = model.inventoryCommodities.map((commodity) => commodity.id)

  return (
    <div className="executive-overview">
      <section className="executive-intro">
        <div className="executive-intro-copy">
          <span className="executive-intro-kicker"><Sprout size={14} /> FIELD TO FRONT DOOR</span>
          <h2>One view of the proposed agricultural supply chain.</h2>
          <p>
            Synthetic pilot records connect sourcing, processing, storage, freight and direct
            retail. Figures below are simulated demo data, not government performance.
          </p>
        </div>
        <div className="executive-context">
          <div className="executive-context-line">
            <span className="context-symbol"><Boxes size={17} /></span>
            <span><strong>Shared demo ledger</strong><small>Fixed reference · {model.dateRangeLabel}</small></span>
          </div>
          <div className="executive-context-line">
            <span className="context-symbol context-clock"><Clock3 size={16} /></span>
            <span><strong>Last updated</strong><small>{formatDemoTimestamp(model.latestUpdatedAt)} IST</small></span>
          </div>
        </div>
      </section>

      <section className="executive-kpi-grid" aria-label="Executive key performance indicators">
        <KpiCard
          href="/farm-sourcing"
          icon={Sprout}
          label="Contracted farmers"
          value={formatNumber(model.contractedFarmers)}
          detail="Active contracts in scope"
          definition="Distinct farmers with active buy-back contracts for the selected district and commodity scope. This is a current contract snapshot; date range does not remove existing contracts."
        />
        <KpiCard
          href="/farm-sourcing"
          icon={Wheat}
          label="Procurement accepted"
          value={metricText(model.acceptedKg, (kg) => `${(kg / 1000).toFixed(2)} MT`)}
          detail="Accepted quantity in selected period"
          definition="Sum of accepted lot quantities in the selected district, commodity and date range. Received and rejected quantities are excluded."
        />
        <KpiCard
          href="/farm-sourcing"
          icon={BadgeIndianRupee}
          label="Procurement value"
          value={metricText(model.procurementValueINR, formatCurrency)}
          detail="Accepted kg × contracted price/kg"
          definition="Accepted procurement quantity multiplied by the lot's contracted price per kg, scoped to the selected date range."
        />
        <KpiCard
          href="/farmer-payments"
          icon={CheckCircle2}
          label="Paid within 72 hours"
          value={metricText(model.paymentCompliance, (value) => `${value.toFixed(1)}%`)}
          detail="Completed payments with valid timestamps"
          definition="Among completed payments with valid acceptance and paid timestamps, percentage paid no later than 72 hours after acceptance. Pending and failed payments are not in the denominator."
        />
        <KpiCard
          href="/farmer-payments"
          icon={CircleAlert}
          label="Pending farmer payments"
          value={formatCurrency(model.pendingPaymentsINR)}
          detail={`${formatNumber(model.pendingPaymentsCount)} pending or failed obligations`}
          definition="Total payable amount for unpaid pending and failed payment records in the selected district, commodity and date range."
          className="kpi-warning"
        />
        <KpiCard
          href="/storage-inventory"
          icon={Warehouse}
          label="Usable inventory"
          value={metricText(model.usableInventoryKg, (kg) => `${(kg / 1000).toFixed(2)} MT`)}
          detail="On hand less reserved and damaged"
          definition="Current warehouse balance after subtracting reserved and damaged quantity. This is a point-in-time stock snapshot, not period throughput."
        />
        <KpiCard
          href="/reports-audit"
          icon={ArrowDownRight}
          label="Recorded supply-chain loss"
          value={metricText(model.recordedLossPercent, (value) => `${value.toFixed(2)}%`)}
          detail="Stage-weighted recorded loss ratio"
          definition="Recorded rejected, processing and freight loss quantities divided by their corresponding stage inputs. This is a stage-weighted demo ratio, not a single end-to-end batch loss."
          className="kpi-neutral"
        />
        <KpiCard
          href="/batch-traceability"
          icon={GitBranch}
          label="QR-traceable batches"
          value={metricText(model.qrCoverage, (value) => `${value.toFixed(1)}%`)}
          detail="Complete verified demo chain"
          definition="Share of in-scope state-brand product batches with verified demo events at all required traceability stages. Missing scans are not counted as verified."
        />
      </section>

      <div className="executive-comparison-note">
        <span>No comparison data</span>
        <p>Comparable prior-period demo records are unavailable; no growth figures are inferred.</p>
      </div>

      <section className="executive-chart-grid">
        <article className="executive-panel procurement-chart-panel">
          <PanelHeader
            kicker="FARM SOURCING"
            title="Accepted procurement trend"
            meta={filters.dateRange === '7d' ? 'Daily · kg' : 'By acceptance date · kg'}
          />
          {model.procurementTrend.length > 0 ? (
            <div className="executive-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={model.procurementTrend} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="#edf0e9" strokeDasharray="3 4" vertical={false} />
                  <XAxis axisLine={false} dataKey="label" tick={{ fill: '#858c80', fontSize: 10 }} tickLine={false} />
                  <YAxis axisLine={false} tick={{ fill: '#858c80', fontSize: 9 }} tickFormatter={(value: number) => `${value / 1000}k`} tickLine={false} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => [`${formatNumber(Number(value))} kg`, 'Accepted']}
                    labelFormatter={(_label, entries) => entries[0]?.payload?.date ?? ''}
                  />
                  <Line
                    activeDot={{ r: 4, fill: '#315b42', stroke: '#fff', strokeWidth: 2 }}
                    dataKey="acceptedKg"
                    dot={{ r: 3, fill: '#66895a', stroke: '#fff', strokeWidth: 2 }}
                    stroke="#66895a"
                    strokeWidth={2.5}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <ChartEmpty message="No accepted lots in this date range and filter scope." />}
          <p className="chart-footnote">Source: synthetic procurement lots · quantities shown as accepted kg.</p>
        </article>

        <article className="executive-panel commodity-chart-panel">
          <PanelHeader kicker="COMMODITY MIX" title="Accepted by commodity" meta="kg" />
          {model.commodityVolumes.length > 0 ? (
            <div className="executive-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.commodityVolumes} layout="vertical" margin={{ top: 3, right: 18, bottom: 0, left: 3 }}>
                  <CartesianGrid stroke="#edf0e9" strokeDasharray="3 4" horizontal={false} />
                  <XAxis axisLine={false} tick={{ fill: '#858c80', fontSize: 9 }} tickFormatter={(value: number) => `${value / 1000}k`} tickLine={false} type="number" />
                  <YAxis axisLine={false} dataKey="label" tick={{ fill: '#687466', fontSize: 10 }} tickLine={false} type="category" width={77} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${formatNumber(Number(value))} kg`, 'Accepted']} />
                  <Bar dataKey="acceptedKg" fill="#6c8c5c" maxBarSize={20} radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <ChartEmpty message="No commodity volume matches this scope." />}
          <p className="chart-footnote">Volume is derived from the same accepted lot records as the KPI.</p>
        </article>
      </section>

      <section className="executive-chart-grid executive-chart-grid-secondary">
        <article className="executive-panel district-panel">
          <PanelHeader kicker="PILOT DISTRICTS" title="Operational comparison" meta="Proposed scope · synthetic actuals" />
          {model.districtPerformance.length > 0 ? (
            <div className="district-table-wrap">
              <table className="district-performance-table">
                <thead>
                  <tr>
                    <th scope="col">District</th>
                    <th scope="col">Farmers</th>
                    <th scope="col">Accepted</th>
                    <th scope="col">Payment SLA</th>
                    <th scope="col">Usable stock</th>
                  </tr>
                </thead>
                <tbody>
                  {model.districtPerformance.map((district) => (
                    <tr key={district.districtId}>
                      <th scope="row">
                        <span>{district.district}</span>
                        <small>{district.pilotStatus === 'proposed' ? 'Proposed district' : 'Configurable option'}</small>
                      </th>
                      <td>{formatNumber(district.farmers)}</td>
                      <td>{formatNumber(district.acceptedKg / 1000)} MT</td>
                      <td>{metricText(district.paymentCompliance, (value) => `${value.toFixed(0)}%`)}</td>
                      <td>{formatNumber(district.usableInventoryKg / 1000)} MT</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <ChartEmpty message="No district records match this filter." />}
          <p className="chart-footnote">
            Thanjavur is proposed for rice; Dharmapuri and Tiruvannamalai are configurable pilot options.
          </p>
        </article>

        <article className="executive-panel payment-chart-panel">
          <PanelHeader kicker="FARMER PAYMENTS" title="Payment status" meta={`${formatNumber(paymentTotal)} records`} />
          {paymentTotal > 0 ? (
            <div className="payment-chart-layout">
              <div className="payment-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={model.paymentDistribution.filter((entry) => entry.count > 0)}
                      dataKey="count"
                      innerRadius="62%"
                      outerRadius="84%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {model.paymentDistribution.filter((entry) => entry.count > 0).map((entry) => (
                        <Cell fill={paymentColors[entry.status]} key={entry.status} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value, _name, item) => [formatNumber(Number(value)), item.payload.status]} />
                  </PieChart>
                </ResponsiveContainer>
                <span className="donut-total"><strong>{formatNumber(paymentTotal)}</strong><small>payments</small></span>
              </div>
              <div className="payment-legend">
                {model.paymentDistribution.map((entry) => (
                  <div className="payment-legend-row" key={entry.status}>
                    <span className="legend-dot" style={{ backgroundColor: paymentColors[entry.status] }} />
                    <span>{entry.status}</span>
                    <strong>{entry.count}</strong>
                    <small>{formatCurrency(entry.amountINR)}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : <ChartEmpty message="No payment records match this scope." />}
          <p className="chart-footnote">Failed transactions are not counted as paid; totals include payable value.</p>
        </article>
      </section>

      <section className="executive-chart-grid">
        <article className="executive-panel inventory-chart-panel">
          <PanelHeader kicker="STORAGE" title="Usable inventory by warehouse" meta="Current snapshot · kg" />
          {model.inventoryByWarehouse.length > 0 && chartCommodityIds.length > 0 ? (
            <>
              <div className="executive-chart inventory-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={model.inventoryByWarehouse} margin={{ top: 8, right: 10, bottom: 2, left: -15 }}>
                    <CartesianGrid stroke="#edf0e9" strokeDasharray="3 4" vertical={false} />
                    <XAxis axisLine={false} dataKey="warehouse" tick={{ fill: '#727b70', fontSize: 9 }} tickLine={false} />
                    <YAxis axisLine={false} tick={{ fill: '#858c80', fontSize: 9 }} tickFormatter={(value: number) => `${value / 1000}k`} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [`${formatNumber(Number(value))} kg`, COMMODITIES.find((commodity) => commodity.id === name)?.label ?? String(name)]} />
                    {chartCommodityIds.map((commodityId, index) => (
                      <Bar
                        dataKey={commodityId}
                        fill={['#64845a', '#9eae76', '#d2ad60', '#84a49a', '#a98062'][index % 5]}
                        key={commodityId}
                        maxBarSize={36}
                        stackId="inventory"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                {model.inventoryCommodities.map((commodity, index) => (
                  <span key={commodity.id}><i style={{ backgroundColor: ['#64845a', '#9eae76', '#d2ad60', '#84a49a', '#a98062'][index % 5] }} />{commodity.label}</span>
                ))}
              </div>
            </>
          ) : <ChartEmpty message="No warehouse inventory matches this scope." />}
          <p className="chart-footnote">Point-in-time on-hand quantity. Reserved and damaged stock are excluded from the usable inventory KPI.</p>
        </article>

        <article className="executive-panel flow-panel">
          <PanelHeader kicker="CONNECTED OPERATIONS" title="Supply-chain flow" meta="Scoped demo records" />
          <div className="supply-flow">
            {model.flow.map((step, index) => {
              const FlowIcon = [Sprout, Factory, Warehouse, PackageCheck][index]
              return (
                <div className="supply-flow-segment" key={step.label}>
                  <Link className="supply-flow-node" to={step.href}>
                    <span className="flow-icon"><FlowIcon aria-hidden="true" size={17} /></span>
                    <span className="flow-stage">{step.label}</span>
                    <strong>{step.value}</strong>
                    <small>{step.detail}</small>
                  </Link>
                  {index < model.flow.length - 1 && <ArrowRight className="flow-arrow" aria-hidden="true" size={15} />}
                </div>
              )
            })}
          </div>
          <p className="chart-footnote">
            Stage quantities have different scopes and are not additive or a single mass-balance claim.
          </p>
        </article>
      </section>

      <section className="executive-bottom-grid">
        <article className="executive-panel targets-panel">
          <PanelHeader kicker="PROPOSAL GOALS" title="Pilot targets vs simulated actuals" meta="Targets are not results" />
          <div className="target-actual-list">
            {model.targets.map((target) => (
              <div className="target-actual-row" key={target.id} title={target.definition}>
                <div className="target-actual-title">
                  <span>{target.label}</span>
                  <span className="target-goal">Goal {target.target}</span>
                </div>
                <div className="target-meter" aria-label={`Progress to target: ${target.progressPercent === null ? 'insufficient data' : `${target.progressPercent.toFixed(0)} percent`}`}>
                  <span
                    className={target.achieved === false ? 'target-meter-fill is-short' : 'target-meter-fill'}
                    style={{ width: `${target.progressPercent ?? 0}%` }}
                  />
                </div>
                <span className={`target-actual-value${target.actual === 'Insufficient data' ? ' is-unavailable' : ''}`}>
                  <strong>{target.actual}</strong>
                  <small>{target.achieved === null ? 'Baseline unavailable' : target.achieved ? 'Target met in demo' : 'Below proposed goal'}</small>
                </span>
              </div>
            ))}
          </div>
          <p className="chart-footnote">Income increase and loss reduction need a comparable baseline; neither is inferred.</p>
        </article>

        <article className="executive-panel activity-panel">
          <PanelHeader kicker="RECENT ACTIVITY" title="Latest demo events" meta="From shared records" />
          {model.activity.length > 0 ? (
            <div className="activity-list">
              {model.activity.map((item) => (
                <Link className="activity-row" key={item.id} to={item.href}>
                  <span className={`activity-marker activity-${item.type}`} />
                  <span className="activity-copy">
                    <strong>{item.label}</strong>
                    <small>{item.entity} · {item.district}</small>
                  </span>
                  <time dateTime={item.occurredAt}>{formatDemoTimestamp(item.occurredAt)}</time>
                </Link>
              ))}
            </div>
          ) : <ChartEmpty message="No activity records in this range." />}
          <Link className="panel-action-link" to="/reports-audit">Open prototype audit log <ChevronRight size={14} /></Link>
        </article>
      </section>

      <section className="executive-panel attention-panel">
        <PanelHeader
          kicker="EXECUTIVE ATTENTION"
          title="Prioritised exceptions"
          meta={`${formatNumber(model.alerts.length)} generated from demo rules`}
        />
        <p className="attention-description">
          Rules use the fixed demo clock. Payment due-soon window: {DEMO_OPERATIONAL_THRESHOLDS.paymentDueSoonHours}h;
          low-yield threshold: {DEMO_OPERATIONAL_THRESHOLDS.processingYieldMinimumPercent}%;
          retail reorder threshold: {DEMO_OPERATIONAL_THRESHOLDS.retailReorderUnits} units.
        </p>
        {model.alerts.length > 0 ? (
          <div className="attention-table-wrap">
            <table className="attention-table">
              <thead>
                <tr>
                  <th scope="col">Priority</th>
                  <th scope="col">Affected entity</th>
                  <th scope="col">District</th>
                  <th scope="col">Age</th>
                  <th scope="col">Reason</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {model.alerts.map((alert) => {
                  const Icon = alertIcons[alert.category]
                  return (
                    <tr key={alert.id}>
                      <td><span className={`severity-pill severity-${alert.severity}`}><i />{severityCopy[alert.severity]}</span></td>
                      <td><span className="alert-entity"><Icon size={14} />{alert.entity}</span></td>
                      <td>{alert.district}</td>
                      <td className="alert-age">{alert.age}</td>
                      <td>{alert.reason}</td>
                      <td><Link className="alert-open-link" to={alert.href}>Open <ChevronRight size={13} /></Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ChartEmpty message="No exceptions match this district, commodity and date scope." />
        )}
      </section>

      <div className="executive-integrity">
        <AlertTriangle size={16} />
        <p>
          <strong>Prototype integrity note.</strong> Vayal-to-Vaasal is a proposed platform, not a
          deployed Government of Tamil Nadu service. All transactions shown are synthetic. Government
          ownership is intended; this screen does not imply endorsement or live integration.
        </p>
      </div>
    </div>
  )
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="chart-empty">
      <span><AlertTriangle size={17} /></span>
      <p>{message}</p>
    </div>
  )
}

export default ExecutiveOverview
