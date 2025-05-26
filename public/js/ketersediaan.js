// ketersediaan.js - UPDATED VERSION dengan Status Logic

document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const checkAvailabilityForm = document.getElementById('checkAvailabilityForm');
  const checkInDateInput = document.getElementById('checkInDate');
  const checkOutDateInput = document.getElementById('checkOutDate');
  const unavailableDatesTable = document.getElementById('unavailableDatesTable');
  
  // Set default values: Today and Tomorrow
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Format dates as YYYY-MM-DD for input fields
  checkInDateInput.value = formatDateForInput(today);
  checkOutDateInput.value = formatDateForInput(tomorrow);
  
  // Set minimum dates (can't check dates in the past)
  checkInDateInput.min = formatDateForInput(today);
  checkOutDateInput.min = formatDateForInput(tomorrow);
  
  // When check-in date changes, update minimum for check-out date
  checkInDateInput.addEventListener('change', function() {
    const newMinDate = new Date(this.value);
    newMinDate.setDate(newMinDate.getDate() + 1);
    checkOutDateInput.min = formatDateForInput(newMinDate);
    
    // If current check-out date is before new minimum, update it
    if (new Date(checkOutDateInput.value) <= new Date(this.value)) {
      checkOutDateInput.value = formatDateForInput(newMinDate);
    }
  });
  
  // Handle form submission
  if (checkAvailabilityForm) {
    checkAvailabilityForm.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const checkInDate = checkInDateInput.value;
      const checkOutDate = checkOutDateInput.value;
      
      // Fetch availability data from our API
      checkAvailability(checkInDate, checkOutDate);
    });
  }
  
  // Initial check when the page loads
  checkAvailability(checkInDateInput.value, checkOutDateInput.value);
  
  // Fetch unavailable dates for the table
  fetchUnavailableDates();
  
  // ============================================
  // UPDATED FUNCTION: Check availability via API
  // Logic: Hanya reservasi dengan status 'accepted' yang dianggap unavailable
  // ============================================
  function checkAvailability(checkInDate, checkOutDate) {
    // Show loading indicator
    document.querySelectorAll('.villa-status').forEach(el => {
      el.innerHTML = '<p><i class="fas fa-spinner fa-spin status-icon"></i> Sedang memeriksa ketersediaan...</p>';
    });
    
    console.log(`🔍 Checking availability for dates: ${checkInDate} to ${checkOutDate}`);
    console.log(`📋 Logic: Hanya reservasi ACCEPTED yang membuat villa unavailable`);
    console.log(`📋 Status PENDING & REJECTED tidak akan muncul sebagai unavailable`);
    
    // Make real API call to backend - tambahkan timestamp untuk mencegah caching
    const timestamp = new Date().getTime();
    fetch(`/check-availability?checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&_t=${timestamp}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
          return response.text().then(text => {
            console.error('Error response:', text);
            throw new Error(`Server returned ${response.status}: ${text}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ Availability data received:', data);
        console.log(`📊 Villa Jales: ${data.vilajales ? 'AVAILABLE' : 'UNAVAILABLE'}`);
        console.log(`📊 Villa Akmal: ${data.vilaakmal ? 'AVAILABLE' : 'UNAVAILABLE'}`);
        console.log(`📊 Villa Rizaldi: ${data.vilarizaldi ? 'AVAILABLE' : 'UNAVAILABLE'}`);
        
        // Hapus class status sebelumnya dari semua villa
        document.querySelectorAll('.villa-status').forEach(el => {
          el.classList.remove('status-available', 'status-unavailable');
        });
        
        updateVillaAvailability(data, checkInDate, checkOutDate);
      })
      .catch(error => {
        console.error('❌ Error:', error);
        document.querySelectorAll('.villa-status').forEach(el => {
          el.innerHTML = '<p><i class="fas fa-exclamation-circle status-icon"></i> Gagal memeriksa ketersediaan</p>';
        });
        alert('Terjadi kesalahan saat memeriksa ketersediaan: ' + error.message);
      });
  }
  
  // Function to update villa availability display
  function updateVillaAvailability(data, checkInDate, checkOutDate) {
    // Format dates for display (DD/MM/YYYY)
    const formattedCheckIn = formatDateForDisplay(checkInDate);
    const formattedCheckOut = formatDateForDisplay(checkOutDate);
    
    console.log(`🎨 Updating UI for dates: ${formattedCheckIn} - ${formattedCheckOut}`);
    
    // Update each villa's status
    updateVillaStatus('vilaJalesStatus', 'Villa Jales', data.vilajales, formattedCheckIn, formattedCheckOut);
    updateVillaStatus('vilaAkmalStatus', 'Villa Akmal', data.vilaakmal, formattedCheckIn, formattedCheckOut);
    updateVillaStatus('vilaRizaldiStatus', 'Villa Rizaldi', data.vilarizaldi, formattedCheckIn, formattedCheckOut);
  }
  
  // Update individual villa status display
  function updateVillaStatus(elementId, villaName, isAvailable, checkInDate, checkOutDate) {
    const statusElement = document.getElementById(elementId);
    
    if (!statusElement) return;
    
    // Clear previous status
    statusElement.innerHTML = '';
    statusElement.className = 'villa-status';
    
    console.log(`🏠 Updating status for ${villaName}: isAvailable = ${isAvailable}`);
    
    if (isAvailable === true) {
      // Villa is available - HIJAU
      statusElement.classList.add('status-available');
      statusElement.innerHTML = `
        <p><i class="fas fa-check-circle status-icon"></i> Tersedia untuk tanggal ${checkInDate} sampai ${checkOutDate}</p>
        <small>✅ Tidak ada reservasi yang diterima (accepted) pada tanggal ini</small>
      `;
    } else {
      // Villa is not available - MERAH
      statusElement.classList.add('status-unavailable');
      statusElement.innerHTML = `
        <p><i class="fas fa-times-circle status-icon"></i> Tidak tersedia untuk tanggal ${checkInDate} sampai ${checkOutDate}</p>
        <small>❌ Ada reservasi yang sudah diterima (accepted) pada tanggal ini</small>
      `;
    }
  }
  
  // Helper function to format date for input fields (YYYY-MM-DD)
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Helper function to format date for display (DD/MM/YYYY)
  function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // ============================================
  // UPDATED FUNCTION: Fetch unavailable dates
  // Logic: Hanya tampilkan reservasi dengan status 'accepted'
  // ============================================
  function fetchUnavailableDates() {
    if (!unavailableDatesTable) return;
    
    // Show loading state
    unavailableDatesTable.innerHTML = '<tr><td colspan="3" class="text-center">Memuat data tanggal tidak tersedia...</td></tr>';
    
    console.log('📅 Fetching unavailable dates...');
    console.log('📋 Logic: Hanya menampilkan reservasi dengan status ACCEPTED');
    
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    fetch(`/unavailable-dates?_t=${timestamp}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('✅ Unavailable dates data:', data);
      console.log('📊 Data ini hanya berisi reservasi yang statusnya ACCEPTED');
      updateUnavailableDatesTable(data);
    })
    .catch(error => {
      console.error('❌ Error fetching unavailable dates:', error);
      unavailableDatesTable.innerHTML = 
        `<tr><td colspan="3" class="text-center text-danger">
          <i class="fas fa-exclamation-circle"></i> Gagal memuat data: ${error.message}
         </td></tr>`;
      
      // Jika error adalah 404, tambahkan panduan troubleshooting
      if (error.message.includes('404')) {
        unavailableDatesTable.innerHTML += 
          `<tr><td colspan="3" class="text-center">
            <small>Catatan: Pastikan endpoint '/unavailable-dates' sudah ditambahkan ke app.js dan server sudah di-restart.</small>
           </td></tr>`;
        
        // Tampilkan data fallback untuk demo
        setTimeout(() => {
          updateUnavailableDatesTable(getFallbackUnavailableDates());
        }, 1000);
      }
    });
  }
  
  // Function to update the unavailable dates table
  function updateUnavailableDatesTable(data) {
    if (!unavailableDatesTable) return;
    
    // Reset table
    unavailableDatesTable.innerHTML = '';
    
    // Check if we have data
    let hasData = false;
    
    // Helper to create rows for a villa
    function createVillaRows(villaName, dates) {
      if (!dates || dates.length === 0) return '';
      
      hasData = true;
      
      // For each range of dates, create a row
      return dates.map(dateRange => {
        return `<tr>
          <td>${villaName}</td>
          <td>${dateRange.checkIn}</td>
          <td>${dateRange.checkOut}</td>
        </tr>`;
      }).join('');
    }
    
    // Add rows for each villa
    let tableContent = '';
    tableContent += createVillaRows('Vila Jales', data['Vila Jales']);
    tableContent += createVillaRows('Vila Akmal', data['Vila Akmal']);
    tableContent += createVillaRows('Vila Rizaldi', data['Vila Rizaldi']);
    
    // If no data, show a message
    if (!hasData) {
      tableContent = `<tr><td colspan="3" class="text-center no-data">
        <i class="fas fa-info-circle"></i> Belum ada reservasi yang diterima (accepted)
        <br><small class="text-muted">Reservasi dengan status pending atau rejected tidak ditampilkan</small>
      </td></tr>`;
    } else {
      // Add info header untuk menjelaskan data
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
    
    unavailableDatesTable.innerHTML = tableContent;
    
    console.log(`📊 Table updated with ${hasData ? 'accepted reservations' : 'no accepted reservations'}`);
  }
  
  // Fallback function to generate demo data if API fails
  function getFallbackUnavailableDates() {
    console.log('⚠️ Using fallback data - API might be down');
    return {
      'Vila Jales': [
        { checkIn: '21/05/2025', checkOut: '23/05/2025' },
        { checkIn: '28/05/2025', checkOut: '30/05/2025' }
      ],
      'Vila Akmal': [
        { checkIn: '18/05/2025', checkOut: '20/05/2025' },
        { checkIn: '25/05/2025', checkOut: '27/05/2025' }
      ],
      'Vila Rizaldi': [
        { checkIn: '15/05/2025', checkOut: '18/05/2025' },
        { checkIn: '01/06/2025', checkOut: '05/06/2025' }
      ]
    };
  }
});