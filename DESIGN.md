---
name: ผี 1 บาท
description: 'สตูดิโอทำคลิปเรื่องผีสั้นลายเส้นเล่มละบาท: โรงพิมพ์การ์ตูนผียุค 2520 โทนมืดนวลตา ตัวละครผู้ใหญ่ลายเส้นลงสี'
colors:
  shop-day-bg: '#2b2318'
  shop-day-panel: '#3a2f21'
  shop-day-ink: '#f6ead0'
  shop-day-muted: '#d6c49c'
  shop-day-line: '#8f7b55'
  shop-day-pick: '#4a3b28'
  shop-day-accent: '#ff8a73'
  shop-day-accent-ink: '#1c0d0a'
  shop-night-bg: '#14100c'
  shop-night-panel: '#1f1812'
  shop-night-ink: '#f1e4c4'
  shop-night-muted: '#c4b18a'
  shop-night-line: '#7d6a48'
  shop-night-pick: '#2c2318'
  shop-night-accent: '#ff8a73'
  shop-night-accent-ink: '#140a08'
  status-ok: '#8fd3ad'
  status-warn: '#ecc763'
  status-danger: '#ff9f93'
  dept-chatgpt: '#e9c46a'
  dept-flow: '#ff8a78'
  dept-meta: '#f2a65a'
  dept-voice: '#8fd0b8'
  dept-edit: '#8fb4e8'
  ghost-dark-bg: '#1a0d0e'
  ghost-dark-panel: '#281517'
  ghost-dark-accent: '#ff9a8a'
  saiyasat-dark-bg: '#181226'
  saiyasat-dark-panel: '#221a35'
  saiyasat-dark-accent: '#e6c46e'
  folk-dark-bg: '#121e2d'
  folk-dark-panel: '#1a2a3e'
  folk-dark-accent: '#ffd85c'
  drama-dark-bg: '#10232b'
  drama-dark-panel: '#173039'
  drama-dark-accent: '#9fdcf5'
  comedy-dark-bg: '#181e0d'
  comedy-dark-panel: '#222a14'
  comedy-dark-accent: '#ffe14d'
typography:
  body:
    fontFamily: '"Noto Sans Thai", "Leelawadee UI", system-ui, sans-serif'
    fontSize: 15px
    lineHeight: 1.55
  brand:
    fontSize: 23px
    fontWeight: 750
    lineHeight: 1.4
  headline:
    fontSize: 18px
    fontWeight: 750
    lineHeight: 1.55
  hero-title:
    fontSize: 20px
    lineHeight: 1.55
  hero-sub:
    fontSize: 13px
    lineHeight: 1.65
  hint:
    fontSize: 12px
    lineHeight: 1.7
  terminal:
    fontFamily: Consolas, "Courier New", monospace
    fontSize: 12.5px
    lineHeight: 1.6
rounded:
  field: 9px
  button: 10px
  crew: 12px
  section: 14px
  hero: 16px
  chip: 99px
spacing:
  compact: 8px
  control: 10px
  gap: 12px
  inset: 14px
  section: 16px
  step: 22px
components:
  button-primary:
    backgroundColor: '{colors.shop-night-accent}'
    textColor: '{colors.shop-night-accent-ink}'
    rounded: '{rounded.button}'
    padding: 10px 15px
    height: 44px
  button-ghost:
    backgroundColor: '{colors.shop-night-panel}'
    textColor: '{colors.shop-night-ink}'
    rounded: '{rounded.button}'
    padding: 8px 12px
  card-section:
    backgroundColor: '{colors.shop-night-panel}'
    textColor: '{colors.shop-night-ink}'
    rounded: '{rounded.section}'
    padding: 16px 14px
  crew-selector:
    backgroundColor: '{colors.shop-night-panel}'
    rounded: '{rounded.crew}'
    width: 52px
    height: 52px
---

# Design System: ผี 1 บาท

## Overview

**Creative North Star: "โรงพิมพ์การ์ตูนผียุค 2520 ที่ทำงานกันดึกๆ"**

ผี 1 บาททั้งแอปอยู่ในโรงพิมพ์การ์ตูนเล่มละบาท: กระดาษปรู๊ฟเหลืองหม่น หมึกดำ และแดงชื่อเรื่องแบบปกเล่มละบาท ผู้ใช้เห็นทีมงานห้าคนกำลังทำคลิปเรื่องผีหนึ่งนาที อ่านสถานะและเวลาได้ก่อนชมฉาก ฉากเป็นเพียงบรรยากาศอยู่หลังเนื้อหา ไม่ใช่เครื่องมือเพิ่ม

