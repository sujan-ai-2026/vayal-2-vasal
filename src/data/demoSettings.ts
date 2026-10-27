import type { CommodityId, PilotTarget } from './models'

export interface DemoSettings {
  districtScopeIds: string[]
  commodityIds: CommodityId[]
  paymentSlaHours: number
  targetValues: Record<string, number>
}

export const DEFAULT_DEMO_SETTINGS: DemoSettings = {
  districtScopeIds: ['district-thanjavur', 'district-dharmapuri'],
  commodityIds: ['paddy', 'millets', 'groundnut', 'gingelly', 'pulses'],
  paymentSlaHours: 72,
  targetValues: {
    'farmer-income': 15,
    'farmer-share': 55,
    'grain-loss': 25,
    'payment-sla': 72,
    'qr-traceability': 100,
  },
}

const STORAGE_KEY = 'vayal-to-vaasal-settings-v1'

export function getDemoSettings(): DemoSettings {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) return DEFAULT_DEMO_SETTINGS
  try {
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object') throw new Error('Saved demo settings have an invalid shape.')
    const candidate = parsed as Partial<DemoSettings>
    return {
      districtScopeIds: Array.isArray(candidate.districtScopeIds) ? candidate.districtScopeIds : DEFAULT_DEMO_SETTINGS.districtScopeIds,
      commodityIds: Array.isArray(candidate.commodityIds) ? candidate.commodityIds : DEFAULT_DEMO_SETTINGS.commodityIds,
      paymentSlaHours: Number.isFinite(candidate.paymentSlaHours) && candidate.paymentSlaHours! > 0 ? candidate.paymentSlaHours! : DEFAULT_DEMO_SETTINGS.paymentSlaHours,
      targetValues: candidate.targetValues && typeof candidate.targetValues === 'object' ? { ...DEFAULT_DEMO_SETTINGS.targetValues, ...candidate.targetValues } : DEFAULT_DEMO_SETTINGS.targetValues,
    }
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Saved demo settings could not be read. Clear local demo settings to continue.', { cause: error })
    throw error
  }
}

export function saveDemoSettings(settings: DemoSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function resetDemoSettings(): DemoSettings {
  window.localStorage.removeItem(STORAGE_KEY)
  return DEFAULT_DEMO_SETTINGS
}

export function getSettingTarget(target: PilotTarget, settings: DemoSettings): number {
  return settings.targetValues[target.id] ?? target.value
}
