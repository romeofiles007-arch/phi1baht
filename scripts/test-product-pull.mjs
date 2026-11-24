// ดึงรูปสินค้าจากแท็บ Shopee → ให้ ChatGPT เลือกรูป → แนบรูปที่เลือกให้ Flow
//   node --test scripts/test-product-pull.mjs
// ดึงจากฝั่งเซิร์ฟเวอร์ไม่ได้ (23 พ.ย. 2026: shopee.co.th ส่ง HTML ก้อนเดียวกันทุก URL ไม่มีแม้แต่ og:image)
// จึงต้องอ่านจากหน้าที่เรนเดอร์แล้วในแท็บของผู้ใช้ แบบเดียวกับที่แอปขับ ChatGPT และ Flow
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const SHOPEE = read('extension/content-shopee.js')
const PANEL = read('extension/sidepanel.js')
const UI = read('bridge/ui.js')
const MANIFEST = JSON.parse(read('extension/manifest.json'))

test('ตัวอ่านหน้า Shopee: อ่านอย่างเดียว ไม่กดปุ่ม ไม่แตะบัญชี', () => {
  // ดูเฉพาะโค้ด ไม่รวมคอมเมนต์ (คอมเมนต์อธิบายว่า "ไม่สั่งซื้อ" จึงมีคำพวกนี้อยู่)
  const code = SHOPEE.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  assert.ok(!/\.click\(\)|dispatchEvent\(new MouseEvent/.test(code), 'ห้ามกดปุ่มใดๆ ในหน้า Shopee')
  assert.ok(!/addToCart|checkout|\bbuy\b|ตะกร้า|สั่งซื้อ/i.test(code), 'ห้ามแตะการซื้อขาย')
  assert.ok(!/method:\s*'POST'/i.test(code), 'อ่านอย่างเดียว ไม่ส่งข้อมูลกลับไปที่ Shopee')
  assert.match(SHOPEE, /credentials: 'omit'/, 'โหลดรูปโดยไม่ส่งคุกกี้บัญชีผู้ใช้')
})

test('เลือกเฉพาะรูปสินค้า — ไม่เอาไอคอน รูปรีวิว หรือสินค้าแนะนำท้ายหน้า', () => {
  assert.match(SHOPEE, /icon\|logo\|sprite\|placeholder\|avatar/, 'กรองไอคอนและโลโก้ออก')
  assert.match(SHOPEE, /top > 1400/, 'เอาเฉพาะแกลเลอรีครึ่งบน ไม่เอารีวิว/สินค้าแนะนำ')
  assert.match(SHOPEE, /_tn/, 'รูปย่อของ Shopee มี _tn ต่อท้าย ต้องตัดเพื่อเอาไฟล์ใหญ่')
  // ผูกกับตำแหน่งและขนาด ไม่ผูกกับชื่อคลาสของ Shopee ซึ่งเป็นตัวย่อสุ่มและเปลี่ยนบ่อย
  assert.ok(!/querySelector\(['"]\.[a-zA-Z0-9_-]{6,}/.test(SHOPEE), 'ห้ามผูกกับชื่อคลาสยาวๆ ของ Shopee')
})

test('ไม่เจอรูป → บอกวิธีแก้ ไม่ใช่ล้มเงียบ · บางรูปโหลดไม่ได้ก็ไม่ล้มทั้งชุด', () => {
  assert.match(SHOPEE, /เลื่อนหน้าขึ้นบนสุด/, 'บอกผู้ใช้ว่าต้องทำอะไร')
  assert.match(SHOPEE, /ก๊อปรูปมาวางเองในแผงข้าง/, 'บอกทางสำรองเสมอ')
  assert.match(SHOPEE, /catch \{ \/\* รูปไหนโหลดไม่ได้ก็ข้ามไป/)
})

test('manifest: ลงทะเบียนตัวอ่าน Shopee และขอสิทธิ์เฉพาะที่ต้องใช้', () => {
  const cs = MANIFEST.content_scripts.find((c) => c.js.includes('content-shopee.js'))
  assert.ok(cs, 'ต้องลงทะเบียน content-shopee.js')
  assert.deepEqual(cs.matches, ['https://shopee.co.th/*', 'https://*.shopee.co.th/*'])
  for (const host of ['https://shopee.co.th/*', 'https://*.susercontent.com/*']) {
    assert.ok(MANIFEST.host_permissions.includes(host), `ต้องขอสิทธิ์ ${host}`)
  }
  // ไม่ไปขอสิทธิ์ทั้งเว็บ
  assert.ok(!MANIFEST.host_permissions.includes('<all_urls>'))
})

test('แผงข้าง: ปุ่มดึงรูป · ปุ่มให้ AI เลือก · ที่วางรูปเอง · ตัวเลือกความเด่น', () => {
  const html = read('extension/sidepanel.html')
  for (const id of ['pullShopee', 'pickProduct', 'productPaste', 'productThumbs', 'productHint', 'clipProminence']) {
    assert.ok(html.includes(`id="${id}"`), `แผงข้างต้องมี #${id}`)
  }
  assert.match(PANEL, /chrome\.tabs\.query\(\{ url: \['https:\/\/shopee\.co\.th\/\*'/)
  // รูปที่ส่งให้ ChatGPT/Gemini เว็บต้องเป็น { name, type, base64 } ตามที่ pasteFiles ต้องการ
  assert.match(PANEL, /base64: p\.dataUrl\.slice\(p\.dataUrl\.indexOf\(','\) \+ 1\)/)
  // อ่านคำตอบด้วยจำนวนรูปที่ส่งไปจริง (ส่งรูปเดียวตอนบรรยายรูปที่ผู้ใช้เลือกเอง)
  assert.match(PANEL, /parseProductPick\(text, sent\.length\)/)
})

// 23 พ.ย. 2026 ผู้ใช้ขอเลือกรูปเองได้ — รูปเดียวหรือรูปที่เลือกเองแล้ว ปุ่ม AI กลายเป็น "บรรยายรูปที่เลือก"
test('ปุ่ม AI ใช้ได้ตั้งแต่ 1 รูป: รูปเดียวหรือรูปที่เลือกเองแล้ว = บรรยายอย่างเดียว ไม่เลือกทับ', () => {
  assert.match(PANEL, /\$\('pickProduct'\)\.disabled = !p\.images\.length \|\| p\.stale/)
  assert.match(PANEL, /const describeOnly = mine \|\| p\.images\.length === 1/)
  assert.match(PANEL, /บรรยายรูปที่เลือก/)
})

// 23 พ.ย. 2026 ผู้ใช้: "ทำไมไม่ดึงให้อัตโนมัติ" — วางลิ้งแล้วดึงรูปเอง (ยังเป็นแบบนี้)
// ต่อมาวันเดียวกัน: "ถ้าเราไม่สั่งให้ส่งไป ChatGPT ก็ยังไม่ต้องส่งไป" — ดึงเสร็จแล้วรอผู้ใช้สั่ง ไม่ส่งให้ AI เอง
test('วางลิ้งแล้วดึงรูปให้เลย แต่ไม่ส่งให้ AI เลือกเอง — รอผู้ใช้สั่ง', () => {
  const onUrl = /async function saveProductUrl[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.match(onUrl, /fetchProductPhotos\(\{ auto: true \}\)/, 'วางลิ้งเสร็จต้องดึงรูปเอง')
  assert.match(onUrl, /clip\?\.product\?\.url === url/, 'ดึงเฉพาะเมื่อลิ้งถูกบันทึกจริง (ไม่ใช่ลิ้งที่ระบบไม่รับ)')
  const fetchFn = /async function fetchProductPhotos[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.ok(!/pickProductPhoto\(/.test(fetchFn), 'ดึงรูปเสร็จห้ามส่งให้ AI เอง')
  assert.match(fetchFn, /กดที่รูปเพื่อเลือกเป็นแบบเอง/, 'ต้องบอกว่าทำอะไรต่อได้บ้าง')
  // ปุ่มยังอยู่สำหรับกดซ้ำเอง
  assert.match(PANEL, /\$\('pullShopee'\)\.addEventListener\('click', \(\) => fetchProductPhotos\(\)\)/)
  assert.match(PANEL, /\$\('pickProduct'\)\.addEventListener\('click', \(\) => pickProductPhoto\(\)\)/)
})

// 23 พ.ย. 2026 ผู้ใช้วางลิ้งแล้วนั่งรอ ไม่มีอะไรเกิดขึ้น แล้วถามว่า "จะดึงตอนไหน"
// change ยิงตอนช่องเสียโฟกัสเท่านั้น — คนวางลิ้งแล้วไม่ได้คลิกที่อื่นจึงไม่เห็นอะไรเลย
test('ดึงทันทีที่วางลิ้ง ไม่ต้องรอคลิกที่อื่น · กด Enter ก็ได้ · ไม่ยิงซ้ำลิ้งเดิม', () => {
  assert.match(PANEL, /\$\('clipProductUrl'\)\.addEventListener\('paste'/, 'ยิงตอนวาง')
  assert.match(PANEL, /if \(e\.key === 'Enter'\) saveProductUrl/, 'ยิงตอนกด Enter')
  assert.match(PANEL, /\$\('clipProductUrl'\)\.addEventListener\('change'/, 'ยิงตอนเสียโฟกัสด้วย (วางแล้วแก้ต่อ)')
  assert.match(PANEL, /if \(url === productUrlDone\) return/, 'ลิ้งเดิมไม่ดึงซ้ำ · และวางลิ้งระหว่างผลิตคลิปก็ต้องได้')
  assert.match(PANEL, /setTimeout\(\(\) => saveProductUrl\(pasted\), 0\)/, 'รอให้ค่าลงช่องก่อนอ่าน')
})

test('ชื่อจากหน้าเว็บทับชื่อที่เดาจากลิ้งเสมอ (ลิ้งมีชื่อร้านกับคำโฆษณาปน)', () => {
  const fetchFn = /async function fetchProductPhotos[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.match(fetchFn, /if \(res\.name\) await saveClipSettings\(\{ productName: res\.name/)
  assert.ok(!/!clip\?\.product\?\.name && res\.name/.test(fetchFn), 'ไม่ใช่เติมเฉพาะตอนชื่อว่างแล้ว')
})

// 23 พ.ย. 2026 ผู้ใช้: "ทำไมกดดึงสินค้าไม่สำเร็จ"
// แท็บ Shopee ที่เปิดค้างไว้ตั้งแต่ก่อนติดตั้ง/รีโหลดส่วนขยาย ยังไม่มี content script อยู่ในหน้า
// (manifest ฉีดตอนโหลดหน้าเท่านั้น) → sendMessage ล้มทุกครั้ง รอซ้ำกี่รอบก็ไม่ขึ้นเอง
test('แท็บที่เปิดค้างไว้ก่อนรีโหลดส่วนขยาย: ฉีดตัวอ่านเข้าไปเองแล้วลองใหม่', () => {
  const fn = /async function pullShopeePhotos[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.match(fn, /noScript: true/, 'แยกให้ออกว่าล้มเพราะไม่มีตัวอ่านในหน้า')
  assert.match(fn, /chrome\.scripting\.executeScript\(\{ target: \{ tabId: tab\.id \}, files: \['content-shopee\.js'\] \}\)/)
  assert.match(fn, /if \(res\?\.noScript && !injected\)/, 'ฉีดครั้งเดียว ไม่วนฉีดซ้ำ')
  assert.match(fn, /chrome:\/\/extensions/, 'ฉีดไม่ได้ก็ต้องบอกว่าไปรีเฟรชส่วนขยายตรงไหน')
  assert.ok(JSON.parse(read('extension/manifest.json')).permissions.includes('scripting'), 'ต้องมีสิทธิ์ scripting')
})

// ภาพจากผู้ใช้ 23 พ.ย. 2026: ปุ่ม "หยุดทุก…" สีแดงอยู่บนหน้า = กำลังผลิตคลิป
// เดิมปิดปุ่มดึงรูปด้วยระหว่างผลิต กดแล้วจึงไม่มีอะไรเกิดขึ้นและไม่มีข้อความบอกว่าทำไม
test('ระหว่างผลิตคลิป: ดึงรูปได้ (ใช้แท็บคนละตัว) · ปุ่ม AI ที่ต้องยืมแท็บต้องรอ และบอกเหตุผล', () => {
  assert.match(PANEL, /\$\('pullShopee'\)\.disabled = false/, 'ดึงรูปไม่ชนกับงานผลิต')
  // ChatGPT และ Gemini เว็บยืมแท็บที่งานผลิตใช้อยู่ · Gemini API ถามผ่านโปรแกรมในเครื่อง ไม่ต้องรอ
  assert.match(PANEL, /const needsTab = w\.id !== 'gemini'/)
  assert.match(PANEL, /\(needsTab && localBusy\(\)\)/)
  assert.match(PANEL, /กำลังผลิตคลิปอยู่ — \$\{w\.label\} ไม่ว่าง/, 'ปุ่มที่กดไม่ได้ต้องบอกเหตุผล')
})

// 23 พ.ย. 2026 ผู้ใช้: "ตอนนี้กดเลือกสามปุ่มนั้นไม่ได้" (ของใช้ในมือ / มีช็อตเด่น / มีบทบาท)
// ตั้งค่าคลิปอื่น (แนวภาพ ซับไตเติล เพลง) ล็อกระหว่างผลิตเพราะมีผลกับงานที่กำลังเรนเดอร์
// แต่ตั้งค่าสินค้ามีผลตอนสร้าง prompt ของขั้นที่ยังไม่ถึง ล็อกไว้จึงมีแต่เสีย
test('ตั้งค่าสินค้าใช้ได้ระหว่างผลิตคลิป (ยกเว้นขั้นที่ต้องใช้แท็บ ChatGPT)', () => {
  const prom = /function renderProminence[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.match(prom, /b\.disabled = false/, 'ปุ่มระดับความเด่นกดได้ตลอด')
  assert.match(prom, /กำลังผลิตคลิปอยู่ — ที่เปลี่ยนตอนนี้มีผลกับขั้นที่ยังไม่ถึง/, 'บอกผลของการเปลี่ยนกลางคัน')
  assert.match(PANEL, /if \(b\) saveClipSettings\(\{ productProminence: b\.dataset\.value \}\)/, 'คลิกแล้วต้องบันทึกจริง')
  const prod = /function renderProduct\(\)[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.match(prod, /\$\('clipProductEnabled'\)\.disabled = !p\.name$/m, 'สวิตช์เปิดใช้ไม่ผูกกับงานที่รันอยู่')
  assert.match(prod, /\$\('clipProductClear'\)\] \) ?el\.disabled = false|\$\('clipProductClear'\)\]\) el\.disabled = false/, 'ช่องลิ้ง/ชื่อ/ปุ่มล้าง กดได้ตลอด')
  // ขั้นเดียวที่ยังต้องรอคืออันที่ยืมแท็บ ChatGPT/Gemini เว็บ
  assert.match(PANEL, /\(needsTab && localBusy\(\)\)/)
})

// ข้อความผิดพลาดเคยถูก renderProductPhotos() เขียนทับทันที ผู้ใช้จึงเห็นแต่ข้อความตั้งต้น
// แล้วไล่ไม่ได้ว่าทำไมกดดึงแล้วไม่สำเร็จ
test('ข้อความสถานะของกล่องรูปสินค้าต้องค้างไว้ ไม่ถูก render ทับ', () => {
  assert.match(PANEL, /let productMsg = null/)
  assert.match(PANEL, /function setProductStatus\(text, kind = ''\)/)
  assert.match(PANEL, /\$\('productHint'\)\.textContent = productMsg\?\.text \?\?/, 'ข้อความล่าสุดต้องชนะข้อความตั้งต้น')
  assert.ok(!/setStatus\('productHint'/.test(PANEL), 'ห้ามเขียนช่องนี้ตรงๆ ด้วย setStatus (จะถูก render ทับ)')
})

test('โปรแกรมในเครื่องรุ่นเก่าตอบ 404 → บอกให้ปิด-เปิดโปรแกรม ไม่ใช่โชว์เลข 404', () => {
  assert.match(PANEL, /โปรแกรมในเครื่องยังเป็นรุ่นเก่า — ปิดโปรแกรมแล้วเปิดใหม่/)
  assert.match(PANEL, /const old = \/\\b404\\b\/\.test\(err\.message\)/)
})

test('เปิดแท็บเองได้เมื่อยังไม่ได้เปิดหน้าสินค้า แล้วปิดคืนให้ · มีแท็บหน้านั้นอยู่แล้วก็ใช้ของเดิม', () => {
  const fn = /async function pullShopeePhotos[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.match(fn, /chrome\.tabs\.create\(\{ url, active: false \}\)/, 'เปิดแบบไม่แย่งหน้าจอผู้ใช้')
  assert.match(fn, /if \(opened\) await chrome\.tabs\.remove/, 'แท็บที่เราเปิดเองต้องเก็บคืน')
  assert.match(fn, /new URL\(tabUrl\)\.pathname === new URL\(url\)\.pathname/, 'ใช้แท็บที่เปิดหน้าสินค้านี้อยู่ก่อน')
  // หน้า Shopee เรนเดอร์รูปด้วย JS ทีหลัง — ถามครั้งเดียวไม่พอ
  assert.match(fn, /attempt < 5/, 'ต้องถามซ้ำจนกว่าหน้าจะเรนเดอร์รูป')
  assert.match(fn, /ยังไม่ได้วางลิ้งสินค้า/, 'ไม่มีลิ้งก็ไม่เปิดแท็บมั่ว')
})

// 23 พ.ย. 2026 ผู้ใช้: "ยังกดสามปุ่มไม่ติดอยู่ดี" — กดได้ แต่ค่าไม่ถูกบันทึก ปุ่มจึงเด้งกลับค่าเดิม
// เพราะเงื่อนไขขาเข้าของบล็อกสินค้าลืมใส่ productProminence ค่าที่ส่งมาเดี่ยวๆ เลยถูกข้ามเงียบๆ
test('ทุกช่องของสินค้าที่แผงข้างส่ง ต้องอยู่ในเงื่อนไขรับค่าของโปรแกรมในเครื่อง', () => {
  const gate = /if \(body\.productUrl !== undefined[^)]*\) \{/.exec(UI)?.[0] ?? ''
  assert.ok(gate, 'ไม่พบเงื่อนไขรับค่าสินค้า')
  // ชื่อช่องที่แผงข้างส่งไปจริง — ดึงจากโค้ดแผงข้าง ไม่ใช่รายการที่พิมพ์ไว้เอง จะได้ไม่ลืมตามเวลาเพิ่มช่องใหม่
  const sent = [...PANEL.matchAll(/saveClipSettings\(\{([^}]*)\}/g)]
    .flatMap((m) => [...m[1].matchAll(/\b(product[A-Z]\w*)\s*:/g)].map((x) => x[1]))
  assert.ok(sent.includes('productProminence'), 'แผงข้างต้องส่ง productProminence')
  for (const field of new Set(sent)) {
    assert.ok(gate.includes(`body.${field} !== undefined`), `โปรแกรมในเครื่องไม่รับ ${field} — กดแล้วจะไม่ติด`)
    assert.ok(UI.includes(`body.${field}`), `ไม่มีโค้ดอ่านค่า ${field}`)
  }
})

test('โปรแกรมในเครื่อง: endpoint รูปสินค้าครบ และแยกจากตั้งค่าสินค้า', () => {
  for (const route of ['/api/product', '/api/product/image', '/api/product/image/delete', '/api/product/pick', '/api/product/clear']) {
    assert.ok(UI.includes(`'${route}'`), `ต้องมี ${route}`)
  }
  assert.match(UI, /prominence: prominenceOf\(c\.script\.product\?\.prominence\)/, 'คืนระดับความเด่นให้แผงข้าง')
  assert.match(UI, /productProminence: Object\.entries\(PROMINENCE\)/, 'ส่งตัวเลือกความเด่นให้แผงข้าง')
})

// เดิมซ่อนกล่องทุกครั้งที่อ่านคลังไม่สำเร็จ → ปุ่มหายไปทั้งแถบ กดอะไรไม่ได้และไม่รู้ว่าทำไม
test('ซ่อนกล่องเฉพาะตอนโปรแกรมในเครื่องรุ่นเก่า · อ่านไม่ได้ด้วยเหตุอื่นต้องยังเห็นปุ่มกับเหตุผล', () => {
  assert.match(PANEL, /let productSupported = null/)
  assert.match(PANEL, /box\.hidden = productSupported === false/, 'ซ่อนเฉพาะตอนไม่รองรับจริง')
  // เช็กเฉพาะกล่องรูป — กล่องตั้งค่าสินค้า (renderProduct) ซ่อนตอน clip.product ไม่มา ซึ่งแปลว่ารุ่นเก่าจริง
  const fn = /function renderProductPhotos[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.ok(!/if \(!p\) return/.test(fn), 'ไม่ซ่อน/ไม่ออกจากฟังก์ชันเพราะคลังว่าง')
  assert.match(fn, /productPhotos \?\? \{ images: \[\], previews: \[\]/, 'คลังว่างให้ render เป็นค่าว่าง ไม่ใช่เลิกทำ')
  assert.ok(PANEL.includes('productSupported = !/\\b404\\b/.test(err.message)'), '404 = รุ่นเก่า · error อื่นยังใช้ได้')
  assert.match(PANEL, /อ่านคลังรูปสินค้าไม่ได้: \$\{err\.message\}/, 'บอกเหตุผลจริง')
  assert.match(PANEL, /row\.hidden = !options\.length/, 'แถวความเด่นซ่อนเมื่อโปรแกรมเก่าไม่ส่งตัวเลือกมา')
})

test('ปุ่มดึงรูปบอกสถานะตัวเอง — กดแล้วไม่เงียบ', () => {
  const fn = /async function fetchProductPhotos[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.match(fn, /btn\.textContent = '⏳ กำลังดึงรูป…'/)
  assert.match(fn, /btn\.disabled = true/)
  // \r?\n: ไฟล์ในโครงการนี้ลงท้ายบรรทัดแบบ CRLF — regex ที่ใช้ \n เฉยๆ จะล้มทั้งที่โค้ดถูก
  assert.match(fn, /finally \{\r?\n    btn\.textContent = label\r?\n    btn\.disabled = false\r?\n  \}/, 'ล้มแล้วต้องคืนปุ่มให้กดซ้ำได้')
})