ภาพทุกภาพเป็นลายเส้นหมึกดำลงสีเต็มแบบปกเล่มละบาท (สีไม้และสีน้ำ เห็นรอยดินสอและเนื้อกระดาษ) ไม่ใช่ 3D ไม่ใช่ขาวดำ ทีมงานทั้งห้าเป็นผู้ใหญ่สัดส่วนธรรมชาติ ไม่มีเด็ก ไม่มี chibi ไม่มีภาพสยองเลือดสาด ห้ามเลียนตราหรือโลโก้ของสำนักพิมพ์จริง

**Key Characteristics:**
- โทนมืดนวลตาทั้งสองโหมด ไม่มีพื้นขาวเด็ดขาด
- โหมดสว่าง = โรงพิมพ์ตอนกลางวัน สว่างกว่าโหมดมืด (ยามดึก) เพียงเล็กน้อย
- หมวดเนื้อหาเปลี่ยนชุดสีทั้งแอป (ผีไทยแดงเลือด ไสยศาสตร์ม่วงกลางคืนกับทอง ฯลฯ) ส่วนแผนกมีสีประจำตัวของตัวเอง
- ทีมผู้ใหญ่ลายเส้นลงสีห้าคน แต่ละคนมี atlas โปร่งใส 4×3 = 12 เฟรมจริง
- แบบฟอร์มบนพื้นทึบ สถานะจริง และการเคลื่อนไหวเฉพาะตอนทำงาน

`extension/category-themes.js` เป็นแหล่งสี ฉาก และตราของหมวด ส่วน `extension/temple.css` และ `extension/agents.css` เป็นแหล่งสีฐานและสีแผนก (ชื่อไฟล์ temple เป็นชื่อเดิมที่คงไว้ ไม่เกี่ยวกับธีม)

## Colors

### Print shop base

| บทบาท | โหมดสว่าง (กลางวัน) | โหมดมืด (ยามดึก) |
| --- | --- | --- |
| bg | `#2b2318` | `#14100c` |
| panel | `#3a2f21` | `#1f1812` |
| ink | `#f6ead0` กระดาษเหลือง | `#f1e4c4` |
| muted | `#d6c49c` | `#c4b18a` |
| line | `#8f7b55` | `#7d6a48` |
| pick | `#4a3b28` | `#2c2318` |
| accent (แดงชื่อเรื่อง) | `#ff8a73` / ink `#1c0d0a` | `#ff8a73` / ink `#140a08` |

`ok` `#8fd3ad`, `warn` `#ecc763`, `danger` `#ff9f93` คงความหมายสถานะเดิมทุกธีม คู่สีข้อความกับพื้น (bg/panel/pick) ต้องมี contrast อย่างน้อย 4.5:1 และมีสคริปต์ทดสอบตรวจ

### สีประจำแผนก

| แผนก | ตัวละคร | สี |
| --- | --- | --- |
| chatgpt เขียนบท | นักเขียนผีสูงวัย + พิมพ์ดีด | เหลืองกระดาษ `#e9c46a` |
| flow วาดภาพ | นักวาดปกเล่มละบาท + ปากกาหมึก | แดงชาดหมึก `#ff8a78` |
| meta แอนิเมชัน (Kie) | คนฉายหนังกลางแปลง + ม้วนฟิล์ม | ส้มหลอดฉาย `#f2a65a` |
| voice เสียงพากย์ | นักพากย์หนังกลางแปลง + ไมค์ | เขียวหยก `#8fd0b8` |
| edit ตัดต่อ | ช่างโรงพิมพ์เย็บเล่ม | ฟ้าหมึก `#8fb4e8` |

สีแผนกใช้กับป้ายชื่อ ขอบกล่อง และปุ่มของขั้นที่แผนกนั้นรับผิดชอบ พื้นของแต่ละแผนกเป็นน้ำตาล/เขียว/น้ำเงินเข้มที่เอนไปทางสีนั้น ยังเป็นโทนมืด

### สีหมวดเนื้อหา

