# JSATA Standalone Library

ไลบรารี JavaScript สำหรับเลือกที่อยู่ไทยแบบลำดับชั้น:
`จังหวัด -> อำเภอ/เขต -> ตำบล/แขวง -> รหัสไปรษณีย์`

รองรับ:
- หลายชุดฟอร์มในหน้าเดียว
- ตั้งค่า default value
- append ฟอร์มใหม่แล้ว init เฉพาะส่วนที่เพิ่ม
- การแปลข้อความหลายภาษา

---

## เริ่มใช้งานเร็ว (สำหรับผู้เริ่มต้น)

### 1) เตรียมไฟล์

อย่างน้อยต้องมี:
- `jsata-standalone.js`
- `address.json`

แนะนำ:
- `lang/th.json`, `lang/en.json` (ถ้าต้องการใช้หลายภาษา)

### 2) วาง HTML ของฟอร์ม

```html
<div class="jsata-group-main">
  <select class="jsata-select-province"></select>
  <select class="jsata-select-district"></select>
  <select class="jsata-select-subdistrict"></select>
  <select class="jsata-select-postalcode"></select>
</div>
```

### 3) include สคริปต์

```html
<script src="/assets/jsata/jsata-standalone.js"></script>
```

เท่านี้ใช้งานได้เลย:
- ระบบจะ auto init ตอน DOM พร้อม
- ถ้าไม่ตั้งค่าอะไรเพิ่ม ระบบจะพยายามโหลด `address.json` อัตโนมัติ

### 4) เปิดผ่านเว็บเซิร์ฟเวอร์

ห้ามเปิดแบบ `file://` เพราะ `fetch` JSON จะไม่ทำงานตามปกติ  
ให้เปิดผ่านเว็บเซิร์ฟเวอร์ เช่น Laragon / Nginx / Apache

---

## ตัวอย่างใช้งานแบบพร้อมคัดลอก

```html
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>JSATA Quick Start</title>
</head>
<body>
  <div class="jsata-group-main">
    <select class="jsata-select-province"></select>
    <select class="jsata-select-district"></select>
    <select class="jsata-select-subdistrict"></select>
    <select class="jsata-select-postalcode"></select>
  </div>

  <script src="/assets/jsata/jsata-standalone.js"></script>
</body>
</html>
```

---

## โครงสร้าง HTML ที่รองรับ

class ที่ต้องใช้:
- จังหวัด: `jsata-select-province`
- อำเภอ/เขต: `jsata-select-district`
- ตำบล/แขวง: `jsata-select-subdistrict`
- รหัสไปรษณีย์: `jsata-select-postalcode`

### หลายชุดในหน้าเดียว

ให้ใส่ `jsata-group-*` เพื่อบอกว่า 4 select ไหนเป็นชุดเดียวกัน

```html
<div class="jsata-group-shipping">
  <select class="jsata-select-province"></select>
  <select class="jsata-select-district"></select>
  <select class="jsata-select-subdistrict"></select>
  <select class="jsata-select-postalcode"></select>
</div>

<div class="jsata-group-billing">
  <select class="jsata-select-province"></select>
  <select class="jsata-select-district"></select>
  <select class="jsata-select-subdistrict"></select>
  <select class="jsata-select-postalcode"></select>
</div>
```

### ค่าเริ่มต้น (default value)

ใช้ `data-jsata-value`:
- `province`, `district`, `subdistrict` ต้องเป็น ID
- `postalcode` ต้องเป็น "รหัสไปรษณีย์" เช่น `10200`

```html
<select class="jsata-select-province" data-jsata-value="10"></select>
<select class="jsata-select-district" data-jsata-value="1001"></select>
<select class="jsata-select-subdistrict" data-jsata-value="100101"></select>
<select class="jsata-select-postalcode" data-jsata-value="10200"></select>
```

---

## เมื่อมีการ append HTML ใหม่ (AJAX/Dynamic UI)

หลัง append เสร็จ ให้เรียก:

```js
window.jsataInit(newContext);
```

ตัวอย่าง `context` ที่ส่งได้:
- selector string: `"#target"`
- DOM element
- `NodeList`
- jQuery object
- `ShadowRoot` (สำหรับ Web Components / Shadow DOM)

ตัวอย่าง:

```js
window.jsataInit("#new-form-section");
```

---

## API หลัก

### `window.jsataInit(context?, options?)`

คืนค่าเป็น `Promise`:

```js
{
  sets: number, // จำนวนชุดที่ถูก initialize รอบนั้น
  lang: string  // slug ภาษาที่ใช้
}
```

ตัวอย่าง:

```js
window.jsataInit(document);
window.jsataInit("#target", { lang: "en" });
window.jsataInit({ context: "#target", lang: "demo", reinitialize: true });
```

