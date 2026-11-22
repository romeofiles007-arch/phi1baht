/**
 * ผู้เล่าของฉัน — โหมด "ผู้เล่าเรื่อง (ตัวเราเอง)": เจ้าของช่องเล่าเรื่องจีนโบราณเอง
 * ใช้ที่เก็บเดียวกับ self_monk.mjs (characters/self/) — ไฟล์นี้เป็นชื่อใหม่ของฟังก์ชันชุดเดิม
 */
export {
  SELF_DIR, MAX_SELF_IMAGES, selfMime,
  readSelfMonk as readSelfNarrator,
  selfMonkReady as selfNarratorReady,
  updateSelfMonk as updateSelfNarrator,
  addSelfMonkImage as addSelfNarratorImage,
  removeSelfMonkImage as removeSelfNarratorImage,
} from './self_monk.mjs'

export const SELF_NOT_READY = 'โหมดผู้เล่าเรื่องต้องมีรูปหน้าผู้เล่าก่อน — วางรูปในกล่อง "ผู้เล่าของฉัน" ใต้หมวดเนื้อหาในแผงข้าง (1–4 รูป)'
