const bcrypt = require('bcryptjs');
const prisma = require('../models/tefa.model');

const roles = {
  ADMIN: 'Admin TeFa',
  PROJECT_MANAGER: 'Project Manager',
  SISWA_TEKNISI: 'Siswa Teknisi'
};

const makeOrderNumber = () => `TEFA-${Date.now().toString().slice(-8)}`;
const parseId = (value) => Number.parseInt(value, 10);
const spellAmount = (value) => {
  const words = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const say = (amount) => {
    if (amount < 12) return words[amount];
    if (amount < 20) return `${say(amount - 10)} belas`;
    if (amount < 100) return `${say(Math.floor(amount / 10))} puluh${amount % 10 ? ` ${say(amount % 10)}` : ''}`;
    if (amount < 200) return `seratus${amount > 100 ? ` ${say(amount - 100)}` : ''}`;
    if (amount < 1000) return `${say(Math.floor(amount / 100))} ratus${amount % 100 ? ` ${say(amount % 100)}` : ''}`;
    if (amount < 2000) return `seribu${amount > 1000 ? ` ${say(amount - 1000)}` : ''}`;
    if (amount < 1000000) return `${say(Math.floor(amount / 1000))} ribu${amount % 1000 ? ` ${say(amount % 1000)}` : ''}`;
    if (amount < 1000000000) return `${say(Math.floor(amount / 1000000))} juta${amount % 1000000 ? ` ${say(amount % 1000000)}` : ''}`;
    return `${say(Math.floor(amount / 1000000000))} miliar${amount % 1000000000 ? ` ${say(amount % 1000000000)}` : ''}`;
  };
  return `${say(Math.floor(Number(value) || 0))} rupiah`;
};

exports.loginPage = (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Masuk • TeFa', error: '' });
};

exports.login = async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { username: (req.body.username || '').trim() } });
  const valid = user && (user.password.startsWith('$2')
    ? await bcrypt.compare(req.body.password || '', user.password)
    : user.password === req.body.password);
  if (!valid) return res.status(401).render('login', { title: 'Masuk • TeFa', error: 'Username atau kata sandi tidak cocok.' });
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.user = { id: user.id, username: user.username, nama: user.nama, role: user.role };
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      res.redirect('/');
    });
  });
};

exports.logout = (req, res) => req.session.destroy(() => res.redirect('/login'));

exports.dashboard = async (req, res) => {
  const user = req.session.user;
  const where = user.role === 'SISWA_TEKNISI'
    ? { tasks: { some: { studentId: user.id } } }
    : user.role === 'PROJECT_MANAGER'
      ? { tasks: { some: { mentorId: user.id } } }
      : {};
  const [orders, services, students, setting, honors, tasks, paidOrders, activeOrders] = await Promise.all([
    prisma.projectOrder.findMany({ where, include: { service: true, tasks: { include: { student: true, honorarium: true } } }, orderBy: { createdAt: 'desc' } }),
    user.role === 'ADMIN' ? prisma.service.findMany({ orderBy: { namaLayanan: 'asc' } }) : user.role === 'PROJECT_MANAGER' ? prisma.service.findMany({ where: { active: true }, orderBy: { namaLayanan: 'asc' } }) : [],
    user.role === 'PROJECT_MANAGER' ? prisma.user.findMany({ where: { role: 'SISWA_TEKNISI' }, orderBy: { nama: 'asc' } }) : [],
    user.role === 'ADMIN' ? prisma.teFaSetting.findUnique({ where: { id: 1 } }) : null,
    user.role === 'SISWA_TEKNISI' ? prisma.honorarium.findMany({ where: { studentId: user.id }, include: { task: { include: { order: true } } }, orderBy: { createdAt: 'desc' } }) : user.role === 'ADMIN' ? prisma.honorarium.findMany({ include: { student: true, task: { include: { order: true } } }, orderBy: { createdAt: 'desc' } }) : [],
    user.role === 'SISWA_TEKNISI' ? prisma.projectTask.findMany({ where: { studentId: user.id }, include: { order: { include: { service: true } }, honorarium: true }, orderBy: { createdAt: 'desc' } }) : [],
    prisma.projectOrder.aggregate({ where: { status: 'SELESAI' }, _sum: { totalBiaya: true }, _count: true }),
    prisma.projectOrder.count({ where: { status: 'DALAM_PENGERJAAN' } })
  ]);
  res.render('dashboard', {
    title: 'Ringkasan • TeFa', roleLabel: roles[user.role], orders, services, students, setting, honors, tasks,
    stats: { revenue: paidOrders._sum.totalBiaya || 0, completed: paidOrders._count, active: activeOrders, pending: await prisma.projectOrder.count({ where: { status: 'PENDING' } }) }
  });
};