| หมวด | บุคลิกสี |
| --- | --- |
| ผีไทย (หลัก, ใช้กับ "คละหมวด") | แดงเลือดบนน้ำตาลแดงเข้ม กับทองหม่น |
| ไสยศาสตร์และหมอผี | ม่วงกลางคืนกับทองของขลัง |
| นิทานพื้นบ้านและจักรๆ วงศ์ๆ | ฟ้าเข้มกับเหลืองสดแบบปกนครไทย |
| ชีวิตสอนใจ | เขียวน้ำเงินเข้มกับฟ้าอ่อน |
| ตลกบ้านทุ่ง | เขียวมะกอกเข้มกับเหลืองมุก |

**The Category Owns the World Rule.** หมวดที่ผู้ใช้เลือกเป็นเจ้าของชุดสีทั้งแอป การเปลี่ยนแผนกไม่ทับธีมหมวด เปลี่ยนหมวดแล้วเปลี่ยนธีมทันทีและจำค่าข้ามการเปิดใหม่

**The Readable Surface Rule.** ข้อมูล แบบฟอร์ม และปุ่มอยู่บนพื้น `--panel` ทึบ ข้อความไม่วางบนภาพฉากโดยตรง แบนเนอร์มีพื้นไล่สีเข้มรองข้อความเหนือภาพ

## Typography

ใช้ "Noto Sans Thai", "Leelawadee UI", system-ui จากเครื่องผู้ใช้ ไม่โหลดฟอนต์เครือข่าย log จริงใช้ Consolas, "Courier New", monospace

- **Brand** 23px 750 · **Headline** 18px 750 · **Hero title** 20px จำกัดสามบรรทัด · **Body** 15px/1.55 · **Hero sub** 13px/1.65 · **Hint** 12px/1.7 · ตัวเลขค่าใช้จ่ายใช้ tabular-nums

ชื่อบริการ งาน สถานะ และเวลามาจากระบบจริง ไม่ใช้ภาพหรือตัวอย่างอ้างว่าระบบพร้อม

## Layout

เป้าหมายแผงข้าง 360–450px `main` อยู่กลาง กว้างสูงสุด 760px เว้นขอบ 14px ด้านบน 16px และท้าย 108px กล่องส่วนงานห่าง 16px ขั้นทำเองห่าง 22px

ภาพโลก (`world-day` / `world-night` แนวตั้ง 1024×1536px) อยู่บน `body::before` แบบ fixed/cover ไม่รับ pointer ไม่เพิ่มความสูงเอกสาร ทับด้วยฟิล์มสีมืด แบนเนอร์ใช้ภาพเดียวกันกับพื้นไล่สีเข้มรองข้อความ ตัวละครหลักอยู่ซ้าย ข้อความอยู่กลาง ที่ไม่เกิน 380px ตัวละครหลักลดขนาดและขอบ main ลดลง

## Elevation & Depth

ข้อมูลหลักใช้พื้นทึบและเส้นขอบโดยไม่มีเงา เงาเฉพาะแบนเนอร์ แถบทีม tooltip หน้าต่าง และ drop-shadow ตาม alpha ของตัวละคร เงาเป็นสีน้ำตาลเข้มอุ่น ไม่ใช่ดำสนิท

## Shapes

ส่วนงานและ modal มุม 14px แบนเนอร์ 16px ปุ่มและตัวเลือก 10px ปุ่มลูกทีม 12px ช่องกรอก 9px

## Components

- **ปุ่มหลัก** `accent` / `accent-ink` สูงขั้นต่ำ 44px น้ำหนัก 750 hover ผสม ink 12% active ลง 1px
- **ปุ่มรอง** พื้น panel ขอบ line สูงขั้นต่ำ 40px hover ใช้ pick และขอบ accent
- **ช่องกรอก** พื้น panel ขอบ line สูงขั้นต่ำ 42px caret และ focus เป็น accent
- **แถบตัวเลือก** ห่อบรรทัดได้ `aria-pressed=true` ใช้ accent/accent-ink และตัวหนา ไม่พึ่งสีอย่างเดียว
- **ปุ่มลูกทีม** มีชื่อบริการใน accessible label และ tooltip หน้าที่/สถานะ `aria-current=true` เพิ่ม outline
- **log จริง** terminal คงพื้นเข้มและสี severity เดิม

## ทีมผู้ใหญ่และการเคลื่อนไหว

**The Adult Proportions Rule.** ผู้ใหญ่สัดส่วนจริง ศีรษะประมาณ 1 ใน 7 ของความสูง ไม่มีเด็ก หัวโต ตาโต ตุ๊กตา หรือ chibi

