# JSATA Standalone Library

ไฟล์หลัก: `jsata-standalone.js`  
ไลบรารี JavaScript สำหรับเลือกที่อยู่ไทยแบบลำดับชั้น:
`จังหวัด -> อำเภอ/เขต -> ตำบล/แขวง -> รหัสไปรษณีย์`

## โครงสร้างไฟล์ที่เกี่ยวข้อง

- `jsata-standalone.js` logic หลัก
- `lang/*.json` ไฟล์ภาษา (ตัวอย่าง: `th.json`, `en.json`, `demo.json`)
- `examples/*.html` ตัวอย่างการใช้งาน
- `address.json` ข้อมูลที่อยู่ (กำหนด path ผ่าน config)

## วิธีการทำงาน

1. อ่านค่า config จาก `window.jsataConfig` และ options ตอนเรียก `jsataInit(...)`
2. โหลดข้อมูลที่อยู่จาก `data` หรือ `addressUrl`/`dataUrl` แล้วสร้าง index ในหน่วยความจำ
3. โหลดภาษา (`langData`, `langUrl`, `langUrls`, `langBaseUrl`, `langUrlTemplate`) พร้อม fallback
4. ค้นหา field ใน context แล้วจับคู่เป็นชุดด้วย `jsata-group-*` (ถ้ามี)
5. render options ตามลำดับชั้น และ apply ค่าเริ่มต้นจาก `data-jsata-value`
6. bind event `change` เพื่ออัปเดต dropdown ลูกเมื่อเลือก dropdown แม่
7. รองรับการเรียก init ซ้ำสำหรับ element ที่ append เข้ามาทีหลัง

## โครงสร้าง HTML ขั้นต่ำ

```html
<div class="jsata-group-shipping">
  <select class="jsata-select-province" data-jsata-value=""></select>
  <select class="jsata-select-district" data-jsata-value=""></select>
  <select class="jsata-select-subdistrict" data-jsata-value=""></select>
  <select class="jsata-select-postalcode" data-jsata-value=""></select>
</div>
```

## เรียกใช้งานพื้นฐาน

```html
<script>
  window.jsataConfig = {
    addressUrl: "/path/to/address.json",
    lang: "th"
  };
</script>
<script src="/path/to/jsata-standalone.js"></script>
```

ระบบจะ auto init เมื่อ DOM พร้อม  
ปิดได้ด้วย `autoInit: false`

## API

- `window.jsataInit(context?, options?)`
- `window.jsataRefresh(context?, options?)` (alias)
- `window.jsata` object:
  - `init`
  - `refresh`
  - `loadAddressData`
  - `loadLanguage`
  - `getAddressIndex`
  - `getLanguagePack`

ตัวอย่าง:

```js
window.jsataInit(document, { lang: "en", reinitialize: true });
window.jsataInit("#target", { lang: "th" });
window.jsataInit({ context: "#target", lang: "demo", reinitialize: true });
```

## Config ที่รองรับ (`window.jsataConfig`)

- `addressUrl` หรือ `dataUrl`: URL ของ `address.json`
- `data`: ส่ง address object โดยตรง (ไม่ fetch)
- `lang`: ภาษาเริ่มต้น
- `langBaseUrl`: base path ของไฟล์ภาษา เช่น `/assets/lang/`
- `langUrl`: ระบุไฟล์ภาษาแบบตรง ๆ เช่น `/assets/lang/custom.json`
- `langUrls`: map ระหว่าง slug กับ URL
- `langUrlTemplate`: template เช่น `/assets/lang/{lang}.json`
- `langData`: ใส่ language pack object โดยตรง
- `autoInit`: `false` เพื่อปิด init อัตโนมัติ

## รูปแบบไฟล์ภาษา

```json
{
  "slug": "en",
  "nameSource": "en",
  "labels": {
    "nodata": "No data",
    "province": "Select province",
    "district": "Select district",
    "subdistrict": "Select subdistrict",
    "postalcode": "Select postal code"
  }
}
```

ความหมาย:

- `slug`: slug ภาษา
- `nameSource`: แหล่งชื่อพื้นที่จาก `address.json` (`th` หรือ `en`)
- `labels`: ข้อความ placeholder ของ dropdown

## ค่าเริ่มต้น (`data-jsata-value`)

- `province`, `district`, `subdistrict` ต้องใส่เป็น ID
- `postalcode` ใส่เป็นรหัสไปรษณีย์ เช่น `10200`
- ค่าต้องสัมพันธ์กันตามลำดับชั้น

## Event

- Native:
  - `document.dispatchEvent(new CustomEvent("jsata:init", { detail: { context: "#target", lang: "en" } }))`
- jQuery:
  - `$(document).trigger("jsata:init", ["#target", { lang: "en" }]);`

## ตัวอย่าง

- `examples/01-basic-multi-set.html`
- `examples/02-default-value-and-language.html`
- `examples/03-dynamic-append-and-context.html`

## หมายเหตุการทดสอบ

- เปิดผ่านเว็บเซิร์ฟเวอร์ (ไม่แนะนำ `file://`) เพราะมีการ `fetch` ไฟล์ JSON
