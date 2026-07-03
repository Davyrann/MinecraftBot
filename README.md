# Minecraft Bot Dashboard & Auto-Login Controller

Minecraft Bot client otomatis berbasis **Mineflayer** yang dilengkapi dengan **Web Dashboard** modern. Bot ini dirancang agar dapat diatur secara dinamis melalui antarmuka web, mendukung eksekusi perintah otomatis saat masuk, pendeteksian pesan server untuk auto-reply/auto-login, dan telah dilengkapi dengan berbagai perbaikan protokol (patches) agar kompatibel dengan server Minecraft modern (1.20.x s/d 1.21.x).

---

## 🚀 Fitur Utama

1. **Dashboard Konsol Live & Responsif**:
   - Antarmuka web premium dengan visual gelap (*slate theme*).
   - Menampilkan konsol log bot secara real-time menggunakan Server-Sent Events (SSE).
   - Fitur **Auto-Scroll** yang hanya menggeser area log terminal saja tanpa mengganggu navigasi halaman utama.

2. **Konfigurasi Dinamis Lengkap dari Web**:
   - Mengatur IP Server (Host), Username, Versi Minecraft, Tipe Autentikasi (Cracked/Offline & Premium/Microsoft), serta Client Brand (default: `vanilla`) secara langsung di web tanpa harus menyunting kode.
   - Perubahan konfigurasi akan me-restart koneksi bot secara otomatis.

3. **Startup Commands (Urutan Perintah Masuk)**:
   - Menjalankan serangkaian perintah/chat otomatis setelah bot berhasil memuat dunia (*spawn*).
   - Mendukung penambahan baris secara dinamis dan placeholder `{password}` yang otomatis diganti dengan kata sandi bot.

4. **Auto Reply & Auto Login (Deteksi Chat Server)**:
   - Bot memantau semua jenis pesan server secara menyeluruh (chat pemain, chat lokal/faksi, maupun pengumuman sistem).
   - Jika terdeteksi kata kunci tertentu (misal: `/login`), bot akan otomatis mengirimkan balasan (misal: `/login {password}`) setelah jeda 1 detik secara otomatis.

5. **Runtime Protocol Patches (Portabilitas Tinggi)**:
   - **Fix Biome Bits**: Mengatasi eror `Bits per biome is too big` pada server 1.21.x.
   - **Fix Dimension Codec**: Penanganan fail-safe jika server mengirimkan data dimensi/biome yang tidak dikenali.
   - **Fix Entity Teleport Size**: Mengatasi crash akibat perbedaan ukuran paket koordinat `entity_teleport` (`ENTITY_POSITION_SYNC`) pada versi Minecraft 1.21.2 ke atas.

---

## 🛠️ Persyaratan Sistem

- **Node.js** v18 atau lebih baru.
- **npm** atau **pnpm** sebagai package manager.

---

## ⚙️ Cara Instalasi & Menjalankan

### 1. Persiapan Dependencies Utama
Di direktori root proyek, pasang seluruh pustaka backend:
```bash
pnpm install
# atau
npm install
```

### 2. Kompilasi Kode Frontend (React + Vite)
Masuk ke direktori `frontend`, pasang dependencies, lalu lakukan proses build:
```bash
cd frontend
pnpm install && pnpm run build
# atau
npm install && npm run build
```
Proses ini akan mengompilasi frontend dan menaruh berkas statisnya di folder `public` pada direktori utama.

### 3. Menjalankan Server Utama
Kembali ke direktori root, lalu jalankan server Node.js:
```bash
cd ..
node index.js
```
Setelah berjalan, buka browser Anda dan akses dashboard pada:
`http://localhost:3000`

---

## 🔒 Keamanan Data (Security)

Proyek ini telah dikonfigurasi agar data sensitif tidak bocor ke Git. Berkas-berkas berikut telah ditambahkan ke `.gitignore` sehingga **aman** dari proses commit dan upload ke GitHub:
- `.env` (Berkas konfigurasi environment lokal).
- `config.json` (Menyimpan riwayat password, konfigurasi server Minecraft, dan pemicu auto-reply Anda).
- `node_modules/` dan folder build sementara.

---

## 💬 Pertanyaan Umum (FAQ)

### *Apakah patch-patch yang kita buat tetap bekerja saat dibagikan ke GitHub?*
**Ya, 100% bekerja.** Seluruh *monkey-patching* (perbaikan skema paket `entity_teleport`, data biome, dan `prismarine-nbt`) ditulis langsung di bagian atas berkas start-up `index.js`. Perbaikan ini bekerja di level memori saat server Node dijalankan pertama kali. 

Siapa pun yang meng-clone proyek ini dari GitHub Anda akan langsung menikmati fitur penambalan protokol ini secara otomatis tanpa perlu memodifikasi berkas di dalam folder `node_modules` mereka secara manual.
