const prisma = require('../config/db');

// Helper generator kode transaksi acak: SE-XXXXX
function generateTransactionCode() {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `SE-${randomNum}`;
}

// 1. Tampilkan Daftar Seluruh Transaksi Persewaan ("Cek Sewaan")
exports.getAllRentals = async (req, res) => {
  try {
    const { status, search } = req.query;

    const whereClause = {};

    if (status && status !== 'ALL') {
      whereClause.rentalStatus = status;
    }

    if (search && search.trim() !== '') {
      whereClause.OR = [
        { transactionCode: { contains: search.trim() } },
        { customer: { name: { contains: search.trim() } } },
        { customer: { phone: { contains: search.trim() } } }
      ];
    }

    const rentals = await prisma.rentalTransaction.findMany({
      where: whereClause,
      orderBy: { id: 'desc' },
      include: {
        customer: true,
        rentalItems: {
          include: { item: true }
        }
      }
    });

    const today = new Date();

    // Tandai status telat pengembalian
    const processedRentals = rentals.map((r) => {
      const isOverdue = r.rentalStatus === 'DIAMBIL' && new Date(r.returnDate) < today;
      return {
        ...r,
        isOverdue
      };
    });

    res.render('rentals/index', {
      title: 'Daftar Transaksi Persewaan — SEWA AJA',
      currentPage: 'rentals',
      rentals: processedRentals,
      query: {
        status: status || 'ALL',
        search: search || ''
      }
    });
  } catch (error) {
    console.error('Error getAllRentals:', error);
    res.status(500).send('Terjadi kesalahan memuat data transaksi: ' + error.message);
  }
};

// 2. Formulir Transaksi Sewa Baru ("Transaksi Sewa")
exports.getCreateRental = async (req, res) => {
  try {
    // Ambil busana yang statusnya AVAILABLE
    const availableItems = await prisma.item.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: { category: 'asc' }
    });

    // Tanggal default: Ambil (Besok H-1), Pakai (Lusa Hari H), Pulang (3 hari lagi H+1)
    const now = new Date();
    const pickupDateDefault = new Date(now);
    pickupDateDefault.setDate(now.getDate() + 1);

    const eventDateDefault = new Date(now);
    eventDateDefault.setDate(now.getDate() + 2);

    const returnDateDefault = new Date(now);
    returnDateDefault.setDate(now.getDate() + 3);

    const toInputDate = (d) => d.toISOString().split('T')[0];

    res.render('rentals/create', {
      title: 'Buat Transaksi Sewa Baru — SEWA AJA',
      currentPage: 'rentals',
      availableItems,
      defaultDates: {
        pickup: toInputDate(pickupDateDefault),
        event: toInputDate(eventDateDefault),
        return: toInputDate(returnDateDefault)
      },
      generatedCode: generateTransactionCode(),
      error: null
    });
  } catch (error) {
    console.error('Error getCreateRental:', error);
    res.status(500).send('Terjadi kesalahan memuat form sewa: ' + error.message);
  }
};

// 3. Proses Simpan Transaksi Sewa Baru (POST /rentals)
exports.createRental = async (req, res) => {
  try {
    const {
      transactionCode,
      customerName,
      customerPhone,
      customerAddress,
      idCardNumber,
      customerGuarantee,
      pickupDate,
      eventDate,
      returnDate,
      itemIds, // Bisa berupa array atau string jika hanya 1
      additionalCharge,
      discount,
      paidAmount,
      paymentMethod,
      fittingNotes
    } = req.body;

    // 1. Validasi pemilihan busana
    if (!itemIds) {
      throw new Error('Wajib memilih minimal satu busana yang akan disewa!');
    }

    const selectedIds = Array.isArray(itemIds) ? itemIds.map(Number) : [Number(itemIds)];

    // 2. Ambil data item terpilih
    const items = await prisma.item.findMany({
      where: { id: { in: selectedIds } }
    });

    if (items.length === 0) {
      throw new Error('Busana yang dipilih tidak valid atau sudah tidak tersedia.');
    }

    // Hitung total harga dasar
    const totalBasePrice = items.reduce((sum, it) => sum + it.rentalPrice, 0);
    const charge = Number(additionalCharge) || 0;
    const disc = Number(discount) || 0;
    const finalPrice = Math.max(0, totalBasePrice + charge - disc);
    const paid = Number(paidAmount) || 0;

    // Validasi DP Minimal Rp 50.000
    if (paid < 50000 && paid < finalPrice) {
      throw new Error('Uang muka (DP) minimal sebesar Rp 50.000!');
    }

    const remainingAmount = Math.max(0, finalPrice - paid);
    const paymentType = remainingAmount === 0 ? 'LUNAS' : 'DP';

    // 3. Buat Customer (atau update jika sudah pernah ada nomor HP sama)
    let customer = await prisma.customer.findFirst({
      where: { phone: customerPhone.trim() }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress ? customerAddress.trim() : null,
          idCardNumber: idCardNumber ? idCardNumber.trim() : null
        }
      });
    }

    // 4. Jalankan Transaksi Database: Buat RentalTransaction + RentalItems + Update Status Item ke RENTED
    const code = transactionCode || generateTransactionCode();

    const createdTrx = await prisma.$transaction(async (tx) => {
      const trx = await tx.rentalTransaction.create({
        data: {
          transactionCode: code,
          customerId: customer.id,
          cashierName: 'Seli (Kasir)',
          pickupDate: new Date(pickupDate),
          eventDate: new Date(eventDate),
          returnDate: new Date(returnDate),
          totalBasePrice,
          additionalCharge: charge,
          discount: disc,
          finalPrice,
          paidAmount: paid,
          remainingAmount,
          paymentType,
          paymentMethod: paymentMethod || 'TUNAI',
          rentalStatus: 'BOOKING',
          customerGuarantee: customerGuarantee || 'E-KTP',
          fittingNotes: fittingNotes ? fittingNotes.trim() : null,
          rentalItems: {
            create: items.map((it) => ({
              itemId: it.id,
              priceAtRent: it.rentalPrice,
              itemCustomNote: null
            }))
          }
        }
      });

      // Update status item busana menjadi RENTED
      await tx.item.updateMany({
        where: { id: { in: selectedIds } },
        data: { status: 'RENTED' }
      });

      return trx;
    });

    res.redirect(`/rentals/${createdTrx.id}?success=Transaksi+sewa+berhasil+dibuat`);
  } catch (error) {
    console.error('Error createRental:', error);
    // Kembalikan ke halaman form sewa dengan pesan error
    const availableItems = await prisma.item.findMany({
      where: { status: 'AVAILABLE' }
    });
    res.render('rentals/create', {
      title: 'Buat Transaksi Sewa Baru — SEWA AJA',
      currentPage: 'rentals',
      availableItems,
      defaultDates: {
        pickup: req.body.pickupDate || '',
        event: req.body.eventDate || '',
        return: req.body.returnDate || ''
      },
      generatedCode: req.body.transactionCode || generateTransactionCode(),
      error: error.message
    });
  }
};