exports.createService = async (req, res) => {
  const { namaLayanan, kategori, hargaDasar, estimasiHari } = req.body;
  if (!namaLayanan?.trim() || !['WEB', 'JARINGAN', 'DESAIN', 'HARDWARE'].includes(kategori) || !Number.isInteger(Number(hargaDasar)) || Number(hargaDasar) < 0 || !Number.isInteger(Number(estimasiHari)) || Number(estimasiHari) < 1) {
    return res.redirect('/?notice=Data%20layanan%20tidak%20valid');
  }
  await prisma.service.create({ data: { namaLayanan: namaLayanan.trim(), kategori, hargaDasar: Number(hargaDasar), estimasiHari: Number(estimasiHari) } });
  res.redirect('/?notice=Layanan%20berhasil%20ditambahkan');
};

exports.updateSettings = async (req, res) => {
  const persentaseSiswa = Number(req.body.persentaseSiswa);
  const persentaseKas = Number(req.body.persentaseKas);
  if (!Number.isInteger(persentaseSiswa) || !Number.isInteger(persentaseKas) || persentaseSiswa < 0 || persentaseKas < 0 || persentaseSiswa + persentaseKas !== 100) {
    return res.redirect('/?notice=Persentase%20harus%20berjumlah%20100');
  }
  await prisma.teFaSetting.upsert({ where: { id: 1 }, update: { persentaseSiswa, persentaseKas }, create: { id: 1, persentaseSiswa, persentaseKas } });
  res.redirect('/?notice=Konfigurasi%20bagi%20hasil%20tersimpan');
};

exports.createOrder = async (req, res) => {
  const serviceId = parseId(req.body.serviceId);
  const studentIds = [...new Set((Array.isArray(req.body.studentIds) ? req.body.studentIds : [req.body.studentIds]).map(parseId).filter(Number.isInteger))];
  const service = await prisma.service.findFirst({ where: { id: serviceId, active: true } });
  const deadline = new Date(req.body.deadline);
  const totalBiaya = req.body.totalBiaya === '' || req.body.totalBiaya == null ? service?.hargaDasar : Number(req.body.totalBiaya);
  if (!service || !req.body.namaKlien?.trim() || !req.body.kontakKlien?.trim() || studentIds.length < 1 || Number.isNaN(deadline.getTime()) || !Number.isInteger(totalBiaya) || totalBiaya < 0) {
    return res.redirect('/?notice=Lengkapi%20data%20order%20dan%20pilih%20minimal%20satu%20siswa');
  }
  const students = await prisma.user.findMany({ where: { id: { in: studentIds }, role: 'SISWA_TEKNISI' } });
  if (students.length !== studentIds.length) return res.redirect('/?notice=Penugasan%20siswa%20tidak%20valid');
  const tasksData = students.map((student) => ({ studentId: student.id, mentorId: req.session.user.id, judulTugas: `${service.namaLayanan} • ${student.nama}`, deskripsi: req.body.deskripsi?.trim() || `Pengerjaan layanan ${service.namaLayanan} untuk ${req.body.namaKlien.trim()}.` }));
  await prisma.projectOrder.create({ data: {
    nomorOrder: makeOrderNumber(), namaKlien: req.body.namaKlien.trim(), kontakKlien: req.body.kontakKlien.trim(), serviceId,
    totalBiaya,
    deadline, status: 'PENDING', tasks: { create: tasksData }
  } });
  res.redirect('/?notice=Order%20dibuat%20dan%20tiket%20ditugaskan');
};

exports.verifyOrder = async (req, res) => {
  const orderId = parseId(req.params.id);
  const order = await prisma.projectOrder.findFirst({ where: { id: orderId, tasks: { some: { mentorId: req.session.user.id } } } });
  if (!order || order.status !== 'PENDING') return res.redirect('/?notice=Order%20tidak%20dapat%20diverifikasi');
  await prisma.projectOrder.update({ where: { id: orderId }, data: { status: 'DALAM_PENGERJAAN' } });
  res.redirect('/?notice=Order%20terverifikasi%20dan%20mulai%20dikerjakan');
};

