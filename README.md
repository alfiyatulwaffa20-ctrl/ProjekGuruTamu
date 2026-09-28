# TeFa Studio

Aplikasi Teaching Factory untuk pengelolaan order jasa industri, tiket kerja siswa, review deliverable, bagi hasil honor, dan dokumen serah terima. Dibangun dengan Node.js, Express, EJS, Prisma ORM, dan SQLite.

## Menjalankan aplikasi

Persyaratan: Node.js 18+.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run db:setup
npm run dev
```

Buka `http://localhost:3002`. Jika port sudah dipakai, server memilih port berikutnya. `npm run db:setup` membuat/memperbarui tabel SQLite dan menambahkan data demo. Perintah ini aman dijalankan ulang tanpa menggandakan order contoh.

## Akun demo

Semua akun memakai kata sandi `password123`.

| Role | Username | Akses utama |
| --- | --- | --- |
| Admin | `admin` | Katalog layanan, konfigurasi bagi hasil, dan ringkasan omset |
| Project Manager | `projectmanager` | Order klien, verifikasi, penugasan, review, invoice, dan berita acara |
| Siswa Teknisi | `siswateknisi` | Tiket pribadi, status Kanban, bukti hasil, dan rekap honor |
| Siswa Teknisi | `teknisi2` | Akun teknisi kedua untuk uji tim |

Akun demo dapat dipilih cepat dari halaman login. Seed menyimpan password dalam bentuk hash bcrypt.

## Siklus order

1. Project Manager mencatat klien, layanan, nilai, deadline, dan memilih satu atau lebih siswa. Sistem membuat tiket per siswa dan order berstatus `PENDING`.
2. Project Manager memverifikasi order. Status berpindah menjadi `DALAM_PENGERJAAN`.
3. Siswa mengubah tiket ke `IN_PROGRESS`, mengirim tautan hasil dengan status `REVIEW`, atau melanjutkan ke pengerjaan.
4. Project Manager menyetujui setiap tiket yang siap direview. Honor siswa dihitung dari persentase siswa dikali nilai order dan dibagi jumlah tiket. Order menjadi `SELESAI` setelah seluruh tiket disetujui.
5. Project Manager mencetak invoice dan berita acara serah terima melalui tautan pada tabel order.

Persentase siswa dan kas harus berjumlah 100%. Status honor `PENDING`/`CAIR` serta tanggal cair tercatat pada tabel honorarium.

## Akses dan keamanan

Aplikasi memakai session berbasis cookie HTTP-only dan middleware pemeriksaan role pada route sensitif. Pengguna tanpa role yang tepat menerima halaman `403`. Password seed di-hash dengan bcrypt. Untuk deployment, atur `SESSION_SECRET` yang kuat, aktifkan HTTPS, dan gunakan session store persisten.

Database lokal disimpan di `prisma/dev.db` dengan `DATABASE_URL="file:./dev.db"`. Prisma Studio dapat dibuka menggunakan `npm run prisma:studio`.
