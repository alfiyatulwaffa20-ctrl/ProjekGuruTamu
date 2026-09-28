const prisma = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    // 1. Ambil statistik busana
    const totalItems = await prisma.item.count();
    const availableItems = await prisma.item.count({ where: { status: 'AVAILABLE' } });
    const rentedItems = await prisma.item.count({ where: { status: 'RENTED' } });
    const maintenanceItems = await prisma.item.count({
      where: { status: { in: ['LAUNDRY', 'MAINTENANCE'] } }
    });

    // 2. Ambil statistik transaksi sewa
    const activeRentals = await prisma.rentalTransaction.count({
      where: { rentalStatus: { in: ['BOOKING', 'DIAMBIL'] } }
    });
    const completedRentals = await prisma.rentalTransaction.count({
      where: { rentalStatus: 'SELESAI' }
    });

    // 3. Hitung omset dan piutang
    const allRentals = await prisma.rentalTransaction.findMany({
      select: { paidAmount: true, remainingAmount: true, rentalStatus: true }
    });

    const totalRevenue = allRentals
      .filter((r) => r.rentalStatus !== 'BATAL')
      .reduce((acc, curr) => acc + curr.paidAmount, 0);

    const totalReceivable = allRentals
      .filter((r) => ['BOOKING', 'DIAMBIL'].includes(r.rentalStatus))
      .reduce((acc, curr) => acc + curr.remainingAmount, 0);

    // 4. Ambil 5 transaksi terbaru
    const recentRentals = await prisma.rentalTransaction.findMany({
      take: 5,
      orderBy: { id: 'desc' },
      include: {
        customer: true,
        rentalItems: {
          include: { item: true }
        }
      }
    });

    // 5. Cek keterlambatan pengembalian
    const today = new Date();
    const overdueCount = await prisma.rentalTransaction.count({
      where: {
        rentalStatus: 'DIAMBIL',
        returnDate: { lt: today }
      }
    });

    res.render('dashboard', {
      title: 'Dashboard Operasional — SEWA AJA (SMK Telkom Lampung)',
      currentPage: 'dashboard',
      stats: {
        totalItems,
        availableItems,
        rentedItems,
        maintenanceItems,
        activeRentals,
        completedRentals,
        totalRevenue,
        totalReceivable,
        overdueCount
      },
      recentRentals
    });
  } catch (error) {
    console.error('Error getDashboard:', error);
    res.status(500).send('Terjadi kesalahan memuat dashboard: ' + error.message);
  }
};
