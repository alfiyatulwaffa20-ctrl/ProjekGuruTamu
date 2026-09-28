/**
 * SEWA AJA - Thermal Bluetooth Printer Driver
 * Web Bluetooth API & ESC/POS Command Encoder
 * Workshop PjBL SMK Telkom Lampung
 */

// Global Bluetooth State
const btState = {
  device: null,
  server: null,
  characteristic: null,
  isConnected: false,
  isPrinting: false
};

// Known BLE Service UUIDs used by common Bluetooth Thermal Printers
// (Panda, Eppos, Iware, Zywell, VSC, PT-210, MPT-II, POS-58, GOOJPRT, etc.)
const PRINTER_GATT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS ESC/POS Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART (Paling umum pada printer thermal portabel)
  '0000e0ff-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffff-0000-1000-8000-00805f9b34fb'
];

/**
 * 1. Helper Tampilan UI Status Bluetooth
 */
function updateBtUI(status, message, options = {}) {
  const dot = document.getElementById('btStatusDot');
  const text = document.getElementById('btStatusText');
  const alertBox = document.getElementById('btAlertBox');
  const alertIcon = document.getElementById('btAlertIcon');
  const alertMsg = document.getElementById('btAlertMessage');
  const btnConnect = document.getElementById('btnConnectBt');
  const btnPrintDirect = document.getElementById('btnPrintBtDirect');
  const btnDisconnect = document.getElementById('btnDisconnectBt');

  // Reset Dot classes
  if (dot) {
    dot.className = 'status-dot';
  }

  switch (status) {
    case 'disconnected':
      if (dot) dot.classList.add('status-disconnected');
      if (text) text.innerHTML = 'Belum Terkoneksi <span style="font-weight: normal; color: #64748b;">(Siap Pairing)</span>';
      if (btnConnect) {
        btnConnect.style.display = 'inline-flex';
        btnConnect.disabled = false;
        btnConnect.innerHTML = '<span class="btn-icon">📶</span> Hubungkan & Cetak Bluetooth';
      }
      if (btnPrintDirect) btnPrintDirect.style.display = 'none';
      if (btnDisconnect) btnDisconnect.style.display = 'none';
      break;

    case 'connecting':
      if (dot) dot.classList.add('status-connecting');
      if (text) text.innerHTML = '<span style="color: #b45309; font-weight: 700;">Menghubungkan ke Printer Bluetooth...</span>';
      if (btnConnect) {
        btnConnect.disabled = true;
        btnConnect.innerHTML = '<span class="spinner-inline"></span> Menghubungkan...';
      }
      showAlert('connecting', '🔄 Membuka dialog Bluetooth. Silakan pilih printer thermal Anda dari daftar perangkat...');
      break;

    case 'connected':
      const devName = options.deviceName || (btState.device ? btState.device.name : 'Printer Thermal');
      if (dot) dot.classList.add('status-connected');
      if (text) text.innerHTML = `Terkoneksi ke: <strong style="color: #15803d;">${devName}</strong> <span style="color: #15803d; font-size: 0.85em;">(Siap Cetak)</span>`;
      if (btnConnect) btnConnect.style.display = 'none';
      if (btnPrintDirect) {
        btnPrintDirect.style.display = 'inline-flex';
        btnPrintDirect.disabled = false;
        btnPrintDirect.innerHTML = '<span class="btn-icon">🖨️</span> Kirim Struk ke Bluetooth';
      }
      if (btnDisconnect) btnDisconnect.style.display = 'inline-flex';
      showAlert('success', `✅ Berhasil terhubung ke <strong>${devName}</strong>! Printer siap menerima struk.`);
      break;

    case 'printing':
      if (dot) dot.classList.add('status-printing');
      if (text) text.innerHTML = '<span style="color: #7c3aed; font-weight: 800;">Sedang Memproses Cetak... (Mengirim Data ESC/POS)</span>';
      if (btnPrintDirect) {
        btnPrintDirect.disabled = true;
        btnPrintDirect.innerHTML = '<span class="spinner-inline"></span> Mengirim ke Printer...';
      }
      if (btnConnect) {
        btnConnect.disabled = true;
        btnConnect.innerHTML = '<span class="spinner-inline"></span> Memproses Cetak...';
      }
      showAlert('printing', '🖨️ Mengirim data struk via Bluetooth... Mohon jangan matikan printer.');
      break;

    case 'success':
      if (dot) dot.classList.add('status-connected');
      const name = options.deviceName || (btState.device ? btState.device.name : 'Printer Thermal');
      if (text) text.innerHTML = `Terkoneksi ke: <strong style="color: #15803d;">${name}</strong> (Cetak Sukses)`;
      if (btnPrintDirect) {
        btnPrintDirect.disabled = false;
        btnPrintDirect.innerHTML = '<span class="btn-icon">🖨️</span> Cetak Lagi via Bluetooth';
      }
      showAlert('success', `🎉 Struk sukses dicetak ke <strong>${name}</strong>! Silakan sobek kertas struk.`);
      break;

    case 'error':
      if (dot) dot.classList.add('status-error');
      if (text) text.innerHTML = '<span style="color: #dc2626; font-weight: 700;">Gagal Terkoneksi / Error</span>';
      if (btnConnect) {
        btnConnect.style.display = 'inline-flex';
        btnConnect.disabled = false;
        btnConnect.innerHTML = '<span class="btn-icon">📶</span> Coba Hubungkan Lagi';
      }
      if (btnPrintDirect) btnPrintDirect.style.display = 'none';
      if (btnDisconnect) btnDisconnect.style.display = 'none';
      showAlert('error', message || 'Terjadi kesalahan saat menyambungkan atau mengirim data ke printer Bluetooth.');
      break;
  }
}

