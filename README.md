# 烤箱使用管理網站

這是一個可直接打開的第一版原型，功能包含：

- 六台烤箱位置視覺化
- 使用者填入部門、名字、烤箱、開始使用時間、結束使用時間
- 使用時間以月為單位視覺化，每格代表一天
- 可切換上個月/下個月
- 不同烤箱使用不同顏色顯示

## 1. 本機啟動

在此資料夾執行：

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1 -Port 8000
```

然後用瀏覽器開啟：

```text
http://127.0.0.1:8000/
```

## 2. 手機掃 QR 測試

如果手機要掃你電腦上的網站，手機和電腦必須在同一個 Wi-Fi。

先查電腦區網 IP：

```powershell
ipconfig
```

找到類似 `192.168.x.x` 的 IPv4 位址後，用手機開：

```text
http://你的電腦IP:8000/
```

例如：

```text
http://192.168.1.23:8000/
```

目前頁面已移除內建 QR code 區塊。如果之後要讓每台烤箱貼專屬 QR code，可以用外部工具產生以下格式的網址：

```text
http://你的電腦IP:8000/?oven=1
http://你的電腦IP:8000/?oven=2
...
```

## 3. Supabase 雲端同步

網站現在支援 Supabase。若 `config.js` 有填 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`，資料會寫到雲端；若 key 留空，會自動使用本機 `localStorage` 測試模式。

先在 Supabase SQL Editor 執行：

```sql
create table public.oven_bookings (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in ('CCP6', 'NVM')),
  user_name text not null,
  oven_id int not null check (oven_id between 1 and 6),
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.oven_bookings enable row level security;

create policy "Anyone can read bookings"
on public.oven_bookings
for select
to anon
using (true);

create policy "Anyone can create bookings"
on public.oven_bookings
for insert
to anon
with check (true);

create policy "Anyone can delete bookings"
on public.oven_bookings
for delete
to anon
using (true);
```

然後編輯 `config.js`：

```js
window.OVEN_APP_CONFIG = {
  SUPABASE_URL: "https://zkdrixfcysksqsfqannh.supabase.co",
  SUPABASE_ANON_KEY: "貼上你的 anon 或 publishable key",
};
```

不要把 `service_role` key 放進前端。

## 4. 可微調的位置

- 烤箱數量：改 `app.js` 的 `OVEN_COUNT`
- 烤箱時間軸顏色：改 `app.js` 的 `OVEN_COLORS`
- Supabase 設定：改 `config.js`
- 顏色與版面：改 `styles.css`
- 欄位與驗證：改 `index.html` 表單與 `app.js` 的 `handleSubmit`
