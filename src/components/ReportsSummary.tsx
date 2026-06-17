/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppState } from '../types';
import { calculateOutstandingDues, isSameMemberId } from '../lib/database';
import { FileText, AlertTriangle, Eye, Search, FileSpreadsheet, Download, Printer } from 'lucide-react';

interface ReportsSummaryProps {
  state: AppState;
  onViewProfile?: (noAhli: string) => void;
}

export default function ReportsSummary({ state, onViewProfile }: ReportsSummaryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const kadarYuran = state.kadarYuranSebulan || 3;

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

  // Filter members list based on query
  const filteredList = state.members.filter((member) => {
    const cleanSearch = searchQuery.trim().toLowerCase();
    const isNumericSearch = /^\d+$/.test(cleanSearch);

    const nameMatch = member.nama.toLowerCase().includes(cleanSearch);
    const idMatch = member.noAhli.toLowerCase().includes(cleanSearch) || isSameMemberId(member.noAhli, cleanSearch);
    const icMatch = member.ic && member.ic.includes(cleanSearch) && (!isNumericSearch || cleanSearch.length >= 4);
    const addrMatch = member.alamat ? member.alamat.toLowerCase().includes(cleanSearch) : false;
    
    return nameMatch || idMatch || icMatch || addrMatch;
  });

  // Export to Excel (CSV with UTF-8 BOM)
  const handleExportExcel = () => {
    const headers = [
      'No. Ahli',
      'Nama Ahli',
      'No. IC',
      'Alamat Berdaftar',
      'Status Keahlian',
      'Jumlah Tunggakan (RM)',
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
        m.ic || '-',
        m.alamat || '-',
        m.status,
        actualDues,
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
      {isPrinting && (
        <div className="fixed inset-0 bg-white z-[99999] p-10 overflow-y-auto text-slate-900 font-sans print:p-0 print:m-0">
          
          {/* Print Controls Ribbon - Hides in print */}
          <div className="mb-8 flex justify-between items-center bg-amber-50 border border-amber-200 p-4 rounded-xl print:hidden">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />
              <div>
                <span className="text-xs font-bold text-amber-900 block">Mod Pratonton Dokumen (PDF)</span>
                <span className="text-[10px] text-amber-700 block mt-0.5">Laporan sedia dicetak. Klik butang cetak di sebelah kanan untuk memilih pencetak atau simpan sebagai PDF.</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-black hover:bg-slate-800 cursor-pointer transition flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-4 w-4" />
                Cetak / Simpan PDF
              </button>
              <button
                onClick={() => setIsPrinting(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition shadow-xxs"
              >
                Batal / Tutup
              </button>
            </div>
          </div>

          {/* Letter Head */}
          <div className="text-center border-b-2 border-slate-900 pb-5 mb-6 text-black">
            <h1 className="text-xl font-black tracking-tight uppercase font-display">PERSATUAN KHAIRAT KEMATIAN KARIAH KAMPUNG GONG BADAK</h1>
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
              Muka Surat: 1 / 1
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
          <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase">
                <th className="px-3 py-2 text-center border-r border-slate-300 w-16">No. Ahli</th>
                <th className="px-3 py-2 border-r border-slate-300 w-40">Nama Ahli</th>
                <th className="px-3 py-2 text-center border-r border-slate-300 w-24">No. IC</th>
                <th className="px-3 py-2 border-r border-slate-300">Alamat Berdaftar</th>
                <th className="px-3 py-2 text-center border-r border-slate-300 w-16">Status</th>
                <th className="px-3 py-2 text-center w-20">Tunggakan</th>
                <th className="px-3 py-2 border-l border-slate-300 w-36">Period Tertunggak</th>
                <th className="px-3 py-2 border-l border-slate-300 w-36">Catatan</th>
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
                    <td className="px-3 py-2 text-center font-mono font-bold border-r border-slate-300">{m.noAhli}</td>
                    <td className="px-3 py-2 font-bold text-slate-900 border-r border-slate-300">{m.nama}</td>
                    <td className="px-3 py-2 text-center font-mono border-r border-slate-300">{m.ic || '-'}</td>
                    <td className="px-3 py-1.5 text-[9px] leading-relaxed border-r border-slate-300">{m.alamat || '-'}</td>
                    <td className="px-3 py-2 text-center border-r border-slate-300 font-bold text-[9px] uppercase">{m.status}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-slate-900">
                      {actualDues > 0 ? `RM ${actualDues}` : 'LUNAS'}
                    </td>
                    <td className="px-3 py-2 text-[9px] text-slate-600 border-l border-slate-300 max-w-xs">{actualDues > 0 ? arrearsDetails : 'Tiada tunggakan yuran.'}</td>
                    <td className="px-3 py-2 text-[9px] text-slate-600 border-l border-slate-300 max-w-xs">{m.catatan || '-'}</td>
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

        </div>
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

        {/* Members Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-center w-20">No. Ahli</th>
                <th className="px-4 py-3">Nama Ahli</th>
                <th className="px-4 py-3 text-center w-32">No. Kad Pengenalan</th>
                <th className="px-4 py-3">Alamat Berdaftar</th>
                <th className="px-4 py-3 text-center w-24">Status</th>
                <th className="px-4 py-3 w-60">Tunggakan Yuran</th>
                <th className="px-4 py-3 max-w-xs">Catatan</th>
                <th className="px-4 py-3 text-center w-24">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 italic">
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
                      <td className="px-4 py-3 text-center font-mono text-slate-600 font-bold">
                        {m.ic || '-'}
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