function showAlert(type, htmlContent) {
  const alertBox = document.getElementById('btAlertBox');
  const alertIcon = document.getElementById('btAlertIcon');
  const alertMsg = document.getElementById('btAlertMessage');
  if (!alertBox || !alertMsg) return;

  alertBox.className = 'bt-alert bt-alert-' + type;
  alertBox.style.display = 'flex';

  const icons = {
    connecting: '⏳',
    success: '✅',
    printing: '🖨️',
    error: '⚠️',
    info: 'ℹ️'
  };

  if (alertIcon) alertIcon.textContent = icons[type] || 'ℹ️';
  alertMsg.innerHTML = htmlContent;
}

/**
 * 2. ESC/POS Command Generator
 */
class EscPosBuilder {
  constructor(paperWidth = '80mm') {
    this.buffer = [];
    this.maxChars = paperWidth === '58mm' ? 32 : 44; // 32 kolom untuk 58mm, 44 kolom untuk 80mm
    this.encoder = new TextEncoder();
  }

  init() {
    this.buffer.push(0x1b, 0x40); // ESC @ (Reset/Init)
    return this;
  }

  align(align = 'left') {
    const val = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, val); // ESC a n
    return this;
  }

  bold(isBold = true) {
    this.buffer.push(0x1b, 0x45, isBold ? 1 : 0); // ESC E n
    return this;
  }

  size(mode = 'normal') {
    // normal, double-height, double-both
    if (mode === 'double') {
      this.buffer.push(0x1d, 0x21, 0x11); // GS ! 0x11 (Double width & height)
    } else if (mode === 'tall') {
      this.buffer.push(0x1d, 0x21, 0x01); // GS ! 0x01 (Double height)
    } else {
      this.buffer.push(0x1d, 0x21, 0x00); // Normal
    }
    return this;
  }

  text(str) {
    const bytes = this.encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  line(str = '') {
    this.text(str + '\n');
    return this;
  }

  divider(char = '-') {
    this.line(char.repeat(this.maxChars));
    return this;
  }

  doubleDivider() {
    this.line('='.repeat(this.maxChars));
    return this;
  }

  twoColumns(left, right) {
    const totalLen = this.maxChars;
    const rightLen = right.length;
    let leftLen = left.length;

    if (leftLen + rightLen >= totalLen) {
      const allowedLeft = totalLen - rightLen - 1;
      left = left.substring(0, allowedLeft);
      leftLen = left.length;
    }

    const spaces = ' '.repeat(Math.max(1, totalLen - leftLen - rightLen));
    this.line(left + spaces + right);
    return this;
  }

  feed(lines = 3) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  cut() {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, 0x01); // GS V 1 (Partial cut)
    return this;
  }

  getBytes() {
    return new Uint8Array(this.buffer);
  }
}

/**
 * 3. Pembuat Payload Data Struk Rental Busana
 */
