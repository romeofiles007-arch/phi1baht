// เลือกแท็บ ChatGPT ที่จะใช้ — ไม่เปิดแท็บใหม่ถ้ามีอยู่แล้ว (ผู้ใช้สั่ง 23 พ.ย. 2026)
// ลำดับ: แท็บที่จำเลขไว้ → แท็บ ChatGPT ที่ใช้ล่าสุด → แท็บที่ถูกพักหน่วยความจำ → null (ให้เปิดใหม่)
const isChat = (value) => {
  try { return ['chatgpt.com', 'chat.openai.com'].includes(new URL(value).hostname) } catch { return false }
}
export function preferredChatTab(tabs, savedId) {
  const chats = tabs.filter((t) => isChat(t.url ?? t.pendingUrl))
  const saved = chats.find((t) => t.id === savedId && !t.discarded)
  if (saved) return saved
  const recent = (list) => [...list].sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0] ?? null
  return recent(chats.filter((t) => !t.discarded)) ?? recent(chats)
}
