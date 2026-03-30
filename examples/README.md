# JSATA Examples

## ไฟล์ตัวอย่าง

- `01-basic-multi-set.html`
  - หลายชุดในหน้าเดียว
  - ใช้ `jsata-group-*` แยกชุด

- `02-default-value-and-language.html`
  - ตั้งค่า default ด้วย `data-jsata-value`
  - สลับภาษาในตอน init (`th`, `en`, `demo`)
  - ใช้ `reinitialize: true` เพื่อ render ซ้ำชุดเดิม

- `03-dynamic-append-and-context.html`
  - append ทีละชุด/หลายชุด
  - load ชุดจาก JSON (`data/address-sets.json`)
  - init ด้วย context หลายแบบ (`#id`, `.class`, DOM, NodeList, jQuery object)

## ก่อนทดสอบ

1. เปิดผ่านเว็บเซิร์ฟเวอร์ (ไม่แนะนำเปิดแบบ `file://` เพราะ `fetch` จะโหลด JSON ไม่ได้)
2. ตรวจ path ให้ถูก:
   - `../jsata-standalone.js`
3. ตรวจว่ามีไฟล์ `address.json` อยู่ระดับ root ของโปรเจกต์ (ตำแหน่งเดียวกับ `jsata-standalone.js`)