### Alias
- `window.jsataRefresh(context?, options?)` (เทียบเท่า `jsataInit`)

### Utility object
- `window.jsata.init`
- `window.jsata.refresh`
- `window.jsata.loadAddressData`
- `window.jsata.loadLanguage`
- `window.jsata.getAddressIndex`
- `window.jsata.getLanguagePack`

---

## Advanced: การตั้งค่าแบบละเอียด

ตั้งค่าผ่าน:
- `window.jsataConfig` (global default)
- `options` ตอนเรียก `jsataInit` (override เฉพาะรอบนั้น)

### ค่าที่รองรับ

| key | type | ใช้เมื่อ | ตัวอย่าง |
|---|---|---|---|
| `addressUrl` / `dataUrl` | `string` | อยากบังคับ URL ของ `address.json` | `"/data/address.json"` |
| `data` | `object` | อยากส่ง address object โดยตรง (ไม่ fetch) | `{ ... }` |
| `lang` / `language` | `string` | กำหนดภาษาที่ใช้ | `"th"`, `"en"`, `"demo"` |
| `langBaseUrl` | `string` | ระบุ base path ไฟล์ภาษา | `"/assets/lang/"` |
| `langUrl` | `string` | ระบุไฟล์ภาษาแบบตรงๆ | `"/assets/lang/custom.json"` |
| `langUrls` | `object` | map slug -> URL | `{ en: "/lang/en.json" }` |
| `langUrlTemplate` | `string` | template URL ภาษา | `"/lang/{lang}.json"` |
| `langData` | `object` | ส่ง language pack ตรงๆ | `{ slug: "en", ... }` |
| `autoInit` | `boolean` | ปิด auto init | `false` |
| `reinitialize` | `boolean` | force render ใหม่ชุดเดิม | `true` |

### ตัวอย่าง config พื้นฐาน

```html
<script>
  window.jsataConfig = {
    lang: "th"
  };
</script>
<script src="/assets/jsata/jsata-standalone.js"></script>
```

### ตัวอย่าง override ตอนเรียก init

```js
window.jsataInit("#section-a", { lang: "en" });
window.jsataInit("#section-b", { reinitialize: true, lang: "demo" });
```

### ตัวอย่างส่ง data ตรง (ไม่ fetch)

```html
<script>
  window.jsataConfig = {
    data: window.MY_ADDRESS_DATA
  };
</script>
```

---

## ลำดับการเลือกแหล่งข้อมูล (Priority)

### Address Data
1. `options.data`
2. `window.jsataConfig.data`
3. `options.addressUrl` / `options.dataUrl`
4. `window.jsataConfig.addressUrl` / `window.jsataConfig.dataUrl`
5. fallback: auto load `address.json`

### Language
1. `options.langData`
2. `window.jsataConfig.langData`
3. `options.langUrl` / `window.jsataConfig.langUrl`
4. `langUrls` / `langUrlTemplate` / `langBaseUrl`
5. fallback: default pack (`th`/`en`)

---

## Event Integration

### Native event

```js
document.dispatchEvent(
  new CustomEvent("jsata:init", {
    detail: { context: "#target", lang: "en" }
  })
);
```

### jQuery event

```js
$(document).trigger("jsata:init", ["#target", { lang: "en" }]);
```

---

## หมายเหตุด้านประสิทธิภาพ

- ปลอดภัยที่จะ include script ทุกหน้า  
  ถ้าหน้านั้นไม่มี field ที่เกี่ยวข้อง ระบบจะข้ามการโหลด data/lang
- เหมาะกับการเรียก `jsataInit(...)` ซ้ำหลัง append ฟอร์มใหม่

---

## Troubleshooting

1. dropdown ว่าง
- ตรวจว่าเปิดผ่านเว็บเซิร์ฟเวอร์ (ไม่ใช่ `file://`)
- ตรวจว่า `address.json` เข้าถึงได้จริง (HTTP 200)
- ตรวจ class ของ `select` ให้ตรงตามที่กำหนด

2. default value ไม่ขึ้น
- ตรวจว่าใช้ ID ถูกต้องสำหรับ province/district/subdistrict
- ตรวจว่า postalcode ใช้รหัสไปรษณีย์ เช่น `10200`
- ตรวจว่าค่าทั้งชุดสัมพันธ์กันตามลำดับชั้น

3. สลับภาษาแล้ว UI ไม่เปลี่ยน
- เรียก init พร้อม `reinitialize: true`

```js
window.jsataInit("#target", { lang: "en", reinitialize: true });
```

---

## ตัวอย่างในโปรเจกต์

- `examples/01-basic-multi-set.html`
- `examples/02-default-value-and-language.html`
- `examples/03-dynamic-append-and-context.html`

