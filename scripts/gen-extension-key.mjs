// สร้างคีย์ extension ของ "ผี 1 บาท" (รันครั้งเดียว) — ให้ extension ID คงที่ ไม่ซ้ำกับแอปอื่น
//   node scripts/gen-extension-key.mjs
// public key (SPKI DER base64) → extension/manifest.json "key" · private key → native/.keys/extension.pem (ห้าม commit)
// ID → native/extension-id.txt
import { generateKeyPairSync, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PEM = join(ROOT, 'native', '.keys', 'extension.pem')
const MANIFEST = join(ROOT, 'extension', 'manifest.json')
if (existsSync(PEM) && !process.argv.includes('--force')) {
  console.error('มี native/.keys/extension.pem อยู่แล้ว — ไม่สร้างทับ (ID จะเปลี่ยน) ใช้ --force ถ้าตั้งใจ')
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const der = publicKey.export({ type: 'spki', format: 'der' })
const key = der.toString('base64')
// ID ที่ Chrome ให้ extension ที่มี key: sha256(DER) 32 ตัวแรกของ hex แปลง 0–f เป็น a–p
const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')

mkdirSync(dirname(PEM), { recursive: true })
writeFileSync(PEM, privateKey.export({ type: 'pkcs8', format: 'pem' }))

const raw = readFileSync(MANIFEST, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const manifest = JSON.parse(raw)
manifest.key = key
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2).replace(/\n/g, eol) + eol)
writeFileSync(join(ROOT, 'native', 'extension-id.txt'), id + eol)
console.log(`extension ID: ${id}`)
