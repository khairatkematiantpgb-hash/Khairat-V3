/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppState } from '../types';
import { calculateOutstandingDues, isSameMemberId } from '../lib/database';
import { FileText, AlertTriangle, Eye, Search, FileSpreadsheet, Download, Printer } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ReportsSummaryProps {
  state: AppState;
  onViewProfile?: (noAhli: string) => void;
  currentRole: 'admin' | 'user' | 'ajk' | null;
}

export default function ReportsSummary({ state, onViewProfile, currentRole }: ReportsSummaryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [addressFilter, setAddressFilter] = useState<string>('all');
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const [visibleColumns, setVisibleColumns] = useState({
    noAhli: true,
    nama: true,
    ic: currentRole !== 'user',
    tel: true,
    alamat: true,
    status: true,
    lunasSehingga: true,
    tunggakan: true,
    periodTunggakan: true,
    catatan: true,
  });

  const kadarYuran = state.kadarYuranSebulan || 3;

  // Helper to categorize house address
  const getAddressCategory = (alamat: string | undefined): string => {
    if (!alamat) return 'others';
    const upper = alamat.trim().toUpperCase();
    
    const hasBlockOrHouse = (str: string, letter: string): boolean => {
      // 1. Check if it starts with the letter followed by a non-letter (or end of string)
      const startsWithPattern = new RegExp(`^${letter}([^A-Z]|$)`);
      if (startsWithPattern.test(str)) {
        return true;
      }
      
      // 2. Check if it contains keywords: BLOK X, BLOCK X, RUMAH X, LOT X, NO X, NO. X
      const keywords = ['BLOK', 'BLOCK', 'RUMAH', 'LOT', 'NO', 'NO.'];
      for (const kw of keywords) {
        const patterns = [
          `${kw} ${letter}`,
          `${kw}-${letter}`,
          `${kw}${letter}`
        ];
        for (const p of patterns) {
          if (str.includes(p)) {
            return true;
          }
        }
      }

      // 3. Match if the letter appears as a separate word/code inside the address,
      // e.g., preceded by a non-letter and followed by a non-letter.
      const wordPattern = new RegExp(`[^A-Z]${letter}([^A-Z]|$)`);
      if (wordPattern.test(str)) {
        return true;
      }

      return false;
    };

    if (hasBlockOrHouse(upper, 'M')) return 'start_m';
    if (hasBlockOrHouse(upper, 'A')) return 'start_a';
    if (hasBlockOrHouse(upper, 'B')) return 'start_b';
    if (hasBlockOrHouse(upper, 'C')) return 'start_c';
    
    return 'others';
  };

  const addressCategories = [
    { id: 'all', label: 'Semua Alamat', count: state.members.length },
    { id: 'start_a', label: 'A xxx', count: state.members.filter(m => getAddressCategory(m.alamat) === 'start_a').length },
    { id: 'start_b', label: 'B xxx', count: state.members.filter(m => getAddressCategory(m.alamat) === 'start_b').length },
    { id: 'start_c', label: 'C xxx', count: state.members.filter(m => getAddressCategory(m.alamat) === 'start_c').length },
    { id: 'start_m', label: 'M xxx / Blok M xxx', count: state.members.filter(m => getAddressCategory(m.alamat) === 'start_m').length },
    { id: 'others', label: 'Lain-lain', count: state.members.filter(m => getAddressCategory(m.alamat) === 'others').length },
  ];

  // Calculate total outstanding overall arrears
  const totalDuesSum = state.members.reduce((sum, member) => {
    if (member.status !== 'Aktif') return sum;
    const memberRows = state.ledger.filter(r => isSameMemberId(r.noAhli, member.noAhli));
    const totalLebihanKredit = memberRows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);
    const dues = calculateOutstandingDues(member.noAhli, state.ledger, state.members, kadarYuran);
    const actualDues = Math.max(0, dues - totalLebihanKredit);
    return sum + actualDues;
  }, 0);

  // Helper to compute exact months/years that are unpaid
  const getArrearsDetails = (m: any) => {
    if (m.status !== 'Aktif') return 'N/A (Tidak Aktif)';
    
    const cleanNoAhli = m.noAhli;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const monthsKeys: string[] = [
      'jan', 'feb', 'mac', 'apr', 'mei', 'jun',
      'jul', 'ogo', 'sep', 'okt', 'nov', 'dis'
    ];
    const monthLabels = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];

    const hasPaidBeyond = () => {
      const currentYearRow = state.ledger.find(r => isSameMemberId(r.noAhli, cleanNoAhli) && r.tahun === currentYear);
      if (currentYearRow) {
        for (let i = currentMonthIdx + 1; i < 12; i++) {
          if ((currentYearRow as any)[monthsKeys[i]]) {
            return true;
          }
        }
      }
      const futureYearRows = state.ledger.filter(r => isSameMemberId(r.noAhli, cleanNoAhli) && r.tahun > currentYear);
      if (futureYearRows.length > 0) {
        for (const row of futureYearRows) {
          for (let i = 0; i < 12; i++) {
            if ((row as any)[monthsKeys[i]]) {
              return true;
            }
          }
        }
      }
      return false;
    };

    if (hasPaidBeyond()) {
      return 'Tiada ';
    }

    const memberLedgerRows = state.ledger.filter(r => isSameMemberId(r.noAhli, cleanNoAhli));
    if (memberLedgerRows.length === 0) {
      // No payment records at all
      const monthsList = monthLabels.slice(0, currentMonthIdx + 1).join(', ');
      return `${currentYear} (${monthsList})`;
    }

    const years = memberLedgerRows.map(r => r.tahun);
    const minYear = Math.min(...years);

    const arrearsSegments: string[] = [];

    for (let yr = minYear; yr <= currentYear; yr++) {
      const row = state.ledger.find(r => isSameMemberId(r.noAhli, cleanNoAhli) && r.tahun === yr);
      const limit = yr === currentYear ? currentMonthIdx : 11;
      const unpaidInYear: string[] = [];
      
      for (let i = 0; i <= limit; i++) {
        const key = monthsKeys[i];
        const cellValue = row ? (row as any)[key] : '';
        if (!cellValue) {
          unpaidInYear.push(monthLabels[i]);
        }
      }

      if (unpaidInYear.length > 0) {
        if (unpaidInYear.length === limit + 1) {
          arrearsSegments.push(`${yr} (Penuh)`);
        } else {
          arrearsSegments.push(`${yr} (${unpaidInYear.join(', ')})`);
        }
      }
    }

    return arrearsSegments.length > 0 ? arrearsSegments.join('; ') : 'Tiada';
  };

  // Helper to find the latest month/year paid (Lunas Sehingga)
  const getLatestPaidMonthYear = (m: any) => {
    if (m.status !== 'Aktif') return 'N/A (Tidak Aktif)';
    const cleanNoAhli = m.noAhli;
    const memberLedgerRows = state.ledger.filter(r => isSameMemberId(r.noAhli, cleanNoAhli));
    if (memberLedgerRows.length === 0) {
      return 'Tiada Rekod';
    }

    const monthKeys: string[] = ['jan', 'feb', 'mac', 'apr', 'mei', 'jun', 'jul', 'ogo', 'sep', 'okt', 'nov', 'dis'];
    const monthNames = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

    let maxPaidValue = -1;
    let maxPaidLabel = '-';

    for (const row of memberLedgerRows) {
      const yr = row.tahun;
      for (let i = 0; i < 12; i++) {
        const key = monthKeys[i];
        if ((row as any)[key]) {
          const val = yr * 100 + i;
          if (val > maxPaidValue) {
            maxPaidValue = val;
            maxPaidLabel = `${monthNames[i]}/${yr}`;
          }
        }
      }
    }

    return maxPaidValue !== -1 ? maxPaidLabel : 'Belum Bayar';
  };

  // Pre-calculate membership classifications for totals
  const memberStats = state.members.map(m => {
    const rows = state.ledger.filter(r => isSameMemberId(r.noAhli, m.noAhli));
    const totalLebihanKredit = rows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);
    const dues = calculateOutstandingDues(m.noAhli, state.ledger, state.members, kadarYuran);
    const actualDues = Math.max(0, dues - totalLebihanKredit);
    
    return {
      noAhli: m.noAhli,
      status: m.status,
      dues: actualDues
    };
  });

  const countSemua = state.members.length;
  const countInaktif = memberStats.filter(m => m.status !== 'Aktif').length;
  const countAktif = memberStats.filter(m => m.status === 'Aktif').length;
  const countTiada = memberStats.filter(m => m.status !== 'Aktif').length; 
  const countLunas = memberStats.filter(m => m.status === 'Aktif' && m.dues === 0).length;
  const countAdaTunggakan = memberStats.filter(m => m.status === 'Aktif' && m.dues > 0).length;
  const countTunggakanLebih50 = memberStats.filter(m => m.status === 'Aktif' && m.dues > 50).length;

  const categories = [
    { id: 'all', label: 'Semua Ahli', count: countSemua },
    { id: 'tidak_aktif', label: '1. Status Tidak Aktif', count: countInaktif },
    { id: 'aktif', label: '2. Status Aktif', count: countAktif },
    { id: 'tiada', label: '3. Tiada (Tidak Aktif)', count: countTiada },
    { id: 'lunas', label: '4. Lunas / Cemerlang', count: countLunas },
    { id: 'ada_tunggakan', label: '5. Ada Tunggakan', count: countAdaTunggakan },
    { id: 'tunggakan_50', label: '6. Tunggakan > RM50', count: countTunggakanLebih50 },
  ];

  // Filter and sort members list based on query and group filter
  const filteredList = state.members
    .filter((member) => {
      // 1. Text Search query filter
      const cleanSearch = searchQuery.trim().toLowerCase();
      const isNumericSearch = /^\d+$/.test(cleanSearch);

      const nameMatch = member.nama.toLowerCase().includes(cleanSearch);
      const idMatch = member.noAhli.toLowerCase().includes(cleanSearch) || isSameMemberId(member.noAhli, cleanSearch);
      const icMatch = member.ic && member.ic.includes(cleanSearch) && (!isNumericSearch || cleanSearch.length >= 4);
      const addrMatch = member.alamat ? member.alamat.toLowerCase().includes(cleanSearch) : false;
      
      const passSearch = nameMatch || idMatch || icMatch || addrMatch;
      if (!passSearch) return false;

      // 2. Group Filter
      let passGroup = true;
      if (filterGroup !== 'all') {
        const stats = memberStats.find(s => s.noAhli === member.noAhli);
        if (stats) {
          if (filterGroup === 'tidak_aktif' || filterGroup === 'tiada') {
            passGroup = stats.status !== 'Aktif';
          } else if (filterGroup === 'aktif') {
            passGroup = stats.status === 'Aktif';
          } else if (filterGroup === 'lunas') {
            passGroup = stats.status === 'Aktif' && stats.dues === 0;
          } else if (filterGroup === 'ada_tunggakan') {
            passGroup = stats.status === 'Aktif' && stats.dues > 0;
          } else if (filterGroup === 'tunggakan_50') {
            passGroup = stats.status === 'Aktif' && stats.dues > 50;
          }
        } else {
          passGroup = false;
        }
      }
      if (!passGroup) return false;

      // 3. Address Filter
      if (addressFilter !== 'all') {
        const addrCat = getAddressCategory(member.alamat);
        if (addrCat !== addressFilter) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort sequentially ascending by No. Ahli
      return a.noAhli.localeCompare(b.noAhli, undefined, { numeric: true });
    });

  // Export to Excel (CSV with UTF-8 BOM)
  const handleExportExcel = () => {
    const showIc = currentRole !== 'user';
    const headers = [
      'No. Ahli',
      'Nama Ahli',
      ...(showIc ? ['No. IC'] : []),
      'No. Telefon',
      'Alamat Berdaftar',
      'Status Keahlian',
      'Jumlah Tunggakan (RM)',
      'Lunas Sehingga',
      'Bulan/Tahun Tunggakan',
      'Catatan'
    ];

    const dataRows = filteredList.map(m => {
      const rows = state.ledger.filter(r => isSameMemberId(r.noAhli, m.noAhli));
      const totalLebihanKredit = rows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);
      const dues = calculateOutstandingDues(m.noAhli, state.ledger, state.members, kadarYuran);
      const actualDues = Math.max(0, dues - totalLebihanKredit);
      const arrearsDetail = actualDues > 0 ? getArrearsDetails(m) : 'Lunas';

      return [
        m.noAhli,
        m.nama,
        ...(showIc ? [m.ic || '-'] : []),
        m.tel || '-',
        m.alamat || '-',
        m.status,
        actualDues,
        getLatestPaidMonthYear(m),
        arrearsDetail,
        m.catatan || '-'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...dataRows.map(row => row.map(val => {
        const text = String(val);
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rumusan_Khairat_Gong_Badak_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedDate = new Date().toLocaleDateString('ms-MY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = new Date().toLocaleTimeString('ms-MY', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="space-y-6 font-sans text-slate-800" id="reports-summary-component">
      
      {/* Printable Preview Overlay */}
      {isPrinting && createPortal(
        <div id="print-area-outlet" className="fixed inset-0 bg-white z-[99999] p-10 overflow-y-auto text-slate-900 font-sans print:relative print:inset-auto print:p-0 print:m-0 print:overflow-visible print:bg-white print:block print:h-auto print:w-full">
          
          {/* Print Controls Ribbon - Hides in print */}
          <div className="mb-8 bg-amber-50 border border-amber-200 p-5 rounded-xl print:hidden flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse shrink-0" />
                <div>
                  <span className="text-xs font-bold text-amber-900 block font-sans uppercase tracking-wide">Mod Pratonton Dokumen (PDF)</span>
                  <span className="text-[10px] text-amber-700 block mt-0.5 font-sans">Laporan sedia dicetak. Klik butang cetak di sebelah kanan untuk memilih pencetak atau simpan sebagai PDF.</span>
                </div>
              </div>
              <div className="flex gap-2 self-stretch md:self-auto justify-end">
                <button
                  onClick={() => {
                    try {
                      window.print();
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="px-4 py-2.5 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-black hover:bg-slate-800 cursor-pointer transition flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="h-4 w-4" />
                  Cetak / Simpan PDF
                </button>
                <button
                  onClick={() => setIsPrinting(false)}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition shadow-xxs"
                >
                  Batal / Tutup
                </button>
              </div>
            </div>

            {/* Column Selector Configurator Section */}
            <div className="pt-4 border-t border-amber-200/60 mt-1">
              <span className="block text-[10px] font-black text-amber-905 uppercase tracking-wider mb-2">
                ⚙️ PILIHAN KOLUM UNTUK DIKADARKAN SEBELUM DICETAK (Sembunyikan kolum tidak perlu untuk membesarkan tulisan):
              </span>
              
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => setVisibleColumns({
                    noAhli: true,
                    nama: true,
                    ic: currentRole !== 'user',
                    tel: true,
                    alamat: true,
                    status: true,
                    lunasSehingga: true,
                    tunggakan: true,
                    periodTunggakan: true,
                    catatan: true,
                  })}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[9px] rounded-md transition border border-amber-300"
                >
                  Semua Kolum
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleColumns({
                    noAhli: true,
                    nama: true,
                    ic: false,
                    tel: false,
                    alamat: false,
                    status: true,
                    lunasSehingga: true,
                    tunggakan: true,
                    periodTunggakan: true,
                    catatan: false,
                  })}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[9px] rounded-md transition border border-amber-300"
                >
                  Ringkasan Tunggakan (Disyorkan PDF)
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleColumns({
                    noAhli: true,
                    nama: true,
                    ic: false,
                    tel: true,
                    alamat: false,
                    status: true,
                    lunasSehingga: false,
                    tunggakan: false,
                    periodTunggakan: false,
                    catatan: true,
                  })}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[9px] rounded-md transition border border-amber-300"
                >
                  Hubungan & Catatan
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleColumns({
                    noAhli: true,
                    nama: true,
                    ic: false,
                    tel: false,
                    alamat: true,
                    status: false,
                    lunasSehingga: false,
                    tunggakan: false,
                    periodTunggakan: false,
                    catatan: false,
                  })}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[9px] rounded-md transition border border-amber-300"
                >
                  Senarai Alamat Sahaja
                </button>
              </div>

              {/* Checkbox grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2 bg-amber-50/50 p-3 rounded-lg border border-amber-200/50">
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.noAhli}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, noAhli: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>No. Ahli</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.nama}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, nama: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>Nama Ahli</span>
                </label>
                {currentRole !== 'user' && (
                  <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleColumns.ic}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, ic: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                    />
                    <span>No. IC</span>
                  </label>
                )}
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.tel}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, tel: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>No. Telefon</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.alamat}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, alamat: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>Alamat Berdaftar</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.status}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, status: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>Status Keahlian</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.lunasSehingga}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, lunasSehingga: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>Lunas Sehingga</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.tunggakan}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, tunggakan: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>Jumlah Tunggakan</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.periodTunggakan}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, periodTunggakan: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>Bulan Tertunggak</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleColumns.catatan}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, catatan: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-amber-300"
                  />
                  <span>Catatan</span>
                </label>
              </div>
            </div>

            {isInIframe && (
              <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-lg text-xs leading-relaxed shadow-sm">
                <p className="font-extrabold text-[11px] mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  🛑 MAKLUMAN PENTING (BACA JIKA TIADA PENERIMAAN POPUP MENU):
                </p>
                <p className="mb-2">
                  Memandangkan aplikasi ini sedang berjalan di dalam panel <strong>Pratonton (IFrame Sandbox)</strong> AI Studio, pelayar web (browser) menghalang arahan cetakan fizikal secara langsung atas faktor keselamatan.
                </p>
                <ul className="list-decimal pl-5 space-y-1 font-semibold text-[11px] text-red-950">
                  <li>Sila klik butang ikon anak panah <strong className="bg-red-100 px-1 py-0.5 rounded text-red-900 border border-red-250 font-sans">"Open in a new tab"</strong> di bahagian atas kanan skrin kelabu AI Studio (luar bingkai putih aplikasi).</li>
                  <li>Selepas aplikasi dibuka di tab berasingan, anda boleh menekan semula butang di atas untuk memanggil menu cetakan rasmi atau menyimpan terus sebagai dokumen PDF!</li>
                </ul>
              </div>
            )}
          </div>

          {/* Letter Head */}
          <div className="text-center border-b-2 border-slate-900 pb-5 mb-6 text-black">
            <h1 className="text-xl font-black tracking-tight uppercase font-display">Pertubuhan Khairat Kematian Dan Kebajikan Kampung Gong Badak</h1>
            <p className="text-xs text-slate-600 font-medium mt-1">21300 Kuala Nerus, Terengganu Darul Iman</p>
            <p className="text-[10px] text-slate-400 font-mono mt-1">Sistem Pengurusan Khairat Kematian Tambahan | Hubungi: khairatkematiantpgb@gmail.com</p>
          </div>

          {/* Report Title */}
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">LAPORAN RUMUSAN REKOD & TUNGGAKAN YURAN KHAIRAT</h2>
              <p className="text-[10px] text-slate-500 font-medium mt-1">Pangkalan data ahli kariah Kampung Gong Badak setakat {formattedDate} ({formattedTime})</p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-500">
              Jumlah Ahli Dipamerkan: {filteredList.length} Orang
            </div>
          </div>

          {/* Stats Summary Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6 border border-slate-200 bg-slate-50 p-4 rounded-xl text-xs">
            <div>
              <span className="text-slate-500 block">Jumlah Keseluruhan Ahli:</span>
              <strong className="text-slate-900 text-sm font-extrabold">{state.members.length} Orang</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Jumlah Ahli Aktif / Pasif:</span>
              <strong className="text-slate-900 text-sm font-extrabold">
                {state.members.filter(m => m.status === 'Aktif').length} Aktif / {state.members.filter(m => m.status !== 'Aktif').length} Inaktif
              </strong>
            </div>
            <div>
              <span className="text-rose-505 block text-slate-500">Jumlah Tunggakan Keseluruhan:</span>
              <strong className="text-rose-700 text-sm font-black font-mono">RM {totalDuesSum}</strong>
            </div>
          </div>

          {/* Printable Report Table */}
          <table className="w-full text-left border-collapse border border-slate-350 text-[12px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-350 text-slate-700 font-bold uppercase">
                {visibleColumns.noAhli && <th className="px-2.5 py-2 text-center border-r border-slate-350 w-16">No. Ahli</th>}
                {visibleColumns.nama && <th className="px-2.5 py-2 border-r border-slate-350 w-40">Nama Ahli</th>}
                {visibleColumns.ic && currentRole !== 'user' && <th className="px-2.5 py-2 text-center border-r border-slate-350 w-24">No. IC</th>}
                {visibleColumns.tel && <th className="px-2.5 py-2 border-r border-slate-350 w-24 text-center">No. Telefon</th>}
                {visibleColumns.alamat && <th className="px-2.5 py-2 border-r border-slate-350">Alamat Berdaftar</th>}
                {visibleColumns.status && <th className="px-2.5 py-2 text-center border-r border-slate-350 w-16">Status</th>}
                {visibleColumns.lunasSehingga && <th className="px-2.5 py-2 text-center border-r border-slate-350 w-20">Lunas Sehingga</th>}
                {visibleColumns.tunggakan && <th className="px-2.5 py-2 text-center w-20 border-r border-slate-350">Tunggakan</th>}
                {visibleColumns.periodTunggakan && <th className="px-2.5 py-2 border-r border-slate-350 w-36">Period Tertunggak</th>}
                {visibleColumns.catatan && <th className="px-2.5 py-2 w-36">Catatan</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredList.map((m) => {
                const rows = state.ledger.filter(r => isSameMemberId(r.noAhli, m.noAhli));
                const totalLebihanKredit = rows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);
                const dues = calculateOutstandingDues(m.noAhli, state.ledger, state.members, kadarYuran);
                const actualDues = Math.max(0, dues - totalLebihanKredit);
                const arrearsDetails = getArrearsDetails(m);
 
                return (
                  <tr key={m.noAhli} className="align-top">
                    {visibleColumns.noAhli && <td className="px-2.5 py-2 text-center font-mono font-bold border-r border-slate-350">{m.noAhli}</td>}
                    {visibleColumns.nama && <td className="px-2.5 py-2 font-bold text-slate-900 border-r border-slate-350">{m.nama}</td>}
                    {visibleColumns.ic && currentRole !== 'user' && <td className="px-2.5 py-2 text-center font-mono border-r border-slate-350">{m.ic || '-'}</td>}
                    {visibleColumns.tel && <td className="px-2.5 py-2 text-center font-mono border-r border-slate-350">{m.tel || '-'}</td>}
                    {visibleColumns.alamat && <td className="px-2.5 py-1.5 leading-relaxed border-r border-slate-350 text-[12px]">{m.alamat || '-'}</td>}
                    {visibleColumns.status && <td className="px-2.5 py-2 text-center border-r border-slate-350 font-bold uppercase">{m.status}</td>}
                    {visibleColumns.lunasSehingga && <td className="px-2.5 py-2 text-center font-mono font-bold border-r border-slate-350">{getLatestPaidMonthYear(m)}</td>}
                    {visibleColumns.tunggakan && (
                      <td className="px-2.5 py-2 text-center font-mono font-bold text-slate-900 border-r border-slate-350">
                        {actualDues > 0 ? `RM ${actualDues}` : 'LUNAS'}
                      </td>
                    )}
                    {visibleColumns.periodTunggakan && (
                      <td className="px-2.5 py-2 border-r border-slate-350 max-w-xs text-[12px] text-slate-600">
                        {actualDues > 0 ? arrearsDetails : 'Tiada tunggakan yuran.'}
                      </td>
                    )}
                    {visibleColumns.catatan && <td className="px-2.5 py-2 max-w-xs text-[12px] text-slate-600">{m.catatan || '-'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Report Footer / Signature Section */}
          <div className="mt-16 grid grid-cols-2 gap-12 text-xs">
            <div>
              <p className="font-semibold text-slate-800">Disediakan Oleh,</p>
              <div className="mt-16 border-t border-slate-400 w-48"></div>
              <p className="text-slate-500 text-[9px] mt-1">Urusetia Khairat Kematian Kampung Gong Badak</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="font-semibold text-slate-800 text-right">Disahkan Oleh,</p>
              <div className="mt-16 border-t border-slate-400 w-48"></div>
              <p className="text-slate-500 text-[9px] mt-1">Pengerusi/AJK Utama Khairat Kampung Gong Badak</p>
            </div>
          </div>

          <div className="mt-12 text-center text-[9px] text-slate-400 font-mono border-t border-slate-200 pt-3 print:block hidden">
            Laporan ini dijana komputer melalui Sistem Pengurusan Khairat Kematian Gong Badak tambahan pada {formattedDate} {formattedTime}. Cetakan rasmi.
          </div>

        </div>,
        document.body
      )}

      {/* Prominent Overall Arrears Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs max-w-xl mx-auto flex flex-col items-center justify-center text-center space-y-3 print:hidden">
        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5 bg-rose-50 border border-rose-100 px-3 py-1 rounded-full">
          <AlertTriangle className="h-3.5 w-3.5" />
          Kiraan Tunggakan Keseluruhan (Semua Ahli)
        </span>
        <div className="flex items-baseline gap-1 mt-1 font-mono">
          <span className="text-rose-600 font-extrabold text-lg">RM</span>
          <span className="text-4xl font-black text-rose-700 tracking-tight">{totalDuesSum}</span>
        </div>
        <p className="text-[10px] text-slate-400 font-sans max-w-sm leading-relaxed">
          Jumlah keseluruhan sumbangan tertunggak Kampung Gong Badak yang belum dibayar oleh kesemua pencarum berdaftar yang aktif.
        </p>
      </div>

      {/* Main Table Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4 print:hidden">
        
        {/* Header and Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-tight">Kriteria Ringkasan Ahli Khairat</h3>
            <p className="text-[10px] text-slate-400">Papar dan tapis laporan, status tunggakan ahli, serta muat turun dokumen.</p>
          </div>

          {/* Action buttons on the right - Merged with only "Semua Ahli" layout */}
          {currentRole !== 'user' && (
            <div className="flex items-center gap-1.5 self-stretch sm:self-auto ml-auto">
              <button
                onClick={() => setIsPrinting(true)}
                className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold rounded-lg cursor-pointer transition flex items-center gap-1"
                title="Cetak Laporan Keseluruhan atau Simpan sebagai PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                Laporan PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold rounded-lg cursor-pointer transition flex items-center gap-1"
                title="Eksport data ini ke dalam fail Spreadsheet Excel/CSV"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Eksport Excel (CSV)
              </button>
            </div>
          )}
        </div>

        {/* Search Filter input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-250 outline-none transition font-sans font-medium"
            placeholder="Cari ahli berdasarkan Nama, No. Ahli, No. IC, beralamat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Kumpulan Tapis / Kriteria Carian */}
        <div className="space-y-2 pt-1">
          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Tapis Mengikut Kumpulan Ahli ({filteredList.length} Padanan):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const isActive = filterGroup === cat.id;
              
              // Set separate subtle styles based on criteria type to make it visually pleasing
              let badgeColor = 'bg-slate-200 text-slate-755';
              if (isActive) {
                badgeColor = 'bg-indigo-900 text-indigo-100';
              } else if (cat.id === 'tidak_aktif' || cat.id === 'tiada') {
                badgeColor = 'bg-rose-50 text-rose-700 hover:bg-rose-100/80 hover:text-rose-800';
              } else if (cat.id === 'aktif' || cat.id === 'lunas') {
                badgeColor = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 hover:text-emerald-800';
              } else if (cat.id === 'ada_tunggakan') {
                badgeColor = 'bg-amber-50 text-amber-700 hover:bg-amber-100/80 hover:text-amber-800';
              } else if (cat.id === 'tunggakan_50') {
                badgeColor = 'bg-red-50 text-red-700 hover:bg-red-100/80 hover:text-red-800';
              }

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterGroup(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none border border-slate-200/80 ${
                    isActive
                      ? 'bg-indigo-700 text-white border-indigo-800 shadow-md ring-2 ring-indigo-200 transform -translate-y-px scale-[1.02]'
                      : 'bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-350 shadow-xxs'
                  }`}
                >
                  <span className="tracking-tight">{cat.label}</span>
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none font-black ${badgeColor}`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tapisan Alamat Rumah */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Tapis Mengikut Alamat Rumah:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {addressCategories.map((cat) => {
              const isActive = addressFilter === cat.id;
              
              let badgeColor = 'bg-slate-200 text-slate-700';
              if (isActive) {
                badgeColor = 'bg-emerald-900 text-emerald-100';
              } else if (cat.id === 'others') {
                badgeColor = 'bg-slate-50 text-slate-600 hover:bg-slate-100/85 hover:text-slate-700';
              } else {
                badgeColor = 'bg-sky-50 text-sky-700 hover:bg-sky-100/80 hover:text-sky-850';
              }

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setAddressFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none border border-slate-200/80 ${
                    isActive
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-200 transform -translate-y-px scale-[1.02]'
                      : 'bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-350 shadow-xxs'
                  }`}
                >
                  <span className="tracking-tight">{cat.label}</span>
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none font-black ${badgeColor}`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

         {/* Members Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-center w-20">No. Ahli</th>
                <th className="px-4 py-3">Nama Ahli</th>
                {currentRole !== 'user' && <th className="px-4 py-3 text-center w-32">No. Kad Pengenalan</th>}
                <th className="px-4 py-3 text-center w-32">No. Telefon</th>
                <th className="px-4 py-3">Alamat Berdaftar</th>
                <th className="px-4 py-3 text-center w-24">Status</th>
                <th className="px-4 py-3 text-center w-32">Lunas Sehingga</th>
                <th className="px-4 py-3 w-60">Tunggakan Yuran</th>
                <th className="px-4 py-3 max-w-xs">Catatan</th>
                <th className="px-4 py-3 text-center w-24">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={currentRole === 'user' ? 9 : 10} className="text-center py-10 text-slate-400 italic">
                    Tiada rekod ahli dijumpai mengikut penapis carian ini.
                  </td>
                </tr>
              ) : (
                filteredList.map((m) => {
                  // Calculate potential dues
                  const rows = state.ledger.filter(r => isSameMemberId(r.noAhli, m.noAhli));
                  const totalLebihanKredit = rows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);
                  const dues = calculateOutstandingDues(m.noAhli, state.ledger, state.members, kadarYuran);
                  const actualDues = Math.max(0, dues - totalLebihanKredit);
                  const arrearsDetails = getArrearsDetails(m);

                  return (
                    <tr key={m.noAhli} className="hover:bg-slate-50/50 transition-colors">
                      {/* No Ahli */}
                      <td className="px-4 py-3 text-center font-mono font-extrabold text-slate-900">
                        {m.noAhli}
                      </td>
                      
                      {/* Nama */}
                      <td className="px-4 py-3 font-extrabold text-slate-800 tracking-tight">
                        {m.nama}
                      </td>
                      
                      {/* No Kad Pengenalan */}
                      {currentRole !== 'user' && (
                        <td className="px-4 py-3 text-center font-mono text-slate-600 font-bold">
                          {m.ic || '-'}
                        </td>
                      )}

                      {/* No. Telefon */}
                      <td className="px-4 py-3 text-center font-mono text-slate-700 font-bold">
                        {m.tel || <span className="text-slate-400 italic font-normal text-[10px]">Tiada</span>}
                      </td>

                      {/* Alamat */}
                      <td className="px-4 py-3 text-slate-500 leading-relaxed max-w-sm truncate text-[11px]" title={m.alamat}>
                        {m.alamat || '-'}
                      </td>
                      
                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          m.status === 'Aktif'
                            ? 'bg-emerald-50 border border-emerald-110 text-emerald-700'
                            : 'bg-rose-50 border border-rose-100 text-rose-700'
                        }`}>
                          {m.status}
                        </span>
                      </td>

                      {/* Lunas Sehingga */}
                      <td className="px-4 py-3 text-center font-mono font-extrabold text-slate-700 text-[11px]">
                        {getLatestPaidMonthYear(m)}
                      </td>

                      {/* Tunggakan Yuran (di sebelah Status) */}
                      <td className="px-4 py-3">
                        {actualDues > 0 ? (
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded inline-block font-mono">
                              RM {actualDues}
                            </span>
                            <div className="text-[9px] text-rose-500 font-medium font-sans leading-relaxed">
                              Bulan: <span className="font-semibold text-rose-700">{arrearsDetails}</span>
                            </div>
                          </div>
                        ) : (
                          m.status === 'Aktif' ? (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded inline-block font-sans">
                              Lunas / Cemerlang
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">
                              Tiada (Tidak Aktif)
                            </span>
                          )
                        )}
                      </td>
                      
                      {/* Catatan */}
                      <td className="px-4 py-3 text-slate-500 text-[11px] max-w-xs truncate" title={m.catatan}>
                        {m.catatan || '-'}
                      </td>
                      
                      {/* Tindakan */}
                      <td className="px-4 py-3 text-center">
                        {onViewProfile ? (
                          <button
                            onClick={() => onViewProfile(m.noAhli)}
                            className="px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded font-black text-[9px] uppercase tracking-wider flex items-center gap-1 mx-auto transition cursor-pointer select-none"
                            title="Buka Lembaran Profil Ahli"
                          >
                            <Eye className="h-3 w-3" />
                            Profil
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Counter summary */}
        <div className="pt-2 text-xxs text-slate-400 flex justify-end font-medium">
          Menampilkan <strong className="text-slate-700 font-bold px-1">{filteredList.length}</strong> daripada <strong className="text-slate-700 font-bold px-1">{state.members.length}</strong> keseluruhan rekod ahli.
        </div>

      </div>

    </div>
  );
}

