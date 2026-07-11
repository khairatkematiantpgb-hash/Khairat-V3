/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { AppState, Member } from '../types';
import { 
  Users, 
  FileText, 
  Award, 
  Calendar, 
  Plus, 
  Trash2, 
  Printer, 
  AlertCircle,
  X,
  Search,
  Check,
  Edit2,
  Phone,
  UserCheck
} from 'lucide-react';

interface MaklumatPertubuhanProps {
  state: AppState;
  onChangeState?: (newState: AppState) => void;
  currentRole: 'admin' | 'user' | 'ajk' | null;
}

interface Pekeliling {
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

interface RoleAssignment {
  nama: string;
  tel: string;
  noAhli?: string;
}

interface ChartRoles {
  [roleId: string]: RoleAssignment;
}

const ROLE_LABELS: { [key: string]: string } = {
  pengerusi: 'PENGERUSI',
  bendahari: 'BENDAHARI',
  setiausaha: 'SETIAUSAHA',
  timb_pengerusi: 'TIMB. PENGERUSI',
  pen_setiausaha: 'PEN. SETIAUSAHA',
  ajk_1: 'AJK KARIYAH I',
  ajk_2: 'AJK KARIYAH II',
  ajk_3: 'AJK KARIYAH III',
  ajk_4: 'AJK KARIYAH IV',
  ajk_5: 'AJK KARIYAH V',
  ajk_6: 'AJK KARIYAH VI',
  ajk_7: 'AJK KARIYAH VII',
  ajk_8: 'AJK KARIYAH VIII',
  ajk_9: 'AJK KARIYAH IX',
  ajk_10: 'AJK KARIYAH X',
};

export default function MaklumatPertubuhan({ state, onChangeState, currentRole }: MaklumatPertubuhanProps) {
  // 1. Initial State for Circulars (loaded from localStorage if exists, else defaults)
  const [pekelilingList, setPekelilingList] = useState<Pekeliling[]>(() => {
    const saved = localStorage.getItem('khairat_gong_badak_pekeliling');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse pekeliling list', e);
      }
    }
    return [
      {
        id: 'pek-1',
        noRujukan: 'PKKKBGB/2026/PEK/01',
        tarikh: '2026-01-01',
        tarikhBerkuatkuasa: '2026-01-01',
        jenis: 'Pekeliling',
        tajuk: 'Penetapan Caruman Kebajikan & Yuran Khairat Bulanan RM3',
        kandungan: `Dengan hormat takzimnya perkara di atas adalah dirujuk.\n\nAdalah dimaklumkan kepada seluruh ahli kariah Kampung Gong Badak bahawa kadar caruman kebajikan bulanan kekal sebanyak RM3.00 sebulan bagi setiap ahli berdaftar. Caruman ini adalah sangat kritikal bagi membolehkan pihak jawatankuasa menguruskan bantuan kebajikan am, khairat kematian (RM400 hingga RM700), serta saguhati kemasukan wad (RM50-RM100) secara saksama.\n\nPihak bendahari memohon kerjasama semua ketua keluarga agar melakukan semakan baki secara berkala melalui portal ini dan melunaskan tunggakan sekiranya ada sebelum tarikh akhir kutipan tahunan bagi mengelakkan status keahlian bertukar kepada "Tidak Aktif".\n\nKerjasama dan keperihatinan seluruh ahli kariah amatlah dihargai demi kebajikan bersama.\n\nSekian, terima kasih.\n\n"BERIKHTIAR BERSAMA, BERBAKTI SEIKHLAS HATI"`,
        penerbit: 'Encik Zakaria bin Jusoh',
        jawatanPenerbit: 'Setiausaha Agung Pertubuhan',
        kepentingan: 'Penting'
      },
      {
        id: 'pek-2',
        noRujukan: 'PKKKBGB/2026/PEK/02',
        tarikh: '2026-06-15',
        tarikhBerkuatkuasa: '2026-06-15',
        jenis: 'Hebahan',
        tajuk: 'Hebahan Pelancaran Sistem Awan Google Sheets Terbuka',
        kandungan: `Merujuk kepada ketetapan Mesyuarat Agung Tahunan (AGM) Pertubuhan, dengan sukacitanya dimaklumkan bahawa sistem pangkalan data khairat kini dinaik taraf sepenuhnya dengan sistem penyegerakan dwi-hala Google Sheets.\n\nLangkah ini bertujuan meningkatkan ketelusan rekod bayaran dan membolehkan seluruh ahli kariah menyemak status terkini yuran masing-masing terus dari telefon pintar tanpa perlu merujuk kepada rekod fizikal.\n\nSemua urusan kemasukan data hanya boleh disunting oleh bendahari berdaftar (admin), manakala ahli kariah dan ajk diberikan akses carian telus bagi mengelakkan ralat teknikal.\n\nSila sebarkan pautan portal rasmi khairat-v3.vercel.app kepada semua waris kariah.\n\nSekian, terima kasih.`,
        penerbit: 'Haji Mohamad bin Alias',
        jawatanPenerbit: 'Pengerusi Pertubuhan',
        kepentingan: 'Segera'
      },
      {
        id: 'pek-3',
        noRujukan: 'PKKKBGB/2026/PEK/03',
        tarikh: '2026-06-28',
        tarikhBerkuatkuasa: '2026-07-01',
        jenis: 'Pekeliling',
        tajuk: 'Prosedur Tuntutan Manfaat Kematian & Bantuan Kebajikan Wad',
        kandungan: `Untuk makluman semua pencarum aktif, berikut adalah ketetapan prosedur rasmi bagi tuntutan khairat kematian dan bantuan kebajikan wad:\n\n1. Tuntutan Kematian (Ahli / Tanggungan):\n   - Salinan Sijil Kematian (Sijil Daftar Kematian) mestilah dikemukakan kepada Setiausaha dalam tempoh 14 hari.\n   - Kadar bantuan kematian ahli aktif adalah sebanyak RM700, manakala bantuan bagi tanggungan berdaftar adalah sebanyak RM400.\n\n2. Bantuan Kebajikan Wad (Warded):\n   - Bantuan sebanyak RM50 (rawatan biasa) sehingga RM100 (tahan wad melebihi 3 hari) akan diberikan sekali setahun bagi rawatan dalam wad hospital kerajaan.\n   - Sila lampirkan surat discaj wad (discharge note) kepada Setiausaha/PIC kebajikan bagi tujuan pengesahan.\n\nSemua tuntutan akan diproses and diluluskan secara tunai/pindahan bank dalam tempoh 48 jam bekerja.\n\nSekian untuk makluman seluruh ahli.`,
        penerbit: 'Haji Mamat bin Bakar',
        jawatanPenerbit: 'Bendahari Kehormat',
        kepentingan: 'Biasa'
      }
    ];
  });

  const savePekelilingToStorage = (newList: Pekeliling[]) => {
    setPekelilingList(newList);
    localStorage.setItem('khairat_gong_badak_pekeliling', JSON.stringify(newList));
  };

  // 2. Active Tab inside Information View (either 'carta' or 'pekeliling')
  const [infoTab, setInfoTab] = useState<'carta' | 'pekeliling'>('carta');
  
  // 3. States for adding new Circular
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPekeliling, setSelectedPekeliling] = useState<Pekeliling | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newIssuer, setNewIssuer] = useState('Encik Zakaria bin Jusoh');
  const [newIssuerRole, setNewIssuerRole] = useState('Setiausaha Agung');
  const [newPriority, setNewPriority] = useState<'Penting' | 'Biasa' | 'Segera'>('Biasa');
  const [newJenis, setNewJenis] = useState<'Pekeliling' | 'Hebahan'>('Pekeliling');
  const [newTarikhBerkuatkuasa, setNewTarikhBerkuatkuasa] = useState('');
  const [filterJenis, setFilterJenis] = useState<'Semua' | 'Pekeliling' | 'Hebahan'>('Semua');

  // 4. Interactive Org Chart State
  const [chartRoles, setChartRoles] = useState<ChartRoles>(() => {
    const saved = localStorage.getItem('khairat_gong_badak_chart_roles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse chart roles', e);
      }
    }
    // Default assignments based on initial state/image records
    return {
      pengerusi: { nama: "LAKSAMANA DATO' PAHLAWAN HJ. SULAIMAN BIN MOHAMAD (B)", tel: '013-5871409' },
      bendahari: { nama: "HJ. JAMALUDDIN BIN MOHAMAD", tel: '013-4842213' },
      setiausaha: { nama: "HJ. SALLEH BIN HASHIM", tel: '019-5514670' },
      timb_pengerusi: { nama: "IR. HJ. ABDUL RAHIM BIN JAAFAR", tel: '019-5581192' },
      pen_setiausaha: { nama: "HJ. AHMAD BIN HAMZAH", tel: '012-4565905' },
      ajk_1: { nama: "HJ. LATIF BIN SULONG", tel: '019-9001234' },
      ajk_2: { nama: "HJ. WAHAB BIN DAUD", tel: '019-9005678' },
      ajk_3: { nama: "ENCIK FADILAS BIN SHAFIE", tel: '019-9009012' },
      ajk_4: { nama: "HAJI ABDUL MANAN BIN OTHMAN", tel: '013-9821211' },
      ajk_5: { nama: "HAJI WAN SALLEH BIN WAN MAT", tel: '019-9554321' },
      ajk_6: { nama: "ENCIK RAMLI BIN JUSOH", tel: '012-9844321' },
      ajk_7: { nama: "HAJI ISMAIL BIN MAMAT", tel: '013-9213456' },
      ajk_8: { nama: "HAJI MOHD NOR BIN ISA", tel: '019-9812423' },
      ajk_9: { nama: "HAJI YUSOF BIN ABDULLAH", tel: '012-9445678' },
      ajk_10: { nama: "ENCIK MAT ALI BIN DIN", tel: '017-9123456' },
    };
  });

  // Modal States for selecting Member
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualNama, setManualNama] = useState('');
  const [manualTel, setManualTel] = useState('');
  const [selectedMemberNo, setSelectedMemberNo] = useState<string>('');

  // Open Edit Mode for specific position
  const startEditingRole = (roleId: string) => {
    if (currentRole !== 'admin') return;
    const current = chartRoles[roleId] || { nama: '', tel: '' };
    setEditingRoleId(roleId);
    setManualNama(current.nama);
    setManualTel(current.tel);
    setSelectedMemberNo(current.noAhli || '');
    setSearchQuery('');
  };

  // Filter members list based on query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return state.members.filter(m => m.status === 'Aktif').slice(0, 8);
    }
    const q = searchQuery.toLowerCase();
    return state.members.filter(m => 
      m.nama.toLowerCase().includes(q) || 
      m.noAhli.toLowerCase().includes(q) ||
      (m.ic && m.ic.includes(q))
    );
  }, [state.members, searchQuery]);

  // Handle selecting a member from database list
  const handleSelectMember = (member: Member) => {
    setManualNama(member.nama);
    setManualTel(member.tel || '');
    setSelectedMemberNo(member.noAhli);
  };

  // Save changes to local state & storage
  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoleId) return;

    const updatedRoles = {
      ...chartRoles,
      [editingRoleId]: {
        nama: manualNama.trim(),
        tel: manualTel.trim(),
        noAhli: selectedMemberNo || undefined
      }
    };

    setChartRoles(updatedRoles);
    localStorage.setItem('khairat_gong_badak_chart_roles', JSON.stringify(updatedRoles));
    setEditingRoleId(null);
  };

  // Reset/Clear role assignment
  const handleClearRole = () => {
    if (!editingRoleId) return;

    const updatedRoles = {
      ...chartRoles,
      [editingRoleId]: {
        nama: '',
        tel: '',
        noAhli: undefined
      }
    };

    setChartRoles(updatedRoles);
    localStorage.setItem('khairat_gong_badak_chart_roles', JSON.stringify(updatedRoles));
    setEditingRoleId(null);
  };

  // Handle Create Circular
  const handleCreateCircular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const currentDate = String(new Date().getDate()).padStart(2, '0');
    const formattedDate = `${currentYear}-${currentMonth}-${currentDate}`;
    
    const sequentialNum = String(pekelilingList.length + 1).padStart(2, '0');
    const newRef = `PKKKBGB/${currentYear}/PEK/${sequentialNum}`;

    const newPek: Pekeliling = {
      id: `pek-${Date.now()}`,
      noRujukan: newRef,
      tarikh: formattedDate,
      tarikhBerkuatkuasa: newTarikhBerkuatkuasa || undefined,
      jenis: newJenis,
      tajuk: newTitle,
      kandungan: newContent,
      penerbit: newIssuer,
      jawatanPenerbit: newIssuerRole,
      kepentingan: newPriority
    };

    const updated = [newPek, ...pekelilingList];
    savePekelilingToStorage(updated);
    
    setNewTitle('');
    setNewContent('');
    setNewTarikhBerkuatkuasa('');
    setNewJenis('Pekeliling');
    setShowAddModal(false);
  };

  // Delete Circular
  const handleDeleteCircular = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Adakah anda pasti mahu memadam pekeliling rasmi ini?')) {
      const filtered = pekelilingList.filter(p => p.id !== id);
      savePekelilingToStorage(filtered);
      if (selectedPekeliling?.id === id) {
        setSelectedPekeliling(null);
      }
    }
  };

  const handlePrintCircular = () => {
    window.print();
  };

  // Render Card Component for organization chart
  const renderCard = (roleId: string, customTitle?: string) => {
    const roleData = chartRoles[roleId] || { nama: '', tel: '' };
    const title = customTitle || ROLE_LABELS[roleId];
    const isAssigned = !!roleData.nama;
    const isBendahari = roleId === 'bendahari';
    const isAdmin = currentRole === 'admin';

    return (
      <div
        onClick={() => isAdmin && startEditingRole(roleId)}
        className={`group bg-[#FAF9F6] border-2 ${isAssigned ? 'border-slate-400' : 'border-dashed border-slate-300'} rounded shadow-sm text-center w-full max-w-[230px] ${
          isAdmin 
            ? 'hover:scale-102 hover:shadow-md hover:border-emerald-600 cursor-pointer transition-all' 
            : 'cursor-default'
        } overflow-hidden flex flex-col justify-between`}
        title={isAdmin ? `Klik untuk tukar / pilih pemegang jawatan ${title}` : `${title}`}
      >
        {/* Plaque Header / Title block */}
        <div className="bg-[#EAE6DB] border-b-2 border-slate-350 text-slate-950 font-black tracking-wide text-[11px] md:text-xs py-1.5 uppercase font-mono">
          {title}
        </div>

        {/* Visual / Image frame */}
        <div className="p-3 flex flex-col items-center justify-center bg-white min-h-[95px]">
          {isBendahari ? (
            /* Special logo for Bendahari to match the Masjid image */
            <div className="flex flex-col items-center">
              <svg className="w-14 h-11 text-emerald-700" viewBox="0 0 100 80" fill="currentColor">
                {/* Simplified Masjid Dome and Minarets Vector representation */}
                <path d="M 50 15 C 38 15, 38 35, 50 35 C 62 35, 62 15, 50 15 Z" />
                <rect x="47" y="35" width="6" height="15" />
                <path d="M 25 50 L 75 50 L 70 30 L 30 30 Z" />
                {/* Minarets */}
                <rect x="20" y="15" width="4" height="35" />
                <path d="M 22 5 L 20 15 L 24 15 Z" fill="currentColor" />
                <rect x="76" y="15" width="4" height="35" />
                <path d="M 78 5 L 76 15 L 80 15 Z" fill="currentColor" />
                {/* Base */}
                <rect x="15" y="50" width="70" height="6" />
              </svg>
              <span className="text-[7.5px] font-bold text-emerald-800 tracking-wider uppercase mt-1 font-mono">MASJID AN-NASRIYAH</span>
            </div>
          ) : (
            /* Default Profile Frame Silhouette with Songkok/Kopiah style hint */
            <div className={`h-14 w-14 rounded-full flex items-center justify-center ${isAssigned ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-300'} relative`}>
              <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              {isAssigned && isAdmin && (
                <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-0.5 rounded-full">
                  <Edit2 className="h-2.5 w-2.5" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Name and phone info footer plaque */}
        <div className="bg-[#FAF9F6] border-t border-slate-200 py-2.5 px-1.5 flex flex-col justify-center min-h-[55px]">
          {isAssigned ? (
            <>
              <strong className="block text-[10.5px] font-black text-slate-900 tracking-tight leading-tight uppercase font-sans">
                {roleData.nama}
              </strong>
              <span className="text-[9.5px] text-slate-600 font-mono font-bold mt-1 block">
                H/P: {roleData.tel || '-'}
              </span>
            </>
          ) : (
            <span className="text-[10px] text-slate-400 font-bold tracking-tight uppercase italic block border border-dashed border-slate-300 rounded p-1 mx-2">
              {isAdmin ? '+ Pilih Nama' : 'Tiada Pemegang'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Visual Header banner */}
      <div className="bg-slate-900 border-l-4 border-emerald-600 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden" id="info-portal-banner">
        <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-650/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full font-mono">
              Maklumat Rasmi Pertubuhan
            </span>
            <h2 className="text-lg md:text-xl font-extrabold mt-2 tracking-tight uppercase">
              STRUKTUR TADBIR & ARKIB PEKELILING KARIYAH
            </h2>
            <p className="text-slate-350 text-xs mt-1 max-w-xl leading-relaxed">
              Selamat datang ke portal maklumat bersepadu. Di sini dipaparkan Carta Organisasi kepimpinan kebajikan Kampung Gong Badak serta arkib surat pekeliling rasmi untuk makluman seluruh kariah.
            </p>
          </div>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setInfoTab('carta')}
              className={`px-4 py-2 text-xs font-black uppercase rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                infoTab === 'carta' 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Carta Organisasi
            </button>
            <button
              onClick={() => setInfoTab('pekeliling')}
              className={`px-4 py-2 text-xs font-black uppercase rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                infoTab === 'pekeliling' 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Pekeliling Ahli
              <span className="bg-rose-500 text-white text-[9px] font-bold h-4 px-1.2 rounded-full flex items-center justify-center animate-pulse">
                {pekelilingList.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Screen Area */}
      <div>
        {infoTab === 'carta' ? (
          <div className="space-y-8" id="carta-organisasi-view">
            
            {/* Header section */}
            <div className="text-center max-w-2xl mx-auto space-y-1 bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Carta Eksekutif & Ahli Jawatankuasa</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Pertubuhan Khairat Kematian dan Kebajikan Kampung Gong Badak.
              </p>
              <p className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100 max-w-lg mx-auto mt-1.5">
                💡 Sila klik pada mana-mana kotak jawatan di bawah untuk menukar pemegang jawatan, memilih nama daripada pangkalan data ahli secara automatik, atau mengemas kini nombor telefon.
              </p>
            </div>

            {/* Hierarchy Tree (Responsively designed to match the uploaded diagram layout) */}
            <div className="relative p-2 md:p-6 bg-white border border-slate-150 rounded-2xl shadow-sm overflow-x-auto min-w-[700px] md:min-w-0">
              
              <div className="flex flex-col items-center">
                
                {/* Level 1: PENGERUSI (Centered at top) */}
                <div className="flex justify-center w-full relative z-10">
                  {renderCard('pengerusi')}
                </div>

                {/* Vertical Connector Line from Pengerusi to Horizontal Bar */}
                <div className="w-1.5 h-8 bg-slate-900 !mt-0 z-0" />

                {/* Level 2: Left-Center-Right Layout connected with horizontal line */}
                <div className="w-full relative !mt-0">
                  
                  {/* The Horizontal Connector Line */}
                  <div className="absolute top-0 left-[16.67%] right-[16.67%] h-1.5 bg-slate-900" />
                  
                  {/* Vertical drops at the endpoints of the line */}
                  <div className="absolute top-0 left-[16.67%] w-1.5 h-4 bg-slate-900" />
                  <div className="absolute top-0 left-1/2 -ml-[3px] w-1.5 h-4 bg-slate-900" />
                  <div className="absolute top-0 right-[16.67%] w-1.5 h-4 bg-slate-900" />

                  {/* Three pillars below horizontal line: Bendahari (Left), Timb. Pengerusi (Center), Setiausaha (Right) */}
                  <div className="grid grid-cols-3 gap-4 pt-4 relative z-10">
                    
                    {/* Left: BENDAHARI */}
                    <div className="flex flex-col items-center">
                      {renderCard('bendahari')}
                    </div>

                    {/* Center: TIMB. PENGERUSI */}
                    <div className="flex flex-col items-center h-full">
                      {renderCard('timb_pengerusi')}
                      
                      {/* Vertical line going down from Timb Pengerusi to AJKs section */}
                      <div className="w-1.5 flex-grow bg-slate-900" />
                    </div>

                    {/* Right: SETIAUSAHA */}
                    <div className="flex flex-col items-center">
                      {renderCard('setiausaha')}
                      
                      {/* Vertical line going down from Setiausaha to Pen. Setiausaha */}
                      <div className="w-1.5 h-6 bg-slate-900" />
                      
                      {/* PEN. SETIAUSAHA directly underneath SETIAUSAHA */}
                      {renderCard('pen_setiausaha')}
                    </div>

                  </div>
                </div>

                {/* Level 3: 10 Ahli Jawatankuasa under Timb. Pengerusi */}
                <div className="w-full border-t-4 border-slate-900 pt-6 !mt-0 relative">
                  
                  {/* Vertical connector line inside Level 3 */}
                  <div className="absolute top-0 left-1/2 -ml-[3px] w-1.5 h-16 bg-slate-900 pointer-events-none" />
                  
                  <div className="text-center mb-6 relative z-10">
                    <span className="bg-white border-2 border-slate-900 text-slate-950 font-black text-[10px] tracking-widest uppercase py-1.5 px-5 rounded-full font-mono">
                      AHLI JAWATANKUASA (10 ORANG) - Di bawah Timbalan Pengerusi
                    </span>
                  </div>

                  {/* Grid of 10 AJK members */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-6xl mx-auto">
                    {Array.from({ length: 10 }).map((_, index) => {
                      const ajkId = `ajk_${index + 1}`;
                      return (
                        <div key={ajkId} className="flex justify-center">
                          {renderCard(ajkId, `AJK ${index + 1}`)}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>

            {/* Info Footer Box */}
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3 text-xs text-emerald-850 max-w-4xl mx-auto">
              <AlertCircle className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black uppercase tracking-wider text-[10.5px]">Ketelusan Tadbir Urus</strong>
                <p className="font-sans leading-relaxed mt-1 text-emerald-900/90">
                  Semua nama di atas dilantik melalui persetujuan sebulat suara dalam Mesyuarat Agung Tahunan (AGM) Kariah Kampung Gong Badak. Segala penyata aliran tunai, caruman bulanan, dan perbelanjaan kebajikan adalah dikendalikan dengan telus di bawah seliaan barisan AJK Eksekutif ini dan disahkan oleh Pemeriksa Kira-Kira berdaftar.
                </p>
              </div>
            </div>

          </div>
        ) : (
          <div className="space-y-5" id="surat-pekeliling-view">
            
            {/* Header circular */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Arkib Surat Pekeliling Kariah</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">Senarai surat edaran, hebahan rasmi, dan prosedur pendaftaran kebajikan ahli khairat.</p>
              </div>
              
              {/* Add New Circular button for Admin */}
              {currentRole === 'admin' && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Pekeliling Baru
                </button>
              )}
            </div>

            {/* Tapis Jenis Pekeliling / Hebahan */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black uppercase text-slate-500 mr-1.5">Tapis Dokumen:</span>
                <button
                  onClick={() => setFilterJenis('Semua')}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                    filterJenis === 'Semua'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-550'
                  }`}
                >
                  Semua ({pekelilingList.length})
                </button>
                <button
                  onClick={() => setFilterJenis('Pekeliling')}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                    filterJenis === 'Pekeliling'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-550'
                  }`}
                >
                  Pekeliling ({pekelilingList.filter(p => (p.jenis || 'Pekeliling') === 'Pekeliling').length})
                </button>
                <button
                  onClick={() => setFilterJenis('Hebahan')}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                    filterJenis === 'Hebahan'
                      ? 'bg-sky-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-550'
                  }`}
                >
                  Hebahan ({pekelilingList.filter(p => p.jenis === 'Hebahan').length})
                </button>
              </div>
            </div>

            {/* Circular list grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
              {pekelilingList.filter(pek => {
                if (filterJenis === 'Semua') return true;
                return (pek.jenis || 'Pekeliling') === filterJenis;
              }).map((pek) => {
                const isUrgent = pek.kepentingan === 'Segera';
                const isImportant = pek.kepentingan === 'Penting';
                const jenis = pek.jenis || 'Pekeliling';
                const isHebahan = jenis === 'Hebahan';
                
                return (
                  <div
                    key={pek.id}
                    onClick={() => setSelectedPekeliling(pek)}
                    className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-2xs hover:shadow-md transition-all duration-150 cursor-pointer border-t-4 hover:border-emerald-600 space-y-3.5 flex flex-col justify-between group"
                    style={{ borderTopColor: isUrgent ? '#ef4444' : isImportant ? '#f59e0b' : '#10b981' }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono font-bold text-slate-400">
                          {pek.noRujukan}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded font-mono ${
                            isHebahan 
                              ? 'bg-sky-50 text-sky-700 border border-sky-100' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {jenis}
                          </span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded font-mono ${
                            isUrgent 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : isImportant 
                                ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {pek.kepentingan}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-xs font-black text-slate-800 leading-snug group-hover:text-emerald-700 transition-colors uppercase">
                        {pek.tajuk}
                      </h4>
                      
                      <p className="text-[11.5px] text-slate-500 font-sans line-clamp-3 leading-relaxed whitespace-pre-line pt-1">
                        {pek.kandungan}
                      </p>
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex flex-col gap-2 mt-auto shrink-0">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>Diterbit: {pek.tarikh}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {currentRole === 'admin' && (
                            <button
                              onClick={(e) => handleDeleteCircular(pek.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition rounded hover:bg-rose-50"
                              title="Padam Pekeliling"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                            Baca &rarr;
                          </span>
                        </div>
                      </div>

                      {pek.tarikhBerkuatkuasa && (
                        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded text-[9.5px] font-bold font-mono self-start border border-emerald-100">
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Mula Kuatkuasa: {pek.tarikhBerkuatkuasa}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {pekelilingList.filter(pek => filterJenis === 'Semua' || (pek.jenis || 'Pekeliling') === filterJenis).length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2 max-w-md mx-auto">
                <FileText className="h-8 w-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-black uppercase text-slate-600">Tiada Rekod Ditemui</h4>
                <p className="text-xs text-slate-400 font-sans">
                  Sila hubungi bendahari (admin) kariah untuk memuat naik surat pekeliling atau keputusan mesyuarat terkini bagi kategori ini.
                </p>
              </div>
            )}

          </div>
        )}
      </div>

      {/* MODAL: Select / Edit Member for Committee Position */}
      {editingRoleId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl rounded-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <UserCheck className="h-4.5 w-4.5" />
                <span>PILIH PEMEGANG JAWATAN: {ROLE_LABELS[editingRoleId] || editingRoleId.toUpperCase()}</span>
              </h3>
              <button 
                onClick={() => setEditingRoleId(null)}
                className="text-slate-400 hover:text-white cursor-pointer p-1 rounded hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search input for Pangkalan Data */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Cari Nama Ahli Dari Pangkalan Data (Ahli Aktif)
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Taip nama atau No. Ahli..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-sans text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Scrollable search results list */}
            <div className="space-y-1">
              <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest px-1 font-mono">Hasil Carian Ahli</div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-900">
                {filteredMembers.map((member) => (
                  <button
                    key={member.noAhli}
                    type="button"
                    onClick={() => handleSelectMember(member)}
                    className="w-full text-left p-2 hover:bg-emerald-950/40 rounded-lg transition-colors flex items-center justify-between gap-3 text-xs cursor-pointer group"
                  >
                    <div>
                      <span className="font-mono bg-emerald-950/80 border border-emerald-900 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded mr-2">
                        {member.noAhli}
                      </span>
                      <strong className="text-slate-200 group-hover:text-emerald-300 transition-colors uppercase">
                        {member.nama}
                      </strong>
                    </div>
                    <div className="text-right flex items-center gap-1">
                      {member.tel ? (
                        <span className="text-slate-400 text-[10px] font-mono">{member.tel}</span>
                      ) : (
                        <span className="text-slate-500 text-[10px] italic">Tiada H/P</span>
                      )}
                      <span className="text-[10px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-emerald-400 font-bold uppercase group-hover:bg-emerald-900 group-hover:text-white transition-colors ml-2">
                        Pilih
                      </span>
                    </div>
                  </button>
                ))}
                {filteredMembers.length === 0 && (
                  <div className="text-center p-6 text-slate-500 text-xs italic">
                    Tiada ahli ditemui dengan nama tersebut. Sila taip secara manual di bawah jika ahli belum berdaftar.
                  </div>
                )}
              </div>
            </div>

            {/* Selected / Manual inputs */}
            <form onSubmit={handleSaveRole} className="space-y-4 pt-2 border-t border-slate-800">
              <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest px-1 font-mono">Kemas Kini Butiran Jawatan</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nama Pemegang Jawatan</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama penuh..."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-bold uppercase text-xs"
                    value={manualNama}
                    onChange={(e) => setManualNama(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">No. Telefon / HP</label>
                  <input
                    type="text"
                    placeholder="e.g. 013-5871409"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-mono text-xs font-bold"
                    value={manualTel}
                    onChange={(e) => setManualTel(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-between gap-2.5 text-[10.5px] font-black uppercase font-mono">
                <button
                  type="button"
                  onClick={handleClearRole}
                  className="px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-900/60 text-rose-300 hover:text-white transition rounded-xl cursor-pointer"
                >
                  Padam / Kosongkan
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRoleId(null)}
                    className="px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white transition rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white transition rounded-xl cursor-pointer shadow-md"
                  >
                    Simpan Jawatankuasa
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: Display Full Circular PDF-Memo */}
      {selectedPekeliling && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in print:bg-white print:absolute print:inset-0">
          <div className="bg-white border border-slate-350 shadow-2xl rounded-2xl max-w-2xl w-full p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto relative animate-scale-up print:shadow-none print:border-none print:p-0 print:max-h-none print:overflow-visible">
            
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 print:hidden">
              <span className="text-[10px] font-mono font-bold text-slate-550 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-400" />
                DOKUMEN RASMI PERSURATAN PERTUBUHAN
              </span>
              
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrintCircular}
                  className="p-1.8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Cetak Surat Pekeliling"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak</span>
                </button>
                <button
                  onClick={() => setSelectedPekeliling(null)}
                  className="p-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-6 pt-2 select-text font-serif">
              
              <div className="text-center pb-4 border-b-2 border-double border-slate-800 space-y-1">
                <h3 className="text-sm font-extrabold tracking-wide text-slate-950 uppercase leading-snug">
                  PERTUBUHAN KHAIRAT KEMATIAN DAN KEBAJIKAN KAMPUNG GONG BADAK
                </h3>
                <p className="text-[10px] text-slate-700 uppercase tracking-wider leading-relaxed">
                  Kuala Nerus, 21300 Terengganu Darul Iman
                </p>
                <p className="text-[9px] text-slate-500 font-sans tracking-normal italic leading-none">
                  E-mel: khairatkematiantpgb@gmail.com &bull; Pendaftaran Pertubuhan (ROS): PPM-024-11-10112024
                </p>
              </div>

              <div className="flex justify-between items-start text-xs font-sans font-semibold text-slate-800">
                <div className="space-y-0.5">
                  <div>Ruj. Kami: <strong className="font-bold">{selectedPekeliling.noRujukan}</strong></div>
                  <div>Jenis: <span className={`font-black uppercase font-mono text-[10px] ${selectedPekeliling.jenis === 'Hebahan' ? 'text-sky-700' : 'text-emerald-700'}`}>{selectedPekeliling.jenis || 'Pekeliling'}</span></div>
                  <div>Status: <span className="text-amber-700 font-bold uppercase font-mono text-[10px]">{selectedPekeliling.kepentingan}</span></div>
                </div>
                <div className="text-right space-y-0.5">
                  <div>Tarikh Terbit: <strong className="font-bold">{selectedPekeliling.tarikh}</strong></div>
                  {selectedPekeliling.tarikhBerkuatkuasa && (
                    <div className="text-emerald-800 font-bold">Mula Kuatkuasa: <span>{selectedPekeliling.tarikhBerkuatkuasa}</span></div>
                  )}
                  <div>Kariah: <span className="font-normal italic">Kampung Gong Badak</span></div>
                </div>
              </div>

              <div className="text-xs space-y-1 font-sans">
                <div>Kepada,</div>
                <div className="font-bold text-slate-950">Semua Ahli Kariah & Pencarum Berdaftar,</div>
                <div>Pertubuhan Khairat Kematian Kampung Gong Badak.</div>
              </div>

              <div className="text-slate-950 font-bold uppercase text-xs md:text-[13px] leading-snug border-l-4 border-slate-900 pl-3 py-1 bg-slate-50 font-sans">
                {selectedPekeliling.jenis === 'Hebahan' ? 'HEBAHAN RASMI' : 'PEKELILING RASMI'}: {selectedPekeliling.tajuk}
              </div>

              <div className="text-xs md:text-[13px] text-slate-900 leading-relaxed whitespace-pre-wrap font-sans text-justify space-y-4 pt-1">
                {selectedPekeliling.kandungan}
              </div>

              <div className="pt-6 space-y-10 border-t border-slate-100 font-sans select-none shrink-0">
                <div className="text-xs">
                  Sedia berkhidmat untuk kariah,<br />
                  <strong className="block text-slate-950 uppercase mt-4 tracking-wide font-black">
                    {selectedPekeliling.penerbit}
                  </strong>
                  <span className="text-xxs text-slate-500 block uppercase font-bold mt-0.5">
                    {selectedPekeliling.jawatanPenerbit}
                  </span>
                  <span className="text-slate-450 block text-[9px] font-mono mt-0.2">
                    Pertubuhan Khairat Kematian & Kebajikan Kampung Gong Badak
                  </span>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-slate-150 text-center text-[9px] text-slate-400 font-mono flex items-center justify-between shrink-0 print:hidden">
              <span>Sistem Pengurusan Khairat Terengganu v2.0</span>
              <span className="italic">Dijenakan cetakan mesra PDF (A4 Portrait)</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New Circular Form */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl rounded-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Tambah Surat Pekeliling
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCircular} className="space-y-3.5 text-left text-xs font-sans">
              
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tajuk Dokumen</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Notis Keputusan Mesyuarat Agung AGM 2026"
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-bold uppercase"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Jenis Dokumen</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setNewJenis('Pekeliling')}
                    className={`py-2 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                      newJenis === 'Pekeliling'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Pekeliling
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewJenis('Hebahan')}
                    className={`py-2 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                      newJenis === 'Hebahan'
                        ? 'bg-sky-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Hebahan
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Pilih Pengeluar (Isi Automatik dari Carta Organisasi)</label>
                <select
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const roleData = chartRoles[val];
                      if (roleData && roleData.nama) {
                        setNewIssuer(roleData.nama);
                        const rawLabel = ROLE_LABELS[val];
                        let formattedLabel = rawLabel;
                        if (rawLabel === 'PENGERUSI') formattedLabel = 'Pengerusi Pertubuhan';
                        else if (rawLabel === 'TIMB. PENGERUSI') formattedLabel = 'Timbalan Pengerusi';
                        else if (rawLabel === 'SETIAUSAHA') formattedLabel = 'Setiausaha Kehormat';
                        else if (rawLabel === 'PEN. SETIAUSAHA') formattedLabel = 'Penolong Setiausaha';
                        else if (rawLabel === 'BENDAHARI') formattedLabel = 'Bendahari Kehormat';
                        else {
                          // Titlecase AJK
                          formattedLabel = rawLabel.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        }
                        setNewIssuerRole(formattedLabel);
                      }
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>-- Pilih Pengurus Jawatankuasa --</option>
                  {Object.keys(chartRoles).map((roleId) => {
                    const roleData = chartRoles[roleId];
                    if (roleData && roleData.nama) {
                      return (
                        <option key={roleId} value={roleId}>
                          {ROLE_LABELS[roleId]} - {roleData.nama}
                        </option>
                      );
                    }
                    return null;
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Penerbit (Nama)</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                    value={newIssuer}
                    onChange={(e) => setNewIssuer(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jawatan</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                    value={newIssuerRole}
                    onChange={(e) => setNewIssuerRole(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Tahap Kepentingan</label>
                  <select
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                  >
                    <option value="Biasa">Biasa (Hijau)</option>
                    <option value="Penting">Penting (Oren)</option>
                    <option value="Segera">Segera (Merah)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Tarikh Berkuatkuasa</label>
                  <input
                    type="date"
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-bold font-mono"
                    value={newTarikhBerkuatkuasa}
                    onChange={(e) => setNewTarikhBerkuatkuasa(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Isi Kandungan Surat / Mesej</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Tuliskan isi kandungan rasmi..."
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 font-sans"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>

              <div className="pt-2 flex gap-2 font-black uppercase text-center text-[10px]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-white border border-slate-800 transition rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#047857] hover:bg-emerald-700 text-white transition rounded-xl cursor-pointer shadow-md"
                >
                  Simpan Pekeliling / Hebahan
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
