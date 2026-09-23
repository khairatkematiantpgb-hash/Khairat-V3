/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  MessageSquare,
  Type,
  ExternalLink,
  Clock,
  ShieldAlert
} from 'lucide-react';

export interface ArrearsRecipient {
  member: Member;
  actualDues: number;
  nextMonthDues: number;
  arrearsPeriod: string;
  latestPaid: string;
  category: 'semasa' | 'amaran_awal';
}

interface SuratPeringatanModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  kadarYuran: number;
  initialCategory?: 'semua' | 'semasa' | 'amaran_awal';
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

const STORAGE_KEY_SEMASA = 'khairat_surat_peringatan_config_v1';
const STORAGE_KEY_AWAL = 'khairat_surat_amaran_awal_config_v1';

export default function SuratPeringatanModal({
  isOpen,
  onClose,
  state,
  kadarYuran,
  initialCategory = 'semua'
}: SuratPeringatanModalProps) {
  if (!isOpen) return null;

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'senarai' | 'sunting' | 'pratonton'>('senarai');
  
  // Category Filter in List: 'semua' | 'amaran_awal' | 'semasa'
  const [categoryFilter, setCategoryFilter] = useState<'semua' | 'amaran_awal' | 'semasa'>(initialCategory);
  
  // Which template to edit in Tab 2: 'semasa' | 'amaran_awal'
  const [selectedTemplateToEdit, setSelectedTemplateToEdit] = useState<'semasa' | 'amaran_awal'>('semasa');

  // Preview format mode in Tab 3: 'auto' (based on member's category) | 'semasa' | 'amaran_awal'
  const [previewFormatMode, setPreviewFormatMode] = useState<'auto' | 'semasa' | 'amaran_awal'>('auto');

  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [previewMemberIndex, setPreviewMemberIndex] = useState(0);
  const [isPrintingPortal, setIsPrintingPortal] = useState(false);
  const [printSingleMember, setPrintSingleMember] = useState<Member | null>(null);
  const [saveNotification, setSaveNotification] = useState(false);

  // Derive current Bendahari from org chart roles or fallback
  const currentBendahariName = state.chartRoles?.bendahari?.nama || 'HJ. JAMALUDDIN BIN MOHAMAD';
  const currentBendahariTel = state.chartRoles?.bendahari?.tel || '013-4842213';

  // Today formatted in Malay
  const todayMalay = useMemo(() => {
    return new Date().toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const defaultYear = new Date().getFullYear();

  // Initial Default Template for Current Arrears (>= RM36)
  const getDefaultConfigSemasa = (): LetterConfig => ({
    rujukanPrefix: `PKKGB/BND/PERINGATAN/${defaultYear}`,
    tarikhSurat: todayMalay,
    tajukSurat: 'PERINGATAN PENJELASAN TUNGGAKAN YURAN KHAIRAT KEMATIAN KAMPUNG GONG BADAK (RM36 & KE ATAS)',
    pembukaan:
      'Dengan segala hormatnya, perkara di atas adalah dirujuk. Berdasarkan semakan rekod pangkalan data kami setakat tarikh surat ini dikeluarkan, pihak pengurusan mendapati akaun yuran khairat kematian tuan/puan mempunyai baki tertunggak seperti yang dinyatakan di bawah.',
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

  // Initial Default Template for Early Warning (Next Month >= RM36)
  const getDefaultConfigAwal = (): LetterConfig => ({
    rujukanPrefix: `PKKGB/BND/AMARAN-AWAL/${defaultYear}`,
    tarikhSurat: todayMalay,
    tajukSurat: 'SURAT AMARAN AWAL: PERINGATAN TUNGGAKAN YURAN KHAIRAT KEMATIAN KAMPUNG GONG BADAK',
    pembukaan:
      'Dengan segala hormatnya dimaklumkan bahawa semakan rekod akaun khairat kematian mendapati akaun tuan/puan mempunyai baki tunggakan yuran tahunan seperti yang dinyatakan di bawah. Pihak pengurusan mengeluarkan surat amaran awal ini sebagai peringatan mesra bahawa pada bulan seterusnya, jumlah tunggakan tuan/puan akan mencecah atau melebihi had RM36.00 (melebihi 12 bulan) sekiranya tiada bayaran dibuat.',
    arahanBayaran:
      'Sehubungan dengan itu, pihak Bendahari memohon kerjasama tuan/puan agar dapat mengambil tindakan awal membuat bayaran penjelasan tunggakan tersebut sebelum ketibaan bulan hadapan bagi mengelakkan akaun keahlian tuan/puan melepasi had kelayakan tunggakan yang ditetapkan.',
    tempohHari: '14 hari dari tarikh surat ini (atau sebelum menjelang bulan seterusnya)',
    namaBank: 'Bank Islam Malaysia Berhad (BIMB)',
    noAkaunBank: '13017010088998',
    namaPemegangAkaun: 'PERTUBUHAN KHAIRAT KEMATIAN KG GONG BADAK',
    maklumanResitOnline:
      'Resit bayaran secara atas talian/transfer perlu dihantar kepada Bendahari di nombor 017-9161615 melalui WhatsApp dengan menyatakan butiran seperti:\n1. Nama Ahli\n2. No. Ahli',
    maklumanTunai:
      'Bayaran tunai juga boleh diserahkan terus kepada Bendahari atau wakil AJK kariah berdekatan.',
    peringatanKeahlian:
      'Peringatan Penting: Mengikut Fasal Perlembagaan Pertubuhan, ahli yang mempunyai tunggakan yuran melebihi RM36 boleh digantung hak dan manfaat khairat kematian. Sila buat bayaran awal demi memastikan manfaat kebajikan dan perlindungan khairat kematian keluarga tuan/puan sentiasa terjamin dan berterusan.',
    namaBendahari: currentBendahariName,
    telBendahari: currentBendahariTel,
    jawatanPengeluar: 'Bendahari',
    notaJanaanKomputer:
      'Surat ini adalah cetakan janaan komputer dan tidak memerlukan tandatangan fizikal.'
  });

  // State for Semasa Template
  const [configSemasa, setConfigSemasa] = useState<LetterConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SEMASA);
    const def = getDefaultConfigSemasa();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const jawatan = parsed.jawatanPengeluar || def.jawatanPengeluar;
        const cleanedJawatan = jawatan.replace(/\s*kehormat\s*/gi, '').trim() || 'Bendahari';
        return {
          ...def,
          ...parsed,
          jawatanPengeluar: cleanedJawatan,
          namaBendahari: parsed.namaBendahari || currentBendahariName,
          telBendahari: parsed.telBendahari || currentBendahariTel
        };
      } catch (e) {
        console.error('Failed to parse saved semasa template', e);
      }
    }
    return def;
  });

  // State for Amaran Awal Template
  const [configAwal, setConfigAwal] = useState<LetterConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AWAL);
    const def = getDefaultConfigAwal();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const jawatan = parsed.jawatanPengeluar || def.jawatanPengeluar;
        const cleanedJawatan = jawatan.replace(/\s*kehormat\s*/gi, '').trim() || 'Bendahari';
        return {
          ...def,
          ...parsed,
          jawatanPengeluar: cleanedJawatan,
          namaBendahari: parsed.namaBendahari || currentBendahariName,
          telBendahari: parsed.telBendahari || currentBendahariTel
        };
      } catch (e) {
        console.error('Failed to parse saved awal template', e);
      }
    }
    return def;
  });

  // Calculate all members with arrears (both Semasa >= RM36 and Amaran Awal where next month >= RM36)
  const allArrearsRecipients = useMemo<ArrearsRecipient[]>(() => {
    return state.members
      .filter((m) => m.status === 'Aktif')
      .map((m) => {
        const rows = state.ledger.filter((r) => isSameMemberId(r.noAhli, m.noAhli));
        const totalLebihanKredit = rows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);
        const dues = calculateOutstandingDues(m.noAhli, state.ledger, state.members, kadarYuran);
        const actualDues = Math.max(0, dues - totalLebihanKredit);
        const nextMonthDues = actualDues + kadarYuran;
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

        // Category Classification:
        // 1. 'semasa': actualDues >= 36 (Sudah mencapai had RM36 dan ke atas bulan ini)
        // 2. 'amaran_awal': actualDues < 36 && nextMonthDues >= 36 (Bulan semasa belum cecah 36, tapi bulan hadapan akan cecah/lebih RM36, e.g. RM33 + RM3 = RM36)
        let category: 'semasa' | 'amaran_awal' | null = null;
        if (actualDues >= 36) {
          category = 'semasa';
        } else if (nextMonthDues >= 36) {
          category = 'amaran_awal';
        }

        if (!category) return null;

        return {
          member: m,
          actualDues,
          nextMonthDues,
          arrearsPeriod,
          latestPaid,
          category
        };
      })
      .filter((item): item is ArrearsRecipient => item !== null)
      .sort((a, b) => {
        if (b.actualDues !== a.actualDues) return b.actualDues - a.actualDues;
        return b.nextMonthDues - a.nextMonthDues;
      });
  }, [state.members, state.ledger, kadarYuran]);

  // Counts for each category
  const countSemasa = useMemo(() => allArrearsRecipients.filter((r) => r.category === 'semasa').length, [allArrearsRecipients]);
  const countAmaranAwal = useMemo(() => allArrearsRecipients.filter((r) => r.category === 'amaran_awal').length, [allArrearsRecipients]);
  const countSemua = allArrearsRecipients.length;

  // Filter recipients based on active category filter
  const categoryFilteredRecipients = useMemo(() => {
    if (categoryFilter === 'semasa') {
      return allArrearsRecipients.filter((r) => r.category === 'semasa');
    }
    if (categoryFilter === 'amaran_awal') {
      return allArrearsRecipients.filter((r) => r.category === 'amaran_awal');
    }
    return allArrearsRecipients;
  }, [allArrearsRecipients, categoryFilter]);

  // Filtered members in modal search
  const filteredModalMembers = useMemo(() => {
    const q = searchMemberQuery.trim().toLowerCase();
    if (!q) return categoryFilteredRecipients;
    return categoryFilteredRecipients.filter((item) => {
      const m = item.member;
      return (
        String(m.nama || '').toLowerCase().includes(q) ||
        String(m.noAhli || '').toLowerCase().includes(q) ||
        (Boolean(m.ic) && String(m.ic).toLowerCase().includes(q)) ||
        (Boolean(m.alamat) && String(m.alamat).toLowerCase().includes(q)) ||
        (Boolean(m.tel) && String(m.tel).toLowerCase().includes(q))
      );
    });
  }, [categoryFilteredRecipients, searchMemberQuery]);

  // Selected members for batch printing (set of member.noAhli)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    return allArrearsRecipients.map((item) => item.member.noAhli);
  });

  // Keep selected ids populated when recipients change
  useEffect(() => {
    if (selectedMemberIds.length === 0 && allArrearsRecipients.length > 0) {
      setSelectedMemberIds(allArrearsRecipients.map((item) => item.member.noAhli));
    }
  }, [allArrearsRecipients]);

  // Font size state (Standard Font 12 for official warning letters)
  const [fontSizePt, setFontSizePt] = useState<number>(12);

  // Selected members list for printing
  const recipientsToPrint = useMemo(() => {
    if (printSingleMember) {
      const found = allArrearsRecipients.find((x) => isSameMemberId(x.member.noAhli, printSingleMember.noAhli));
      return found ? [found] : [];
    }
    return allArrearsRecipients.filter((x) => selectedMemberIds.includes(x.member.noAhli));
  }, [allArrearsRecipients, selectedMemberIds, printSingleMember]);

  // Save template edits
  const handleSaveConfig = () => {
    localStorage.setItem(STORAGE_KEY_SEMASA, JSON.stringify(configSemasa));
    localStorage.setItem(STORAGE_KEY_AWAL, JSON.stringify(configAwal));
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 3000);
  };

  // Reset template
  const handleResetConfig = () => {
    const isAwal = selectedTemplateToEdit === 'amaran_awal';
    const msg = isAwal
      ? 'Adakah anda pasti mahu mengembalikan templat SURAT AMARAN AWAL kepada tetapan piawai asal?'
      : 'Adakah anda pasti mahu mengembalikan templat SURAT PERINGATAN SEMASA (RM36+) kepada tetapan piawai asal?';
    
    if (window.confirm(msg)) {
      if (isAwal) {
        const def = getDefaultConfigAwal();
        setConfigAwal(def);
        localStorage.removeItem(STORAGE_KEY_AWAL);
      } else {
        const def = getDefaultConfigSemasa();
        setConfigSemasa(def);
        localStorage.removeItem(STORAGE_KEY_SEMASA);
      }
      setSaveNotification(true);
      setTimeout(() => setSaveNotification(false), 3000);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    const currentListIds = categoryFilteredRecipients.map((x) => x.member.noAhli);
    const allSelectedInCurrent = currentListIds.every((id) => selectedMemberIds.includes(id));
    if (allSelectedInCurrent) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => !currentListIds.includes(id)));
    } else {
      const newSet = new Set([...selectedMemberIds, ...currentListIds]);
      setSelectedMemberIds(Array.from(newSet));
    }
  };

  const handleToggleMember = (noAhli: string) => {
    if (selectedMemberIds.includes(noAhli)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== noAhli));
    } else {
      setSelectedMemberIds([...selectedMemberIds, noAhli]);
    }
  };

  // Resolve config to use for a recipient based on category and preview mode
  const getLetterConfigForRecipient = (recipient: ArrearsRecipient) => {
    if (previewFormatMode === 'semasa') return configSemasa;
    if (previewFormatMode === 'amaran_awal') return configAwal;
    return recipient.category === 'amaran_awal' ? configAwal : configSemasa;
  };

  // Preview current member
  const currentPreviewRecipient = recipientsToPrint[previewMemberIndex] || allArrearsRecipients[0];
  const activePreviewConfig = currentPreviewRecipient
    ? getLetterConfigForRecipient(currentPreviewRecipient)
    : configSemasa;

  // Print launcher
  const triggerPrintBatch = (single?: Member) => {
    if (single) {
      setPrintSingleMember(single);
    } else {
      setPrintSingleMember(null);
    }
    setIsPrintingPortal(true);
  };

  // WhatsApp quick reminder sender
  const handleSendWhatsApp = (item: ArrearsRecipient) => {
    const m = item.member;
    if (!m.tel) {
      alert(`Ahli ${m.nama} (${m.noAhli}) tidak mempunyai rekod nombor telefon.`);
      return;
    }
    const cleanPhone = m.tel.replace(/\D/g, '');
    const phoneFormatted = cleanPhone.startsWith('60')
      ? cleanPhone
      : cleanPhone.startsWith('0')
      ? '60' + cleanPhone.slice(1)
      : '60' + cleanPhone;

    const isAwal = item.category === 'amaran_awal';
    const cfg = isAwal ? configAwal : configSemasa;

    let text = '';
    if (isAwal) {
      text =
        `*SURAT AMARAN AWAL: PERINGATAN TUNGGAKAN YURAN KHAIRAT KEMATIAN KG GONG BADAK*\n\n` +
        `Assalamualaikum & Salam Sejahtera,\n` +
        `Kepada: *${m.nama}* (No. Ahli: *${m.noAhli}*)\n\n` +
        `Semakan rekod akaun khairat kematian mendapati baki tunggakan semasa anda adalah sebanyak *RM ${item.actualDues}.00* (${item.arrearsPeriod}).\n\n` +
        `⚠️ *PERINGATAN AWAL:*\n` +
        `Pada *bulan seterusnya*, jumlah tunggakan anda akan mencecah *RM ${item.nextMonthDues}.00* (mencecah had kelayakan 12 bulan / RM36).\n\n` +
        `Mengikut Perlembagaan Pertubuhan, sebarang tunggakan melebihi RM36 boleh menyebabkan hak dan manfaat khairat kematian digantung. Pihak Bendahari memohon kerjasama tuan/puan untuk membuat bayaran segera sebelum bulan hadapan.\n\n` +
        `*Saluran Bayaran Rasmi:*\n` +
        `• Bank: ${cfg.namaBank}\n` +
        `• No. Akaun: *${cfg.noAkaunBank}*\n` +
        `• Nama Akaun: ${cfg.namaPemegangAkaun}\n\n` +
        `Sila hantarkan resit/bukti bayaran kepada Bendahari (${cfg.namaBendahari} di ${cfg.telBendahari}). Terima kasih.`;
    } else {
      text =
        `*PERINGATAN PENJELASAN TUNGGAKAN YURAN KHAIRAT KEMATIAN KG GONG BADAK (RM36 & KE ATAS)*\n\n` +
        `Assalamualaikum & Salam Sejahtera,\n` +
        `Kepada: *${m.nama}* (No. Ahli: *${m.noAhli}*)\n\n` +
        `Semakan rekod akaun khairat kematian mendapati baki tunggakan semasa anda adalah sebanyak *RM ${item.actualDues}.00* (${item.arrearsPeriod}).\n\n` +
        `⚠️ *PERINGATAN:* Mengikut Perlembagaan Pertubuhan, tunggakan melebihi RM36 boleh menyebabkan kelayakan dan manfaat khairat kematian digantung sehingga semua tunggakan diselesaikan.\n\n` +
        `Mohon kerjasama pihak tuan/puan agar dapat membuat penjelasan bayaran dalam tempoh *${cfg.tempohHari}*.\n\n` +
        `*Saluran Bayaran Rasmi:*\n` +
        `• Bank: ${cfg.namaBank}\n` +
        `• No. Akaun: *${cfg.noAkaunBank}*\n` +
        `• Nama Akaun: ${cfg.namaPemegangAkaun}\n\n` +
        `Sila hantarkan resit bayaran kepada Bendahari (${cfg.namaBendahari} di ${cfg.telBendahari}). Terima kasih.`;
    }

    const url = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Currently active configuration in Editor
  const currentEditingConfig = selectedTemplateToEdit === 'amaran_awal' ? configAwal : configSemasa;
  const setCurrentEditingConfig = (newCfg: LetterConfig) => {
    if (selectedTemplateToEdit === 'amaran_awal') {
      setConfigAwal(newCfg);
    } else {
      setConfigSemasa(newCfg);
    }
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
                  <span>Jana Surat Peringatan &amp; Amaran Awal Tunggakan Yuran</span>
                  <span className="bg-rose-500 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-full">
                    {countSemua} Ahli Terlibat
                  </span>
                </h2>
                <p className="text-[11px] text-slate-300 font-medium">
                  Tunggakan Semasa (≥ RM36) &bull; Amaran Awal (Bulan Seterusnya ≥ RM36) &bull; Dikeluarkan oleh Bendahari
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
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'senarai'
                  ? 'border-rose-600 text-rose-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckSquare className="h-4 w-4" />
              <span>1. Senarai Penerima ({categoryFilteredRecipients.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sunting')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'sunting'
                  ? 'border-rose-600 text-rose-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Edit3 className="h-4 w-4" />
              <span>2. Sunting Kandungan &amp; Templat Surat</span>
            </button>

            <button
              onClick={() => setActiveTab('pratonton')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'pratonton'
                  ? 'border-rose-600 text-rose-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              <span>3. Pratonton &amp; Cetak Surat (A4)</span>
            </button>
          </div>

          {/* TAB 1: SENARAI PENERIMA */}
          {activeTab === 'senarai' && (
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              
              {/* Category Filter Pills and Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-600 mr-1">Kategori Notis:</span>
                  <button
                    onClick={() => setCategoryFilter('semua')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      categoryFilter === 'semua'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>Semua Rekod</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-white font-mono">
                      {countSemua}
                    </span>
                  </button>

                  <button
                    onClick={() => setCategoryFilter('amaran_awal')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      categoryFilter === 'amaran_awal'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100'
                    }`}
                    title="Surat Amaran Awal: Ahli yang tunggakan akan mencecah atau melebihi RM36 pada bulan seterusnya"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Amaran Awal (Bulan Seterusnya ≥ RM36)</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-700 text-white font-mono">
                      {countAmaranAwal}
                    </span>
                  </button>

                  <button
                    onClick={() => setCategoryFilter('semasa')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      categoryFilter === 'semasa'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 border border-rose-200 text-rose-900 hover:bg-rose-100'
                    }`}
                    title="Surat Peringatan Semasa: Ahli yang telah tertunggak RM36 dan ke atas pada bulan ini"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Tunggakan Semasa (≥ RM36)</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-700 text-white font-mono">
                      {countSemasa}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  <button
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    {categoryFilteredRecipients.every((x) => selectedMemberIds.includes(x.member.noAhli)) && categoryFilteredRecipients.length > 0 ? (
                      <>
                        <Square className="h-3.5 w-3.5" /> Nyahpilih Kategori Ini
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" /> Pilih Kategori Ini ({categoryFilteredRecipients.length})
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

              {/* Informational Guidance Banner */}
              {categoryFilter === 'amaran_awal' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Fungsi Surat Amaran Awal:</strong> Kategori ini memaparkan ahli aktif yang tunggakan semasanya belum digantung (contohnya RM33 atau di bawah RM36), namun <strong>pada bulan seterusnya</strong> tunggakan mereka akan mencecah atau melebihi had RM36 sekiranya tiada bayaran dibuat (+RM{kadarYuran}). Notis awal ini memberi peluang kepada ahli untuk menyelesaikan yuran sebelum hak khairat kematian digantung.
                  </div>
                </div>
              )}

              {categoryFilter === 'semasa' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Peringatan Tunggakan Semasa:</strong> Kategori ini menyenaraikan ahli yang telah pun mencapai atau melebihi had perlembagaan RM36 (12 bulan atau lebih) pada rekod terkini. Surat ini berfungsi sebagai peringatan rasmi dan penegasan penggantungan manfaat khairat.
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari penerima mengikut Nama, No. Ahli, No. IC, Telefon atau Alamat..."
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              {/* Table / List */}
              {filteredModalMembers.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
                  <p className="text-sm font-bold text-slate-700">Tiada rekod ahli dijumpai untuk kriteria ini.</p>
                  <p className="text-xs text-slate-500">Semua ahli aktif berada dalam status pembayaran yang teratur.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto max-h-[460px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/90 text-slate-700 font-extrabold text-[11px] uppercase tracking-wide sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-10 text-center">Pilih</th>
                          <th className="p-3 w-24">No. Ahli</th>
                          <th className="p-3">Nama Ahli &amp; No. IC</th>
                          <th className="p-3">Alamat</th>
                          <th className="p-3 w-28 text-center">Lunas Hingga</th>
                          <th className="p-3 w-32 text-center">Tunggakan Semasa</th>
                          <th className="p-3 w-36 text-center">Bulan Hadapan (+RM{kadarYuran})</th>
                          <th className="p-3 w-36 text-center">Status / Jenis Notis</th>
                          <th className="p-3 w-32 text-center">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredModalMembers.map((item) => {
                          const m = item.member;
                          const isChecked = selectedMemberIds.includes(m.noAhli);
                          const isAwal = item.category === 'amaran_awal';

                          return (
                            <tr
                              key={m.noAhli}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                isChecked
                                  ? isAwal
                                    ? 'bg-amber-50/20'
                                    : 'bg-rose-50/20'
                                  : ''
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
                                  {m.ic || 'Tiada No. IC'} {m.tel ? `• Tel: ${m.tel}` : '• Tiada Tel'}
                                </div>
                              </td>
                              <td className="p-3 text-slate-600 text-[11px] max-w-xs truncate">
                                {m.alamat || '-'}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-700">
                                {item.latestPaid}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-block px-2 py-0.5 font-mono font-black text-xs rounded-full border ${
                                  isAwal
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-rose-100 text-rose-900 border-rose-300'
                                }`}>
                                  RM {item.actualDues}
                                </span>
                                <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                                  {item.arrearsPeriod}
                                </div>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-800">
                                <span className="text-rose-700 font-black">RM {item.nextMonthDues}</span>
                                <span className="block text-[9px] text-slate-400 font-sans">
                                  {item.nextMonthDues >= 36 ? 'Mencecah/Lebih RM36' : ''}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {isAwal ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock className="h-3 w-3 text-amber-700" />
                                    <span>Amaran Awal</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                    <ShieldAlert className="h-3 w-3 text-rose-700" />
                                    <span>Tunggakan ≥ RM36</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setPrintSingleMember(m);
                                      setActiveTab('pratonton');
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 font-bold text-[10px] rounded transition cursor-pointer"
                                    title="Papar dan cetak surat untuk ahli ini"
                                  >
                                    Pratonton
                                  </button>

                                  <button
                                    onClick={() => handleSendWhatsApp(item)}
                                    disabled={!m.tel}
                                    className={`px-2 py-1 font-bold text-[10px] rounded transition cursor-pointer flex items-center gap-1 ${
                                      m.tel
                                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-200'
                                    }`}
                                    title={m.tel ? 'Hantar notis rasmi terus melalui WhatsApp' : 'Tiada rekod nombor telefon'}
                                  >
                                    <MessageSquare className="h-3 w-3 text-emerald-600" />
                                    <span>WA</span>
                                  </button>
                                </div>
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

          {/* TAB 2: SUNTING KANDUNGAN SURAT */}
          {activeTab === 'sunting' && (
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              
              {/* Notification Banner */}
              {saveNotification && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Kandungan dan tetapan templat surat telah berjaya disimpan ke pangkalan data.</span>
                </div>
              )}

              {/* Template Switcher Buttons */}
              <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedTemplateToEdit('semasa')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedTemplateToEdit === 'semasa'
                      ? 'bg-rose-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Templat 1: Surat Tunggakan Semasa (≥ RM36)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTemplateToEdit('amaran_awal')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedTemplateToEdit === 'amaran_awal'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span>Templat 2: Surat Amaran Awal (Bulan Seterusnya ≥ RM36)</span>
                </button>
              </div>

              <div className={`border p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                selectedTemplateToEdit === 'amaran_awal'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <Edit3 className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Penyuntingan Templat {selectedTemplateToEdit === 'amaran_awal' ? 'Surat Amaran Awal' : 'Surat Peringatan Semasa'}:</strong> Anda sedang menyunting perkataan rasmi, maklumat rujukan, akaun bank, dan arahan Bendahari untuk kategori ini. Maklumat pencarum (Nama, No Ahli, Tunggakan Semasa, Anggaran Bulan Hadapan) akan diisi secara automatik.
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
                    value={currentEditingConfig.rujukanPrefix}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, rujukanPrefix: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-400">Contoh: PKKGB/BND/AMARAN-AWAL/2026/001</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Tarikh Surat:
                  </label>
                  <input
                    type="text"
                    value={currentEditingConfig.tarikhSurat}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, tarikhSurat: e.target.value })}
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
                    value={currentEditingConfig.tajukSurat}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, tajukSurat: e.target.value })}
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
                    value={currentEditingConfig.pembukaan}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, pembukaan: e.target.value })}
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
                    value={currentEditingConfig.arahanBayaran}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, arahanBayaran: e.target.value })}
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
                    value={currentEditingConfig.namaBank}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, namaBank: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Nombor Akaun Bank:
                  </label>
                  <input
                    type="text"
                    value={currentEditingConfig.noAkaunBank}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, noAkaunBank: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Nama Pemegang Akaun (Akaun Pertubuhan):
                  </label>
                  <input
                    type="text"
                    value={currentEditingConfig.namaPemegangAkaun}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, namaPemegangAkaun: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Tempoh Penyelesaian Bayaran:
                  </label>
                  <input
                    type="text"
                    value={currentEditingConfig.tempohHari}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, tempohHari: e.target.value })}
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
                    value={currentEditingConfig.maklumanResitOnline}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, maklumanResitOnline: e.target.value })}
                    className="w-full p-2.5 bg-emerald-50/40 border border-emerald-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-emerald-600 leading-relaxed text-slate-800"
                  />
                  <span className="text-[10px] text-slate-500">
                    Sertakan nombor telefon WhatsApp Bendahari (017-9161615) dan maklumat butiran wajib seperti Nama Ahli &amp; No. Ahli.
                  </span>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Makluman Pilihan Bayaran Tunai:
                  </label>
                  <input
                    type="text"
                    value={currentEditingConfig.maklumanTunai}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, maklumanTunai: e.target.value })}
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
                    value={currentEditingConfig.peringatanKeahlian}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, peringatanKeahlian: e.target.value })}
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
                    value={currentEditingConfig.namaBendahari}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, namaBendahari: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500 uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    No. Telefon Bendahari:
                  </label>
                  <input
                    type="text"
                    value={currentEditingConfig.telBendahari}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, telBendahari: e.target.value })}
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
                    value={currentEditingConfig.notaJanaanKomputer}
                    onChange={(e) => setCurrentEditingConfig({ ...currentEditingConfig, notaJanaanKomputer: e.target.value })}
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
                  <span>Set Semula Templat {selectedTemplateToEdit === 'amaran_awal' ? 'Amaran Awal' : 'Peringatan Semasa'}</span>
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

          {/* TAB 3: PRATONTON & CETAK SURAT */}
          {activeTab === 'pratonton' && (
            <div className="p-5 flex-1 overflow-y-auto space-y-4 flex flex-col">
              
              {/* Controls ribbon */}
              <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">Pilih Ahli Ditonton:</span>
                  <select
                    value={previewMemberIndex}
                    onChange={(e) => setPreviewMemberIndex(Number(e.target.value))}
                    className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-rose-500"
                  >
                    {recipientsToPrint.map((item, idx) => (
                      <option key={item.member.noAhli} value={idx}>
                        {item.member.noAhli} - {item.member.nama} ({item.category === 'amaran_awal' ? 'Amaran Awal: RM' : 'Tunggakan: RM'} {item.actualDues})
                      </option>
                    ))}
                  </select>

                  {/* Template Format Selector in Preview */}
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 text-xs">
                    <span className="text-[11px] font-bold text-slate-500 px-1.5">Format Surat:</span>
                    <button
                      type="button"
                      onClick={() => setPreviewFormatMode('auto')}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                        previewFormatMode === 'auto'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Gunakan format automatik mengikut kategori ahli (Amaran Awal atau Semasa)"
                    >
                      Automatik
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFormatMode('amaran_awal')}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                        previewFormatMode === 'amaran_awal'
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Amaran Awal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFormatMode('semasa')}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                        previewFormatMode === 'semasa'
                          ? 'bg-rose-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Peringatan Semasa
                    </button>
                  </div>
                </div>

                {/* Font Size Adjustment (Standard Font 12) */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
                  <Type className="h-3.5 w-3.5 text-slate-500" />
                  <span className="font-bold text-slate-700">Saiz Tulisan:</span>
                  <button
                    type="button"
                    onClick={() => setFontSizePt((prev) => Math.max(10, prev - 1))}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-black flex items-center justify-center cursor-pointer transition"
                    title="Kecilkan Saiz Tulisan"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-rose-700 px-1 text-xs min-w-[34px] text-center">
                    {fontSizePt} pt
                  </span>
                  <button
                    type="button"
                    onClick={() => setFontSizePt((prev) => Math.min(15, prev + 1))}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-black flex items-center justify-center cursor-pointer transition"
                    title="Besarkan Saiz Tulisan"
                  >
                    +
                  </button>
                  {fontSizePt === 12 && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded ml-1">
                      Piawai (Font 12)
                    </span>
                  )}
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

                  {currentPreviewRecipient && (
                    <button
                      onClick={() => handleSendWhatsApp(currentPreviewRecipient)}
                      disabled={!currentPreviewRecipient.member.tel}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                        currentPreviewRecipient.member.tel
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                      title={currentPreviewRecipient.member.tel ? 'Kirim notis ini terus ke WhatsApp ahli' : 'Tiada no telefon'}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Kirim WhatsApp</span>
                    </button>
                  )}

                  <button
                    onClick={() => triggerPrintBatch(currentPreviewRecipient?.member)}
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
                  <div
                    className="bg-white text-slate-900 p-8 sm:p-11 shadow-xl border border-slate-300 rounded-sm w-full max-w-3xl space-y-4 font-sans select-text"
                    style={{ fontSize: `${fontSizePt}pt`, lineHeight: 1.5 }}
                  >
                    
                    {/* Official Letterhead */}
                    <div className="border-b-2 border-double border-slate-900 pb-3 text-center space-y-1">
                      <div className="flex items-center justify-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                          PKK
                        </div>
                        <div>
                          <h1
                            style={{ fontSize: `${fontSizePt + 2}pt` }}
                            className="font-black tracking-tight text-slate-950 uppercase"
                          >
                            PERTUBUHAN KEBAJIKAN KHAIRAT KEMATIAN
                          </h1>
                          <h2
                            style={{ fontSize: `${fontSizePt}pt` }}
                            className="font-bold text-slate-800 uppercase tracking-widest"
                          >
                            KAMPUNG GONG BADAK, KUALA NERUS, TERENGGANU
                          </h2>
                        </div>
                      </div>
                      <p
                        style={{ fontSize: `${fontSizePt - 2}pt` }}
                        className="text-slate-600"
                      >
                        Pendaftaran Pertubuhan (PPM) &bull; Masjid Kampung Gong Badak, 21300 Kuala Nerus, Terengganu
                      </p>
                    </div>

                    {/* Reference & Date */}
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="flex justify-between items-center text-slate-700 pt-1"
                    >
                      <div>
                        Ruj. Kami: <strong className="font-mono font-bold">{activePreviewConfig.rujukanPrefix}/{currentPreviewRecipient.member.noAhli}</strong>
                      </div>
                      <div className="text-right">
                        Tarikh: <strong>{activePreviewConfig.tarikhSurat}</strong>
                      </div>
                    </div>

                    {/* Recipient Address */}
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="space-y-0.5 pt-1"
                    >
                      <div>Kepada:</div>
                      <div
                        style={{ fontSize: `${fontSizePt + 1.5}pt` }}
                        className="font-black text-slate-950 uppercase tracking-wide"
                      >
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
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="pt-1 font-semibold"
                    >
                      Tuan / Puan,
                    </div>

                    {/* Subject */}
                    <div
                      style={{ fontSize: `${fontSizePt + 0.5}pt` }}
                      className="font-black text-slate-950 uppercase underline leading-snug pt-0.5"
                    >
                      {activePreviewConfig.tajukSurat}
                    </div>

                    {/* Paragraph 1 */}
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="text-justify text-slate-900 leading-relaxed"
                    >
                      {activePreviewConfig.pembukaan}
                    </div>

                    {/* Box: Arrears Summary */}
                    <div className={`border-2 rounded-lg p-3.5 space-y-2 ${
                      currentPreviewRecipient.category === 'amaran_awal'
                        ? 'bg-amber-50/40 border-amber-800'
                        : 'bg-slate-50 border-slate-800'
                    }`}>
                      <div
                        style={{ fontSize: `${fontSizePt - 1}pt` }}
                        className="font-black uppercase text-slate-900 tracking-wider border-b border-slate-300 pb-1 flex justify-between items-center"
                      >
                        <span>PENYATA BUTIRAN TUNGGAKAN YURAN:</span>
                        <span className="font-mono font-bold text-slate-600">ID: {currentPreviewRecipient.member.noAhli}</span>
                      </div>
                      <div
                        style={{ fontSize: `${fontSizePt}pt` }}
                        className="grid grid-cols-2 gap-y-1.5"
                      >
                        <div className="text-slate-600">Nama Pencarum:</div>
                        <div className="font-bold text-slate-900 uppercase">{currentPreviewRecipient.member.nama}</div>

                        <div className="text-slate-600">Status Pembayaran Terakhir:</div>
                        <div className="font-bold text-slate-900 font-mono">Lunas Sehingga {currentPreviewRecipient.latestPaid}</div>

                        <div className="text-slate-600">Tempoh / Bulan Tertunggak:</div>
                        <div className="font-bold text-rose-800">{currentPreviewRecipient.arrearsPeriod}</div>

                        <div
                          style={{ fontSize: `${fontSizePt + 0.5}pt` }}
                          className="text-slate-900 font-bold pt-1 border-t border-slate-200"
                        >
                          Jumlah Tunggakan Semasa:
                        </div>
                        <div
                          style={{ fontSize: `${fontSizePt + 1.5}pt` }}
                          className="font-black text-rose-700 font-mono pt-1 border-t border-slate-200"
                        >
                          RM {currentPreviewRecipient.actualDues}.00
                        </div>

                        {/* Next Month Projected Arrears */}
                        <div
                          style={{ fontSize: `${fontSizePt + 0.5}pt` }}
                          className="text-slate-900 font-bold pt-1 border-t border-slate-200"
                        >
                          Anggaran Tunggakan Bulan Seterusnya (+RM{kadarYuran}):
                        </div>
                        <div
                          style={{ fontSize: `${fontSizePt + 1.5}pt` }}
                          className="font-black text-rose-800 font-mono pt-1 border-t border-slate-200"
                        >
                          RM {currentPreviewRecipient.nextMonthDues}.00
                          <span className="text-[10px] font-sans font-bold text-amber-800 block">
                            (Bakal Melebihi / Mencecah Had RM36)
                          </span>
                        </div>

                        <div className="text-slate-600 pt-1 border-t border-slate-200">Jenis Notis Surat:</div>
                        <div className="font-bold text-slate-900 pt-1 border-t border-slate-200">
                          {currentPreviewRecipient.category === 'amaran_awal' ? (
                            <span className="text-amber-800 uppercase font-black">
                              Surat Amaran Awal (Sebelum Penggantungan Keahlian)
                            </span>
                          ) : (
                            <span className="text-rose-800 uppercase font-black">
                              Surat Peringatan Semasa (Tunggakan ≥ RM36)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Paragraph 2: Instructions */}
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="text-justify text-slate-900 leading-relaxed"
                    >
                      {activePreviewConfig.arahanBayaran} Bayaran hendaklah diselesaikan dalam tempoh <strong>{activePreviewConfig.tempohHari}</strong> melalui saluran rasmi pertubuhan berikut:
                    </div>

                    {/* Bank Info Box */}
                    <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 space-y-1.5 text-slate-900">
                      <div
                        style={{ fontSize: `${fontSizePt}pt` }}
                        className="font-black text-slate-950 flex items-center gap-2 uppercase tracking-wide border-b border-slate-300 pb-1"
                      >
                        <Building2 className="h-4 w-4 text-slate-700" />
                        <span>Saluran Pembayaran Rasmi Pertubuhan</span>
                      </div>
                      <div
                        style={{ fontSize: `${fontSizePt}pt` }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1"
                      >
                        <div>Nama Bank: <strong>{activePreviewConfig.namaBank}</strong></div>
                        <div>Nama Akaun: <strong>{activePreviewConfig.namaPemegangAkaun}</strong></div>
                        <div className="sm:col-span-2">
                          Nombor Akaun: <strong className="font-mono text-slate-950 font-black text-base">{activePreviewConfig.noAkaunBank}</strong>
                        </div>
                      </div>

                      {/* Online Receipt Instructions (WhatsApp Bendahari) */}
                      {activePreviewConfig.maklumanResitOnline && (
                        <div className="bg-white border border-emerald-300 rounded-lg p-3 text-slate-800 space-y-1.5 shadow-2xs mt-2">
                          <div
                            style={{ fontSize: `${fontSizePt - 1}pt` }}
                            className="font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Penghantaran Bukti / Resit Bayaran Atas Talian (Transfer):</span>
                          </div>
                          <div
                            style={{ fontSize: `${fontSizePt}pt` }}
                            className="text-slate-800 whitespace-pre-line leading-relaxed pl-5 font-medium"
                          >
                            {activePreviewConfig.maklumanResitOnline}
                          </div>
                          <div
                            style={{ fontSize: `${fontSizePt - 1.5}pt` }}
                            className="text-slate-500 font-mono pl-5 pt-1 border-t border-slate-100"
                          >
                            (Sertakan: Nama Ahli: <strong>{currentPreviewRecipient.member.nama}</strong> | No. Ahli: <strong>{currentPreviewRecipient.member.noAhli}</strong>)
                          </div>
                        </div>
                      )}

                      <div
                        style={{ fontSize: `${fontSizePt - 0.5}pt` }}
                        className="text-slate-600 pt-1.5 border-t border-slate-200 italic"
                      >
                        {activePreviewConfig.maklumanTunai}
                      </div>
                    </div>

                    {/* Paragraph 3: Constitution Warning */}
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className={`text-justify leading-relaxed p-3 rounded-lg border ${
                        currentPreviewRecipient.category === 'amaran_awal'
                          ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                          : 'bg-rose-50/70 border-rose-300 text-rose-950'
                      }`}
                    >
                      {activePreviewConfig.peringatanKeahlian}
                    </div>

                    {/* Closing & Sign-off */}
                    <div className="pt-2 space-y-3">
                      <div
                        style={{ fontSize: `${fontSizePt}pt` }}
                        className="space-y-1"
                      >
                        <div>Sekian, terima kasih.</div>
                        <div className="font-bold text-slate-950 tracking-wide mt-1">
                          &quot;BERKHIDMAT UNTUK KARIAH&quot;
                        </div>
                      </div>

                      {/* Issuer Details */}
                      <div
                        style={{ fontSize: `${fontSizePt}pt` }}
                        className="space-y-0.5"
                      >
                        <div>Saya yang menjalankan amanah,</div>
                        <div
                          style={{ fontSize: `${fontSizePt + 1.5}pt` }}
                          className="pt-4 font-black uppercase text-slate-950 tracking-wider"
                        >
                          {activePreviewConfig.namaBendahari}
                        </div>
                        <div
                          style={{ fontSize: `${fontSizePt + 0.5}pt` }}
                          className="font-bold text-slate-800 uppercase"
                        >
                          {activePreviewConfig.jawatanPengeluar}
                        </div>
                        <div className="text-slate-600">
                          Pertubuhan Kebajikan Khairat Kematian Kampung Gong Badak
                        </div>
                        <div className="font-mono text-slate-700 flex items-center gap-1.5 pt-0.5">
                          <Phone className="h-3.5 w-3.5 text-slate-500" />
                          <span>H/P: {activePreviewConfig.telBendahari}</span>
                        </div>
                      </div>

                      {/* Computer Generated Disclaimer */}
                      <div className="pt-2 border-t border-slate-200 text-center">
                        <p
                          style={{ fontSize: `${fontSizePt - 2}pt` }}
                          className="text-slate-500 font-mono italic"
                        >
                          *** {activePreviewConfig.notaJanaanKomputer} ***
                        </p>
                      </div>

                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* Footer Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="text-slate-500 font-medium">
              Jumlah penerima terpilih: <strong className="text-slate-800">{recipientsToPrint.length} ahli</strong> ({countAmaranAwal} Amaran Awal, {countSemasa} Semasa)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => triggerPrintBatch()}
                disabled={recipientsToPrint.length === 0}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Semua ({recipientsToPrint.length})</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 2. PRINT PORTAL (FOR REAL A4 BATCH PRINTING) */}
      {isPrintingPortal && createPortal(
        <div className="fixed inset-0 z-99999 bg-white text-black p-0 overflow-y-auto">
          {/* Top Bar for Print Screen */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden sticky top-0 z-50 shadow-md">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-rose-400" />
              <span className="font-bold text-sm">
                Sedia Untuk Cetak: {recipientsToPrint.length} Salinan Surat Peringatan / Amaran Awal (Piawai Font 12)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Buka Dialog Cetakan (Ctrl + P)</span>
              </button>
              <button
                onClick={() => setIsPrintingPortal(false)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Kembali
              </button>
            </div>
          </div>

          {/* Individual Print Letters with CSS Page Break */}
          <div className="space-y-8 print:space-y-0">
            {recipientsToPrint.map((item, idx) => {
              const m = item.member;
              const cfg = getLetterConfigForRecipient(item);

              return (
                <div
                  key={m.noAhli}
                  className="bg-white text-slate-900 p-8 sm:p-12 mx-auto max-w-3xl space-y-4 print:p-0 print:m-0 print:max-w-none print:w-full select-text"
                  style={{
                    fontSize: `${fontSizePt}pt`,
                    lineHeight: 1.5,
                    pageBreakAfter: idx === recipientsToPrint.length - 1 ? 'auto' : 'always',
                    breakAfter: idx === recipientsToPrint.length - 1 ? 'auto' : 'page'
                  }}
                >
                  
                  {/* Official Letterhead */}
                  <div className="border-b-2 border-double border-slate-900 pb-3 text-center space-y-1">
                    <div className="flex items-center justify-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                        PKK
                      </div>
                      <div>
                        <h1
                          style={{ fontSize: `${fontSizePt + 2}pt` }}
                          className="font-black tracking-tight text-slate-950 uppercase"
                        >
                          PERTUBUHAN KEBAJIKAN KHAIRAT KEMATIAN
                        </h1>
                        <h2
                          style={{ fontSize: `${fontSizePt}pt` }}
                          className="font-bold text-slate-800 uppercase tracking-widest"
                        >
                          KAMPUNG GONG BADAK, KUALA NERUS, TERENGGANU
                        </h2>
                      </div>
                    </div>
                    <p
                      style={{ fontSize: `${fontSizePt - 2}pt` }}
                      className="text-slate-600"
                    >
                      Pendaftaran Pertubuhan (PPM) &bull; Masjid Kampung Gong Badak, 21300 Kuala Nerus, Terengganu
                    </p>
                  </div>

                  {/* Reference & Date */}
                  <div
                    style={{ fontSize: `${fontSizePt}pt` }}
                    className="flex justify-between items-center text-slate-700 pt-1"
                  >
                    <div>
                      Ruj. Kami: <strong className="font-mono font-bold">{cfg.rujukanPrefix}/{m.noAhli}</strong>
                    </div>
                    <div className="text-right">
                      Tarikh: <strong>{cfg.tarikhSurat}</strong>
                    </div>
                  </div>

                  {/* Recipient Address */}
                  <div
                    style={{ fontSize: `${fontSizePt}pt` }}
                    className="space-y-0.5 pt-1"
                  >
                    <div>Kepada:</div>
                    <div
                      style={{ fontSize: `${fontSizePt + 1.5}pt` }}
                      className="font-black text-slate-950 uppercase tracking-wide"
                    >
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
                  <div
                    style={{ fontSize: `${fontSizePt}pt` }}
                    className="pt-1 font-semibold"
                  >
                    Tuan / Puan,
                  </div>

                  {/* Subject */}
                  <div
                    style={{ fontSize: `${fontSizePt + 0.5}pt` }}
                    className="font-black text-slate-950 uppercase underline leading-snug pt-0.5"
                  >
                    {cfg.tajukSurat}
                  </div>

                  {/* Paragraph 1 */}
                  <div
                    style={{ fontSize: `${fontSizePt}pt` }}
                    className="text-justify text-slate-900 leading-relaxed"
                  >
                    {cfg.pembukaan}
                  </div>

                  {/* Box: Arrears Summary */}
                  <div className={`border-2 rounded-lg p-3.5 space-y-2 ${
                    item.category === 'amaran_awal'
                      ? 'bg-amber-50/40 border-amber-800'
                      : 'bg-slate-50 border-slate-800'
                  }`}>
                    <div
                      style={{ fontSize: `${fontSizePt - 1}pt` }}
                      className="font-black uppercase text-slate-900 tracking-wider border-b border-slate-300 pb-1 flex justify-between items-center"
                    >
                      <span>PENYATA BUTIRAN TUNGGAKAN YURAN:</span>
                      <span className="font-mono font-bold text-slate-600">ID: {m.noAhli}</span>
                    </div>
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="grid grid-cols-2 gap-y-1.5"
                    >
                      <div className="text-slate-600">Nama Pencarum:</div>
                      <div className="font-bold text-slate-900 uppercase">{m.nama}</div>

                      <div className="text-slate-600">Status Pembayaran Terakhir:</div>
                      <div className="font-bold text-slate-900 font-mono">Lunas Sehingga {item.latestPaid}</div>

                      <div className="text-slate-600">Tempoh / Bulan Tertunggak:</div>
                      <div className="font-bold text-rose-800">{item.arrearsPeriod}</div>

                      <div
                        style={{ fontSize: `${fontSizePt + 0.5}pt` }}
                        className="text-slate-900 font-bold pt-1 border-t border-slate-200"
                      >
                        Jumlah Tunggakan Semasa:
                      </div>
                      <div
                        style={{ fontSize: `${fontSizePt + 1.5}pt` }}
                        className="font-black text-rose-700 font-mono pt-1 border-t border-slate-200"
                      >
                        RM {item.actualDues}.00
                      </div>

                      <div
                        style={{ fontSize: `${fontSizePt + 0.5}pt` }}
                        className="text-slate-900 font-bold pt-1 border-t border-slate-200"
                      >
                        Anggaran Tunggakan Bulan Seterusnya (+RM{kadarYuran}):
                      </div>
                      <div
                        style={{ fontSize: `${fontSizePt + 1.5}pt` }}
                        className="font-black text-rose-800 font-mono pt-1 border-t border-slate-200"
                      >
                        RM {item.nextMonthDues}.00
                        <span className="text-[10px] font-sans font-bold text-amber-800 block">
                          (Bakal Melebihi / Mencecah Had RM36)
                        </span>
                      </div>

                      <div className="text-slate-600 pt-1 border-t border-slate-200">Jenis Notis Surat:</div>
                      <div className="font-bold text-slate-900 pt-1 border-t border-slate-200">
                        {item.category === 'amaran_awal' ? (
                          <span className="text-amber-800 uppercase font-black">
                            Surat Amaran Awal (Sebelum Penggantungan Keahlian)
                          </span>
                        ) : (
                          <span className="text-rose-800 uppercase font-black">
                            Surat Peringatan Semasa (Tunggakan ≥ RM36)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Paragraph 2: Instructions */}
                  <div
                    style={{ fontSize: `${fontSizePt}pt` }}
                    className="text-justify text-slate-900 leading-relaxed"
                  >
                    {cfg.arahanBayaran} Bayaran hendaklah diselesaikan dalam tempoh <strong>{cfg.tempohHari}</strong> melalui saluran rasmi pertubuhan berikut:
                  </div>

                  {/* Bank Info Box */}
                  <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 space-y-1.5 text-slate-900">
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="font-black text-slate-950 flex items-center gap-2 uppercase tracking-wide border-b border-slate-300 pb-1"
                    >
                      <Building2 className="h-4 w-4 text-slate-700" />
                      <span>Saluran Pembayaran Rasmi Pertubuhan</span>
                    </div>
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1"
                    >
                      <div>Nama Bank: <strong>{cfg.namaBank}</strong></div>
                      <div>Nama Akaun: <strong>{cfg.namaPemegangAkaun}</strong></div>
                      <div className="sm:col-span-2">
                        Nombor Akaun: <strong className="font-mono text-slate-950 font-black text-base">{cfg.noAkaunBank}</strong>
                      </div>
                    </div>

                    {/* WhatsApp Online Receipt Notice for Print */}
                    {cfg.maklumanResitOnline && (
                      <div className="bg-white border border-slate-400 rounded p-2 text-slate-900 space-y-1 mt-2">
                        <div
                          style={{ fontSize: `${fontSizePt - 1}pt` }}
                          className="font-bold text-slate-950 uppercase tracking-wide"
                        >
                          Penghantaran Bukti / Resit Bayaran Atas Talian (Transfer):
                        </div>
                        <div
                          style={{ fontSize: `${fontSizePt}pt` }}
                          className="whitespace-pre-line leading-relaxed pl-2 font-medium"
                        >
                          {cfg.maklumanResitOnline}
                        </div>
                        <div
                          style={{ fontSize: `${fontSizePt - 1.5}pt` }}
                          className="text-slate-600 font-mono pl-2 pt-0.5 border-t border-slate-200 mt-1"
                        >
                          (Rujukan Ahli: <strong>{m.nama}</strong> | No. Ahli: <strong>{m.noAhli}</strong>)
                        </div>
                      </div>
                    )}

                    <div
                      style={{ fontSize: `${fontSizePt - 0.5}pt` }}
                      className="text-slate-700 pt-1 border-t border-slate-200 italic"
                    >
                      {cfg.maklumanTunai}
                    </div>
                  </div>

                  {/* Paragraph 3: Warning */}
                  <div
                    style={{ fontSize: `${fontSizePt}pt` }}
                    className={`text-justify leading-relaxed p-2.5 rounded-md border ${
                      item.category === 'amaran_awal'
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    {cfg.peringatanKeahlian}
                  </div>

                  {/* Closing & Sign-off */}
                  <div className="pt-2 space-y-4">
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="space-y-1"
                    >
                      <div>Sekian, terima kasih.</div>
                      <div className="font-bold text-slate-950 tracking-wide mt-1">
                        &quot;BERKHIDMAT UNTUK KARIAH&quot;
                      </div>
                    </div>

                    {/* Issuer details from Bendahari */}
                    <div
                      style={{ fontSize: `${fontSizePt}pt` }}
                      className="space-y-0.5"
                    >
                      <div>Saya yang menjalankan amanah,</div>
                      <div
                        style={{ fontSize: `${fontSizePt + 1.5}pt` }}
                        className="pt-3 font-black uppercase text-slate-950 tracking-wider"
                      >
                        {cfg.namaBendahari}
                      </div>
                      <div
                        style={{ fontSize: `${fontSizePt + 0.5}pt` }}
                        className="font-bold text-slate-800 uppercase"
                      >
                        {cfg.jawatanPengeluar}
                      </div>
                      <div className="text-slate-600">
                        Pertubuhan Kebajikan Khairat Kematian Kampung Gong Badak
                      </div>
                      <div className="font-mono text-slate-700 flex items-center gap-1 pt-0.5">
                        <Phone className="h-3 w-3 text-slate-500" />
                        <span>H/P: {cfg.telBendahari}</span>
                      </div>
                    </div>

                    {/* Computer Generated Disclaimer */}
                    <div className="pt-2 border-t border-slate-300 text-center">
                      <p
                        style={{ fontSize: `${fontSizePt - 2}pt` }}
                        className="text-slate-600 font-mono font-semibold italic bg-slate-100 py-1.5 px-3 rounded border border-slate-200"
                      >
                        *** {cfg.notaJanaanKomputer} ***
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
