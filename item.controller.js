const prisma = require('../config/db');

// 1. Tampilkan Katalog Busana dengan Fitur Pencarian & Filter
exports.getAllItems = async (req, res) => {
  try {
    const { search, category, status } = req.query;

    const whereClause = {};

    // Filter Pencarian (Nama atau Kode)
    if (search && search.trim() !== '') {
      whereClause.OR = [
        { name: { contains: search.trim() } },
        { code: { contains: search.trim() } }
      ];
    }

    // Filter Kategori
    if (category && category !== 'ALL') {
      whereClause.category = category;
    }

    // Filter Status Ketersediaan
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const items = await prisma.item.findMany({
      where: whereClause,
      orderBy: { id: 'desc' }
    });

    // Ambil daftar kategori unik untuk dropdown filter
    const categories = ['Kebaya', 'Jas Formal', 'Gaun Pengantin', 'Beskap Adat', 'Aksesoris'];

    res.render('items/index', {
      title: 'Katalog Koleksi Busana — SEWA AJA',
      currentPage: 'items',
      items,
      categories,
      query: {
        search: search || '',
        category: category || 'ALL',
        status: status || 'ALL'
      }
    });
  } catch (error) {
    console.error('Error getAllItems:', error);
    res.status(500).send('Terjadi kesalahan memuat katalog busana: ' + error.message);
  }
};

// 2. Form Tambah Busana Baru
exports.getCreateItem = (req, res) => {
  res.render('items/create', {
    title: 'Tambah Koleksi Busana Baru — SEWA AJA',
    currentPage: 'items',
    error: null
  });
};

// 3. Simpan Busana Baru dari Form POST
exports.createItem = async (req, res) => {
  try {
    const { code, name, category, size, rentalPrice, stock, description } = req.body;

    // Cek duplikasi kode busana
    const existing = await prisma.item.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    if (existing) {
      return res.render('items/create', {
        title: 'Tambah Koleksi Busana Baru — SEWA AJA',
        currentPage: 'items',
        error: `Kode busana "${code}" sudah digunakan oleh item: ${existing.name}. Gunakan kode lain!`,
        values: req.body
      });
    }

    await prisma.item.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category,
        size: size || 'All Size',
        rentalPrice: Number(rentalPrice),
        stock: stock ? Number(stock) : 1,
        status: 'AVAILABLE',
        description: description ? description.trim() : null
      }
    });

    res.redirect('/items?success=Item+berhasil+ditambahkan');
  } catch (error) {
    console.error('Error createItem:', error);
    res.render('items/create', {
      title: 'Tambah Koleksi Busana Baru — SEWA AJA',
      currentPage: 'items',
      error: 'Gagal menambahkan busana: ' + error.message,
      values: req.body
    });
  }
};

// 4. Form Edit Busana
exports.getEditItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.item.findUnique({
      where: { id: Number(id) }
    });

    if (!item) {
      return res.status(404).send('Busana tidak ditemukan.');
    }

    res.render('items/edit', {
      title: `Edit ${item.name} — SEWA AJA`,
      currentPage: 'items',
      item,
      error: null
    });
  } catch (error) {
    console.error('Error getEditItem:', error);
    res.status(500).send('Terjadi kesalahan memuat data busana: ' + error.message);
  }
};

// 5. Perbarui Data Busana (POST /items/edit/:id)
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, category, size, rentalPrice, stock, status, description } = req.body;

    await prisma.item.update({
      where: { id: Number(id) },
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category,
        size: size || 'All Size',
        rentalPrice: Number(rentalPrice),
        stock: Number(stock) || 1,
        status,
        description: description ? description.trim() : null
      }
    });

    res.redirect('/items?success=Item+berhasil+diperbarui');
  } catch (error) {
    console.error('Error updateItem:', error);
    res.status(400).send('Gagal memperbarui busana: ' + error.message);
  }
};

// 6. Hapus Busana dari Katalog
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah item sedang terikat pada transaksi sewa aktif
    const activeRentals = await prisma.rentalItem.findFirst({
      where: {
        itemId: Number(id),
        rentalTransaction: {
          rentalStatus: { in: ['BOOKING', 'DIAMBIL'] }
        }
      }
    });

    if (activeRentals) {
      return res.redirect('/items?error=Busana+tidak+bisa+dihapus+karena+sedang+disewa+dalam+transaksi+aktif');
    }

    await prisma.item.delete({
      where: { id: Number(id) }
    });

    res.redirect('/items?success=Busana+berhasil+dihapus');
  } catch (error) {
    console.error('Error deleteItem:', error);
    res.redirect('/items?error=Gagal+menghapus+busana:+' + encodeURIComponent(error.message));
  }
};

// 7. Toggle Status Cepat (AVAILABLE <-> LAUNDRY)
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.item.findUnique({ where: { id: Number(id) } });
    if (!item) return res.redirect('/items');

    let nextStatus = 'AVAILABLE';
    if (item.status === 'AVAILABLE') nextStatus = 'LAUNDRY';
    else if (item.status === 'LAUNDRY') nextStatus = 'AVAILABLE';

    await prisma.item.update({
      where: { id: Number(id) },
      data: { status: nextStatus }
    });

    res.redirect('/items');
  } catch (error) {
    console.error('Error toggleStatus:', error);
    res.redirect('/items');
  }
};