function buildRentalReceiptBytes(paperWidth = '80mm') {
  const dataEl = document.getElementById('rentalDataJson');
  if (!dataEl) {
    throw new Error('Data transaksi sewa tidak ditemukan.');
  }

  const r = JSON.parse(dataEl.textContent);
  const builder = new EscPosBuilder(paperWidth);
  const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

  builder.init();

  // Header Toko
  builder.align('center')
    .size('double')
    .bold(true)
    .line('SEWA AJA')
    .size('normal')
    .bold(false)
    .line('PERSEWAAN KEBAYA & JAS')
    .line('SMK TELKOM LAMPUNG')
    .line('Jl. Raya Gisting, Tanggamus, Lampung')
    .line('WhatsApp: 0812-7890-0000')
    .doubleDivider();

  // Info Nota & Kasir
  builder.align('left');
  builder.twoColumns('NO. NOTA', '#' + r.transactionCode);
  builder.twoColumns('TANGGAL', r.date);
  builder.twoColumns('KASIR', r.cashierName);
  builder.twoColumns('BAYAR', '[' + r.paymentType + ']');
  builder.twoColumns('STATUS SEWA', r.rentalStatus);
  builder.divider();

  // Data Penyewa & Jaminan
  builder.bold(true).line('DATA PENYEWA:').bold(false);
  builder.twoColumns('Nama', r.customerName);
  builder.twoColumns('WhatsApp', r.customerPhone);
  builder.twoColumns('Jaminan', r.guarantee);
  builder.divider();

  // Jadwal Operasional Sewa H-1, Hari H, H+1
  builder.bold(true).line('JADWAL PEMAKAIAN:').bold(false);
  builder.twoColumns('• Ambil (H-1)', r.pickupDate);
  builder.twoColumns('• Hari H (Acara)', r.eventDate);
  builder.twoColumns('• Pulang (H+1)', r.returnDate);
  builder.divider();

  // Rincian Busana
  builder.bold(true).line('RINCIAN BUSANA:').bold(false);
  r.items.forEach((item, idx) => {
    builder.bold(true).line(`${idx + 1}. ${item.name}`).bold(false);
    builder.twoColumns(`   [${item.code}] Uk.${item.size} (1x)`, formatRp(item.price));
    if (item.note) {
      builder.line(`   * Note: ${item.note}`);
    }
  });
  builder.divider();

  // Kalkulasi Keuangan
  builder.twoColumns('Total Tarif Busana', formatRp(r.totalBasePrice));
  if (r.additionalCharge > 0) {
    builder.twoColumns('Biaya Tambahan', '+' + formatRp(r.additionalCharge));
  }
  if (r.discount > 0) {
    builder.twoColumns('Diskon Promo', '-' + formatRp(r.discount));
  }
  builder.doubleDivider();

  // Total Akhir
  builder.bold(true);
  builder.twoColumns('TOTAL TAGIHAN', formatRp(r.finalPrice));
  builder.bold(false);
  builder.twoColumns(`Sudah Dibayar (${r.paymentMethod})`, formatRp(r.paidAmount));
  builder.bold(true);
  builder.twoColumns('SISA PIUTANG', formatRp(r.remainingAmount));
  builder.bold(false);

  if (r.penaltyFee > 0) {
    builder.twoColumns('Denda Telat', '+' + formatRp(r.penaltyFee));
  }

  // Catatan Vermak jika ada
  if (r.fittingNotes) {
    builder.divider();
    builder.bold(true).line('✂️ CATATAN VERMAK:').bold(false);
    builder.line(`"${r.fittingNotes}"`);
  }

  // Ketentuan Singkat
  builder.divider();
  builder.line('KETENTUAN OPERASIONAL:');
  builder.line('1. Wajib kembali H+1 maks 17.00 WIB.');
  builder.line('2. Denda telat Rp 25.000/hari/busana.');
  builder.line('3. Jaminan kembali saat busana utuh.');
  builder.line('4. Simpan struk untuk ambil jaminan.');
  builder.divider();

  // Tanda Tangan
  builder.align('center');
  builder.twoColumns('    Penyewa,', '    Kasir,    ');
  builder.line('');
  builder.line('');
  builder.twoColumns(` ( ${r.customerName.substring(0, 10)} ) `, ` ( ${r.cashierName} ) `);
  builder.doubleDivider();

  // Footer & Terimakasih
  builder.align('center')
    .bold(true)
    .line(`* ${r.transactionCode} *`)
    .line('*** TERIMA KASIH ***')
    .bold(false)
    .line('SEWA AJA - SOLUSI BUSANA ANDA')
    .cut();

  return builder.getBytes();
}

/**
 * 4. Pengiriman Data via Web Bluetooth GATT
 */
