# Test Cases — TeFa Studio

Jalankan `npm run db:setup` dan `npm run dev`, lalu gunakan akun demo yang tercantum di README. Uji alur berikut secara berurutan. Setelah setiap aksi, pastikan dashboard/tabel menampilkan perubahan dan tidak ada respons server 500.

## TC-01 — Admin menambahkan layanan

1. Login sebagai `admin` / `password123`.
2. Pada katalog, buat layanan `Jasa Pembuatan Landing Page`, kategori `WEB`, tarif `500000`, estimasi `7` hari.
3. Hasil yang diharapkan: layanan muncul di katalog dengan tarif Rp500.000 dan tersedia untuk order Project Manager.

## TC-02 — Project Manager menerima order dan menugaskan tim

1. Login sebagai `projectmanager` / `password123`.
2. Buat order untuk UMKM, pilih layanan Landing Page, masukkan kontak, nilai order, dan deadline.
3. Pilih dua siswa teknisi, termasuk `Nadia Putri` dan `Rizky Pratama`, lalu kirim.
4. Hasil yang diharapkan: order berstatus `PENDING` muncul dengan dua tiket, satu per siswa.
5. Klik **Verifikasi & mulai pengerjaan**. Hasil yang diharapkan: status order menjadi `DALAM_PENGERJAAN`.

## TC-03 — Siswa memperbarui tiket dan mengirim bukti

1. Login sebagai `siswateknisi` / `password123`.
2. Pada tiket order TC-02, ubah status menjadi `IN_PROGRESS`, masukkan URL GitHub hasil web, lalu simpan.
3. Kirim tiket ke QA dengan status `Kirim ke QA / Review`.
4. Hasil yang diharapkan: tiket tampil sebagai `REVIEW` pada akun siswa dan Project Manager, beserta tautan hasil.

## TC-04 — Project Manager menyetujui deliverable

1. Login sebagai `projectmanager`.
2. Pada tiket berstatus `REVIEW`, klik **Setujui hasil**.
3. Ulangi review pada tiket teknisi kedua setelah tiket tersebut dikirim ke review.
4. Hasil yang diharapkan: tiket menjadi `DONE`, honor tercatat tepat satu kali per tiket, dan order menjadi `SELESAI` setelah seluruh tiket selesai.

## TC-05 — Bagi hasil dan dokumen resmi

1. Periksa rekap honor akun siswa. Dengan pembagian demo 60% dan order Rp500.000 berisi dua tiket, setiap siswa memperoleh Rp150.000.
2. Periksa status honor awal `PENDING`; label `CAIR` hanya tampil jika pembayaran dan `tglCair` dicatat melalui database.
3. Login sebagai Project Manager, buka **Invoice** dan **Berita acara** pada order TC-02, lalu gunakan tombol cetak browser.
4. Hasil yang diharapkan: invoice memuat klien, layanan, nilai order, dan nomor order; berita acara memuat pekerjaan dan anggota tim. Tata letak cetak A4 menyembunyikan kontrol navigasi.

## Pengujian RBAC

- Saat login sebagai siswa, buka `POST /services` atau `POST /settings`: akses ditolak dengan HTTP 403.
- Saat login sebagai Admin, akses route order, approval, atau dokumen Project Manager: akses ditolak dengan HTTP 403.
- Tanpa sesi, halaman dashboard mengarahkan ke `/login`.
