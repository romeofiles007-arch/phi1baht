// ต้อง import เป็นบรรทัดแรกของไฟล์เทสต์ที่แก้คลังรูปสินค้าหรือคลังตัวละคร
// ให้แต่ละไฟล์เทสต์ (ซึ่ง node --test รันขนานกันคนละโปรเซส) มีโฟลเดอร์ชั่วคราวของตัวเอง
// 23 พ.ย. 2026: เทสต์สองไฟล์สำรอง/ล้าง/คืน characters/product ตัวจริงพร้อมกัน → product.json ของผู้ใช้หาย
// ES module ประมวล import ตามลำดับ ไฟล์นี้จึงตั้งค่าได้ก่อน product.mjs / cast.mjs ถูกโหลด
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = mkdtempSync(join(tmpdir(), 'phi-test-stores-'))
process.env.PHI_PRODUCT_DIR = join(root, 'product')
process.env.PHI_CAST_DIR = join(root, 'cast')
process.on('exit', () => rmSync(root, { recursive: true, force: true }))
