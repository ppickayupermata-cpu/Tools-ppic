# PPIC Tools (React + Vite + Neon)

## Cara pakai
1. Salin `.env.example` menjadi `.env` (di folder yang sama dengan `package.json`), lalu isi `DATABASE_URL`, `SESSION_SECRET`, `APP_USERS`.
2. `npm install`
3. `npm run dev` (API di folder `api/` ikut jalan otomatis dan membaca `.env`). Setiap mengubah `.env`, hentikan (Ctrl+C) lalu jalankan ulang.
4. Buka alamat yang muncul. Kalau ada peringatan di halaman login, ikuti pesannya.

## Deploy Vercel
Isi variabel yang sama di Settings > Environment Variables. Untuk `APP_USERS`, tempel array JSON saja tanpa tanda kutip tunggal di luar.
Tabel database dibuat otomatis saat pertama dipakai. Cek `/api/health` untuk memastikan env terbaca.

## Cara kerja data
- Daftar material, kolom SO, dan rencana PO diambil dari Neon sekali, lalu disimpan di cache sesi browser. Refresh tidak get ulang.
- Baris RESERVASI diambil per No. SO yang dipakai di kolom (lazy), dan tiap SO hanya di-get sekali. Tombol "Muat ulang dari database" di menu Upload memaksa ambil ulang.
- Edit stok, PO, dan kolom SO disimpan sebagai draft di layar. Muncul bar "N perubahan belum disimpan" dengan tombol Submit / Batalkan; baru setelah Submit dikirim ke Neon (satu transaksi). Upload: pilih file → periksa ringkasan → Submit.
- Tombol "Tabel RESERVASI" (kanan atas) menampilkan seluruh RESERVASI dari database, per halaman + pencarian. Kolom cari di Stok juga bisa mencari No. SO.
- Upload RESERVASI: mode "Tambah / perbarui per SO" atau "Ganti semua". Upload Data All: STOK SAP + RESERVASI + header RESUME CAT.

## Submit (alur aman)
Perubahan stok/PO/kolom SO berupa draf. Tombol "N perubahan - Tinjau & Submit" membuka layar tinjau: daftar perubahan (sebelum -> sesudah, bisa dibatalkan per item), peringatan/validasi, lalu "Konfirmasi & Submit". Server memeriksa bentrok dengan pengguna lain (409) sebelum menyimpan dalam satu transaksi; tersedia pilihan Muat ulang atau Timpa.
