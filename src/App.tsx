import {
  Archive,
  BadgeIndianRupee,
  ChevronDown,
  CircleHelp,
  Factory,
  FileClock,
  LayoutDashboard,
  MapPinned,
  PackageCheck,
  ScanLine,
  Settings2,
  Sprout,
  Truck,
  Warehouse,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { Component, Suspense, lazy, useState, type ErrorInfo, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { DEFAULT_DEMO_SETTINGS, getDemoSettings, resetDemoSettings, saveDemoSettings, type DemoSettings } from './data/demoSettings'
import type { DemoDataset } from './data/models'
import {
  COMMODITIES,
  type DashboardDateRange,
  type DashboardFilters,
  getLatestDemoTimestamp,
} from './lib/executiveDashboard'
import { appendDemoAuditEvent, getDemoData, resetDemoData } from './services/mockDataService'
import { formatDemoTimestamp, formatNumber } from './lib/formatters'
import './App.css'

const ExecutiveOverview = lazy(() => import('./components/ExecutiveOverview'))
const ProcessingHubs = lazy(() => import('./components/ProcessingHubs'))
const StorageInventory = lazy(() => import('./components/StorageInventory'))
const FreightLogistics = lazy(() => import('./components/FreightLogistics'))
const DirectRetailSales = lazy(() => import('./components/DirectRetailSales'))
const BatchTraceability = lazy(() => import('./components/BatchTraceability'))
const DistrictPerformance = lazy(() => import('./components/DistrictPerformance'))
const ReportsAudit = lazy(() => import('./components/ReportsAudit'))
const SettingsDataSources = lazy(() => import('./components/SettingsDataSources'))
const FarmSourcing = lazy(() => import('./components/FarmSourcing'))
const FarmerPayments = lazy(() => import('./components/FarmerPayments'))
const About = lazy(() => import('./components/About'))

type Screen = {
  path: string
  title: string
  description: string
  icon: LucideIcon
  count: (data: DemoDataset) => number
}

type NavigationGroup = {
  label: string
  screens: Screen[]
}

const navigationGroups: NavigationGroup[] = [
  {
    label: 'Command',
    screens: [
      {
        path: '/',
        title: 'Executive Overview',
        description: 'Tamil Nadu Agricultural Supply Chain Command Centre',
        icon: LayoutDashboard,
        count: (data) => data.procurementLots.length,
      },
    ],
  },
  {
    label: 'Operations',
    screens: [
      {
        path: '/farm-sourcing',
        title: 'Farm Sourcing',
        description: 'Contracts, farmer records and procurement lots.',
        icon: Sprout,
        count: (data) => data.procurementLots.length,
      },
      {
        path: '/farmer-payments',
        title: 'Farmer Payments',
        description: 'Payment obligations linked to accepted procurement lots.',
        icon: BadgeIndianRupee,
        count: (data) => data.farmerPayments.length,
      },
      {
        path: '/processing-hubs',
        title: 'Processing Hubs',
        description: 'Simulated facilities and input-to-output batch records.',
        icon: Factory,
        count: (data) => data.processingBatches.length,
      },
      {
        path: '/storage-inventory',
        title: 'Storage & Inventory',
        description: 'Warehouse capacities, stock balances and movements.',
        icon: Warehouse,
        count: (data) => data.inventoryBalances.length,
      },
      {
        path: '/freight-logistics',
        title: 'Freight & Logistics',
        description: 'Dispatches and simulated shipment status records.',
        icon: Truck,
        count: (data) => data.shipments.length,
      },
      {
        path: '/direct-retail-sales',
        title: 'Direct Retail & Sales',
        description: 'Participating stores, product stock and demo sales.',
        icon: PackageCheck,
        count: (data) => data.salesTransactions.length,
      },
      {
        path: '/batch-traceability',
        title: 'Batch Traceability',
        description: 'Chronological events for complete and incomplete demo chains.',
        icon: ScanLine,
        count: (data) => data.traceabilityEvents.length,
      },
    ],
  },
  {
    label: 'Oversight',
    screens: [
      {
        path: '/district-performance',
        title: 'District Performance',
        description: 'Configured pilot-district comparisons, target progress and drill-downs.',
        icon: MapPinned,
        count: (data) => data.districts.length,
      },
      {
        path: '/reports-audit',
        title: 'Reports & Audit Log',
        description: 'Operational reports and a clearly labelled prototype audit trail.',
        icon: FileClock,
        count: (data) => data.auditEvents.length,
      },
      {
        path: '/settings-data-sources',
        title: 'Settings & Data Sources',
        description: 'Demo pilot configuration and proposed, non-live data sources.',
        icon: Settings2,
        count: (data) => data.dataSources.length,
      },
    ],
  },
  {
    label: 'About',
    screens: [
      {
        path: '/about',
        title: 'About Vayal-to-Vaasal',
        description: 'Demo roles, permission boundaries and an interactive supply-chain workflow.',
        icon: CircleHelp,
        count: () => 0,
      },
    ],
  },
]

const screens = navigationGroups.flatMap((group) => group.screens)

type AppErrorBoundaryState = {
  error: Error | null
  resetFailure: string | null
}

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, resetFailure: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, resetFailure: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Vayal-to-Vaasal demo UI error', error, info)
  }

  private resetSavedDemo = () => {
    try {
      window.localStorage.removeItem('vayal-to-vaasal-demo-v1')
      window.localStorage.removeItem('vayal-to-vaasal-settings-v1')
      window.localStorage.removeItem('vayal-to-vaasal-demo-role')
      window.location.reload()
    } catch (error) {
      this.setState({
        resetFailure: error instanceof Error ? error.message : 'Browser storage could not be cleared.',
      })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-error-state" role="alert">
          <p className="eyebrow">DEMO DATA</p>
          <h1>The demo could not load</h1>
          <p>Saved demo data may be invalid or unavailable. Reset the locally stored demo records, settings and role to try again.</p>
          {this.state.resetFailure && <p className="form-error">{this.state.resetFailure}</p>}
          <button className="primary-button" onClick={this.resetSavedDemo} type="button">Reset saved demo and reload</button>
        </main>
      )
    }
    return this.props.children
  }
}

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentScreen = screens.find((screen) => screen.path === location.pathname)
  const [data, setData] = useState<DemoDataset>(() => getDemoData())
  const [settings, setSettings] = useState<DemoSettings>(() => getDemoSettings())
  const [activeDemoUserId, setActiveDemoUserId] = useState(() => {
    const saved = window.localStorage.getItem('vayal-to-vaasal-demo-role')
    return saved ?? 'user-executive'
  })
  const [globalSearch, setGlobalSearch] = useState('')
  const [filters, setFilters] = useState<DashboardFilters>({
    districtId: 'all',
    commodityId: 'all',
    dateRange: 'season',
    paymentSlaHours: settings.paymentSlaHours,
  })
  const activeDemoUser = data.demoUsers.find((user) => user.id === activeDemoUserId) ?? data.demoUsers[0]
  const visibleScreens = screens.filter((screen) => {
    if (activeDemoUser?.role === 'state-executive') return true
    if (activeDemoUser?.role === 'district-officer') return screen.path !== '/settings-data-sources'
    if (activeDemoUser?.role === 'procurement-officer')     return ['/farm-sourcing', '/farmer-payments', '/batch-traceability', '/reports-audit', '/about'].includes(screen.path)
    return ['/processing-hubs', '/storage-inventory', '/freight-logistics', '/batch-traceability', '/reports-audit', '/about'].includes(screen.path)
  })
  const currentAllowed = visibleScreens.some((screen) => screen.path === location.pathname)
  const latestUpdatedAt = getLatestDemoTimestamp(data)

  if (!currentScreen || !currentAllowed) {
    return <Navigate to={visibleScreens[0]?.path ?? '/'} replace />
  }

  const operationalMutationsAllowed =
    activeDemoUser?.role === 'district-officer' || activeDemoUser?.role === 'warehouse-operator'
  const assignedDistrictId = activeDemoUser?.role !== 'state-executive' ? activeDemoUser?.districtId ?? null : null
  const effectiveFilters = {
    ...filters,
    districtId: assignedDistrictId ?? filters.districtId,
    paymentSlaHours: settings.paymentSlaHours,
    pilotTargetValues: settings.targetValues,
  }

  function resolveGlobalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = globalSearch.trim()
    if (!query) return
    const needle = query.toLocaleLowerCase()
    const batch = data.processingBatches.find((item) =>
      [item.id, item.outputReference].some((value) => value.toLocaleLowerCase().includes(needle)),
    )
    const shipment = data.shipments.find((item) =>
      [item.id, item.vehicleReference, item.carrierReference, ...item.processingBatchIds].some((value) => value.toLocaleLowerCase().includes(needle)),
    )
    const payment = data.farmerPayments.find((item) =>
      [item.id, item.paymentReference, item.procurementLotId].some((value) => value?.toLocaleLowerCase().includes(needle)),
    )
    const sale = data.salesTransactions.find((item) =>
      [item.reference, item.processingBatchId, item.retailStoreId].some((value) => value.toLocaleLowerCase().includes(needle)),
    )
    const retailBalance = data.retailInventoryBalances.find((item) =>
      [item.id, item.processingBatchId, item.retailStoreId].some((value) => value.toLocaleLowerCase().includes(needle)),
    )
    const warehouseBalance = data.inventoryBalances.find((item) =>
      [item.id, item.processingBatchId, item.warehouseId].some((value) => value.toLocaleLowerCase().includes(needle)),
    )
    const lot = data.procurementLots.find((item) => {
      const farmer = data.farmers.find((candidate) => candidate.id === item.farmerId)
      const organisation = data.pacsFpos.find((candidate) => candidate.id === item.pacsFpoId)
      return [item.id, item.farmerId, item.cropVariety, farmer?.name, farmer?.farmerCode, organisation?.name]
        .some((value) => value?.toLocaleLowerCase().includes(needle))
    })
    const productBatch = data.processingBatches.find((item) => {
      const product = data.products.find((candidate) => candidate.id === item.productId)
      const facility = data.processingFacilities.find((candidate) => candidate.id === item.facilityId)
      return [product?.name, product?.brandLabel, facility?.name].some((value) => value?.toLocaleLowerCase().includes(needle))
    })
    const resolvedPaymentLot = payment && data.procurementLots.find((item) => item.id === payment.procurementLotId)
    const traceId = batch?.id ??
      shipment?.processingBatchIds[0] ??
      sale?.processingBatchId ??
      retailBalance?.processingBatchId ??
      warehouseBalance?.processingBatchId ??
      productBatch?.id ??
      data.processingBatches.find((item) => item.sourceLotIds.includes(lot?.id ?? resolvedPaymentLot?.id ?? ''))?.id ??
      query
    navigate(`/batch-traceability?search=${encodeURIComponent(traceId)}`)
    setGlobalSearch('')
  }

  function changeDemoRole(userId: string) {
    const nextUser = data.demoUsers.find((user) => user.id === userId)
    if (!nextUser) return
    setActiveDemoUserId(userId)
    window.localStorage.setItem('vayal-to-vaasal-demo-role', userId)
    setFilters((current) => ({ ...current, districtId: nextUser.role === 'state-executive' ? 'all' : nextUser.districtId ?? 'all' }))
    const nextVisible = screens.filter((screen) => {
      if (nextUser.role === 'state-executive') return true
      if (nextUser.role === 'district-officer') return screen.path !== '/settings-data-sources'
      if (nextUser.role === 'procurement-officer') return ['/farm-sourcing', '/farmer-payments', '/batch-traceability', '/reports-audit', '/about'].includes(screen.path)
      return ['/processing-hubs', '/storage-inventory', '/freight-logistics', '/batch-traceability', '/reports-audit', '/about'].includes(screen.path)
    })
    if (!nextVisible.some((screen) => screen.path === location.pathname)) navigate(nextVisible[0]?.path ?? '/')
    setData((current) => appendDemoAuditEvent(current, {
      demoUserId: activeDemoUser?.id ?? 'user-executive',
      action: 'Switched simulated demo role',
      entityType: 'DemoUser',
      entityId: userId,
      previousValue: activeDemoUser?.role ?? null,
      newValue: nextUser.role,
      note: 'Frontend-only permission demonstration; this does not change or represent production authorization.',
    }))
  }

  function resetAllDemoState() {
    if (!window.confirm('Reset demo data, settings and role to the deterministic baseline? This cannot be undone.')) return
    setData(resetDemoData())
    setSettings(resetDemoSettings())
    setActiveDemoUserId('user-executive')
    window.localStorage.removeItem('vayal-to-vaasal-demo-role')
    setFilters({ districtId: 'all', commodityId: 'all', dateRange: 'season', paymentSlaHours: DEFAULT_DEMO_SETTINGS.paymentSlaHours, pilotTargetValues: DEFAULT_DEMO_SETTINGS.targetValues })
    setGlobalSearch('')
    navigate('/')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand-lockup" to="/" aria-label="Vayal-to-Vaasal home">
          <span className="brand-mark" aria-hidden="true">
            <Wheat size={23} strokeWidth={1.8} />
          </span>
          <span className="brand-copy">
            <strong>Vayal-to-Vaasal</strong>
            <span>Supply chain command centre</span>
          </span>
        </NavLink>

        <div className="sidebar-label">PILOT WORKSPACE</div>
        <nav className="primary-navigation" aria-label="Main navigation">
          {navigationGroups.map((group) => group.screens.some((screen) => visibleScreens.some((allowed) => allowed.path === screen.path)) ? (
            <section className="navigation-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.screens.filter((screen) => visibleScreens.some((allowed) => allowed.path === screen.path)).map((screen) => {
                const Icon = screen.icon
                return (
                  <NavLink
                    className={({ isActive }) =>
                      `navigation-link${isActive ? ' is-active' : ''}`
                    }
                    end={screen.path === '/'}
                    key={screen.path}
                    to={screen.path}
                  >
                    <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                    <span>{screen.title}</span>
                  </NavLink>
                )
              })}
            </section>
          ) : null)}
        </nav>

        <div className="sidebar-footer">
          <div className="season-mark">
            <span className="season-dot" />
            <span>One-season pilot concept</span>
          </div>
          <p>Proposed platform · Not deployed</p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-context">
            <span className="demo-badge"><span /> DEMO DATA</span>
            <span className="context-divider" aria-hidden="true" />
            <span className="reference-time">
              Last updated{' '}
              <time dateTime={latestUpdatedAt}>{formatDemoTimestamp(latestUpdatedAt)} IST</time>
            </span>
          </div>

          <div className="topbar-controls" aria-label="Dashboard controls">
            <form className="global-search" onSubmit={resolveGlobalSearch} role="search">
              <label className="sr-only" htmlFor="global-record-search">Global record search</label>
              <input id="global-record-search" aria-label="Global record search" onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search batch, lot, shipment…" value={globalSearch} />
              <button className="subtle-button" type="submit">Search</button>
            </form>
            <label className="scope-control">
              <span className="sr-only">District filter</span>
              <select
                aria-label="District filter"
                disabled={assignedDistrictId !== null}
                onChange={(event) => setFilters((current) => ({ ...current, districtId: event.target.value }))}
                value={assignedDistrictId ?? filters.districtId}
              >
                <option value="all">All Pilot Districts</option>
                {data.districts.filter((district) => settings.districtScopeIds.includes(district.id) && (assignedDistrictId === null || district.id === assignedDistrictId)).map((district) => (
                  <option key={district.id} value={district.id}>{district.name}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={14} />
            </label>
            <label className="scope-control commodity-control">
              <span className="sr-only">Commodity filter</span>
              <select
                aria-label="Commodity filter"
                onChange={(event) => setFilters((current) => ({ ...current, commodityId: event.target.value as DashboardFilters['commodityId'] }))}
                value={filters.commodityId}
              >
                <option value="all">All commodities</option>
                {COMMODITIES.filter((commodity) => settings.commodityIds.includes(commodity.id)).map((commodity) => (
                  <option key={commodity.id} value={commodity.id}>{commodity.label}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={14} />
            </label>
            <label className="scope-control date-range-control">
              <span className="sr-only">Date range</span>
              <select
                aria-label="Date range"
                onChange={(event) => setFilters((current) => ({ ...current, dateRange: event.target.value as DashboardDateRange }))}
                value={filters.dateRange}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="season">Pilot season to date</option>
              </select>
              <ChevronDown aria-hidden="true" size={14} />
            </label>
            <details className="profile-menu">
              <summary aria-label="Demo user profile">
                <span className="avatar">{activeDemoUser?.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2) ?? 'DE'}</span>
                <span className="profile-copy">
                  <strong>{activeDemoUser?.displayName ?? 'Demo User'}</strong>
                  <small>Demo role</small>
                </span>
                <ChevronDown aria-hidden="true" size={15} />
              </summary>
              <div className="profile-popover">
                <label>Switch simulated role
                  <select aria-label="Switch simulated role" onChange={(event) => changeDemoRole(event.target.value)} value={activeDemoUser?.id ?? 'user-executive'}>
                    {data.demoUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.role.replaceAll('-', ' ')}</option>)}
                  </select>
                </label>
                <p>Simulated UI permissions only; this is not production security.</p>
                <p className="role-scope-note">{activeDemoUser?.role === 'state-executive'
                  ? 'Statewide overview, district comparisons, reports and exceptions.'
                  : activeDemoUser?.role === 'district-officer'
                    ? `District-scoped operational views for ${data.districts.find((district) => district.id === activeDemoUser.districtId)?.name ?? 'assigned district'}.`
                    : activeDemoUser?.role === 'procurement-officer'
                      ? `Procurement, grading and payment actions for ${data.districts.find((district) => district.id === activeDemoUser.districtId)?.name ?? 'assigned district'}.`
                      : `Inventory, stock movement and simulated shipment actions for ${data.districts.find((district) => district.id === activeDemoUser?.districtId)?.name ?? 'assigned district'}.`}</p>
                {activeDemoUser?.role === 'state-executive' && <button className="subtle-button reset-demo-button" onClick={resetAllDemoState} type="button">Reset demo data</button>}
              </div>
            </details>
          </div>
        </header>

        <main className="main-content">
          <div className="page-heading">
            <div className="breadcrumb">
              <span>Vayal-to-Vaasal</span>
              <span aria-hidden="true">/</span>
              <strong>{currentScreen.title}</strong>
            </div>
            <div className="heading-row">
              <div>
                <p className="eyebrow">TAMIL NADU · PROPOSED PILOT</p>
                <h1>{currentScreen.title}</h1>
                <p className="page-description">{currentScreen.description}</p>
              </div>
              <div className="page-status">
                <span className="status-dot" />
                <span>{activeDemoUser?.role === 'district-officer' ? 'District-scoped demo view' : 'Simulated permissions'}</span>
              </div>
            </div>
          </div>

          <Routes>
            <Route
              element={
                <Suspense fallback={<div className="overview-loading">Loading demo overview…</div>}>
                  <ExecutiveOverview data={data} filters={effectiveFilters} />
                </Suspense>
              }
              path="/"
            />
            <Route
              element={<FarmSourcing data={data} filters={effectiveFilters} onDataChange={setData} canMutate={activeDemoUser?.role === 'procurement-officer' || activeDemoUser?.role === 'district-officer'} demoUserId={activeDemoUser?.id ?? 'user-executive'} paymentSlaHours={settings.paymentSlaHours} />}
              path="/farm-sourcing"
            />
            <Route
              element={<FarmerPayments data={data} filters={effectiveFilters} onDataChange={setData} canMutate={activeDemoUser?.role === 'procurement-officer' || activeDemoUser?.role === 'district-officer'} demoUserId={activeDemoUser?.id ?? 'user-executive'} />}
              path="/farmer-payments"
            />
            <Route
              element={
                <Suspense fallback={<div className="overview-loading">Loading processing records…</div>}>
                  <ProcessingHubs data={data} filters={effectiveFilters} />
                </Suspense>
              }
              path="/processing-hubs"
            />
            <Route
              element={
                <Suspense fallback={<div className="overview-loading">Loading inventory records…</div>}>
                  <StorageInventory data={data} filters={effectiveFilters} onDataChange={setData} canMutate={activeDemoUser?.role === 'district-officer' || activeDemoUser?.role === 'warehouse-operator'} demoUserId={activeDemoUser?.id ?? 'user-executive'} />
                </Suspense>
              }
              path="/storage-inventory"
            />
            <Route
              element={
                <Suspense fallback={<div className="overview-loading">Loading freight records…</div>}>
                  <FreightLogistics data={data} filters={effectiveFilters} onDataChange={setData} canMutate={operationalMutationsAllowed} demoUserId={activeDemoUser?.id ?? 'user-executive'} />
                </Suspense>
              }
              path="/freight-logistics"
            />
            <Route
              element={
                <Suspense fallback={<div className="overview-loading">Loading retail records…</div>}>
                  <DirectRetailSales data={data} filters={effectiveFilters} onDataChange={setData} canMutate={activeDemoUser?.role === 'district-officer'} demoUserId={activeDemoUser?.id ?? 'user-executive'} />
                </Suspense>
              }
              path="/direct-retail-sales"
            />
            <Route
              element={
                <Suspense fallback={<div className="overview-loading">Loading batch traceability…</div>}>
                  <BatchTraceability data={data} filters={effectiveFilters} />
                </Suspense>
              }
              path="/batch-traceability"
            />
            <Route
              element={<DistrictPerformance data={data} filters={effectiveFilters} settings={settings} onDistrictSelect={(districtId) => { setFilters((current) => ({ ...current, districtId })); navigate('/') }} />}
              path="/district-performance"
            />
            <Route
              element={<ReportsAudit data={data} filters={effectiveFilters} />}
              path="/reports-audit"
            />
            <Route
              element={<SettingsDataSources data={data} settings={settings} onSettingsChange={(next, previous, note) => {
                saveDemoSettings(next)
                setSettings(next)
                setFilters((current) => ({
                  ...current,
                  districtId: next.districtScopeIds.includes(current.districtId) ? current.districtId : 'all',
                  commodityId: current.commodityId === 'all' || next.commodityIds.includes(current.commodityId) ? current.commodityId : 'all',
                  paymentSlaHours: next.paymentSlaHours,
                }))
                const audited = appendDemoAuditEvent(data, {
                  demoUserId: activeDemoUser?.id ?? 'user-executive',
                  action: 'Updated demo settings',
                  entityType: 'DemoSettings',
                  entityId: 'demo-settings',
                  previousValue: JSON.stringify(previous),
                  newValue: JSON.stringify(next),
                  note,
                })
                setData(audited)
              }} />}
              path="/settings-data-sources"
            />
            <Route
              element={
                <Suspense fallback={<div className="overview-loading">Loading prototype overview…</div>}>
                  <About availablePaths={visibleScreens.map((screen) => screen.path)} data={data} />
                </Suspense>
              }
              path="/about"
            />
            {screens
              .filter((screen) => !['/', '/farm-sourcing', '/farmer-payments', '/processing-hubs', '/storage-inventory', '/freight-logistics', '/direct-retail-sales', '/batch-traceability', '/district-performance', '/reports-audit', '/settings-data-sources', '/about'].includes(screen.path))
              .map((screen) => (
                <Route
                  element={<ModuleShell data={data} screen={screen} />}
                  key={screen.path}
                  path={screen.path}
                />
              ))}
            <Route element={<Navigate to="/" replace />} path="*" />
          </Routes>
          <details className="metric-assumptions">
            <summary>Demo assumptions &amp; metric definitions</summary>
            <div><p>All records and timestamps are synthetic. Procurement value is accepted kilograms × contracted ₹/kg. Payment SLA compliance uses completed payments with valid acceptance/payment timestamps and the configured SLA. Inventory is point-in-time usable stock after reserved and damaged quantities; throughput is cumulative and is not inventory.</p><p>Recorded loss is a stage-weighted loss over recorded procurement, processing and freight inputs and must not be interpreted as reduction from a baseline. Farmer share uses payment attributed to linked sold output divided by matching shelf value; unmatched crop/product conversions are excluded. QR coverage requires modeled traceability stages, not QR authenticity. Proposal targets are goals, not achieved outcomes.</p></div>
          </details>
        </main>
      </div>
    </div>
  )
}

function ModuleShell({ data, screen }: { data: DemoDataset; screen: Screen }) {
  const Icon = screen.icon

  return (
    <section className="module-shell">
      <div className="module-icon"><Icon aria-hidden="true" size={23} strokeWidth={1.8} /></div>
      <p className="eyebrow">STAGE 1 · ROUTE READY</p>
      <h2>{screen.title}</h2>
      <p className="module-description">
        The shared domain model includes <strong>{formatNumber(screen.count(data))}</strong>{' '}
        synthetic {screen.count(data) === 1 ? 'record' : 'records'} for this area.
        Operational views, filters and workflows are intentionally reserved for later stages.
      </p>
      <div className="module-shell-footer">
        <Archive size={16} aria-hidden="true" />
        <span>Shared demo records · No live system connection</span>
      </div>
      {screen.path === '/farm-sourcing' && (
        <div className="module-trace-links">
          <h3>Traceability from procurement lots</h3>
          <div className="trace-related-links">
            {data.procurementLots.map((lot) => <Link key={lot.id} to={`/batch-traceability?search=${encodeURIComponent(lot.id)}`}>Open {lot.id}</Link>)}
          </div>
        </div>
      )}
    </section>
  )
}

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppErrorBoundary>
  )
}

export default App
