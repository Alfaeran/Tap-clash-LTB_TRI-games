# Project Context: Tri LTB 1v1 Reflex Duel Clash

## 1. Perihal Project Apa Ini (Project Overview)
Project ini adalah **"Tri LTB 1v1 Reflex Duel Clash" (Liga Tendang Bola 2026)**.
Ini merupakan aplikasi web *real-time massive multiplayer tapping game* berkonsep *Tug of War* (Tarik Tambang) di mana dua sekolah bertanding satu sama lain dalam peran **Kicker (Penendang)** melawan **Goalie (Kiper)**.
Aplikasi ini memiliki estetika desain **Stitch 5G Cyberpunk Sports** (Dark Mode, warna neon Magenta & Cyan, Glassmorphism).
Dari sisi arsitektur, project ini menggunakan arsitektur Node.js dengan **Socket.io** untuk komunikasi real-time, **Redis** untuk manajemen *state* dan *atomic counting* jumlah tap, serta *frontend* berbasis **React + Tailwind CSS** (dengan rencana integrasi/adaptasi ke Vue framework sesuai *prompt* awal).

## 2. Purpose & Objectives (Tujuan & Sasaran)
**Purpose:** 
Menjadi platform interaktif untuk acara *live event* atau turnamen esports antar sekolah (Liga Tendang Bola 2026). Aplikasi ini digunakan oleh *event operator* (Admin) untuk mengatur pertandingan secara *live*, dan digunakan oleh penonton/siswa (Player) untuk bergabung mendukung sekolah mereka dengan cara men-*tap* layar secepat mungkin.

**Objectives:**
- **Admin Control:** Menyediakan panel admin yang mudah digunakan untuk menjadwalkan pertandingan, men-generate kode akses 6 digit, memulai hitung mundur (countdown), dan menghentikan game (emergency stop).
- **Real-Time Gameplay (Tug of War):** Menampilkan skor *tap* dan visual *progress bar* yang responsif (bergeser ke kiri/kanan berdasarkan rasio *tap* kedua tim) tanpa ada *delay* atau *lag* yang signifikan.
- **Social Sharing (Twibbon):** Setelah pertandingan selesai, mengarahkan pemain ke halaman *Twibbon Customization* di mana mereka dapat mengunggah *selfie*, menampilkan skor akhir, dan membagikan kemenangan mereka ke Instagram.
- **Leaderboard System:** Mengakumulasi total poin, kemenangan, kekalahan, hasil seri, dan jumlah *tap* dari setiap sekolah dalam sebuah seri kota, lalu menampilkannya di sistem *Leaderboard*.

## 3. Bugs & Missing Values (Bug dan Fitur yang Kurang/Belum Selesai)
Saat Anda (Claude) membantu mengembangkan project ini, mohon perhatikan hal-hal berikut yang mungkin menjadi *bugs* atau masih merupakan *missing values*:

**Missing Values (Fitur yang Perlu Dilengkapi):**
- **Twibbon Canvas Generator:** Fungsionalitas konversi UI ke gambar asli (*Twibbon*) yang menggabungkan foto *selfie* *user*, logo sekolah, dan skor akhir untuk dapat di-*download* atau di-*share* langsung belum memiliki implementasi *canvas* murni yang tangguh.
- **Framework Mismatch Alignment:** *Prompt* awal menyebutkan bahwa sistem *backend* menggunakan Vue/Socket.io namun klien membutuhkan *snippet* React, sementara `server.js` saat ini men-*serve* React SSR (`client/.output/server/index.mjs`). Perlu dipastikan sinkronisasi teknologinya apakah akan di-*build* murni di React (Nuxt/Next) atau akan dipisahkan.
- **Authentication & Validation:** Saat ini validasi klien untuk masuk ke pertandingan hanya berbasis "6-digit access code" tanpa verifikasi lanjutan dari input nomor telepon.
- **Admin Dashboard UI:** Antarmuka untuk melihat jadwal pertandingan yang sudah di-set (`scheduledMatches`) dan riwayat (`completedMatches`) di sisi Admin UI harus dipastikan berfungsi secara *real-time*.

**Potential Bugs & Edge Cases:**
- **Race Conditions / High Traffic pada Redis:** Karena ini adalah game *massive multiplayer*, *event* `TAP` via socket akan sangat masif. Meskipun sudah menggunakan `redis.incr`, beban pada server *Node.js* dan *Socket.io* berpotensi *bottleneck* jika jumlah *user* (ribuan) menekan tombol berkali-kali dalam 1 detik. (Dibutuhkan implementasi *batching tap* di sisi klien/server).
- **Socket Disconnection Delay:** Pada file `server.js`, ada modifikasi `setTimeout` 100ms ketika user ter-*disconnect* sebelum melakukan update jumlah pemain. Ini ditujukan untuk mencegah *flicker*, namun berpotensi membuat *player count* tidak akurat untuk beberapa milidetik (atau selamanya jika *event loop* tertahan).
- **State Management Sinkronisasi:** Jika Admin melakukan *refresh* halaman di saat *Tap Battle* sedang berlangsung, status sinkronisasi `STATES.TAP_BATTLE` dan *interval broadcasting* harus dipastikan berjalan tanpa menduplikasi *interval*.
