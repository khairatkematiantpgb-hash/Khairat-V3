/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Member, LedgerRow, AppState, KewanganTransaction } from '../types';

export const defaultMembers: Member[] = [
  {
    noAhli: '001',
    nama: 'x',
    ic: 'x',
    alamat: 'x',
    status: 'Tidak Aktif'
  },
  {
    noAhli: '002',
    nama: 'Wan Teh binti Long',
    ic: '2035433',
    alamat: 'PT 7144 K, Kampung Perpindahan Gong Badak, 21300 Kuala Nerus, Terengganu',
    status: 'Tidak Aktif'
  },
  {
    noAhli: '003',
    nama: 'Mat Ali bin Din',
    ic: '2890906',
    alamat: '7094, Kg. Baru Gong Datok, Gong Badak 21300 Kuala Nerus, Terengganu',
    status: 'Tidak Aktif'
  },
  {
    noAhli: '004',
    nama: 'x',
    ic: 'x',
    alamat: 'x',
    status: 'Tidak Aktif'
  },
  {
    noAhli: '005',
    nama: 'Mahani binti Mohd',
    ic: '580712-11-5062',
    alamat: 'C-29, RAKR Gong Badak, 21300 Kuala Nerus, Terengganu',
    status: 'Aktif',
    tanggungan: [
      { nama: 'Mohd Nor bin Isa', hubungan: 'Suami', ic: '550403-11-5129' },
      { nama: 'Ahmad Syakir bin Mohd Nor', hubungan: 'Anak', ic: '881021-11-5991' }
    ]
  },
  {
    noAhli: '006',
    nama: 'Khalifah binti Abdullah',
    ic: '4387607',
    alamat: 'C-28, RAKR Gong Badak, 21300 Kuala Nerus, Terengganu',
    status: 'Aktif',
    tanggungan: [
      { nama: 'Nurul Huda binti Ali', hubungan: 'Anak', ic: '780102-11-5612' }
    ]
  },
  {
    noAhli: '007',
    nama: 'x',
    ic: 'x',
    alamat: 'x',
    status: 'Tidak Aktif'
  },
  {
    noAhli: '008',
    nama: 'Mustapar bin Abu Bakar',
    ic: '580622-05-5289',
    alamat: 'C-97, RAKR Gong Badak, 21300 Kuala Nerus, Terengganu',
    status: 'Aktif',
    tanggungan: [
      { nama: 'Siti Fatimah binti Awang', hubungan: 'Isteri', ic: '611204-11-5042' },
      { nama: 'Najwa binti Mustapar', hubungan: 'Anak', ic: '920815-11-5232' },
      { nama: 'Aimi binti Mustapar', hubungan: 'Anak', ic: '951111-11-5908' }
    ]
  },
  {
    noAhli: '009',
    nama: 'Harazaman bin Hashim',
    ic: '570714-11-5139',
    alamat: 'C-92, RAKR Gong Badak, 21300 Kuala Nerus, Terengganu',
    status: 'Aktif',
    tanggungan: [
      { nama: 'Rosnah binti Ahmad', hubungan: 'Isteri', ic: '620914-11-5006' }
    ]
  },
  {
    noAhli: '010',
    nama: 'Gayah binti Yusoff',
    ic: 'x',
    alamat: 'x',
    status: 'Tidak Aktif'
  },
  {
    noAhli: '011',
    nama: 'Hashim @ Aziz bin Awang',
    ic: '2889801',
    alamat: 'A-47, RAKR Gong Badak, 21300 Kuala Nerus, Terengganu',
    status: 'Aktif',
    tanggungan: [
      { nama: 'Aminah binti Omar', hubungan: 'Isteri', ic: '350612-11-5110' }
    ]
  }
];