// 4. Detail Transaksi & Cetak Nota Digital
exports.getRentalDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const rental = await prisma.rentalTransaction.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        rentalItems: {
          include: { item: true }
        }
      }
    });

    if (!rental) {
      return res.status(404).send('Transaksi tidak ditemukan.');
    }

    const today = new Date();
    const isOverdue = rental.rentalStatus === 'DIAMBIL' && new Date(rental.returnDate) < today;

    res.render('rentals/detail', {
      title: `Nota Sewa #${rental.transactionCode} — SEWA AJA`,
      currentPage: 'rentals',
      rental,
      isOverdue,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error getRentalDetail:', error);
    res.status(500).send('Terjadi kesalahan memuat detail transaksi: ' + error.message);
  }
};

// 5. Update Status Transaksi (Ambil, Pelunasan, Selesai Pengembalian, Batal)
exports.updateRentalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, penaltyFee } = req.body;

    const rental = await prisma.rentalTransaction.findUnique({
      where: { id: Number(id) },
      include: { rentalItems: true }
    });

    if (!rental) {
      return res.status(404).send('Transaksi tidak ditemukan.');
    }

    const itemIds = rental.rentalItems.map((ri) => ri.itemId);

    if (action === 'AMBIL') {
      // Pelanggan mengambil busana di toko pada H-1
      await prisma.rentalTransaction.update({
        where: { id: Number(id) },
        data: { rentalStatus: 'DIAMBIL' }
      });
    } else if (action === 'PELUNASAN') {
      // Pelanggan melunasi sisa tagihan
      const newPaid = rental.paidAmount + rental.remainingAmount;
      await prisma.rentalTransaction.update({
        where: { id: Number(id) },
        data: {
          paidAmount: newPaid,
          remainingAmount: 0,
          paymentType: 'LUNAS'
        }
      });
    } else if (action === 'SELESAI') {
      // Pelanggan mengembalikan busana
      const denda = Number(penaltyFee) || 0;

      await prisma.$transaction(async (tx) => {
        await tx.rentalTransaction.update({
          where: { id: Number(id) },
          data: {
            rentalStatus: 'SELESAI',
            actualReturnDate: new Date(),
            penaltyFee: denda,
            paidAmount: rental.paidAmount + denda,
            remainingAmount: 0,
            paymentType: 'LUNAS'
          }
        });

        // Kembalikan status busana menjadi AVAILABLE
        await tx.item.updateMany({
          where: { id: { in: itemIds } },
          data: { status: 'AVAILABLE' }
        });
      });
    } else if (action === 'BATAL') {
      // Transaksi dibatalkan
      await prisma.$transaction(async (tx) => {
        await tx.rentalTransaction.update({
          where: { id: Number(id) },
          data: { rentalStatus: 'BATAL' }
        });

        // Kembalikan status busana menjadi AVAILABLE
        await tx.item.updateMany({
          where: { id: { in: itemIds } },
          data: { status: 'AVAILABLE' }
        });
      });
    }

    res.redirect(`/rentals/${id}?success=Status+transaksi+berhasil+diperbarui`);
  } catch (error) {
    console.error('Error updateRentalStatus:', error);
    res.redirect(`/rentals/${req.params.id}?error=Gagal+mengubah+status:+' + encodeURIComponent(error.message)`);
  }
};