| Service ID | ตัวละคร | Atlas |
| --- | --- | --- |
| chatgpt | นักเขียนเรื่องผีสูงวัยหน้าเครื่องพิมพ์ดีด | 1448×1086px |
| flow | นักวาดปกเล่มละบาทจุ่มปากกาหมึก | 1448×1086px |
| meta | คนฉายหนังกลางแปลงหมุนม้วนฟิล์ม | 1448×1086px |
| voice | นักพากย์หนังกลางแปลง/นักเล่าผีทางวิทยุ | 1448×1086px |
| edit | ช่างโรงพิมพ์เย็บเล่ม | 1448×1086px |

ทุก atlas เป็น native RGBA โปร่งใส 4 คอลัมน์ × 3 แถว = 12 เฟรมจริง ช่องละ 362×362px เรียงซ้ายไปขวา บนลงล่าง ตัวละคร อุปกรณ์ กล้อง และตำแหน่งเดียวกันทุกเฟรม ไม่มีข้อความ เส้นตาราง พื้นหลัง หรือเงาพื้น Renderer หาสัดส่วนเฟรมจากขนาดภาพจริงหาร 4 และ 3 จึงไม่ hardcode ขนาดช่อง

- **The Fixed Actor Rule.** ตัวละครอยู่ตำแหน่งคงที่บน stage ไม่ใช้ความสูงข้อความสถานะกำหนดตำแหน่ง
- **The Registered Pose Rule.** `.sea-frame` เป็น viewport คงที่และ `.sprite-pose` เป็นชั้นภาพ ใช้ค่าชดเชยรายเฟรมจาก `sprite-registration.js` (ค่า sha256 ล็อกกับไฟล์ภาพ) ล็อกฐานเก้าอี้/โต๊ะ
- **The Working Frames Rule.** 12 เฟรมเล่นรอบ 1.8 วินาทีด้วย CSS `steps(1, end)` เฉพาะ working; idle/waiting/offline ใช้ภาพนิ่ง หยุดเมื่อซ่อน พ้นจอ หรือผู้ใช้ลดการเคลื่อนไหว (`prefers-reduced-motion`) ไม่มี requestAnimationFrame
- ถามสถานะทุก 3 วินาที ไม่ถามเมื่อ `document.hidden`

## Assets / Provenance

- Prompt สร้างภาพทั้งหมดอยู่ใน `docs/design/phi-*.prompt.txt` (ไอคอน, โลกกลางวัน/กลางคืน, atlas 5 แผนก)
- ภาพต้นฉบับอยู่ที่ `assets/phi-raw/` พร้อมที่มาใน `PROVENANCE.md` (ใช้ prompt ไหน สร้างเมื่อไร) ไฟล์ที่ส่งมอบใน `extension/agents/` และ `extension/icons/` สร้างจากต้นฉบับด้วย `scripts/build-icons.py` และ `scripts/build-sprite-registration.py`
- ไอคอนแอปเป็นปกเล่มละบาทจิ๋วมีหน้าผีกระสือ ชื่อเรื่องแดง และเหรียญ 1 บาท มุมมนโปร่งใส 21% ต้องอ่านออกที่ 16px

## Do's and Don'ts

### Do:
- Do ใช้ `category-themes.js` เป็นแหล่งค่าสีหมวด และคง `category-themes.css` ไว้หลัง `temple.css`
- Do เก็บภาพ สคริปต์ สไตล์ และฟอนต์ระบบไว้ในเครื่อง ไม่เรียกทรัพยากรภายนอก
- Do แสดงชื่อบริการและสถานะเป็นข้อความพร้อมขอบหรือ outline ไม่พึ่งสีอย่างเดียว
- Do คง polling 3 วินาทีและหยุดถามเมื่อซ่อนแผง โดยไม่เพิ่มวง JavaScript เพื่อขยับภาพ

### Don't:
- Don't ใช้พื้นขาวหรือพื้นสว่างจ้า ในโหมดใดๆ
- Don't ใช้ภาพเด็ก ตุ๊กตา chibi หัวโต ตาโต ภาพ 3D หรือภาพขาวดำสำหรับตัวละครและฉาก
- Don't เลียนตราหรือโลโก้ของสำนักพิมพ์จริง
- Don't ให้การเปลี่ยนแผนกเปลี่ยนสีพื้นหรือหมวดที่ผู้ใช้เลือกไว้
- Don't เปลี่ยน bridge, pipeline, prompt เนื้อหา บัญชี ราคา หรือเปิดเครดิต API เพื่อการตกแต่ง