export const defaultLedger: LedgerRow[] = [
  // 001 - 004 starting in current year (2026) with empty payments
  {
    noAhli: '001',
    namaAhli: 'x',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },
  {
    noAhli: '002',
    namaAhli: 'Wan Teh binti Long',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },
  {
    noAhli: '003',
    namaAhli: 'Mat Ali bin Din',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },
  {
    noAhli: '004',
    namaAhli: 'x',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },
  
  // 005 (Mahani binti Mohd) history
  {
    noAhli: '005',
    namaAhli: 'Mahani binti Mohd',
    tahun: 2021,
    jan: '865', feb: '865', mac: '494', apr: '494', mei: '494', jun: '494',
    jul: '494', ogo: '494', sep: '494', okt: '494', nov: '494', dis: '494',
    lebihanKredit: 0
  },
  {
    noAhli: '005',
    namaAhli: 'Mahani binti Mohd',
    tahun: 2022,
    jan: '1918', feb: '1918', mac: '1918', apr: '1918', mei: '1368', jun: '1368',
    jul: '1368', ogo: '1368', sep: '1368', okt: '1368', nov: '1368', dis: '1368',
    lebihanKredit: 0
  },
  {
    noAhli: '005',
    namaAhli: 'Mahani binti Mohd',
    tahun: 2023,
    jan: '1368', feb: '1368', mac: '1368', apr: '1368', mei: '1368', jun: '1368',
    jul: '1122', ogo: '1122', sep: '1122', okt: '1122', nov: '1122', dis: '1122',
    lebihanKredit: 0
  },
  {
    noAhli: '005',
    namaAhli: 'Mahani binti Mohd',
    tahun: 2024,
    jan: '1122', feb: '1122', mac: '1122', apr: '1122', mei: '1122', jun: '1122',
    jul: '1122', ogo: '1122', sep: '1122', okt: '1122', nov: '1122', dis: '1122',
    lebihanKredit: 0
  },
  {
    noAhli: '005',
    namaAhli: 'Mahani binti Mohd',
    tahun: 2025,
    jan: '1319', feb: '1319', mac: '1319', apr: '1319', mei: '1319', jun: '1319',
    jul: '1319', ogo: '1319', sep: '1319', okt: '1319', nov: '1319', dis: '1319',
    lebihanKredit: 0
  },
  {
    noAhli: '005',
    namaAhli: 'Mahani binti Mohd',
    tahun: 2026,
    jan: '1329', feb: '1329', mac: '1329', apr: '1329', mei: '1329', jun: '1329',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },

  // 006 (Khalifah binti Abdullah) history
  {
    noAhli: '006',
    namaAhli: 'Khalifah binti Abdullah',
    tahun: 2021,
    jan: '866', feb: '866', mac: '493', apr: '493', mei: '493', jun: '493',
    jul: '493', ogo: '493', sep: '493', okt: '493', nov: '493', dis: '493',
    lebihanKredit: 0
  },
  {
    noAhli: '006',
    namaAhli: 'Khalifah binti Abdullah',
    tahun: 2022,
    jan: '1919', feb: '1919', mac: '1919', apr: '1919', mei: '934', jun: '934',
    jul: '934', ogo: '1373', sep: '1373', okt: '1373', nov: '1373', dis: '1373',
    lebihanKredit: 0
  },
  {
    noAhli: '006',
    namaAhli: 'Khalifah binti Abdullah',
    tahun: 2023,
    jan: '1373', feb: '1373', mac: '1373', apr: '1373', mei: '1373', jun: '1373',
    jul: '1123', ogo: '1123', sep: '1123', okt: '1123', nov: '1123', dis: '1123',
    lebihanKredit: 0
  },
  {
    noAhli: '006',
    namaAhli: 'Khalifah binti Abdullah',
    tahun: 2024,
    jan: '1123', feb: '1123', mac: '1123', apr: '1123', mei: '1123', jun: '1123',
    jul: '1123', ogo: '1123', sep: '1123', okt: '1123', nov: '1123', dis: '1123',
    lebihanKredit: 0
  },

  // 007 - 011 starting in current year (2026) with empty or pre-filled payments
  {
    noAhli: '007',
    namaAhli: 'x',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },
  {
    noAhli: '008',
    namaAhli: 'Mustapar bin Abu Bakar',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },
  {
    noAhli: '009',
    namaAhli: 'Harazaman bin Hashim',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },
  {
    noAhli: '010',
    namaAhli: 'Gayah binti Yusoff',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  },
  {
    noAhli: '011',
    namaAhli: 'Hashim @ Aziz bin Awang',
    tahun: 2026,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  }
];

