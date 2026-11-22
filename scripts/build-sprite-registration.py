"""ล็อกพื้นยืนของตัวละคร 12 เฟรม

อ่าน atlas โปร่งใส 4x3 ของทุกแผนกจาก extension/agents/china-<id>.png
วัดขอบล่างของพิกเซลที่ไม่โปร่งใสในแต่ละเฟรม (เป็น % ของความสูงช่อง)
แล้วเขียนค่าชดเชยให้ทุกเฟรมยืนบนพื้นระดับเดียวกัน — ตัวละครจะไม่เด้งขึ้นลงเวลาเล่นแอนิเมชัน

ผลลัพธ์ 2 ไฟล์:
  extension/sprite-registration.json  ข้อมูลที่วัดได้ + sha256 ของ PNG (ให้ scripts/test-sprite-registration.mjs ตรวจ)
  extension/sprite-registration.js    ค่าที่ส่วนขยายใช้จริงตอนรัน

รัน:  python scripts/build-sprite-registration.py     (ต้องมี Pillow)
ต้องรันใหม่ทุกครั้งที่สร้าง atlas ตัวละครใหม่ (scripts/build-icons.py)
"""
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IDS = ['chatgpt', 'flow', 'meta', 'voice', 'edit']
COLS, ROWS = 4, 3
FRAMES = COLS * ROWS


def floors_of(path):
    """ขอบล่างของตัวละครในแต่ละเฟรม เป็น % ของความสูงช่อง"""
    im = Image.open(path).convert('RGBA')
    width, height = im.size
    alpha = im.split()[3]
    cell_w, cell_h = width / COLS, height / ROWS
    out = []
    for index in range(FRAMES):
        row, col = divmod(index, COLS)
        cell = alpha.crop((
            int(round(col * cell_w)), int(round(row * cell_h)),
            int(round((col + 1) * cell_w)), int(round((row + 1) * cell_h)),
        ))
        box = cell.getbbox()
        bottom = box[3] if box else cell.size[1]
        out.append(round(bottom * 100.0 / cell.size[1], 5))
    return width, height, out


def main():
    characters = {}
    for cid in IDS:
        path = ROOT / 'extension' / 'agents' / f'china-{cid}.png'
        width, height, floors = floors_of(path)
        reference = round(sum(floors) / len(floors), 5)
        frames = []
        for source in floors:
            y = round(reference - source, 5)
            frames.append({
                'scale': 1, 'x': 0, 'y': y,
                'sourceFloor': source,
                'registeredFloor': round(source + y, 5),
                'error': round(abs(source + y - reference), 5),
                'unregisteredError': round(abs(source - reference), 5),
            })
        characters[cid] = {
            'image': f'agents/china-{cid}.png',
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'width': width, 'height': height,
            'referenceFloor': reference,
            'frames': frames,
        }
        worst = max(f['unregisteredError'] for f in frames)
        print(f'{cid}: พื้นอ้างอิง {reference}% · เบี่ยงมากสุดก่อนปรับ {worst}%')

    doc = {
        'version': 2,
        'description': 'วัดพื้นยืนของตัวละครจีนทั้ง 12 เฟรมจากพิกเซลจริงใน extension/agents/china-*.png '
                       'แล้วล็อกให้พื้นอยู่ระดับเดียวกันทุกเฟรม (สร้างด้วย scripts/build-sprite-registration.py)',
        'characters': characters,
    }
    json_path = ROOT / 'extension' / 'sprite-registration.json'
    io.open(json_path, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(doc, ensure_ascii=False, indent=2) + '\n')

    pose = {cid: [{'scale': f['scale'], 'x': f['x'], 'y': f['y']} for f in c['frames']]
            for cid, c in characters.items()}
    js_path = ROOT / 'extension' / 'sprite-registration.js'
    io.open(js_path, 'w', encoding='utf-8', newline='\n').write(
        '// สร้างจาก extension/sprite-registration.json ด้วย scripts/build-sprite-registration.py — ไฟล์ PNG ไม่ถูกแก้\n'
        'export const SPRITE_REGISTRATION = ' + json.dumps(pose, ensure_ascii=False, indent=2) + '\n')
    print(f'เขียนแล้ว: {json_path.name} และ {js_path.name}')


if __name__ == '__main__':
    main()
