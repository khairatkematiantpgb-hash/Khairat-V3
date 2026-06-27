/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppState, Member, Tanggungan, MONTH_KEYS, MONTH_LABELS } from '../types';
import { calculateOutstandingDues, isSameMemberId, runKemaskiniMaklumatAhli } from '../lib/database';
import { Search, User, ShieldCheck, CheckCircle2, AlertCircle, FileText, Printer, MapPin, CreditCard, PlusCircle, Trash2, Edit2, Users, Check, X, Plus, Phone } from 'lucide-react';

interface ProfileDashboardProps {
  state: AppState;
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  onChangeState: (state: AppState) => void;
  currentRole: 'admin' | 'user';
}

export default function ProfileDashboard({ state, selectedMemberId, setSelectedMemberId, onChangeState, currentRole }: ProfileDashboardProps) {
  const [searchQuery, setSearchQuery] = useState(selectedMemberId || '');
  
  // Track the last ID synced up to the parent or received externally to prevent feedback loops
  const lastSentIdRef = useRef<string>(selectedMemberId);

  // Synchronize internal query state with the incoming parent coordinate ONLY if it differs
  useEffect(() => {
    if (selectedMemberId && selectedMemberId !== lastSentIdRef.current) {
      setSearchQuery(selectedMemberId);
      lastSentIdRef.current = selectedMemberId;
    }
  }, [selectedMemberId]);

  // Find targeted member based on active search query
  const foundMember = searchQuery.trim() !== ''
    ? state.members.find(
        m => isSameMemberId(m.noAhli, searchQuery.trim()) || m.nama.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : null;

  // The active member we are viewing:
  // 1. If we found one via search, use that.
  // 2. If search is empty, fallback to the pre-selected parent member.
  // 3. Otherwise, if there is no query and no pre-selection, fallback to first member.
  const finalMember = foundMember || (searchQuery.trim() === ''
    ? (state.members.find(m => isSameMemberId(m.noAhli, selectedMemberId)) || (state.members.length > 0 ? state.members[0] : null))
    : null);

  // Sync selected ID up to the parent ONLY when a matching member is actively found.
  // This breaks the feedback loop when typing partial unmatched characters or backspacing!
  useEffect(() => {
    if (finalMember && finalMember.noAhli !== selectedMemberId) {
      lastSentIdRef.current = finalMember.noAhli;
      setSelectedMemberId(finalMember.noAhli);
    }
  }, [finalMember, selectedMemberId, setSelectedMemberId]);

  // Fetch payments
  const ledgerRows = finalMember
    ? state.ledger.filter(r => isSameMemberId(r.noAhli, finalMember.noAhli)).sort((a, b) => b.tahun - a.tahun)
    : [];

  const bakiKredit = ledgerRows.length > 0 ? (ledgerRows[0].lebihanKredit || 0) : 0;

  const actualOutstanding = finalMember
    ? (() => {
        const rows = state.ledger.filter(r => isSameMemberId(r.noAhli, finalMember.noAhli));
        if (rows.length === 0) {
          return calculateOutstandingDues(finalMember.noAhli, state.ledger, state.members, state.kadarYuranSebulan || 3);
        }
        return rows.reduce((sum, r) => {
          const rowDues = calculateOutstandingDues(r.noAhli, state.ledger, state.members, state.kadarYuranSebulan || 3, r.tahun);
          return sum + Math.max(0, rowDues - (r.lebihanKredit || 0));
        }, 0);
      })()
    : 0;

  const activeLedgerRow = ledgerRows.length > 0 ? ledgerRows[0] : null;
  const paidMonthsCount = activeLedgerRow
    ? MONTH_KEYS.filter(k => !!activeLedgerRow[k]).length
    : 0;

  // Helper to compute exact months/years that are unpaid
  const getArrearsDetails = (m: Member) => {
    if (m.status !== 'Aktif') return 'Tiada (Tidak Aktif)';
    
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
      return 'Tiada';
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

  // Dependents modal state
  const [showDepModal, setShowDepModal] = useState(false);
  const [editingDepIndex, setEditingDepIndex] = useState<number | null>(null);
  const [depName, setDepName] = useState('');
  const [depHubungan, setDepHubungan] = useState('Anak');
  const [depIc, setDepIc] = useState('');

  // Member edit modal state
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editNama, setEditNama] = useState('');
  const [editIc, setEditIc] = useState('');
  const [editAlamat, setEditAlamat] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editCatatan, setEditCatatan] = useState('');
  const [editTel, setEditTel] = useState('');

  const openEditMemberModal = () => {
    if (!finalMember) return;
    setEditNama(finalMember.nama);
    setEditIc(finalMember.ic);
    setEditAlamat(finalMember.alamat);
    setEditStatus(finalMember.status);
    setEditCatatan(finalMember.catatan || '');
    setEditTel(finalMember.tel || '');
    setShowEditMemberModal(true);
  };

  const handleSaveMemberEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalMember) return;

    const { newState, error } = runKemaskiniMaklumatAhli(state, {
      noAhli: finalMember.noAhli,
      namaBaru: editNama,
      icBaru: editIc,
      alamatBaru: editAlamat,
      statusBaru: editStatus,
      catatanBaru: editCatatan,
      telBaru: editTel
    });

    if (error) {
      alert(error);
    } else {
      onChangeState(newState);
      setShowEditMemberModal(false);
    }
  };

  const openAddDependentModal = () => {
    setDepName('');
    setDepIc('');
    setDepHubungan('Anak');
    setEditingDepIndex(null);
    setShowDepModal(true);
  };

  const openEditDependentModal = (index: number) => {
    if (!finalMember || !finalMember.tanggungan) return;
    const dep = finalMember.tanggungan[index];
    setDepName(dep.nama);
    setDepIc(dep.ic);
    setDepHubungan(dep.hubungan);
    setEditingDepIndex(index);
    setShowDepModal(true);
  };

  const handleDeleteDependent = (indexToDelete: number) => {
    if (!finalMember) return;
    const updatedTanggungan = (finalMember.tanggungan || []).filter((_, idx) => idx !== indexToDelete);
    const updatedMembers = state.members.map(m => {
      if (isSameMemberId(m.noAhli, finalMember.noAhli)) {
        return {
          ...m,
          tanggungan: updatedTanggungan
        };
      }
      return m;
    });

    onChangeState({
      ...state,
      members: updatedMembers
    });
  };

  const handleSaveDependent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalMember || !depName.trim() || !depIc.trim()) return;

    const newDep: Tanggungan = {
      nama: depName.trim(),
      hubungan: depHubungan,
      ic: depIc.trim()
    };

    let updatedTanggungan = [...(finalMember.tanggungan || [])];
    if (editingDepIndex !== null) {
      updatedTanggungan[editingDepIndex] = newDep;
    } else {
      updatedTanggungan.push(newDep);
    }

    const updatedMembers = state.members.map(m => {
      if (isSameMemberId(m.noAhli, finalMember.noAhli)) {
        return {
          ...m,
          tanggungan: updatedTanggungan
        };
      }
      return m;
    });

    onChangeState({
      ...state,
      members: updatedMembers
    });

    setShowDepModal(false);
    setDepName('');
    setDepIc('');
    setDepHubungan('Anak');
    setEditingDepIndex(null);
  };

  // Render Printable Surat Perakuan PDF including Dependents list
  const printOfficialSijil = () => {
    if (!finalMember) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Ralat: Sila benarkan pop-up di browser anda untuk mencetak.');
      return;
    }

    const yearDesc = activeLedgerRow ? activeLedgerRow.tahun : new Date().getFullYear();

    const monthlyLogListHtml = MONTH_KEYS.map((k, idx) => {
      const isPaid = activeLedgerRow ? !!activeLedgerRow[k] : false;
      const receipt = activeLedgerRow ? (activeLedgerRow[k] as string) : '';
      return `
        <div style="display: inline-block; width: 31%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; margin: 4px; text-align: center; box-sizing: border-box; font-size: 8.5px;">
          <strong style="display: block; color: #475569; text-transform: uppercase;">${MONTH_LABELS[idx]}</strong>
          <span style="display: block; font-weight: bold; margin-top: 3px; font-family: monospace; ${isPaid ? 'color: #047857;' : 'color: #be123c;'};">
            ${isPaid ? `RESIT: ${receipt}` : 'TUNGGAK'}
          </span>
        </div>
      `;
    }).join('');

    const dependentsListHtml = finalMember.tanggungan && finalMember.tanggungan.length > 0
      ? `
        <div style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px;">
          <strong style="display: block; font-size: 10px; color: #334155; text-transform: uppercase; margin-bottom: 5px;">SENARAI AHLI TANGGUNGAN BERDAFTAR (KELUARGA):</strong>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: left;">
            <thead>
              <tr style="background-color: #f8fafc; font-weight: bold; border-bottom: 1px solid #ddd;">
                <th style="padding: 5px; border: 1px solid #e2e8f0;">NAMA PENUH TANGGUNGAN</th>
                <th style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; width: 90px;">HUBUNGAN</th>
                <th style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; width: 110px;">NO. IC TANGGUNGAN</th>
              </tr>
            </thead>
            <tbody>
              ${finalMember.tanggungan.map(t => `
                <tr>
                  <td style="padding: 5px; border: 1px solid #e2e8f0; font-weight: bold;">${t.nama}</td>
                  <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center;">${t.hubungan}</td>
                  <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-family: monospace;">${t.ic}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="font-size: 8.5px; color: #475569; font-style: italic; margin-top: 5px; margin-bottom: 0;">* Berdasarkan rekod kebajikan Kampung Gong Badak, sekiranya berlaku kematian ke atas ahli atau mana-mana tanggungan di atas, urusan bantuan khairat kematian akan dijamin.</p>
        </div>
      `
      : `
        <div style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px; font-size: 9px; color: #64748b; font-style: italic;">
          * Tiada ahli keluarga tanggungan berdaftar. Hanya perlindungan bagi diri ahli utama yang diperakui.
        </div>
      `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sijil Perakuan Keahlian Khairat - Kampung Gong Badak</title>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', Times, serif; color: #000; margin: 40px; line-height: 1.5; font-size: 11px; }
          .border-frame { border: 4px double #000; padding: 30px; min-height: 90%; box-sizing: border-box; border-radius: 6px; }
          .crest { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 12px; }
          .title-lg { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }
          .title-sm { font-size: 9px; font-weight: bold; color: #334155; margin-top: 4px; text-transform: uppercase; }
          .doc-num { text-align: right; font-size: 8.5px; font-family: monospace; color: #64748b; margin-top: 15px; }
          .salutation { margin-top: 20px; font-size: 11px; }
          .recipient-box { margin-top: 15px; background: #fafafa; border: 1px solid #ddd; padding: 12px; border-radius: 4px; }
          .recipient-row { display: table; width: 100%; margin-bottom: 5px; }
          .recipient-label { display: table-cell; width: 140px; font-weight: bold; text-transform: uppercase; font-size: 9.5px; }
          .recipient-val { display: table-cell; font-size: 10.5px; font-weight: bold; }
          .main-text { margin-top: 20px; text-align: justify; font-size: 11px; }
          .log-grid { margin-top: 15px; background: #fff; padding: 8px 0; border-top: 1px dashed #ccc; border-bottom: 1px dashed #ccc; }
          .signature-area { margin-top: 40px; display: table; width: 100%; }
          .sig-row { display: table-cell; width: 50%; vertical-align: top; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: right; margin-bottom: 15px;">
          <button onclick="window.print()" style="padding: 6px 14px; background-color: #047857; color: white; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 10px;">Cetak Sijil / Surat Perakuan</button>
          <button onclick="window.close()" style="padding: 6px 14px; background-color: #e11d48; color: white; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; margin-left: 6px; font-size: 10px;">Tutup</button>
        </div>

        <div class="border-frame">
          <div class="crest">
            <h1 class="title-lg">Pertubuhan Khairat Kematian Dan Kebajikan</h1>
            <div style="font-size: 11px; font-weight: bold; margin-top: 2.5px;">Kampung Gong Badak, Kuala Nerus, Terengganu</div>
            <div class="title-sm">Sijil Perakuan Rasmi Status Keahlian & Pendaftaran Sumbangan</div>
          </div>

          <div class="doc-num">No. Rujukan Dokument: KKKB/GB/${finalMember.noAhli}/${yearDesc}</div>

          <div class="salutation">
            Adalah dengan ini diperakui di bawah kuasa Jawatankuasa Pengurusan Khairat Kematian Kampung Gong Badak bahawa penama berikut merupakan ahli sah yang berdaftar dalam sistem pemfailan kami:
          </div>

          <div class="recipient-box">
            <div class="recipient-row">
              <div class="recipient-label">No. Ahli Daftar</div>
              <div class="recipient-val" style="font-family: monospace;">${finalMember.noAhli}</div>
            </div>
            <div class="recipient-row">
              <div class="recipient-label">Nama Penuh</div>
              <div class="recipient-val">${finalMember.nama}</div>
            </div>
            <div class="recipient-row">
              <div class="recipient-label">No. Kad Pengenalan</div>
              <div class="recipient-val" style="font-family: monospace;">${finalMember.ic}</div>
            </div>
            <div class="recipient-row">
              <div class="recipient-label">Alamat Berdaftar</div>
              <div class="recipient-val">${finalMember.alamat}</div>
            </div>
            <div class="recipient-row">
              <div class="recipient-label">Status Keahlian</div>
              <div class="recipient-val" style="${finalMember.status === 'Aktif' ? 'color: #047857;' : 'color: #be123c;'} text-transform: uppercase;">
                ${finalMember.status} (KEALIAN PENUH)
              </div>
            </div>
          </div>

          <div class="main-text">
            Seterusnya diperakui bahawa penama telah melaksanakan sebahagian atau keseluruhan sumbangan dwi-mingguan kebajikan sebanyak <strong>RM3.00 sebulan</strong> bagi tahun kewangan semasa <strong>${yearDesc}</strong> dengan catatan rekod resit berikut:
          </div>

          <div class="log-grid">
            ${monthlyLogListHtml}
          </div>

          <div style="margin-top: 12px; font-size: 11px;">
            <strong>Jumlah Bulan Berbayar:</strong> ${paidMonthsCount} / 12 Bulan <br>
            <strong>Status Tunggakan Semasa:</strong> ${actualOutstanding > 0 ? `<span style="color: #be123c; font-weight: bold;">Mempunyai tunggakan sebanyak RM ${actualOutstanding}.00</span>` : '<span style="color: #047857; font-weight: bold;">LUNAS (TIADA TUNGGAKAN)</span>'}
          </div>

          ${dependentsListHtml}

          <div class="main-text" style="font-style: italic; font-size: 10px; color: #475569; margin-top: 15px;">
            * Dokumen ini dijana secara elektronik menerusi Portal Khairat Kematian Kampung Gong Badak dan disahkan sebagai salinan sah berdasarkan maklumat pangkalan lejar yang disegerakkan. Sijil diperakui bagi menjamin tuntutan kebajikan waris.
          </div>

          <div class="signature-area">
            <div class="sig-row">
              <div>Penerima Sijil,</div>
              <div style="margin-top: 35px; border-bottom: 1px solid #000; display: inline-block; width: 140px;"></div>
              <div style="font-size: 9.5px; margin-top: 3px;">Tarikh: ____________</div>
            </div>
            <div class="sig-row" style="text-align: right;">
              <div>Disahkan Oleh,</div>
              <div style="margin-top: 35px; border-bottom: 1px solid #000; display: inline-block; width: 180px; text-align: right;"></div>
              <div style="font-size: 9.5px; margin-top: 3px; font-weight: bold; text-transform: uppercase;">Pengerusi Jawatankuasa Khairat Kampung Gong Badak</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 font-sans" id="profile-dashboard-component">
      
      {/* Search Bar / Selector Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="space-y-0.5 max-w-md w-full">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight font-sans">Dashboard Carian & Profil Ahli</h3>
          <p className="text-[10px] text-slate-450 font-sans">Pilih atau taip kata kunci (Nama, No. KP, atau No. Ahli) untuk melihat/mengemaskini maklumat keahlian.</p>
        </div>

        {/* Input box */}
        <div className="relative w-full sm:w-auto sm:min-w-[320px]">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Cari No. Ahli, Nama, atau No. IC..."
            className="w-full pl-9 pr-3 py-1.8 bg-slate-50 border border-slate-300 text-slate-905 text-xs rounded focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main split dashboard view */}
      {finalMember ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="profile-grids">
          
          {/* Left Side: Member Detail Card */}
          <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-105 shadow-xs flex flex-col space-y-4 font-sans">
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
              {/* Circular initial badge avatar */}
              <div className="h-16 w-16 bg-slate-100 shadow-xxs rounded-full border border-slate-200 flex items-center justify-center text-slate-700 font-bold font-sans text-xl mb-3">
                {finalMember.nama.charAt(0).toUpperCase()}
              </div>
              <h4 className="text-sm font-extrabold text-slate-905 capitalize">{finalMember.nama}</h4>
              <span className="font-mono text-xs text-slate-400 font-bold block mt-1 tracking-wider">NO. AHLI: {finalMember.noAhli}</span>

              {/* Status Badge */}
              <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                finalMember.status === 'Aktif'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-150 text-slate-600'
              }`}>
                {finalMember.status === 'Aktif' ? 'Aktif (Ahli Khairat)' : 'Tidak Aktif (Tangguh)'}
              </span>
            </div>

            {/* Registry Details */}
            <div className="space-y-3.5 text-xs font-sans">
              <div className="flex gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="space-y-0.5 animate-in fade-in">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Alamat Berdaftar</span>
                  <p className="text-slate-700 font-medium leading-relaxed">{finalMember.alamat}</p>
                </div>
              </div>

              {currentRole !== 'user' && (
                <div className="flex gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Nombor Kad Pengenalan</span>
                    <p className="text-slate-700 font-mono tracking-tight font-bold">{finalMember.ic}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2.5">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">No. Telefon</span>
                  <p className="text-slate-700 font-mono tracking-tight font-bold">{finalMember.tel || <span className="text-slate-400 italic font-normal">Tiada</span>}</p>
                </div>
              </div>

              {finalMember.catatan && (
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600 mb-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Catatan Keanggotaan</span>
                  {finalMember.catatan}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-105 flex flex-col gap-2">
              {currentRole === 'admin' && (
                <button
                  onClick={openEditMemberModal}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-850 font-bold text-[10px] uppercase tracking-wider border border-indigo-200 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5 text-indigo-605" />
                  Kemaskini Butiran Ahli
                </button>
              )}
            </div>
          </div>

          {/* Right Side: Log of Months & Ledgers paid + Dependents Section */}
          <div className="lg:col-span-2 space-y-6 flex flex-col font-sans">
            
            {/* Payments Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-105 shadow-xs space-y-4 flex flex-col">
              <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-tight flex items-center gap-1.5 font-sans">
                  <CreditCard className="h-4.5 w-4.5 text-slate-805" />
                  Rekod Sumbangan Lejar Pemfailan
                </h3>
                <span className="text-[9px] font-black text-indigo-808 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded tracking-wide uppercase font-sans">
                  {ledgerRows.length} rekod am
                </span>
              </div>

              {/* Account Dues / Credit Indicators */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 pt-1">
                <div className="bg-slate-50 border border-slate-201 p-3 rounded-lg flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-405 uppercase tracking-wider font-sans">Jumlah Bulan Berbayar</span>
                  <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                    <span className="text-xl font-black text-slate-900">{paidMonthsCount}</span>
                    <span className="text-[10px] text-slate-400 font-bold font-sans">/ 12 BULAN</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-201 p-3 rounded-lg flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-405 uppercase tracking-wider font-sans">Lebihan Kredit (Baki)</span>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <span className="text-[10px] font-bold text-indigo-700 mr-0.5 font-sans">RM</span>
                    <span className="text-xl font-black text-indigo-705 leading-none">{bakiKredit}</span>
                  </div>
                </div>

                <div className="col-span-2 md:col-span-1 bg-slate-50 border border-slate-201 p-3 rounded-lg flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-405 uppercase tracking-wider font-sans">Tunggakan Keseluruhan</span>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <span className={`text-[10px] font-bold mr-0.5 font-sans ${actualOutstanding > 0 ? 'text-rose-600' : 'text-emerald-705'}`}>RM</span>
                    <span className={`text-xl font-black leading-none ${actualOutstanding > 0 ? 'text-rose-600' : 'text-emerald-705'}`}>
                      {actualOutstanding}
                    </span>
                  </div>
                  <div className="mt-1 text-[9px] leading-snug font-sans text-rose-500 font-medium">
                    {actualOutstanding > 0 ? (
                      <span className="break-words font-semibold block" title={getArrearsDetails(finalMember)}>
                        {getArrearsDetails(finalMember)}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold block">Lunas / Cemerlang</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Monthly Receipt grid layout */}
              {activeLedgerRow ? (
                <div className="space-y-2.5 pt-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Sumbangan Pemfailan {activeLedgerRow.tahun}</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {MONTH_LABELS.map((lbl, idx) => {
                      const monthKey = MONTH_KEYS[idx];
                      const receipt = activeLedgerRow[monthKey] as string;
                      const paid = !!receipt;

                      const today = new Date();
                      const currentYear = today.getFullYear();
                      const currentMonthIdx = today.getMonth();

                      const isArrears = !paid && (
                        activeLedgerRow.tahun < currentYear ||
                        (activeLedgerRow.tahun === currentYear && idx <= currentMonthIdx)
                      );

                      return (
                        <div
                          key={lbl}
                          className={`p-2.5 rounded border flex flex-col justify-between font-mono text-[9px] font-black uppercase transition ${
                            paid
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-150 shadow-3xs'
                              : isArrears
                              ? 'bg-rose-50/40 text-rose-800 border-rose-100 border-dashed'
                              : 'bg-slate-50 text-slate-400 border-slate-200 border-dashed'
                          }`}
                        >
                          <div className="flex justify-between text-slate-400 font-sans font-bold text-[8px]">
                            <span>B{idx + 1}</span>
                            <span>{lbl}</span>
                          </div>
                          <div className="mt-2.5 text-[11px] font-extrabold tracking-tight truncate" title={paid ? `Resit: ${receipt}` : isArrears ? 'Tunggak' : ''}>
                            {paid ? receipt : isArrears ? 'TUNGGAK' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs italic font-sans flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-6 w-6 text-slate-300" />
                  <span>Tiada baris lejar tahunan ditemui untuk ahli ini di dalam rekod lejar.</span>
                </div>
              )}
            </div>

            {/* Maklumat Tanggungan Keluarga Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-105 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-tight flex items-center gap-1.5 font-sans">
                  <Users className="h-4.5 w-4.5 text-slate-805" />
                  Maklumat Tanggungan Keluarga
                </h3>
                {currentRole === 'admin' && (
                  <button
                    onClick={openAddDependentModal}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-black rounded uppercase flex items-center gap-1 cursor-pointer transition-all border border-emerald-200"
                  >
                    <Plus className="h-3 w-3" /> Tambah Tanggungan
                  </button>
                )}
              </div>

              {finalMember.tanggungan && finalMember.tanggungan.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-sans">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-3 py-1.5">Nama Tanggungan</th>
                        {currentRole !== 'user' && <th className="px-3 py-1.5">No. IC / Surat Beranak</th>}
                        <th className="px-3 py-1.5">Hubungan</th>
                        {currentRole === 'admin' && <th className="px-3 py-1.5 text-right">Tindakan</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {finalMember.tanggungan.map((dep, dIdx) => (
                        <tr key={dIdx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-900 capitalize">{dep.nama}</td>
                          {currentRole !== 'user' && <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">{dep.ic}</td>}
                          <td className="px-3 py-2">
                            <span className="inline-block bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded">
                              {dep.hubungan}
                            </span>
                          </td>
                          {currentRole === 'admin' && (
                            <td className="px-3 py-2 text-right space-x-1">
                              <button
                                onClick={() => openEditDependentModal(dIdx)}
                                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold cursor-pointer transition-all"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteDependent(dIdx)}
                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded text-[9px] font-bold cursor-pointer transition-all"
                              >
                                Padam
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs italic font-sans">
                  Tiada maklumat tanggungan keluarga yang didaftarkan untuk ahli ini.
                </div>
              )}
            </div>

            {/* Historic ledger list */}
            {ledgerRows.length > 1 && (
              <div className="bg-white p-5 rounded-xl border border-slate-105 shadow-xs space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Rekod Arkib Tahun Sebelumnya:</span>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded text-xs">
                  {ledgerRows.slice(1).map((histRow) => {
                    const paidCount = MONTH_KEYS.filter(k => !!histRow[k]).length;
                    return (
                      <div key={histRow.tahun} className="p-2.5 flex justify-between font-mono text-[10px] font-bold hover:bg-slate-50 transition-colors">
                        <span className="text-slate-800 uppercase font-sans">Tahun {histRow.tahun}</span>
                        <span className="text-slate-400 uppercase font-sans">Liputan: {paidCount} / 12 Bulan</span>
                        <span className="text-slate-655 font-sans">Baki kredit: RM {histRow.lebihanKredit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 shadow-3xs">
          <Search className="h-8 w-8 text-slate-300 stroke-[1.5]" />
          <div>
            <p className="text-slate-800 text-xs font-bold font-sans">
              {searchQuery ? 'Tiada Rekod Ahli Ditemui' : 'Carian Profil Kosong'}
            </p>
            <p className="text-slate-455 text-[10px] font-sans mt-0.5 max-w-sm mx-auto">
              {searchQuery 
                ? `Tiada rekod ahli keriah ditemui padanan bagi "${searchQuery}". Sila periksa ejaan nama atau digit ID/IC anda.` 
                : 'Sila masukkan No. Ahli, Nama Penubuhan, atau No. IC di ruangan bar carian di atas untuk memaparkan butiran.'}
            </p>
          </div>
        </div>
      )}

      {/* MODAL: EDIT MEMBER PROFILE DETAILS */}
      {showEditMemberModal && finalMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded-xl border border-slate-150 max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-950 text-white p-4 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider">Kemaskini Profil Ahli ({finalMember.noAhli})</h3>
              <button onClick={() => setShowEditMemberModal(false)} className="text-slate-400 hover:text-white cursor-pointer p-0.5">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <form onSubmit={handleSaveMemberEdit} className="p-5 space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Nama Penuh Ahli</label>
                <input
                  type="text"
                  required
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-305 rounded p-2 text-xs font-bold capitalize focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Nombor Kad Pengenalan (IC)</label>
                <input
                  type="text"
                  required
                  value={editIc}
                  onChange={(e) => setEditIc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-305 rounded p-2 text-xs font-mono tracking-tight focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Nombor Telefon</label>
                <input
                  type="tel"
                  required
                  value={editTel}
                  onChange={(e) => setEditTel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-305 rounded p-2 text-xs font-mono tracking-tight focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Alamat Berdaftar</label>
                <textarea
                  required
                  rows={2}
                  value={editAlamat}
                  onChange={(e) => setEditAlamat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-305 rounded p-2 text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Status Keaktifan</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-305 rounded p-2 text-xs font-bold focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="Aktif">Aktif (Keahlian Penuh)</option>
                  <option value="Tidak Aktif">Tidak Aktif (Tangguh / Alamat Luar)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Tiada catatan"
                  className="w-full bg-slate-50 border border-slate-305 rounded p-2 text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditMemberModal(false)}
                  className="px-4 py-1.8 border border-slate-200 text-slate-700 hover:bg-slate-100 transition rounded-md text-[10px] font-bold uppercase cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.8 bg-emerald-700 hover:bg-emerald-805 text-white transition rounded-md text-[10px] font-black uppercase cursor-pointer flex items-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Simpan Kemaskini
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DEPENDENT */}
      {showDepModal && finalMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded-xl border border-slate-150 max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-950 text-white p-4 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-4.5 w-4.5 text-emerald-300" />
                {editingDepIndex !== null ? 'Sunting Ahli Tanggungan' : 'Daftar Tanggungan Baru'}
              </h3>
              <button onClick={() => setShowDepModal(false)} className="text-slate-400 hover:text-white cursor-pointer p-0.5">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <form onSubmit={handleSaveDependent} className="p-5 space-y-4 font-sans text-xs">
              <div className="p-3 bg-emerald-50/60 text-emerald-950 border border-emerald-100 rounded-lg text-[10.5px] leading-relaxed">
                Menyandarkan tanggungan baru keluarga di bawah kelolaan ahli penama utama <strong className="text-emerald-900 font-extrabold">{finalMember.nama} ({finalMember.noAhli})</strong>.
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Nama Penuh Tanggungan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Fatimah binti Sulaiman"
                  value={depName}
                  onChange={(e) => setDepName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-bold focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Hubungan Keluarga</label>
                  <select
                    value={depHubungan}
                    onChange={(e) => setDepHubungan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-bold focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Isteri">Isteri</option>
                    <option value="Suami">Suami</option>
                    <option value="Anak">Anak</option>
                    <option value="Ibu">Ibu</option>
                    <option value="Bapa">Bapa</option>
                    <option value="Adik">Adik</option>
                    <option value="Abang">Abang</option>
                    <option value="Kakak">Kakak</option>
                    <option value="Nenek">Nenek</option>
                    <option value="Datuk">Datuk</option>
                    <option value="Mentua">Mentua</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">No. IC / KP Tanggungan</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 121015-11-2010"
                    value={depIc}
                    onChange={(e) => setDepIc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono tracking-tight focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDepModal(false)}
                  className="px-4 py-1.8 border border-slate-200 text-slate-700 hover:bg-slate-100 transition rounded-md text-[10px] font-bold uppercase cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.8 bg-emerald-700 hover:bg-emerald-805 text-white transition rounded-md text-[10px] font-black uppercase cursor-pointer flex items-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Sahkan & Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
