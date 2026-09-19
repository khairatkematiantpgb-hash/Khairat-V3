/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppState, Member } from '../types';
import { calculateOutstandingDues, isSameMemberId, getArrearsDetails } from '../lib/database';
import {
  Mail,
  Printer,
  Edit3,
  Save,
  RotateCcw,
  CheckSquare,
  Square,
  AlertCircle,
  Building2,
  Phone,
  Calendar,
  X,
  Search,
  CheckCircle2,
  FileCheck,
  MessageSquare
} from 'lucide-react';

interface SuratPeringatanModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  kadarYuran: number;
}

interface LetterConfig {
  rujukanPrefix: string;
  tarikhSurat: string;
  tajukSurat: string;
  pembukaan: string;
  arahanBayaran: string;
  tempohHari: string;
  namaBank: string;
  noAkaunBank: string;
  namaPemegangAkaun: string;
  maklumanResitOnline: string;
  maklumanTunai: string;
  peringatanKeahlian: string;
  namaBendahari: string;
  telBendahari: string;
  jawatanPengeluar: string;
  notaJanaanKomputer: string;
}

const STORAGE_KEY = 'khairat_surat_peringatan_config_v1';

export default function SuratPeringatanModal({
  isOpen,
  onClose,
  state,
  kadarYuran
}: SuratPeringatanModalProps) {
  if (!isOpen) return null;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'senarai' | 'sunting' | 'pratonton'>('senarai');
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [previewMemberIndex, setPreviewMemberIndex] = useState(0);
  const [isPrintingPortal, setIsPrintingPortal] = useState(false);
  const [printSingleMember, setPrintSingleMember] = useState<Member | null>(null);
  const [saveNotification, setSaveNotification] = useState(false);

  // Derive current Bendahari from org chart roles or fallback
  const currentBendahariName = state.chartRoles?.bendahari?.nama || "HJ. JAMALUDDIN BIN MOHAMAD";
  const currentBendahariTel = state.chartRoles?.bendahari?.tel || "013-4842213";

  // Today formatted in Malay
  const todayMalay = useMemo(() => {
    return new Date().toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const defaultYear = new Date().getFullYear();

  // Initial Default Template
  const getDefaultConfig = (): LetterConfig => ({
    rujukanPrefix: `PKKGB/BND/PERINGATAN/${defaultYear}`,
    tarikhSurat: todayMalay,
    tajukSurat: 'PERINGATAN PENJELASAN TUNGGAKAN YURAN KHAIRAT KEMATIAN KAMPUNG GONG BADAK (RM36 & KE ATAS)',
    pembukaan:
      'Dengan segala hormatnya, perkara di atas adalah dirujuk. Berdasarkan rekod pangkalan data kami setakat tarikh surat ini dikeluarkan, pihak pengurusan mendapati akaun yuran khairat kematian tuan/puan mempunyai baki tertunggak seperti yang dinyatakan di bawah.',
    arahanBayaran:
      'Sehubungan dengan itu, pihak Bendahari memohon jasa baik dan kerjasama tuan/puan agar dapat membuat penjelasan bayaran tunggakan tersebut dalam tempoh yang ditetapkan bagi memastikan akaun keahlian tuan/puan kembali aktif dan teratur.',
    tempohHari: '14 hari dari tarikh surat ini',
    namaBank: 'Bank Islam Malaysia Berhad (BIMB)',
    noAkaunBank: '13017010088998',
    namaPemegangAkaun: 'PERTUBUHAN KHAIRAT KEMATIAN KG GONG BADAK',
    maklumanResitOnline:
      'Resit bayaran secara atas talian/transfer perlu dihantar kepada Bendahari di nombor 017-9161615 melalui WhatsApp dengan menyatakan butiran seperti:\n1. Nama Ahli\n2. No. Ahli',
    maklumanTunai:
      'Bayaran tunai juga boleh diserahkan terus kepada Bendahari atau wakil AJK kariah berdekatan.',
    peringatanKeahlian:
      'Peringatan: Mengikut Perlembagaan Pertubuhan, ahli yang mempunyai tunggakan yuran melebihi RM36 boleh digantung hak dan manfaat khairat kematian sehingga semua tunggakan diselesaikan.',
    namaBendahari: currentBendahariName,
    telBendahari: currentBendahariTel,
    jawatanPengeluar: 'Bendahari',
    notaJanaanKomputer:
      'Surat ini adalah cetakan janaan komputer dan tidak memerlukan tandatangan fizikal.'
  });

  const [letterConfig, setLetterConfig] = useState<LetterConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const def = getDefaultConfig();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const jawatan = parsed.jawatanPengeluar || def.jawatanPengeluar;
        const cleanedJawatan = jawatan.replace(/\s*kehormat\s*/gi, '').trim() || 'Bendahari';
        const cleanedMaklumanTunai = parsed.maklumanTunai
          ? parsed.maklumanTunai.replace(/Bendahari Kehormat/gi, 'Bendahari')
          : def.maklumanTunai;

        return {
          ...def,
          ...parsed,
          jawatanPengeluar: cleanedJawatan,
          maklumanTunai: cleanedMaklumanTunai,
          maklumanResitOnline: parsed.maklumanResitOnline || def.maklumanResitOnline,
          // Always keep latest Bendahari from org chart if user didn't customize it
          namaBendahari: parsed.namaBendahari || currentBendahariName,
          telBendahari: parsed.telBendahari || currentBendahariTel
        };
      } catch (e) {
        console.error('Failed to parse saved letter template', e);
      }
    }
    return def;
  });

  // Calculate members with actual dues >= 36
  const membersWithArrears36 = useMemo(() => {
    return state.members
      .filter((m) => m.status === 'Aktif')
      .map((m) => {
        const rows = state.ledger.filter((r) => isSameMemberId(r.noAhli, m.noAhli));
        const totalLebihanKredit = rows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);
        const dues = calculateOutstandingDues(m.noAhli, state.ledger, state.members, kadarYuran);
        const actualDues = Math.max(0, dues - totalLebihanKredit);
        const arrearsPeriod = getArrearsDetails(m, state.ledger, state.members);

        // Compute latest month/year paid
        let latestPaid = 'Belum Pernah Bayar';
        if (rows.length > 0) {
          const monthKeys = ['jan', 'feb', 'mac', 'apr', 'mei', 'jun', 'jul', 'ogo', 'sep', 'okt', 'nov', 'dis'];
          const monthNames = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
          let maxVal = -1;
          for (const row of rows) {
            for (let i = 0; i < 12; i++) {
              if ((row as any)[monthKeys[i]]) {
                const v = row.tahun * 100 + i;
                if (v > maxVal) {
                  maxVal = v;
                  latestPaid = `${monthNames[i]}/${row.tahun}`;
                }
              }
            }
          }
        }

        return {
          member: m,
          actualDues,
          arrearsPeriod,
          latestPaid
        };
      })
      .filter((item) => item.actualDues >= 36)
      .sort((a, b) => b.actualDues - a.actualDues); // Highest arrears first
  }, [state.members, state.ledger, kadarYuran]);

  // Selected members for batch printing (set of member.noAhli)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    return membersWithArrears36.map((item) => item.member.noAhli);
  });

  // Filtered members in modal search
  const filteredModalMembers = useMemo(() => {
    const q = searchMemberQuery.trim().toLowerCase();
    if (!q) return membersWithArrears36;
    return membersWithArrears36.filter((item) => {
      const m = item.member;
      return (
        m.nama.toLowerCase().includes(q) ||
        m.noAhli.toLowerCase().includes(q) ||
        (m.ic && m.ic.toLowerCase().includes(q)) ||
        (m.alamat && m.alamat.toLowerCase().includes(q))
      );
    });
  }, [membersWithArrears36, searchMemberQuery]);

  // Selected members list for printing
  const recipientsToPrint = useMemo(() => {
    if (printSingleMember) {
      const found = membersWithArrears36.find((x) => isSameMemberId(x.member.noAhli, printSingleMember.noAhli));
      return found ? [found] : [];
    }
    return membersWithArrears36.filter((x) => selectedMemberIds.includes(x.member.noAhli));
  }, [membersWithArrears36, selectedMemberIds, printSingleMember]);

  // Save template edits
  const handleSaveConfig = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(letterConfig));
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 3000);
  };

  // Reset template
  const handleResetConfig = () => {
    if (window.confirm('Adakah anda pasti mahu mengembalikan teks kandungan surat kepada templat asal standard?')) {
      const def = getDefaultConfig();
      setLetterConfig(def);
      localStorage.removeItem(STORAGE_KEY);
      setSaveNotification(true);
      setTimeout(() => setSaveNotification(false), 3000);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedMemberIds.length === membersWithArrears36.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(membersWithArrears36.map((x) => x.member.noAhli));
    }
  };

  const handleToggleMember = (noAhli: string) => {
    if (selectedMemberIds.includes(noAhli)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== noAhli));
    } else {
      setSelectedMemberIds([...selectedMemberIds, noAhli]);
    }
  };

  // Preview current member
  const currentPreviewRecipient = recipientsToPrint[previewMemberIndex] || membersWithArrears36[0];

  // Print launcher
  const triggerPrintBatch = (single?: Member) => {
    if (single) {
      setPrintSingleMember(single);
    } else {
      setPrintSingleMember(null);
    }
    setIsPrintingPortal(true);
  };

  return (
    <>
      {/* 1. MAIN DIALOG MODAL */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in font-sans">
        <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
          
          {/* Header Bar */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-900 via-slate-900 to-slate-950 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-600/20 border border-rose-500/30 rounded-xl text-rose-300">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black uppercase tracking-tight flex items-center gap-2">
                  <span>Jana Surat Peringatan Tunggakan Yuran (RM36 & Ke Atas)</span>
                  <span className="bg-rose-500 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-full">
                    {membersWithArrears36.length} Ahli Terlibat
                  </span>
                </h2>
                <p className="text-[11px] text-slate-300 font-medium">
                  Dikeluarkan rasmi oleh Bendahari &bull; Pengesahan sah cetakan janaan komputer
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              title="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50/75 px-5 pt-2 gap-2 text-xs font-bold shrink-0">
            <button
              onClick={() => setActiveTab('senarai')}
              className={`px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                activeTab === 'senarai'
                  ? 'bg-white border-rose-600 text-rose-700 shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="h-4 w-4" />
              <span>1. Senarai Penerima ({selectedMemberIds.length}/{membersWithArrears36.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sunting')}
              className={`px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                activeTab === 'sunting'
                  ? 'bg-white border-rose-600 text-rose-700 shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="h-4 w-4" />
              <span>2. Kandungan Surat (Makluman Bendahari)</span>
            </button>

            <button
              onClick={() => setActiveTab('pratonton')}
              className={`px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                activeTab === 'pratonton'
                  ? 'bg-white border-rose-600 text-rose-700 shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              <span>3. Pratonton & Cetak Surat</span>
            </button>
          </div>

          {/* Tab 1: SENARAI PENERIMA (RM36 & KE ATAS) */}
          {activeTab === 'senarai' && (
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              
              {/* Info banner */}
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  <div className="text-xs text-rose-950">
                    <strong>Syarat Tapisan Surat Peringatan:</strong> Ahli berstatus <strong>Aktif</strong> dengan jumlah tunggakan <strong>RM36.00 dan ke atas</strong> (bersamaan sekurang-kurangnya 12 bulan yuran).
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  <button
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    {selectedMemberIds.length === membersWithArrears36.length ? (
                      <>
                        <Square className="h-3.5 w-3.5" /> Nyahpilih Semua
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" /> Pilih Semua ({membersWithArrears36.length})
                      </>
                    )}
                  </button>
                  <button
                    disabled={selectedMemberIds.length === 0}
                    onClick={() => {
                      setPrintSingleMember(null);
                      setActiveTab('pratonton');
                    }}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>Lihat Pratonton ({selectedMemberIds.length})</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari penerima mengikut Nama, No. Ahli, No. IC atau Alamat..."
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              {/* Table / List */}
              {filteredModalMembers.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
                  <p className="text-sm font-bold text-slate-700">Tiada ahli tertunggak RM36 dan ke atas dijumpai.</p>
                  <p className="text-xs text-slate-500">Semua ahli aktif berada dalam keadaan rekod pembayaran yang teratur.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto max-h-[460px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/90 text-slate-700 font-extrabold text-[11px] uppercase tracking-wide sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-12 text-center">Pilih</th>
                          <th className="p-3 w-24">No. Ahli</th>
                          <th className="p-3">Nama Ahli &amp; No. IC</th>
                          <th className="p-3">Alamat Berdaftar</th>
                          <th className="p-3 w-28 text-center">Lunas Hingga</th>
                          <th className="p-3 w-32 text-center">Tunggakan (RM)</th>
                          <th className="p-3 w-28 text-center">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredModalMembers.map((item) => {
                          const m = item.member;
                          const isChecked = selectedMemberIds.includes(m.noAhli);
                          return (
                            <tr
                              key={m.noAhli}
                              className={`hover:bg-rose-50/40 transition-colors ${
                                isChecked ? 'bg-rose-50/20' : ''
                              }`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleMember(m.noAhli)}
                                  className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-mono font-black text-slate-900">
                                {m.noAhli}
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{m.nama}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {m.ic || 'Tiada No. IC'} &bull; {m.tel || 'Tiada Telefon'}
                                </div>
                              </td>
                              <td className="p-3 text-slate-600 text-[11px] max-w-xs truncate">
                                {m.alamat || '-'}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-700">
                                {item.latestPaid}
                              </td>
                              <td className="p-3 text-center">
                                <span className="inline-block px-2 py-0.5 bg-rose-100 text-rose-800 font-mono font-black text-xs rounded-full border border-rose-200">
                                  RM {item.actualDues}
                                </span>
                                <div className="text-[9px] text-rose-700/80 font-mono mt-0.5">
                                  {item.arrearsPeriod}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => {
                                    setPrintSingleMember(m);
                                    setActiveTab('pratonton');
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 font-bold text-[10px] rounded transition cursor-pointer"
                                >
                                  Pratonton
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Tab 2: SUNTING KANDUNGAN SURAT (BENDHARI) */}
          {activeTab === 'sunting' && (
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              
              {/* Notification Banner */}
              {saveNotification && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Kandungan dan tetapan surat peringatan telah berjaya disimpan.</span>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <Edit3 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Penyuntingan Makluman Bendahari:</strong> Anda boleh mengubah teks kandungan surat, maklumat akaun bank, nombor telefon, dan peringatan di bawah. Semua maklumat dinamik ahli (Nama, No Ahli, Alamat, dan Baki Tunggakan) akan disuntik secara automatik ke dalam surat masing-masing.
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* No Rujukan & Tarikh */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Awalan No. Rujukan Surat:
                  </label>
                  <input
                    type="text"
                    value={letterConfig.rujukanPrefix}
                    onChange={(e) => setLetterConfig({ ...letterConfig, rujukanPrefix: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-400">Contoh: PKKGB/BND/PERINGATAN/2026/001</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Tarikh Surat:
                  </label>
                  <input
                    type="text"
                    value={letterConfig.tarikhSurat}
                    onChange={(e) => setLetterConfig({ ...letterConfig, tarikhSurat: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Tajuk Surat */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Tajuk Surat Rasmi:
                  </label>
                  <input
                    type="text"
                    value={letterConfig.tajukSurat}
                    onChange={(e) => setLetterConfig({ ...letterConfig, tajukSurat: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Perenggan Pembukaan */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Perenggan Pembukaan:
                  </label>
                  <textarea
                    rows={3}
                    value={letterConfig.pembukaan}
                    onChange={(e) => setLetterConfig({ ...letterConfig, pembukaan: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-rose-500 leading-relaxed"
                  />
                </div>

                {/* Arahan Pembayaran */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Arahan &amp; Makluman Pembayaran daripada Bendahari:
                  </label>
                  <textarea
                    rows={3}
                    value={letterConfig.arahanBayaran}
                    onChange={(e) => setLetterConfig({ ...letterConfig, arahanBayaran: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-rose-500 leading-relaxed"
                  />
                </div>

                {/* Maklumat Akaun Bank */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Nama Bank Rasmi Khairat:
                  </label>
                  <input
                    type="text"
                    value={letterConfig.namaBank}
                    onChange={(e) => setLetterConfig({ ...letterConfig, namaBank: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Nombor Akaun Bank:
                  </label>
                  <input
                    type="text"
                    value={letterConfig.noAkaunBank}
                    onChange={(e) => setLetterConfig({ ...letterConfig, noAkaunBank: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Nama Pemegang Akaun (Akaun Pertubuhan):
                  </label>
                  <input
                    type="text"
                    value={letterConfig.namaPemegangAkaun}
                    onChange={(e) => setLetterConfig({ ...letterConfig, namaPemegangAkaun: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Tempoh Penyelesaian Bayaran:
                  </label>
                  <input
                    type="text"
                    value={letterConfig.tempohHari}
                    onChange={(e) => setLetterConfig({ ...letterConfig, tempohHari: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Arahan Penghantaran Resit Atas Talian (WhatsApp Bendahari) */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Arahan Penghantaran Resit Atas Talian / Transfer (WhatsApp Bendahari):</span>
                  </label>
                  <textarea
                    rows={3}
                    value={letterConfig.maklumanResitOnline}
                    onChange={(e) => setLetterConfig({ ...letterConfig, maklumanResitOnline: e.target.value })}
                    className="w-full p-2.5 bg-emerald-50/40 border border-emerald-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-emerald-600 leading-relaxed text-slate-800"
                  />
                  <span className="text-[10px] text-slate-500">
                    Sertakan nombor telefon WhatsApp Bendahari (017-9161615) dan maklumat butiran wajib yang perlu disertakan oleh ahli (1. Nama Ahli, 2. No. Ahli).
                  </span>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Makluman Pilihan Bayaran Tunai:
                  </label>
                  <input
                    type="text"
                    value={letterConfig.maklumanTunai}
                    onChange={(e) => setLetterConfig({ ...letterConfig, maklumanTunai: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Peringatan / Amaran Perlembagaan */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Peringatan Implikasi / Syarat Perlembagaan:
                  </label>
                  <textarea
                    rows={2}
                    value={letterConfig.peringatanKeahlian}
                    onChange={(e) => setLetterConfig({ ...letterConfig, peringatanKeahlian: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-rose-500 leading-relaxed"
                  />
                </div>

                {/* Butiran Pengeluar (Bendahari) */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Nama Bendahari (Pengeluar Surat):
                  </label>
                  <input
                    type="text"
                    value={letterConfig.namaBendahari}
                    onChange={(e) => setLetterConfig({ ...letterConfig, namaBendahari: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500 uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    No. Telefon Bendahari:
                  </label>
                  <input
                    type="text"
                    value={letterConfig.telBendahari}
                    onChange={(e) => setLetterConfig({ ...letterConfig, telBendahari: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Nota Janaan Komputer */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Nota Pengesahan Janaan Komputer (Tanpa Tandatangan):
                  </label>
                  <input
                    type="text"
                    value={letterConfig.notaJanaanKomputer}
                    onChange={(e) => setLetterConfig({ ...letterConfig, notaJanaanKomputer: e.target.value })}
                    className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:bg-white focus:outline-none focus:border-rose-500 italic"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={handleResetConfig}
                  className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Set Semula Templat Asal</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveConfig}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Simpan Templat Ini</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('pratonton')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>Lihat Hasil Pratonton</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Tab 3: PRATONTON & CETAK SURAT */}
          {activeTab === 'pratonton' && (
            <div className="p-5 flex-1 overflow-y-auto space-y-4 flex flex-col">
              
              {/* Controls ribbon */}
              <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">Pilih Ahli Untuk Ditonton:</span>
                  <select
                    value={previewMemberIndex}
                    onChange={(e) => setPreviewMemberIndex(Number(e.target.value))}
                    className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-rose-500"
                  >
                    {recipientsToPrint.map((item, idx) => (
                      <option key={item.member.noAhli} value={idx}>
                        {item.member.noAhli} - {item.member.nama} (RM {item.actualDues})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {printSingleMember && (
                    <button
                      onClick={() => setPrintSingleMember(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                    >
                      Batal Pilihan Tunggal
                    </button>
                  )}

                  <button
                    onClick={() => triggerPrintBatch(currentPreviewRecipient.member)}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-600" />
                    <span>Cetak Surat Ahli Ini</span>
                  </button>

                  <button
                    onClick={() => triggerPrintBatch()}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Cetak Semua Surat Terpilih ({recipientsToPrint.length} Halaman)</span>
                  </button>
                </div>
              </div>

              {/* Single Letter Layout Preview (A4 Paper emulation) */}
              {currentPreviewRecipient && (
                <div className="bg-slate-200/60 p-4 sm:p-8 rounded-2xl flex justify-center overflow-x-auto">
                  <div className="bg-white text-slate-900 p-8 sm:p-12 shadow-xl border border-slate-300 rounded-sm w-full max-w-3xl space-y-6 text-xs sm:text-[13px] leading-relaxed font-sans select-text">
                    
                    {/* Official Letterhead */}
                    <div className="border-b-2 border-double border-slate-900 pb-4 text-center space-y-1">
                      <div className="flex items-center justify-center gap-3 mb-1">
                        {/* Masjid Dome Emblem */}
                        <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-black text-sm">
                          🕌
                        </div>
                        <div>
                          <h1 className="text-sm sm:text-base font-black tracking-wide text-slate-950 uppercase leading-snug">
                            PERTUBUHAN KHAIRAT KEMATIAN DAN KEBAJIKAN KAMPUNG GONG BADAK
                          </h1>
                          <p className="text-[10px] text-slate-700 font-semibold uppercase tracking-wider">
                            Kuala Nerus, 21300 Terengganu Darul Iman
                          </p>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 italic font-mono">
                        Pendaftaran Pertubuhan (ROS): PPM-024-11-10112024 &bull; E-mel: khairatkematiantpgb@gmail.com
                      </p>
                    </div>

                    {/* Meta: Ref & Date */}
                    <div className="flex justify-between items-start text-xs font-medium text-slate-800 pt-1">
                      <div>
                        Ruj. Kami: <strong className="font-mono font-bold">{letterConfig.rujukanPrefix}/{currentPreviewRecipient.member.noAhli}</strong>
                      </div>
                      <div className="text-right">
                        Tarikh: <strong>{letterConfig.tarikhSurat}</strong>
                      </div>
                    </div>

                    {/* Recipient Address */}
                    <div className="space-y-0.5 pt-2 text-xs">
                      <div>Kepada:</div>
                      <div className="font-black text-slate-950 uppercase text-sm">
                        {currentPreviewRecipient.member.nama}
                      </div>
                      <div className="font-mono text-slate-700">
                        No. Ahli: <span className="font-bold">{currentPreviewRecipient.member.noAhli}</span>
                        {currentPreviewRecipient.member.ic && (
                          <span> &bull; No. KP: {currentPreviewRecipient.member.ic}</span>
                        )}
                      </div>
                      <div className="text-slate-800 leading-snug whitespace-pre-line">
                        {currentPreviewRecipient.member.alamat || 'Kampung Gong Badak, 21300 Kuala Nerus, Terengganu'}
                      </div>
                    </div>

                    {/* Salutation */}
                    <div className="pt-2 font-semibold">
                      Tuan / Puan,
                    </div>

                    {/* Subject */}
                    <div className="font-black text-slate-950 uppercase text-xs sm:text-[13px] underline leading-snug pt-1">
                      {letterConfig.tajukSurat}
                    </div>

                    {/* Paragraph 1 */}
                    <div className="text-justify text-slate-900 leading-relaxed pt-1">
                      {letterConfig.pembukaan}
                    </div>

                    {/* Box: Arrears Summary */}
                    <div className="bg-slate-50 border-2 border-slate-800 rounded-lg p-4 space-y-2">
                      <div className="text-[11px] font-black uppercase text-slate-900 tracking-wider border-b border-slate-300 pb-1 flex justify-between items-center">
                        <span>BUTIRAN TUNGGAKAN YURAN KHAIRAT:</span>
                        <span className="font-mono font-bold text-slate-600">ID: {currentPreviewRecipient.member.noAhli}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                        <div className="text-slate-600">Nama Pencarum:</div>
                        <div className="font-bold text-slate-900 uppercase">{currentPreviewRecipient.member.nama}</div>

                        <div className="text-slate-600">Status Pembayaran Terakhir:</div>
                        <div className="font-bold text-slate-900 font-mono">Lunas Sehingga {currentPreviewRecipient.latestPaid}</div>

                        <div className="text-slate-600">Tempoh / Bulan Tertunggak:</div>
                        <div className="font-bold text-rose-800">{currentPreviewRecipient.arrearsPeriod}</div>

                        <div className="text-slate-900 font-black text-xs sm:text-sm pt-1 border-t border-slate-200">
                          JUMLAH TUNGGAKAN:
                        </div>
                        <div className="font-black text-rose-700 text-sm sm:text-base font-mono pt-1 border-t border-slate-200">
                          RM {currentPreviewRecipient.actualDues}.00
                        </div>
                      </div>
                    </div>

                    {/* Paragraph 2: Instructions */}
                    <div className="text-justify text-slate-900 leading-relaxed">
                      {letterConfig.arahanBayaran} Bayaran hendaklah diselesaikan dalam tempoh <strong>{letterConfig.tempohHari}</strong> melalui saluran rasmi pertubuhan berikut:
                    </div>

                    {/* Banking Details Box */}
                    <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3.5 text-xs space-y-2.5 font-sans">
                      <div className="font-bold text-rose-950 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-rose-700" />
                        <span>Saluran Pindahan Bank (Online / CDM / Kaunter):</span>
                      </div>
                      <div className="pl-5 space-y-0.5 text-[11px]">
                        <div>Nama Bank: <strong>{letterConfig.namaBank}</strong></div>
                        <div>Nombor Akaun: <strong className="font-mono text-xs">{letterConfig.noAkaunBank}</strong></div>
                        <div>Nama Akaun: <strong>{letterConfig.namaPemegangAkaun}</strong></div>
                      </div>

                      {/* WhatsApp Online Receipt Notice */}
                      {letterConfig.maklumanResitOnline && (
                        <div className="bg-white border border-emerald-300 rounded-lg p-3 text-[11px] text-slate-800 space-y-1.5 shadow-2xs">
                          <div className="font-bold text-emerald-900 flex items-center gap-1.5 uppercase text-[10.5px] tracking-wide">
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Penghantaran Bukti / Resit Bayaran Atas Talian (Transfer):</span>
                          </div>
                          <div className="text-slate-800 whitespace-pre-line leading-relaxed pl-5 font-medium">
                            {letterConfig.maklumanResitOnline}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-mono pl-5 pt-0.5 border-t border-emerald-100">
                            (Rujukan Contoh Mesej: <strong>{currentPreviewRecipient.member.nama}</strong> &bull; No. Ahli: <strong>{currentPreviewRecipient.member.noAhli}</strong>)
                          </div>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-700 pt-1 border-t border-rose-200/60 italic">
                        {letterConfig.maklumanTunai}
                      </div>
                    </div>

                    {/* Paragraph 3: Warning */}
                    <div className="text-justify text-slate-800 text-[11px] leading-relaxed bg-amber-50/60 border border-amber-200/80 p-2.5 rounded-lg">
                      {letterConfig.peringatanKeahlian}
                    </div>

                    {/* Closing & Sign-off */}
                    <div className="pt-4 space-y-6">
                      <div className="space-y-1">
                        <div>Sekian, terima kasih.</div>
                        <div className="font-bold text-slate-950 tracking-wide mt-2">
                          &quot;BERKHIDMAT UNTUK KARIAH&quot;
                        </div>
                      </div>

                      {/* Issuer details from Bendahari */}
                      <div className="space-y-1">
                        <div>Saya yang menjalankan amanah,</div>
                        <div className="pt-4 font-black uppercase text-slate-950 tracking-wider text-sm">
                          {letterConfig.namaBendahari}
                        </div>
                        <div className="text-xs font-bold text-slate-800 uppercase">
                          {letterConfig.jawatanPengeluar}
                        </div>
                        <div className="text-xs text-slate-600">
                          Pertubuhan Kebajikan Khairat Kematian Kampung Gong Badak
                        </div>
                        <div className="text-xs font-mono text-slate-700 flex items-center gap-1 pt-0.5">
                          <Phone className="h-3 w-3 text-slate-500" />
                          <span>H/P: {letterConfig.telBendahari}</span>
                        </div>
                      </div>

                      {/* Computer Generated Disclaimer */}
                      <div className="pt-4 border-t border-slate-300 text-center">
                        <p className="text-[10px] text-slate-600 font-mono font-semibold italic bg-slate-100 py-1.5 px-3 rounded border border-slate-200">
                          *** {letterConfig.notaJanaanKomputer} ***
                        </p>
                      </div>

                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* Footer Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>Status:</span>
              <span className="font-bold text-slate-800">
                {selectedMemberIds.length} daripada {membersWithArrears36.length} ahli dipilih
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>

              <button
                disabled={selectedMemberIds.length === 0}
                onClick={() => triggerPrintBatch()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak / Simpan PDF ({recipientsToPrint.length} Surat)</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 2. PRINTABLE OUTLET PORTAL (Used when user clicks Cetak / Simpan PDF) */}
      {isPrintingPortal && createPortal(
        <div id="surat-peringatan-print-outlet" className="fixed inset-0 bg-white z-[99999] overflow-y-auto p-6 font-sans text-slate-900 print:p-0 print:m-0 print:overflow-visible print:relative print:inset-auto">
          
          <style>{`
            @page {
              size: portrait;
              margin: 12mm 15mm 12mm 15mm;
            }
            @media print {
              body {
                background: white !important;
                color: black !important;
              }
              .surat-page-item {
                page-break-after: always !important;
                break-after: page !important;
                height: auto !important;
                min-height: 100vh !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                padding-bottom: 20px !important;
              }
              .surat-page-item:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              .print-hide {
                display: none !important;
              }
            }
          `}</style>

          {/* Ribbon Controls (Hidden during print) */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-4 max-w-4xl mx-auto print:hidden shadow-md">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-rose-600 shrink-0" />
              <div>
                <h3 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                  Pratonton Cetakan Surat Peringatan ({recipientsToPrint.length} Surat)
                </h3>
                <p className="text-[11px] text-amber-800">
                  Surat rasmi janaan komputer sedia dicetak atau disimpan sebagai fail PDF.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  try {
                    window.print();
                  } catch (e) {
                    console.error('Print trigger failed', e);
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Sekarang / Simpan PDF</span>
              </button>
              <button
                onClick={() => setIsPrintingPortal(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Tutup Pratonton
              </button>
            </div>
          </div>

          {/* Multiple Printable Pages */}
          <div className="max-w-3xl mx-auto space-y-12 print:space-y-0">
            {recipientsToPrint.map((item, index) => {
              const m = item.member;
              return (
                <div
                  key={m.noAhli}
                  className="surat-page-item bg-white p-8 sm:p-12 border border-slate-200 shadow-lg rounded-sm print:border-none print:shadow-none print:p-0 space-y-6 text-[13px] leading-relaxed select-text"
                >
                  
                  {/* Official Header */}
                  <div className="border-b-2 border-double border-slate-900 pb-3 text-center space-y-1">
                    <h1 className="text-sm sm:text-base font-black tracking-wide text-slate-950 uppercase leading-snug">
                      PERTUBUHAN KHAIRAT KEMATIAN DAN KEBAJIKAN KAMPUNG GONG BADAK
                    </h1>
                    <p className="text-[11px] text-slate-700 font-semibold uppercase tracking-wider">
                      Kuala Nerus, 21300 Terengganu Darul Iman
                    </p>
                    <p className="text-[10px] text-slate-500 italic font-mono">
                      Pendaftaran Pertubuhan (ROS): PPM-024-11-10112024 &bull; E-mel: khairatkematiantpgb@gmail.com
                    </p>
                  </div>

                  {/* Ref & Date */}
                  <div className="flex justify-between items-start text-xs font-medium text-slate-800 pt-1">
                    <div>
                      Ruj. Kami: <strong className="font-mono font-bold">{letterConfig.rujukanPrefix}/{m.noAhli}</strong>
                    </div>
                    <div className="text-right">
                      Tarikh: <strong>{letterConfig.tarikhSurat}</strong>
                    </div>
                  </div>

                  {/* Recipient Box */}
                  <div className="space-y-0.5 pt-1 text-xs">
                    <div>Kepada:</div>
                    <div className="font-black text-slate-950 uppercase text-sm">
                      {m.nama}
                    </div>
                    <div className="font-mono text-slate-700">
                      No. Ahli: <span className="font-bold">{m.noAhli}</span>
                      {m.ic && <span> &bull; No. KP: {m.ic}</span>}
                    </div>
                    <div className="text-slate-800 leading-snug whitespace-pre-line">
                      {m.alamat || 'Kampung Gong Badak, 21300 Kuala Nerus, Terengganu'}
                    </div>
                  </div>

                  {/* Salutation */}
                  <div className="pt-2 font-semibold">
                    Tuan / Puan,
                  </div>

                  {/* Subject */}
                  <div className="font-black text-slate-950 uppercase text-xs sm:text-[13px] underline leading-snug">
                    {letterConfig.tajukSurat}
                  </div>

                  {/* Paragraph 1 */}
                  <div className="text-justify text-slate-900 leading-relaxed">
                    {letterConfig.pembukaan}
                  </div>

                  {/* Arrears Summary Box */}
                  <div className="bg-slate-50 border-2 border-slate-900 rounded-md p-3.5 space-y-2">
                    <div className="text-[10px] font-black uppercase text-slate-900 tracking-wider border-b border-slate-300 pb-1 flex justify-between items-center">
                      <span>PENYATA TUNGGAKAN YURAN KHAIRAT:</span>
                      <span className="font-mono font-bold text-slate-700">NO. AHLI: {m.noAhli}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                      <div className="text-slate-600">Nama Pencarum:</div>
                      <div className="font-bold text-slate-900 uppercase">{m.nama}</div>

                      <div className="text-slate-600">Status Bayaran Terakhir:</div>
                      <div className="font-bold text-slate-900 font-mono">Lunas Sehingga {item.latestPaid}</div>

                      <div className="text-slate-600">Tempoh / Bulan Tertunggak:</div>
                      <div className="font-bold text-rose-800">{item.arrearsPeriod}</div>

                      <div className="text-slate-900 font-black text-xs sm:text-sm pt-1 border-t border-slate-300">
                        JUMLAH TUNGGAKAN PERLU DIJELASKAN:
                      </div>
                      <div className="font-black text-rose-800 text-sm sm:text-base font-mono pt-1 border-t border-slate-300">
                        RM {item.actualDues}.00
                      </div>
                    </div>
                  </div>

                  {/* Paragraph 2: Instructions */}
                  <div className="text-justify text-slate-900 leading-relaxed">
                    {letterConfig.arahanBayaran} Bayaran hendaklah dibuat dalam tempoh <strong>{letterConfig.tempohHari}</strong> melalui saluran rasmi pertubuhan berikut:
                  </div>

                  {/* Banking Details Box */}
                  <div className="bg-slate-50 border border-slate-300 rounded-md p-3 text-xs space-y-2 font-sans">
                    <div className="font-bold text-slate-950 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-slate-700" />
                      <span>Saluran Pindahan Akaun Bank Pertubuhan:</span>
                    </div>
                    <div className="pl-5 space-y-0.5 text-[11px]">
                      <div>Nama Bank: <strong>{letterConfig.namaBank}</strong></div>
                      <div>Nombor Akaun: <strong className="font-mono text-xs">{letterConfig.noAkaunBank}</strong></div>
                      <div>Nama Akaun: <strong>{letterConfig.namaPemegangAkaun}</strong></div>
                    </div>

                    {/* WhatsApp Online Receipt Notice for Print */}
                    {letterConfig.maklumanResitOnline && (
                      <div className="bg-white border border-slate-400 rounded p-2 text-[11px] text-slate-900 space-y-0.5">
                        <div className="font-bold text-slate-950 uppercase text-[10px] tracking-wide">
                          Penghantaran Bukti / Resit Bayaran Atas Talian (Transfer):
                        </div>
                        <div className="whitespace-pre-line leading-relaxed pl-2 font-medium">
                          {letterConfig.maklumanResitOnline}
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono pl-2 pt-0.5 border-t border-slate-200 mt-1">
                          (Rujukan Ahli: <strong>{m.nama}</strong> | No. Ahli: <strong>{m.noAhli}</strong>)
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-700 pt-1 border-t border-slate-200 italic">
                      {letterConfig.maklumanTunai}
                    </div>
                  </div>

                  {/* Paragraph 3: Warning */}
                  <div className="text-justify text-slate-800 text-[11px] leading-relaxed bg-amber-50 border border-amber-200 p-2.5 rounded-md">
                    {letterConfig.peringatanKeahlian}
                  </div>

                  {/* Closing & Sign-off */}
                  <div className="pt-2 space-y-5">
                    <div className="space-y-1">
                      <div>Sekian, terima kasih.</div>
                      <div className="font-bold text-slate-950 tracking-wide mt-1">
                        &quot;BERKHIDMAT UNTUK KARIAH&quot;
                      </div>
                    </div>

                    {/* Issuer details from Bendahari */}
                    <div className="space-y-0.5">
                      <div>Saya yang menjalankan amanah,</div>
                      <div className="pt-3 font-black uppercase text-slate-950 tracking-wider text-sm">
                        {letterConfig.namaBendahari}
                      </div>
                      <div className="text-xs font-bold text-slate-800 uppercase">
                        {letterConfig.jawatanPengeluar}
                      </div>
                      <div className="text-xs text-slate-600">
                        Pertubuhan Kebajikan Khairat Kematian Kampung Gong Badak
                      </div>
                      <div className="text-xs font-mono text-slate-700 flex items-center gap-1 pt-0.5">
                        <Phone className="h-3 w-3 text-slate-500" />
                        <span>H/P: {letterConfig.telBendahari}</span>
                      </div>
                    </div>

                    {/* Computer Generated Disclaimer */}
                    <div className="pt-3 border-t border-slate-300 text-center">
                      <p className="text-[10px] text-slate-600 font-mono font-semibold italic bg-slate-100 py-1.5 px-3 rounded border border-slate-200">
                        *** {letterConfig.notaJanaanKomputer} ***
                      </p>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>

        </div>,
        document.body
      )}
    </>
  );
}