exports.updateTask = async (req, res) => {
  const taskId = parseId(req.params.id);
  const task = await prisma.projectTask.findFirst({ where: { id: taskId, studentId: req.session.user.id } });
  if (!task) return res.status(404).render('error', { title: 'Tiket tidak ditemukan', code: 404, message: 'Tiket tidak ditemukan pada daftar tugas Anda.' });
  const statusKanban = req.body.statusKanban;
  if (!['TODO', 'IN_PROGRESS', 'REVIEW'].includes(statusKanban)) return res.redirect('/?notice=Status%20tiket%20tidak%20valid');
  const buktiHasilUrl = req.body.buktiHasilUrl?.trim() || null;
  if (buktiHasilUrl && !/^https?:\/\//i.test(buktiHasilUrl)) return res.redirect('/?notice=Tautan%20hasil%20harus%20menggunakan%20HTTP%20atau%20HTTPS');
  if (statusKanban === 'REVIEW' && !buktiHasilUrl) return res.redirect('/?notice=Tambahkan%20tautan%20hasil%20sebelum%20dikirim%20ke%20review');
  await prisma.projectTask.update({ where: { id: taskId }, data: { statusKanban, buktiHasilUrl } });
  res.redirect('/?notice=Perkembangan%20tiket%20tersimpan');
};

exports.approveTask = async (req, res) => {
  const taskId = parseId(req.params.id);
  const task = await prisma.projectTask.findFirst({ where: { id: taskId, mentorId: req.session.user.id }, include: { order: { include: { tasks: true } } } });
  if (!task) return res.status(404).render('error', { title: 'Tiket tidak ditemukan', code: 404, message: 'Tiket yang diminta tidak tersedia.' });
  if (task.statusKanban !== 'REVIEW' || !task.buktiHasilUrl) return res.redirect('/?notice=Tiket%20belum%20siap%20direview');
  const settings = await prisma.teFaSetting.findUnique({ where: { id: 1 } });
  const taskCount = task.order.tasks.length;
  const honor = Math.floor((task.order.totalBiaya * (settings?.persentaseSiswa ?? 60) / 100) / taskCount);
  await prisma.$transaction(async (tx) => {
    await tx.projectTask.update({ where: { id: taskId }, data: { statusKanban: 'DONE', catatanRevisi: req.body.catatanRevisi?.trim() || null } });
    await tx.honorarium.upsert({ where: { taskId }, update: { nominalHonor: honor }, create: { taskId, studentId: task.studentId, nominalHonor: honor } });
    const remaining = await tx.projectTask.count({ where: { orderId: task.orderId, statusKanban: { not: 'DONE' } } });
    if (remaining === 0) await tx.projectOrder.update({ where: { id: task.orderId }, data: { status: 'SELESAI' } });
  });
  res.redirect('/?notice=Deliverable%20disetujui%20dan%20honor%20dihitung');
};

exports.orderDocument = async (req, res) => {
  const order = await prisma.projectOrder.findFirst({ where: { id: parseId(req.params.id), tasks: { some: { mentorId: req.session.user.id } } }, include: { service: true, tasks: { include: { student: true, honorarium: true } } } });
  if (!order) return res.status(404).render('error', { title: 'Order tidak ditemukan', code: 404, message: 'Dokumen untuk order ini tidak tersedia.' });
  res.render('document', { title: `Dokumen • ${order.nomorOrder}`, order, terbilang: spellAmount(order.totalBiaya), documentType: req.params.type === 'ba' ? 'Berita Acara Serah Terima' : 'Invoice / Kuitansi' });
};

exports.updateService = async (req, res) => {
  const id = parseId(req.params.id);
  const { namaLayanan, kategori, hargaDasar, estimasiHari } = req.body;
  if (!Number.isInteger(id) || !namaLayanan?.trim() || !['WEB', 'JARINGAN', 'DESAIN', 'HARDWARE'].includes(kategori) || !Number.isInteger(Number(hargaDasar)) || Number(hargaDasar) < 0 || !Number.isInteger(Number(estimasiHari)) || Number(estimasiHari) < 1) {
    return res.redirect('/?notice=Data%20layanan%20tidak%20valid');
  }
  await prisma.service.update({ where: { id }, data: { namaLayanan: namaLayanan.trim(), kategori, hargaDasar: Number(hargaDasar), estimasiHari: Number(estimasiHari) } });
  res.redirect('/?notice=Katalog%20layanan%20diperbarui');
};

exports.toggleService = async (req, res) => {
  const id = parseId(req.params.id);
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return res.redirect('/?notice=Layanan%20tidak%20ditemukan');
  await prisma.service.update({ where: { id }, data: { active: !service.active } });
  res.redirect('/?notice=Status%20layanan%20diperbarui');
};

exports.payHonor = async (req, res) => {
  const id = parseId(req.params.id);
  const honor = await prisma.honorarium.findUnique({ where: { id } });
  if (!honor) return res.redirect('/?notice=Honorarium%20tidak%20ditemukan');
  await prisma.honorarium.update({ where: { id }, data: { statusBayar: 'CAIR', tglCair: new Date() } });
  res.redirect('/?notice=Honorarium%20ditandai%20cair');
};