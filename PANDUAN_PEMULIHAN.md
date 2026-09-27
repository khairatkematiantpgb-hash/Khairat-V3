# Panduan Pemulihan Aplikasi Khairat Kematian Gong Badak

Fail arkib ZIP ini mengandungi salinan penuh (Full Backup) bagi kod sumber dan pangkalan data sistem Khairat Kematian Taman Perkasa Gong Badak.

---

## Kandungan Backup Ini:
1. **Pangkalan Data Lengkap (`db_state.json`)**
   - 499+ Rekod Ahli & Tanggungan
   - Rekod Buku Lejar Yuran & Bayaran Bulanan
   - Penyata Kewangan & Buku Akaun
   - Tetapan Sistem & Konfigurasi Google Sheets

2. **Kod Sumber Penuh Sistem**
   - `src/` - Semua modul paparan (Dashboard, Lejar, Pangkalan Ahli, Kewangan, Integrasi, dll.)
   - `server.ts` - Pelayan Backend Node.js / Express untuk pengurusan API dan penyegerakan awan
   - `index.html`, `vite.config.ts`, `tsconfig.json` - Konfigurasi binaan aplikasi Vite & React

---

## Cara Menjalankan Aplikasi Dari Fail Backup (Restore):

### Prasyarat:
Pastikan komputer anda telah dipasang **Node.js** (versi 18 ke atas) dari [nodejs.org](https://nodejs.org).

### Langkah 1: Ekstrak Fail ZIP
Ekstrak kandungan fail zip ini ke dalam mana-mana folder pilihan anda pada komputer.

### Langkah 2: Buka Terminal / Command Prompt
Buka terminal (atau PowerShell / CMD) di dalam folder yang telah diekstrak tadi.

### Langkah 3: Pasang Kebergantungan (Dependencies)
Jalankan arahan berikut untuk memuat turun semua modul yang diperlukan:
```bash
npm install
```

### Langkah 4: Lancarkan Aplikasi
Untuk menjalankan sistem dalam mod pembangunan (Development):
```bash
npm run dev
```

Sistem akan berjalan dan anda boleh membukanya di pelayar web melalui alamat:
```
http://localhost:3000
```

### Langkah 5: Membina untuk Pelayan / Pengeluaran (Production Build)
Sekiranya anda ingin membina fail pengeluaran untuk dihoskan ke pelayan:
```bash
npm run build
npm start
```

---

## Cara Melakukan Backup Baharu di Masa Hadapan:
Anda boleh menghasilkan fail zip backup baharu pada bila-bila masa dengan menjalankan:
```bash
npm run backup
```
atau menggunakan skrip shell:
```bash
bash backup.sh
```
Fail zip terkini dengan tarikh dan masa semasa akan dijana secara automatik di direktori projek.
