// Flow account selection belongs to the user's chosen tab. Do not restore an
// old project URL over that tab: its owner can pull Google back to account 0.
const HOME = 'https://flow.google.com/?hl=en'
const flowUrl = value => {
  try { const url = new URL(value); return url.origin === 'https://flow.google.com' ? url : null } catch { return null }
}
// Only the tab this app opened (remembered id) is ever used — never a Flow tab the user opened themselves.
export function preferredFlowTab(tabs, savedId) {
  return tabs.find(tab => tab.id === savedId && flowUrl(tab.url) && !tab.discarded) ?? null
}
export function flowHomeUrl(value) {
  const url = flowUrl(value)
  if (!url) return HOME
  url.pathname = url.pathname.replace(/\/project\/.*$/, '/')
  url.hash = ''
  url.searchParams.set('hl', 'en')
  return url.href
}
// .../project/<id> — a deeper path is one of the project's own views (…/edit/<assetId> while an
// image is open). Those views replace Flow's top bar, so neither the Google account button nor the
// project prompt box exists on the page while one is open.
const PROJECT_PATH = /^(.*\/project\/[^/]+)(\/.+)?$/
/** URL ของหน้าโปรเจกต์ (ตัดหน้าย่อย เช่นหน้าเปิดดู/แก้ภาพ) — '' เมื่อไม่ใช่หน้าโปรเจกต์ของ Flow */
export function flowProjectUrl(value) {
  const url = flowUrl(value)
  const root = url && PROJECT_PATH.exec(url.pathname)?.[1]
  if (!url || !root) return ''
  url.pathname = root
  url.hash = ''
  url.searchParams.set('hl', 'en')
  return url.href
}
const inProjectSubview = url => !!url && !!PROJECT_PATH.exec(url.pathname)?.[2]
export function flowJobNavigation(currentUrl, payload = {}) {
  const current = flowUrl(currentUrl)
  const currentProject = flowProjectUrl(currentUrl)
  const savedProject = flowProjectUrl(payload.projectUrl)
  // Resume in the currently selected account/workspace. If the user switched
  // accounts, openProject creates a project there rather than reopening the old owner's.
  if (current && savedProject) {
    if (currentProject && currentProject !== savedProject) {
      return { navigate: false, url: current.href, error: 'โปรเจกต์ Flow ที่เปิดอยู่เป็นคนละโปรเจกต์ — เปิดหน้าแรก Flow ของบัญชีที่ต้องการ แล้วกดทำต่อ ระบบจะสร้างโปรเจกต์ของคลิปนี้ในบัญชีที่เลือกและไม่กลับบัญชีเดิม' }
    }
    // หน้าเปิดดู/แก้ภาพของโปรเจกต์เดิมค้างอยู่ (…/edit/<id>) → แถบบนหาย ทั้งปุ่มบัญชีและช่องพิมพ์
    // จึงไม่มีให้หา → กลับหน้าโปรเจกต์ก่อนเริ่มงาน แทนที่จะล้มทั้งรอบ
    if (currentProject && inProjectSubview(current)) return { navigate: true, url: currentProject }
    return { navigate: false, url: current.href }
  }
  if (current && !/\/project\//.test(current.pathname)) return { navigate: false, url: current.href }
  return { navigate: true, url: flowHomeUrl(currentUrl) }
}
