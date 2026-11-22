/**
 * กันคำรุนแรง/เปลือยในคำบรรยายช็อตก่อนส่ง Google Flow — ด่านสุดท้ายหลัง Blueprint กฎ 9 และกฎความสยอง
 *
 * spec 2: ภาพโป๊/เปลือย หรือเลือดสาดจน Flow/TikTok ปฏิเสธ = ล้มเหลวแม้ระบบทำงานได้
 *   ห้ามเปลือย/เรื่องเพศ · ห้ามไส้ ศพแหลก บาดแผลชัด · เลือดได้เล็กน้อย (คำว่า "เลือด" เฉยๆ ไม่ตัด)
 *
 * ตัดเฉพาะคำ ไม่แก้ประโยค — คำอื่นและโครง field (SHOT | Chars: | Env: ...) อยู่ครบให้ parser และ Flow ใช้ต่อ
 * ใช้กับคำบรรยายช็อตเท่านั้น (ช็อตในเรื่อง ปก ภาพปริศนา) — ไม่ใช้กับ Style Bible ที่มีกฎ "NO guts, NO nudity" อยู่แล้ว
 * (ตัดคำในกฎห้ามจะทำให้กฎหายไปเอง)
 */

/**
 * คำต้องห้าม — แต่ละ regex จับเฉพาะตัวคำ (match[0] คือคำที่ log ว่าตัดออก)
 * ระวังคำปกติที่หน้าตาคล้ายกัน: ไส้ตะเกียง ไส้เทียน ไส้กรอก ไส้เดือน · โลงศพ งานศพ หลุมศพ เผาศพ · หยดเลือด
 */
export const BANNED_GORE = [
  // ไส้/อวัยวะภายใน (กระสือในเล่มจริงมีไส้ห้อย — ภาพของเราใช้แสงเรืองใต้คอแทน)
  /ไส้(?!ตะเกียง|เทียน|กรอก|เดือน|อั่ว|ดินสอ|ปากกา|ขนม)/g,
  /เครื่องใน|อวัยวะภายใน|ตับไตไส้พุง|ควักตับ|ควักตา|ลูกตาหลุด|ลูกตาถลน/g,
  // เลือดมาก (เลือดหยดเล็กน้อยได้)
  /เลือดสาด|เลือดท่วม|เลือดนอง|นองเลือด|เลือดพุ่ง|เลือดไหลนอง|เลือดอาบ|อาบเลือด|โชกเลือด|ชุ่มเลือด|เลือดโชก|กองเลือด/g,
  // ศพ (ยกเว้นคำพิธี/สถานที่: โลงศพ งานศพ หลุมศพ เผาศพ สวดศพ อาบน้ำศพ)
  /ศพแหลก|ศพเน่า|ซากศพ|(?<!โลง|งาน|หลุม|เผา|สวด|อาบน้ำ|เก็บ|ฝัง)ศพ/g,
  // บาดแผล ร่างกายขาด
  /บาดแผล|แผลเหวอะ|แผลเปิด|แผลฉกรรจ์|แผลสด|เนื้อเปื่อย|เนื้อแหว่ง|กระดูกโผล่|หัวขาด|คอขาด|แขนขาด|ขาขาด|ตัวขาด|ร่างขาด|ชำแหละ|หั่นศพ|แหลกเหลว/g,
  // เปลือย/เรื่องเพศ
  /เปลือย|โป๊(?!ก)|ไม่ใส่เสื้อผ้า|ร่วมรัก|เซ็กซ์|ข่มขืน|ล่วงละเมิดทางเพศ/g,
  // English
  /\b(?:guts|entrails|intestines?|internal organs|innards|gore|gory)\b/gi,
  /\b(?:corpses?|dead bod(?:y|ies)|mutilat\w*|dismember\w*|decapitat\w*|severed|beheaded|disembowel\w*)\b/gi,
  /\b(?:blood (?:splatter|spatter|bath|pool|soaked|spurting|gushing)|bloodbath|pools? of blood|soaked in blood|open wounds?|gaping wounds?|gash(?:es)?)\b/gi,
  /\b(?:nude|naked|nudity|topless|sexual|sexy|lingerie|erotic)\b/gi,
]

/**
 * ตัดคำต้องห้ามออกจากคำบรรยายช็อต
 * @param {string} text
 * @returns {{ text: string, removed: string[] }} removed = คำที่ตัดออก (เรียงตามที่เจอ ไม่ซ้ำ) ให้ผู้เรียก log
 */
export function sanitizeShotPrompt(text) {
  const original = String(text ?? '')
  const removed = []
  let out = original
  for (const re of BANNED_GORE) {
    out = out.replace(re, (word) => {
      if (!removed.includes(word)) removed.push(word)
      return ''
    })
  }
  if (!removed.length) return { text: original, removed }
  // เก็บกวาดช่องว่าง/เครื่องหมายที่เหลือจากคำที่ตัด — ไม่แตะตัวคั่น field " | "
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/(,\s*){2,}/g, ', ')
    .replace(/\(\s*\)/g, '')
    .trim()
  return { text: out, removed }
}