export const defaultKewangan: KewanganTransaction[] = [
  // Baki awal pada 1 Jan 2026
  { id: 'k-1', tarikh: '2026-01-01', kenyataan: 'Baki pada 1 Januari 2026', kategoriAkaun: 'Pelaburan Bank Rakyat (33007456390002/2024/TM/ 10.11.2026)', jenisTransaksi: 'masuk', amaun: 13579.01 },
  { id: 'k-2', tarikh: '2026-01-01', kenyataan: 'Baki pada 1 Januari 2026', kategoriAkaun: 'Pelaburan Bank Rakyat (33007456390003/2024/TM/ 28.04.2026)', jenisTransaksi: 'masuk', amaun: 11906.00 },
  { id: 'k-3', tarikh: '2026-01-01', kenyataan: 'Baki pada 1 Januari 2026', kategoriAkaun: 'Pelaburan Bank Rakyat (33007456390004/2024/TM/ 28.01.2026)', jenisTransaksi: 'masuk', amaun: 51729.73 },
  { id: 'k-4', tarikh: '2026-01-01', kenyataan: 'Baki pada 1 Januari 2026', kategoriAkaun: 'Bank', jenisTransaksi: 'masuk', amaun: 13695.49 },
  { id: 'k-5', tarikh: '2026-01-01', kenyataan: 'Baki pada 1 Januari 2026', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 850.79 },

  // Transaksi-transaksi lain
  { id: 'k-6', tarikh: '2026-01-09', kenyataan: 'Kematian/Kebajikan: Mohamad Nor Adzlee bin Isa', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 700.00 },
  { id: 'k-7', tarikh: '2026-01-15', kenyataan: 'Kutipan Yuran Ahli: Zakaria bin Jusoh', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 819.00 },
  { id: 'k-8', tarikh: '2026-01-18', kenyataan: 'Kematian/Kebajikan: Hj.Mustaffa @Abd.Rahman b.Abdullah', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 500.00 },
  { id: 'k-9', tarikh: '2026-01-18', kenyataan: 'Warded: Hj.Mustaffa @Abd.Rahman b.Abdullah', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 50.00 },
  { id: 'k-10', tarikh: '2026-02-05', kenyataan: 'Photostat: Mohamad bin Alias', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 21.60 },
  { id: 'k-11', tarikh: '2026-02-15', kenyataan: 'Abdul Quddus b Che Abdullah', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 100.00 },
  { id: 'k-12', tarikh: '2026-02-26', kenyataan: 'Kematian/Kebajikan: Muhammad Al-Ariff b.Atab', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 400.00 },
  { id: 'k-13', tarikh: '2026-03-09', kenyataan: 'Kematian/Kebajikan: Azmi b. Bidin', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 400.00 },
  { id: 'k-14', tarikh: '2026-03-09', kenyataan: 'Kutipan Yuran Ahli: Mohamad bin Alias', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 948.00 },
  { id: 'k-15', tarikh: '2026-04-12', kenyataan: 'Warded: Sulaiman bin Ngah', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 80.00 },
  { id: 'k-16', tarikh: '2026-04-23', kenyataan: 'Photostat: Mohamad bin Alias', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 20.40 },
  { id: 'k-17', tarikh: '2026-05-10', kenyataan: 'Warded: Hj Abd Ghani bin Mat Amin', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 100.00 },
  { id: 'k-18', tarikh: '2026-05-22', kenyataan: 'Kematian/Kebajikan: Mohd Failani bin Ismail', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 400.00 },
  { id: 'k-19', tarikh: '2026-06-04', kenyataan: 'Kutipan Yuran Ahli: Mohamad bin Alias', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 929.00 },
  { id: 'k-20', tarikh: '2026-06-04', kenyataan: 'Saguhati Setiausaha: Zakaria bin Jusoh (2025-2026)', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 600.00 },
  { id: 'k-21', tarikh: '2026-06-04', kenyataan: 'Photostat: Zakaria bin Jusoh', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 73.63 },
  { id: 'k-22', tarikh: '2026-06-06', kenyataan: 'Kutipan Yuran Ahli: Hj. Rani bin Mat', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 346.00 },
  { id: 'k-23', tarikh: '2026-06-09', kenyataan: 'Kutipan Yuran Ahli: Hj. Latif bin Sulong', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 974.00 },
  { id: 'k-24', tarikh: '2026-06-09', kenyataan: 'Kutipan Yuran Ahli: Hj. Mamat bin Bakar', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 964.00 },
  { id: 'k-25', tarikh: '2026-06-10', kenyataan: 'Kutipan Yuran Ahli: Zakaria bin Jusoh', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 1629.00 },
  { id: 'k-26', tarikh: '2026-06-11', kenyataan: 'Pengurusan: Cop Pertubuhan', kategoriAkaun: 'Tunai', jenisTransaksi: 'keluar', amaun: 90.00 },
  { id: 'k-27', tarikh: '2026-06-11', kenyataan: 'Dividen (31.12.25-11.06.26)', kategoriAkaun: 'Bank', jenisTransaksi: 'masuk', amaun: 66.94 },
  { id: 'k-28', tarikh: '2026-06-13', kenyataan: 'Kutipan Yuran Ahli: Hj. Wahab bin Daud', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 572.00 },
  { id: 'k-29', tarikh: '2026-06-14', kenyataan: 'Kutipan Yuran Ahli: Mohamad Ghazali bin Ismail', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 36.00 },
  { id: 'k-30', tarikh: '2026-06-17', kenyataan: 'Yuran Ahli :Waris Fadilas bin Shafie - PIC Zakaria Jusoh', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 50.00 },
  { id: 'k-31', tarikh: '2026-06-17', kenyataan: 'Yuran Ahli : Mohamad Syafiq bin Mohamad Kabidi - PIC Zakaria Jusoh', kategoriAkaun: 'Tunai', jenisTransaksi: 'masuk', amaun: 36.00 }
];

export function getDefaultAppState(): AppState {
  return {
    members: defaultMembers,
    ledger: defaultLedger,
    kewangan: defaultKewangan,
    useGoogleSheets: true,
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzWl9ccXM2e39h2rjYlezESn2Y-DOtQKxu3mqVZ45b64u_NtN6yeJWTGiy5eBWspo0T/exec',
    googleSheetsId: '',
    kadarYuranSebulan: 3,
    adminPassword: 'gongbadak123'
  };
}
