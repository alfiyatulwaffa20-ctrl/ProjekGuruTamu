const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  const password = await bcrypt.hash('password123', 10);
  const [admin, mentor, studentA, studentB] = await Promise.all([
    prisma.user.upsert({ where: { username: 'admin' }, update: {}, create: { username: 'admin', password, nama: 'Kepala Unit TeFa', role: 'ADMIN', telepon: '081234567890' } }),
    prisma.user.upsert({ where: { username: 'projectmanager' }, update: {}, create: { username: 'projectmanager', password, nama: 'Ari Wijaya, S.Kom.', role: 'PROJECT_MANAGER', telepon: '081234567891' } }),
    prisma.user.upsert({ where: { username: 'siswateknisi' }, update: {}, create: { username: 'siswateknisi', password, nama: 'Nadia Putri', role: 'SISWA_TEKNISI', nisn: '0087123456', telepon: '081234567892' } }),
    prisma.user.upsert({ where: { username: 'teknisi2' }, update: {}, create: { username: 'teknisi2', password, nama: 'Rizky Pratama', role: 'SISWA_TEKNISI', nisn: '0087123457', telepon: '081234567893' } })
  ]);

  const serviceSeed = [
    ['Jasa Pembuatan Website UMKM', 'WEB', 3500000, 14],
    ['Instalasi dan Konfigurasi Jaringan', 'JARINGAN', 1800000, 5],
    ['Desain Identitas Visual', 'DESAIN', 950000, 7],
    ['Servis dan Perakitan Komputer', 'HARDWARE', 450000, 3]
  ];
  const services = [];
  for (const [namaLayanan, kategori, hargaDasar, estimasiHari] of serviceSeed) {
    let service = await prisma.service.findFirst({ where: { namaLayanan } });
    if (!service) service = await prisma.service.create({ data: { namaLayanan, kategori, hargaDasar, estimasiHari } });
    services.push(service);
  }

  await prisma.teFaSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, persentaseSiswa: 60, persentaseKas: 40 } });
  if (await prisma.projectOrder.count() === 0) {
    const finished = await prisma.projectOrder.create({ data: {
      nomorOrder: 'TEFA-26090101', namaKlien: 'Kopi Purnama', kontakKlien: '081298765432', serviceId: services[0].id,
      totalBiaya: 3500000, tglMasuk: daysFromNow(-14), deadline: daysFromNow(-2), status: 'SELESAI',
      tasks: { create: [
        { studentId: studentA.id, mentorId: mentor.id, judulTugas: 'Desain dan halaman utama', deskripsi: 'Membangun tampilan responsif untuk profil dan menu.' },
        { studentId: studentB.id, mentorId: mentor.id, judulTugas: 'Integrasi formulir dan QA', deskripsi: 'Memasang formulir kontak dan menguji lintas perangkat.' }
      ] }
    }, include: { tasks: true } });
    for (const task of finished.tasks) {
      await prisma.projectTask.update({ where: { id: task.id }, data: { statusKanban: 'DONE', buktiHasilUrl: 'https://github.com/example/tefa-kopi-purnama' } });
      await prisma.honorarium.create({ data: { taskId: task.id, studentId: task.studentId, nominalHonor: 1050000, statusBayar: 'CAIR', tglCair: daysFromNow(-1) } });
    }

    const active = await prisma.projectOrder.create({ data: {
      nomorOrder: 'TEFA-26090102', namaKlien: 'Klinik Sehat Sentosa', kontakKlien: '081377788899', serviceId: services[2].id,
      totalBiaya: 1200000, tglMasuk: daysFromNow(-3), deadline: daysFromNow(5), status: 'DALAM_PENGERJAAN',
      tasks: { create: [
        { studentId: studentA.id, mentorId: mentor.id, judulTugas: 'Desain materi promosi', deskripsi: 'Menyusun desain poster digital dan materi media sosial.' },
        { studentId: studentB.id, mentorId: mentor.id, judulTugas: 'Pemeriksaan aset desain', deskripsi: 'Memeriksa aset, ukuran, dan konsistensi visual.' }
      ] }
    }, include: { tasks: true } });
    await prisma.projectTask.update({ where: { id: active.tasks[0].id }, data: { statusKanban: 'IN_PROGRESS' } });
  }
  console.log('Seed TeFa berhasil. Login demo: admin, projectmanager, siswateknisi / password123');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
