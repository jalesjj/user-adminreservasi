// ===============================================
// KETERSEDIAAN.JS - SISTEM PENGECEKAN KETERSEDIAAN VILLA
// ===============================================
// File ini menangani semua logika frontend untuk pengecekan ketersediaan villa
// Sistem ini menggunakan status reservasi di mana hanya reservasi dengan status 'accepted' 
// yang dianggap membuat villa tidak tersedia (unavailable)

// Event listener yang dijalankan setelah DOM selesai dimuat
document.addEventListener('DOMContentLoaded', function() {
  
  // ===============================================
  // BAGIAN 1: INISIALISASI ELEMEN DOM
  // ===============================================
  // Mengambil referensi ke elemen-elemen HTML yang dibutuhkan
  const checkAvailabilityForm = document.getElementById('checkAvailabilityForm'); // Form pengecekan ketersediaan
  const checkInDateInput = document.getElementById('checkInDate');                // Input tanggal check-in
  const checkOutDateInput = document.getElementById('checkOutDate');              // Input tanggal check-out
  const unavailableDatesTable = document.getElementById('unavailableDatesTable'); // Tabel tanggal tidak tersedia
  
  // ===============================================
  // BAGIAN 2: SETUP TANGGAL DEFAULT
  // ===============================================
  // Mengatur tanggal default: hari ini untuk check-in, besok untuk check-out
  const today = new Date();           // Tanggal hari ini
  const tomorrow = new Date(today);   // Membuat copy dari hari ini
  tomorrow.setDate(tomorrow.getDate() + 1); // Menambah 1 hari untuk mendapatkan besok
  
  // Mengisi nilai default ke input field dengan format YYYY-MM-DD (format HTML5 date input)
  checkInDateInput.value = formatDateForInput(today);
  checkOutDateInput.value = formatDateForInput(tomorrow);
  
  // ===============================================
  // BAGIAN 3: PEMBATASAN TANGGAL MINIMUM
  // ===============================================
  // Mencegah user memilih tanggal di masa lalu
  checkInDateInput.min = formatDateForInput(today);     // Check-in minimal hari ini
  checkOutDateInput.min = formatDateForInput(tomorrow); // Check-out minimal besok
  
  // ===============================================
  // BAGIAN 4: EVENT LISTENER UNTUK PERUBAHAN TANGGAL CHECK-IN
  // ===============================================
  // Event handler ketika tanggal check-in berubah
  checkInDateInput.addEventListener('change', function() {
    // Membuat tanggal minimum untuk check-out (1 hari setelah check-in)
    const newMinDate = new Date(this.value);
    newMinDate.setDate(newMinDate.getDate() + 1);
    checkOutDateInput.min = formatDateForInput(newMinDate);
    
    // Validasi: jika tanggal check-out saat ini kurang dari atau sama dengan check-in,
    // maka otomatis update check-out ke hari berikutnya
    if (new Date(checkOutDateInput.value) <= new Date(this.value)) {
      checkOutDateInput.value = formatDateForInput(newMinDate);
    }
  });
  
  // ===============================================
  // BAGIAN 5: EVENT HANDLER UNTUK FORM SUBMISSION
  // ===============================================
  // Menangani ketika form pengecekan ketersediaan di-submit
  if (checkAvailabilityForm) {
    checkAvailabilityForm.addEventListener('submit', function(event) {
      event.preventDefault(); // Mencegah form submit secara default (reload halaman)
      
      // Mengambil nilai tanggal dari input field
      const checkInDate = checkInDateInput.value;
      const checkOutDate = checkOutDateInput.value;
      
      // Memanggil fungsi pengecekan ketersediaan dengan tanggal yang dipilih
      checkAvailability(checkInDate, checkOutDate);
    });
  }
  
  // ===============================================
  // BAGIAN 6: INISIALISASI AWAL
  // ===============================================
  // Melakukan pengecekan ketersediaan pertama kali saat halaman dimuat
  checkAvailability(checkInDateInput.value, checkOutDateInput.value);
  
  // Mengambil data tanggal-tanggal yang tidak tersedia untuk ditampilkan di tabel
  fetchUnavailableDates();
  
  // ===============================================
  // BAGIAN 7: FUNGSI UTAMA - PENGECEKAN KETERSEDIAAN
  // ===============================================
  // Fungsi ini adalah inti dari sistem, mengirim request ke API untuk cek ketersediaan
  // LOGIKA PENTING: Hanya reservasi dengan status 'accepted' yang membuat villa unavailable ;;
  function checkAvailability(checkInDate, checkOutDate) {
    
    // Menampilkan indikator loading di semua status villa
    document.querySelectorAll('.villa-status').forEach(el => {
      el.innerHTML = '<p><i class="fas fa-spinner fa-spin status-icon"></i> Sedang memeriksa ketersediaan...</p>';
    });
    
    // Console logging untuk debugging dan monitoring
    console.log(`🔍 Checking availability for dates: ${checkInDate} to ${checkOutDate}`);
    console.log(`📋 Logic: Hanya reservasi ACCEPTED yang membuat villa unavailable`);
    console.log(`📋 Status PENDING & REJECTED tidak akan muncul sebagai unavailable`);
    
    // ===============================================
    // BAGIAN 8: API CALL KE BACKEND
    // ===============================================
    // Membuat request HTTP ke endpoint backend dengan parameter tanggal
    const timestamp = new Date().getTime(); // Timestamp untuk mencegah browser caching
    fetch(`/check-availability?checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&_t=${timestamp}`, {
      headers: {
        // Headers untuk memastikan data selalu fresh (tidak dari cache)
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(response => {
        // Logging status response untuk debugging
        console.log('Response status:', response.status);
        
        // Error handling jika response tidak OK (status 4xx atau 5xx)
        if (!response.ok) {
          return response.text().then(text => {
            console.error('Error response:', text);
            throw new Error(`Server returned ${response.status}: ${text}`);
          });
        }
        
        // Parse response JSON jika sukses
        return response.json();
      })
      .then(data => {
        // ===============================================
        // BAGIAN 9: PROCESSING RESPONSE DATA
        // ===============================================
        // Logging data yang diterima dari API
        // HASIL DARI BACKEND: HANYA BERDASARKAN RESERVASI ACCEPTED
        console.log('✅ Availability data received:', data);
        console.log(`📊 Villa Jales: ${data.vilajales ? 'AVAILABLE' : 'UNAVAILABLE'}`);
        console.log(`📊 Villa Akmal: ${data.vilaakmal ? 'AVAILABLE' : 'UNAVAILABLE'}`);
        console.log(`📊 Villa Rizaldi: ${data.vilarizaldi ? 'AVAILABLE' : 'UNAVAILABLE'}`);
        
        // Membersihkan class status sebelumnya dari semua elemen villa
        document.querySelectorAll('.villa-status').forEach(el => {
          el.classList.remove('status-available', 'status-unavailable');
        });
        
        // Update tampilan UI berdasarkan data ketersediaan
        updateVillaAvailability(data, checkInDate, checkOutDate);
      })
      .catch(error => {
        // ===============================================
        // BAGIAN 10: ERROR HANDLING
        // ===============================================
        // Menangani error yang terjadi selama API call
        console.error('❌ Error:', error);
        
        // Menampilkan pesan error di semua status villa
        document.querySelectorAll('.villa-status').forEach(el => {
          el.innerHTML = '<p><i class="fas fa-exclamation-circle status-icon"></i> Gagal memeriksa ketersediaan</p>';
        });
        
        // Menampilkan alert error ke user
        alert('Terjadi kesalahan saat memeriksa ketersediaan: ' + error.message);
      });
  }
  
  // ===============================================
  // BAGIAN 11: FUNGSI UPDATE UI VILLA
  // ===============================================
  // Fungsi untuk mengupdate tampilan ketersediaan semua villa berdasarkan data dari API
  function updateVillaAvailability(data, checkInDate, checkOutDate) {
    
    // Format tanggal untuk tampilan (dari YYYY-MM-DD ke DD/MM/YYYY)
    const formattedCheckIn = formatDateForDisplay(checkInDate);
    const formattedCheckOut = formatDateForDisplay(checkOutDate);
    
    console.log(`🎨 Updating UI for dates: ${formattedCheckIn} - ${formattedCheckOut}`);
    
    // Update status untuk setiap villa secara individual
    updateVillaStatus('vilaJalesStatus', 'Villa Jales', data.vilajales, formattedCheckIn, formattedCheckOut);
    updateVillaStatus('vilaAkmalStatus', 'Villa Akmal', data.vilaakmal, formattedCheckIn, formattedCheckOut);
    updateVillaStatus('vilaRizaldiStatus', 'Villa Rizaldi', data.vilarizaldi, formattedCheckIn, formattedCheckOut);
  }
  
  // ===============================================
  // BAGIAN 12: FUNGSI UPDATE STATUS INDIVIDUAL VILLA
  // ===============================================
  // Fungsi untuk mengupdate tampilan status satu villa tertentu
  function updateVillaStatus(elementId, villaName, isAvailable, checkInDate, checkOutDate) {
    // Mencari elemen HTML berdasarkan ID
    const statusElement = document.getElementById(elementId);
    
    // Validasi: keluar dari fungsi jika elemen tidak ditemukan
    if (!statusElement) return;
    
    // Reset elemen: hapus konten dan class sebelumnya
    statusElement.innerHTML = '';
    statusElement.className = 'villa-status';
    
    console.log(`🏠 Updating status for ${villaName}: isAvailable = ${isAvailable}`);
    
    if (isAvailable === true) {
      // ✅ VILLA TERSEDIA (TIDAK ADA RESERVASI ACCEPTED)
      statusElement.classList.add('status-available');
      
      // Menampilkan HTML untuk status tersedia
      statusElement.innerHTML = `
        <p><i class="fas fa-check-circle status-icon"></i> Tersedia untuk tanggal ${checkInDate} sampai ${checkOutDate}</p>
        <small>✅ Tidak ada reservasi yang diterima (accepted) pada tanggal ini</small>
      `;
    } else {
      // ❌ VILLA TIDAK TERSEDIA (ADA RESERVASI ACCEPTED)
      statusElement.classList.add('status-unavailable');
      
      // Menampilkan HTML untuk status tidak tersedia
      statusElement.innerHTML = `
        <p><i class="fas fa-times-circle status-icon"></i> Tidak tersedia untuk tanggal ${checkInDate} sampai ${checkOutDate}</p>
        <small>❌ Ada reservasi yang sudah diterima (accepted) pada tanggal ini</small>
      `;
    }
  }
  
  // ===============================================
  // BAGIAN 13: HELPER FUNCTIONS - FORMAT TANGGAL
  // ===============================================
  // Fungsi helper untuk memformat tanggal ke format input HTML5 (YYYY-MM-DD)
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 karena month dimulai dari 0
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Fungsi helper untuk memformat tanggal ke format tampilan user (DD/MM/YYYY)
  function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // ===============================================
  // BAGIAN 14: FUNGSI FETCH TANGGAL TIDAK TERSEDIA
  // ===============================================
  // Fungsi untuk mengambil data tanggal-tanggal yang tidak tersedia dari API
  // LOGIKA: FUNGSI INI MENGAMBIL DATA UNTUK TABEL "TANGGAL TIDAK TERSEDIA" ;;
  function fetchUnavailableDates() {
    // Validasi: keluar jika elemen tabel tidak ada
    if (!unavailableDatesTable) return;
    
    // Menampilkan state loading di tabel
    unavailableDatesTable.innerHTML = '<tr><td colspan="3" class="text-center">Memuat data tanggal tidak tersedia...</td></tr>';
    
    console.log('📅 Fetching unavailable dates...');
    console.log('📋 Logic: Hanya menampilkan reservasi dengan status ACCEPTED');
    
    // ===============================================
    // BAGIAN 15: API CALL UNTUK UNAVAILABLE DATES
    // ===============================================
    const timestamp = new Date().getTime(); // Timestamp anti-cache
    fetch(`/unavailable-dates?_t=${timestamp}`, {
      headers: {
        // Headers anti-cache
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    .then(response => {
      // Error handling untuk response
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Success: process dan tampilkan data
      console.log('✅ Unavailable dates data:', data);
      console.log('📊 Data ini hanya berisi reservasi yang statusnya ACCEPTED');
      updateUnavailableDatesTable(data);
    })
    .catch(error => {
      // ===============================================
      // BAGIAN 16: ERROR HANDLING UNTUK UNAVAILABLE DATES
      // ===============================================
      console.error('❌ Error fetching unavailable dates:', error);
      
      // Menampilkan pesan error di tabel
      unavailableDatesTable.innerHTML = 
        `<tr><td colspan="3" class="text-center text-danger">
          <i class="fas fa-exclamation-circle"></i> Gagal memuat data: ${error.message}
         </td></tr>`;
      
      // Jika error 404, berikan panduan troubleshooting
      if (error.message.includes('404')) {
        unavailableDatesTable.innerHTML += 
          `<tr><td colspan="3" class="text-center">
            <small>Catatan: Pastikan endpoint '/unavailable-dates' sudah ditambahkan ke app.js dan server sudah di-restart.</small>
           </td></tr>`;
        
        // Tampilkan data fallback untuk demo setelah 1 detik
        setTimeout(() => {
          updateUnavailableDatesTable(getFallbackUnavailableDates());
        }, 1000);
      }
    });
  }
  
  // ===============================================
  // BAGIAN 17: FUNGSI UPDATE TABEL UNAVAILABLE DATES
  // ===============================================
  // Fungsi untuk mengupdate tabel dengan data tanggal yang tidak tersedia
  function updateUnavailableDatesTable(data) {
    // Validasi elemen tabel
    if (!unavailableDatesTable) return;
    
    // Reset tabel
    unavailableDatesTable.innerHTML = '';
    
    // Flag untuk mengecek apakah ada data
    let hasData = false;
    
    // ===============================================
    // BAGIAN 18: HELPER FUNCTION UNTUK MEMBUAT ROWS
    // ===============================================
    // Fungsi helper untuk membuat baris tabel untuk setiap villa
    function createVillaRows(villaName, dates) {
      // Jika tidak ada data, return string kosong
      if (!dates || dates.length === 0) return '';
      
      hasData = true; // Tandai bahwa ada data
      
      // Buat baris HTML untuk setiap range tanggal
      return dates.map(dateRange => {
        return `<tr>
          <td>${villaName}</td>
          <td>${dateRange.checkIn}</td>
          <td>${dateRange.checkOut}</td>
        </tr>`;
      }).join('');
    }
    
    // ===============================================
    // BAGIAN 19: GENERATE CONTENT TABEL
    // ===============================================
    // Membuat konten tabel untuk semua villa
    let tableContent = '';
    tableContent += createVillaRows('Vila Jales', data['Vila Jales']);
    tableContent += createVillaRows('Vila Akmal', data['Vila Akmal']);
    tableContent += createVillaRows('Vila Rizaldi', data['Vila Rizaldi']);
    
    // ===============================================
    // BAGIAN 20: HANDLING KONDISI TIDAK ADA DATA
    // ===============================================
    if (!hasData) {
      // Jika tidak ada data, tampilkan pesan informatif
      tableContent = `<tr><td colspan="3" class="text-center no-data">
        <i class="fas fa-info-circle"></i> Belum ada reservasi yang diterima (accepted)
        <br><small class="text-muted">Reservasi dengan status pending atau rejected tidak ditampilkan</small>
      </td></tr>`;
    } else {
      // Jika ada data, tambahkan header info untuk menjelaskan isi tabel
      const infoHeader = `<tr style="background-color: #e3f2fd;">
        <td colspan="3" class="text-center" style="padding: 10px;">
          <small><i class="fas fa-info-circle"></i> 
          <strong>Info:</strong> Tabel ini hanya menampilkan reservasi yang sudah <strong>diterima (accepted)</strong>.
          <br>Reservasi dengan status <em>pending</em> atau <em>rejected</em> tidak ditampilkan di sini.
          </small>
        </td>
      </tr>`;
      tableContent = infoHeader + tableContent;
    }
    
    // Update HTML tabel dengan konten yang sudah dibuat
    unavailableDatesTable.innerHTML = tableContent;
    
    console.log(`📊 Table updated with ${hasData ? 'accepted reservations' : 'no accepted reservations'}`);
  }
  
  
// ===============================================
// AKHIR EVENT LISTENER DOMContentLoaded
// ===============================================
});

// ===============================================
// RINGKASAN FITUR SISTEM:
// ===============================================
// 1. Pengecekan ketersediaan villa real-time via API
// 2. Validasi tanggal (tidak bisa pilih tanggal masa lalu)
// 3. Update UI otomatis berdasarkan status ketersediaan
// 4. Tabel tanggal tidak tersedia dengan filter status 'accepted'
// 5. Error handling dan fallback data untuk demo
// 6. Anti-cache mechanism untuk data yang selalu fresh
// 7. Responsive loading states dan user feedback
// 8. Console logging untuk debugging dan monitoring
// ===============================================