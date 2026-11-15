import type { CampaignStartMode } from './CampaignStart'
export function startCampaign(mode: CampaignStartMode) { window.dispatchEvent(new CustomEvent('direto:new-campaign', { detail: mode })); window.location.hash = '/radar' }
