/**
 * อ่านรูปสินค้าจากหน้า Shopee ที่เปิดอยู่ในแท็บ — อ่านอย่างเดียว ไม่กดปุ่ม ไม่สั่งซื้อ ไม่แตะบัญชี
 *
 * ทำไมต้องอ่านจากหน้าเว็บ: เซิร์ฟเวอร์ Shopee ส่ง HTML ก้อนเดียวกันทุก URL (ไม่มีแม้แต่ og:image)
 * ข้อมูลสินค้าทั้งหมดมากับ JavaScript ทีหลัง ดึงจากฝั่งเซิร์ฟเวอร์จึงไม่ได้อะไรเลย (ลองแล้ว 23 พ.ย. 2026)
 *
 * รูปที่เอา = รูปในแกลเลอรีของสินค้า (รูปใหญ่กับรูปย่อแถวล่าง) — ไม่เอารูปรีวิว ไม่เอารูปสินค้าแนะนำ
 * รูปย่อของ Shopee มี _tn ต่อท้าย ตัดออกแล้วได้ไฟล์ใหญ่ของรูปเดียวกัน
 */
;(() => {
  if (globalThis.__cartoon_shopee) return
  globalThis.__cartoon_shopee = true

  const MAX = 8
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)

  /** URL รูปใหญ่ของ Shopee — ตัดท้าย _tn (รูปย่อ) และพารามิเตอร์ย่อขนาดออก */
  const fullSize = (src) => String(src ?? '').replace(/_tn(\?.*)?$/, '').replace(/\?.*$/, '')

  const isProductImage = (img) => {
    const src = img.currentSrc || img.src || ''
    if (!/^https?:/.test(src)) return false
    // ไฟล์รูปของ Shopee อยู่บน CDN ของตัวเอง — ไอคอน ปุ่ม แบนเนอร์ ไม่เอา
    if (!/(susercontent|shopee)/i.test(src)) return false
    if (/icon|logo|sprite|placeholder|avatar|flag|badge/i.test(src)) return false
    const w = img.naturalWidth || img.width || 0
    return w === 0 || w >= 80 // รูปที่ยังโหลดไม่เสร็จ (naturalWidth 0) ให้ผ่านไปก่อน
  }

  /**
   * แกลเลอรีของสินค้าอยู่ครึ่งบนของหน้าเสมอ — จำกัดด้วยตำแหน่งแทนการผูกกับชื่อคลาส
   * (ชื่อคลาสของ Shopee เป็นตัวย่อสุ่มและเปลี่ยนบ่อย ผูกไว้แล้วพังทุกครั้งที่เขาดีพลอย)
   */
  function galleryImages() {
    const pageTop = window.scrollY
    const seen = new Map()
    for (const img of $$('img')) {
      if (!visible(img) || !isProductImage(img)) continue
      const box = img.getBoundingClientRect()
      const top = box.top + pageTop
      if (top > 1400) continue // ต่ำกว่านี้เป็นรายละเอียดสินค้า รีวิว และสินค้าแนะนำ
      if (box.width < 40) continue
      const url = fullSize(img.currentSrc || img.src)
      // รูปเดิมโผล่ทั้งแบบย่อและแบบใหญ่ — เก็บใบที่แสดงใหญ่สุดไว้ใบเดียว
      if (!seen.has(url) || seen.get(url).area < box.width * box.height) {
        seen.set(url, { url, area: box.width * box.height, top })
      }
    }
    return [...seen.values()].sort((a, b) => a.top - b.top || b.area - a.area).slice(0, MAX).map((i) => i.url)
  }

  /** ชื่อสินค้าจากหัวหน้า — เผื่อผู้ใช้วางลิ้งย่อที่ไม่มีชื่ออยู่ใน URL */
  function productName() {
    const h1 = $$('h1, [role="heading"]').filter(visible).map((el) => el.textContent.trim()).find((t) => t.length > 5)
    return (h1 ?? document.title.replace(/\s*\|\s*Shopee.*$/i, '')).trim().slice(0, 120)
  }

  /**
   * กรอบโปรโมชันที่ Shopee วางทับรูปสินค้า ("ส่งฟรี · ส่วนลด") เป็น PNG โปร่งใสเกือบทั้งใบ — ไม่ใช่รูปสินค้า
   * 23 พ.ย. 2026: ดึงติดมา 2 ใบ ขึ้นเป็นช่องว่างในแผงข้าง ถ้า ChatGPT เลือกใบนี้ Flow จะได้รูปเปล่าเป็นแบบ
   * ดูจากความโปร่งใสแทน URL เพราะ URL ของกรอบกับรูปสินค้าอยู่บน CDN เดียวกันและหน้าตาเหมือนกัน
   */
  async function mostlyTransparent(blob) {
    try {
      const bmp = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(48, 48)
      const g = canvas.getContext('2d')
      g.drawImage(bmp, 0, 0, 48, 48)
      const px = g.getImageData(0, 0, 48, 48).data
      let clear = 0
      for (let i = 3; i < px.length; i += 4) if (px[i] < 40) clear++
      return clear / (48 * 48) > 0.4
    } catch {
      return false // ถอดรูปไม่ได้ = ไม่ตัดทิ้ง ให้ด่านอื่นตัดสิน
    }
  }

  /** ลายนิ้วมือของไฟล์ — รูปเดียวกันมาหลาย URL (รูปย่อ/รูปใหญ่/ตัวปรับขนาด) แต่ไฟล์เหมือนกันทุกไบต์ */
  async function fingerprint(blob) {
    const hash = await crypto.subtle.digest('SHA-1', await blob.arrayBuffer())
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  /** โหลดรูปเป็น base64 ผ่านแท็บนี้ — ใช้คุกกี้และ referrer ของหน้าจริง ไม่ต้องให้ฝั่ง Node ไปดึงเอง · null = ไม่ใช่รูปสินค้า */
  async function fetchImage(url) {
    const res = await fetch(url, { credentials: 'omit' })
    if (!res.ok) throw new Error(`โหลดรูปไม่ได้ (HTTP ${res.status})`)
    const blob = await res.blob()
    if (blob.size > 6 * 1024 * 1024) throw new Error('รูปใหญ่เกิน 6MB')
    if (await mostlyTransparent(blob)) return null
    const hash = await fingerprint(blob)
    const type = /^image\/(png|jpeg|webp)$/.test(blob.type) ? blob.type : 'image/jpeg'
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'))
      reader.readAsDataURL(blob)
    })
    return { type, base64, hash }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'SHOPEE_PRODUCT') return
    ;(async () => {
      try {
        const urls = galleryImages()
        if (!urls.length) {
          throw new Error('ไม่เจอรูปสินค้าในหน้านี้ — เลื่อนหน้าขึ้นบนสุดให้เห็นรูปสินค้าก่อน แล้วลองใหม่ (หรือก๊อปรูปมาวางเองในแผงข้าง)')
        }
        const images = []
        const seenHash = new Set()
        for (const url of urls) {
          try {
            const img = await fetchImage(url)
            // ไม่ใช่รูปสินค้า (กรอบโปร่งใส) หรือไฟล์ซ้ำกับใบที่ได้แล้ว → ข้าม
            // (23 พ.ย. 2026: ได้ 8 รูปแต่เป็นคู่ซ้ำเหมือนกันทุกไบต์ 4 คู่ คลังเต็มจนดึงสินค้าตัวใหม่ไม่ได้)
            if (!img || seenHash.has(img.hash)) continue
            seenHash.add(img.hash)
            images.push({ type: img.type, base64: img.base64 })
          } catch { /* รูปไหนโหลดไม่ได้ก็ข้ามไป ไม่ล้มทั้งชุด */ }
        }
        if (!images.length) throw new Error('โหลดรูปสินค้าไม่สำเร็จสักรูป — ก๊อปรูปมาวางเองในแผงข้างแทนได้')
        sendResponse({ ok: true, name: productName(), url: location.href, images })
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message ?? err) })
      }
    })()
    return true // ตอบแบบ async
  })
})()
