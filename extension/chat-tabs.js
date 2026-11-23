// เลือกแท็บของเว็บที่จะใช้ — ไม่เปิดแท็บใหม่ถ้ามีอยู่แล้ว (ผู้ใช้สั่ง 23 พ.ย. 2026)
// ลำดับ: แท็บที่จำเลขไว้ → แท็บของเว็บนั้นที่ใช้ล่าสุด → แท็บที่ถูกพักหน่วยความจำ → null (ให้เปิดใหม่)
// เลขแท็บเก็บใน storage.session ซึ่งถูกล้างทุกครั้งที่ส่วนขยายรีโหลด ถ้าดูแต่เลขที่จำไว้จะเปิดแท็บใหม่เพิ่มเรื่อยๆ
const hostOf = (value) => {
  try { return new URL(value).hostname } catch { return '' }
}

/** แท็บที่ควรใช้ของเว็บใน hosts — null = ไม่มีเลย ให้เปิดใหม่ */
export function preferredSiteTab(tabs, savedId, hosts) {
  const mine = tabs.filter((t) => hosts.includes(hostOf(t.url ?? t.pendingUrl)))
  const saved = mine.find((t) => t.id === savedId && !t.discarded)
  if (saved) return saved
  const recent = (list) => [...list].sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0] ?? null
  return recent(mine.filter((t) => !t.discarded)) ?? recent(mine)
}

export const CHAT_HOSTS = ['chatgpt.com', 'chat.openai.com']
// Google ของผู้ใช้: ผู้ใช้สั่ง 23 พ.ย. 2026 "google ไม่ต้องเรียกหน้าต่างใหม่ ถ้ามีเปิดไว้อยู่แล้ว"
export const GEMINI_HOSTS = ['gemini.google.com']
export const FLOW_HOSTS = ['flow.google.com']

export const preferredChatTab = (tabs, savedId) => preferredSiteTab(tabs, savedId, CHAT_HOSTS)
export const preferredGeminiTab = (tabs, savedId) => preferredSiteTab(tabs, savedId, GEMINI_HOSTS)