async function sendEscPosToBluetooth(characteristic, data) {
  // Mini Bluetooth Thermal Printers memiliki batas buffer/MTU (~64 - 100 bytes).
  // Kirim data dalam paket kecil 50 byte dengan jeda 25ms agar printer tidak macet.
  const CHUNK_SIZE = 50;
  const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    // Small delay between chunks for hardware buffer safety
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * 5. Hubungkan Bluetooth & Mulai Cetak (Main Handler)
 */
async function connectAndPrintBluetooth() {
  // Validasi Dukungan Web Bluetooth API di Browser
  if (!navigator.bluetooth) {
    updateBtUI('error', 'Browser Anda tidak mendukung Web Bluetooth API.<br>Pastikan menggunakan <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> (Desktop / Android).');
    return;
  }

  try {
    updateBtUI('connecting');

    // 1. Request Bluetooth Device (Buka dialog pemilih Bluetooth browser)
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_GATT_SERVICES
    });

    btState.device = device;
    const deviceName = device.name || 'Printer Thermal Bluetooth';

    // Listener jika printer mendadak terputus
    device.addEventListener('gattserverdisconnected', onBluetoothDisconnected);

    // 2. Konek ke GATT Server
    const server = await device.gatt.connect();
    btState.server = server;

    // 3. Cari Primary Service & Characteristic yang mendukung Write
    let targetCharacteristic = null;

    // Coba temukan service yang terdaftar di printer
    for (const serviceUuid of PRINTER_GATT_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();

        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            targetCharacteristic = char;
            break;
          }
        }
        if (targetCharacteristic) break;
      } catch (err) {
        // Lanjutkan mencoba service UUID berikutnya
      }
    }

    // Jika belum ketemu di list known, coba enumerate semua services
    if (!targetCharacteristic) {
      try {
        const allServices = await server.getPrimaryServices();
        for (const service of allServices) {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetCharacteristic = char;
              break;
            }
          }
          if (targetCharacteristic) break;
        }
      } catch (e) {
        console.warn('Enum services fallback error:', e);
      }
    }

    if (!targetCharacteristic) {
      throw new Error(`Karakteristik cetak (Write) tidak ditemukan pada printer "${deviceName}". Pastikan printer mendukung protokol Bluetooth SPP/ESC-POS.`);
    }

    btState.characteristic = targetCharacteristic;
    btState.isConnected = true;

    // Tampilkan status Terkoneksi
    updateBtUI('connected', null, { deviceName });

    // Tunggu sejenak agar printer stabil
    await new Promise((r) => setTimeout(r, 400));

    // 4. Mulai Proses Pencetakan
    await executePrint(targetCharacteristic, deviceName);

  } catch (error) {
    console.error('Bluetooth Error:', error);
    if (error.name === 'NotFoundError') {
      // User membatalkan dialog pemilih perangkat
      updateBtUI('disconnected');
      showAlert('info', 'ℹ️ Pemilihan printer dibatalkan oleh pengguna.');
    } else {
      updateBtUI('error', error.message || 'Gagal menyambungkan ke printer Bluetooth.');
    }
  }
}

/**
 * 6. Eksekusi Pengiriman Struk ke Printer yang Sudah Terhubung
 */
async function printToConnectedBluetooth() {
  if (!btState.characteristic || !btState.isConnected) {
    return connectAndPrintBluetooth();
  }

  const deviceName = btState.device ? btState.device.name : 'Printer Thermal';
  await executePrint(btState.characteristic, deviceName);
}

async function executePrint(characteristic, deviceName) {
  try {
    updateBtUI('printing');

    // Ambil lebar kertas yang dipilih (58mm atau 80mm)
    const select = document.getElementById('thermalWidthSelect');
    const paperWidth = select && select.value === 'width-58mm' ? '58mm' : '80mm';

    // Bangun byte ESC/POS
    const receiptBytes = buildRentalReceiptBytes(paperWidth);

    // Kirim byte data via Bluetooth
    await sendEscPosToBluetooth(characteristic, receiptBytes);

    // Selesai cetak!
    updateBtUI('success', null, { deviceName });

  } catch (err) {
    console.error('Print Execution Error:', err);
    updateBtUI('error', 'Gagal saat mengirim data cetak ke printer: ' + err.message);
  }
}

/**
 * 7. Disconnect Handler
 */
function disconnectBluetooth() {
  if (btState.device && btState.device.gatt.connected) {
    btState.device.gatt.disconnect();
  }
  btState.device = null;
  btState.server = null;
  btState.characteristic = null;
  btState.isConnected = false;
  updateBtUI('disconnected');
  showAlert('info', '🔌 Koneksi printer Bluetooth telah diputuskan.');
}

function onBluetoothDisconnected() {
  btState.isConnected = false;
  btState.characteristic = null;
  updateBtUI('disconnected');
  showAlert('error', '⚠️ Koneksi Bluetooth ke printer terputus.');
}

/**
 * 8. Simulasi Cetak Bluetooth (Fitur Demo Guru / Siswa jika tidak membawa printer fisik)
 */
async function simulateBluetoothPrint() {
  updateBtUI('connecting');
  showAlert('connecting', '🔄 [Mode Simulasi] Mencari printer thermal Bluetooth terdekat...');

  await new Promise((r) => setTimeout(r, 1200));
  const simName = 'Panda PRJ-58B (Bluetooth POS)';
  updateBtUI('connected', null, { deviceName: simName });

  await new Promise((r) => setTimeout(r, 1000));
  updateBtUI('printing');

  await new Promise((r) => setTimeout(r, 1800));
  updateBtUI('success', null, { deviceName: simName });
}
