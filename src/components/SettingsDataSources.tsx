import { useState } from 'react'
import { CircleAlert, PlugZap, Save, Settings2 } from 'lucide-react'
import type { DemoDataset, CommodityId } from '../data/models'
import type { DemoSettings } from '../data/demoSettings'
import { COMMODITIES } from '../lib/executiveDashboard'
import { formatDemoTimestamp } from '../lib/formatters'

const STATUS_LABEL: Record<DemoDataset['dataSources'][number]['status'], string> = {
  mock: 'Mock',
  planned: 'Planned',
  'not-connected': 'Not connected',
}

function SettingsDataSources({ data, settings, onSettingsChange }: { data: DemoDataset; settings: DemoSettings; onSettingsChange: (next: DemoSettings, previous: DemoSettings, reason: string) => void }) {
  const [saved, setSaved] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const toggleDistrict = (id: string) => {
    const requiredBase = 'district-thanjavur'
    if (id === requiredBase || settings.districtScopeIds.includes(id)) return
    const otherConfigurableId = id === 'district-dharmapuri' ? 'district-tiruvannamalai' : 'district-dharmapuri'
    const nextIds = settings.districtScopeIds.includes(id)
      ? settings.districtScopeIds
      : [...settings.districtScopeIds.filter((current) => current !== otherConfigurableId), id]
    onSettingsChange({ ...settings, districtScopeIds: nextIds }, settings, `Updated configurable pilot district scope to ${nextIds.join(', ')}`)
    setSaved(true)
  }
  const updateCommodity = (commodityId: CommodityId) => {
    const commodityIds = settings.commodityIds.includes(commodityId)
      ? settings.commodityIds.filter((id) => id !== commodityId)
      : [...settings.commodityIds, commodityId]
    if (commodityIds.length === 0) return
    onSettingsChange({ ...settings, commodityIds }, settings, `Updated demo commodity list to ${commodityIds.join(', ')}`)
    setSaved(true)
  }
  const updateSla = (value: string) => {
    const hours = Number(value)
    if (!Number.isInteger(hours) || hours < 1 || hours > 240) {
      setValidationMessage('Payment SLA must be a whole number from 1 to 240 hours.')
      return
    }
    setValidationMessage('')
    onSettingsChange({ ...settings, paymentSlaHours: hours, targetValues: { ...settings.targetValues, 'payment-sla': hours } }, settings, `Updated demo payment SLA to ${hours} hours`)
    setSaved(true)
  }
  const updateTarget = (id: string, value: string) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > (id === 'payment-sla' ? 240 : 100)) {
      setValidationMessage(`${id.replaceAll('-', ' ')} target must be from 0 to ${id === 'payment-sla' ? 240 : 100}${id === 'payment-sla' ? ' hours' : '%'}.`)
      return
    }
    setValidationMessage('')
    onSettingsChange({
      ...settings,
      paymentSlaHours: id === 'payment-sla' ? numeric : settings.paymentSlaHours,
      targetValues: { ...settings.targetValues, [id]: numeric },
    }, settings, `Updated proposed demo target ${id} to ${numeric}`)
    setSaved(true)
  }

  return <div className="oversight-page">
    <section className="operations-intro"><div><p className="eyebrow">SETTINGS · DEMO CONFIGURATION</p><h2>Proposed integration points and configurable pilot settings.</h2><p>No live platform connection is configured. The Government of Tamil Nadu is the intended owner of any future platform; this prototype does not imply endorsement or deployment.</p></div><Settings2 size={24} /></section>
    <section className="settings-section">
      <div className="operations-panel oversight-panel"><div className="operations-panel-title"><div><p className="eyebrow">PROPOSED CONNECTORS</p><h2>Data sources</h2></div><span>Mock status only</span></div>
        <div className="integration-grid">{data.dataSources.map((source) => <article className="integration-card" key={source.id}><div className="integration-heading"><PlugZap size={16} /><strong>{source.name}</strong><span className={`integration-status status-${source.status}`}>{STATUS_LABEL[source.status]}</span></div><p>{source.purpose}</p><small>Expected data</small><ul>{source.expectedData.map((item) => <li key={item}>{item}</li>)}</ul><div className="integration-meta"><span>Last simulated sync<strong>{source.lastSimulatedSyncAt ? formatDemoTimestamp(source.lastSimulatedSyncAt) : 'Not available'}</strong></span></div><p className="integration-issue"><CircleAlert size={13} />{source.exampleIssue ?? 'No mock validation was recorded. No live validation or connection is available.'}</p></article>)}</div>
      </div>
      <div className="operations-panel oversight-panel">
        <div className="operations-panel-title"><div><p className="eyebrow">LOCAL DEMO SETTINGS</p><h2>Configurable pilot scope and targets</h2></div><span>Persisted in this browser</span></div>
        <div className="settings-grid">
          <fieldset className="settings-fieldset"><legend>Pilot district scope</legend><label className="settings-option"><input checked={settings.districtScopeIds.includes('district-thanjavur')} disabled type="checkbox" />Thanjavur · Proposed rice pilot</label>{data.districts.filter((district) => district.id !== 'district-thanjavur').map((district) => <label className="settings-option" key={district.id}><input checked={settings.districtScopeIds.includes(district.id)} onChange={() => toggleDistrict(district.id)} type="radio" name="configurable-pilot-district" />{district.name} · configurable second district</label>)}<small>Thanjavur remains the proposed paddy district. Select Dharmapuri or Tiruvannamalai for the configurable second pilot.</small></fieldset>
          <fieldset className="settings-fieldset"><legend>Commodity list</legend>{COMMODITIES.map((commodity) => <label className="settings-option" key={commodity.id}><input checked={settings.commodityIds.includes(commodity.id)} disabled={settings.commodityIds.length === 1 && settings.commodityIds.includes(commodity.id)} onChange={() => updateCommodity(commodity.id)} type="checkbox" />{commodity.label}</label>)}<small>At least one commodity must remain enabled. This list controls the global commodity filter.</small></fieldset>
          <label className="settings-control">Payment SLA (hours)<input aria-label="Payment SLA hours" defaultValue={settings.paymentSlaHours} key={`sla-${settings.paymentSlaHours}`} max="240" min="1" onBlur={(event) => updateSla(event.target.value)} onChange={() => setSaved(false)} type="number" /><small>Applied to Executive Overview, district and report payment compliance.</small></label>
          <fieldset className="settings-fieldset"><legend>Proposal targets · demo only</legend>{Object.entries(settings.targetValues).map(([id, value]) => <label className="settings-target" key={id}><span>{id.replaceAll('-', ' ')}</span><input aria-label={`${id} target`} defaultValue={value} key={`${id}-${value}`} max={id === 'payment-sla' ? 240 : 100} min="0" onBlur={(event) => updateTarget(id, event.target.value)} onChange={() => setSaved(false)} type="number" />{id === 'payment-sla' ? 'hours' : '%'}</label>)}<small>Targets are proposed goals, never actual performance guarantees.</small></fieldset>
        </div>
        {validationMessage && <p className="form-error" role="alert">{validationMessage}</p>}
        <div className="settings-save-note"><Save size={14} />{saved ? 'Changes saved locally for this browser.' : 'Changes save locally as you edit.'}</div>
        <p className="operations-footnote">These configuration values affect demo filters and calculations only. No credentials or live endpoints are present.</p>
      </div>
    </section>
  </div>
}

export default SettingsDataSources
