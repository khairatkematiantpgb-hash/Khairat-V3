/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Tanggungan {
  nama: string;
  hubungan: string; // e.g., 'Isteri', 'Suami', 'Anak', 'Ibu', 'Bapa'
  ic: string;
}

export interface Member {
  noAhli: string;
  nama: string;
  ic: string;
  alamat: string;
  status: string; // 'Aktif' | 'Tidak Aktif'
  catatan?: string;
  tanggungan?: Tanggungan[];
  tel?: string;
}

export interface LedgerRow {
  noAhli: string;
  namaAhli: string;
  tahun: number;
  jan: string;
  feb: string;
  mac: string;
  apr: string;
  mei: string;
  jun: string;
  jul: string;
  ogo: string;
  sep: string;
  okt: string;
  nov: string;
  dis: string;
  lebihanKredit: number;
}

export interface KewanganTransaction {
  id: string;
  tarikh: string; // YYYY-MM-DD
  kenyataan: string;
  kategoriAkaun: string; // One of the 5 categories
  jenisTransaksi: 'masuk' | 'keluar';
  amaun: number;
}

export interface Pekeliling {
  id: string;
  noRujukan: string;
  tarikh: string;
  tarikhBerkuatkuasa?: string;
  jenis?: 'Pekeliling' | 'Hebahan';
  tajuk: string;
  kandungan: string;
  penerbit: string;
  jawatanPenerbit: string;
  kepentingan: 'Penting' | 'Biasa' | 'Segera';
}

export interface RoleAssignment {
  nama: string;
  tel: string;
  noAhli?: string;
}

export interface ChartRoles {
  [roleId: string]: RoleAssignment;
}

export interface AppState {
  members: Member[];
  ledger: LedgerRow[];
  googleSheetsId: string;
  appsScriptUrl: string;
  useGoogleSheets: boolean;
  kadarYuranSebulan: number;
  adminPassword?: string;
  ajkPassword?: string;
  kewangan?: KewanganTransaction[];
  customAccountNames?: { [key: string]: string };
  chartRoles?: ChartRoles;
  pekelilingList?: Pekeliling[];
}

export const MONTH_KEYS: (keyof LedgerRow)[] = [
  'jan', 'feb', 'mac', 'apr', 'mei', 'jun',
  'jul', 'ogo', 'sep', 'okt', 'nov', 'dis'
];

export const MONTH_LABELS = [
  'JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN',
  'JUL', 'OGO', 'SEP', 'OKT', 'NOV', 'DIS'
];
