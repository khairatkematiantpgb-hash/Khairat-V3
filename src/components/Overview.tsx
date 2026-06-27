/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppState, Tanggungan } from '../types';
import { runDaftarAhliBaru, calculateOutstandingDues, isSameMemberId } from '../lib/database';
import { PlusCircle, Info, Sparkles, UserPlus, ShieldAlert, CheckCircle, Search, HelpCircle, FileText, Plus, Trash2, Users } from 'lucide-react';

interface OverviewProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
  onNavigate: (tabId: string) => void;
  currentRole: 'admin' | 'user';
}

export default function Overview({ state, onChangeState, onNavigate, currentRole }: OverviewProps) {
  // Form states
  const [noAhli, setNoAhli] = useState('');
  const [nama, setNama] = useState('');
  const [ic, setIc] = useState('');
  const [alamat, setAlamat] = useState('');
  const [status, setStatus] = useState('Aktif');

  const monthsMalay = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];

  const [bulanDaftar, setBulanDaftar] = useState<number>(new Date().getMonth());
  const [tahunDaftar, setTahunDaftar] = useState<number>(new Date().getFullYear());
  
  // Tanggungan states (minimum 2 by default, can be added)
  const [tanggunganList, setTanggunganList] = useState<Tanggungan[]>([
    { nama: '', ic: '', hubungan: 'Isteri' },
    { nama: '', ic: '', hubungan: 'Anak' }
  ]);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tanggungan helpers
  const handleAddTanggungan = () => {
    setTanggunganList([...tanggunganList, { nama: '', ic: '', hubungan: 'Anak' }]);
  };

  const handleUpdateTanggungan = (index: number, field: keyof Tanggungan, value: string) => {
    const newList = [...tanggunganList];
    newList[index] = { ...newList[index], [field]: value };
    setTanggunganList(newList);
  };

  const handleRemoveTanggungan = (index: number) => {
    const newList = tanggunganList.filter((_, i) => i !== index);
    setTanggunganList(newList);
  };

  // 1. Calculate next recommended Member ID ("Cadangan")
  const getNextRecommendedId = () => {
    const numericIds = state.members
      .map(m => {
        const clean = m.noAhli.replace(/\D/g, '');
        return clean ? parseInt(clean, 10) : 0;
      })
      .filter(id => id > 0);
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    const nextId = maxId + 1;
    return nextId.toString().padStart(3, '0');
  };

  const handleApplySuggestion = () => {
    setNoAhli(getNextRecommendedId());
    setErrorMsg('');
  };

  // 2. Form submission handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (currentRole !== 'admin') {
      setErrorMsg('Ralat: Sesi pelawat (Read-Only) disekat daripada mendaftar ahli baru. Sila masuk sebagai admin.');
      return;
    }

    // Filter out dependents that do not have a name
    const validTanggungan = tanggunganList.filter(t => t.nama.trim() !== '');
    const catatanPendaftaran = `Mendaftar pada ${monthsMalay[bulanDaftar]} ${tahunDaftar}`;

    const { newState, error } = runDaftarAhliBaru(state, {
      noAhli,
      nama,
      ic,
      alamat,
      status,
      tanggungan: validTanggungan,
      catatan: catatanPendaftaran
    });

    if (error) {
      setErrorMsg(error);
    } else {
      onChangeState(newState);
      setSuccessMsg(`Sukses! Ahli ${nama.trim()} (${noAhli}) telah berjaya didaftarkan di dalam pangkalan data.`);
      
      // Clear form inputs
      setNoAhli('');
      setNama('');
      setIc('');
      setAlamat('');
      setStatus('Aktif');
      setBulanDaftar(new Date().getMonth());
      setTahunDaftar(new Date().getFullYear());
      setTanggunganList([
        { nama: '', ic: '', hubungan: 'Isteri' },
        { nama: '', ic: '', hubungan: 'Anak' }
      ]);
    }
  };

  // 3. Dynamic Stats Computations
  const totalMembers = state.members.length;
  const activeMembers = state.members.filter(m => m.status === 'Aktif').length;
  const inactiveMembers = state.members.filter(m => m.status === 'Tidak Aktif').length;

  const totalOutstanding = state.members.reduce((sum, member) => {
    if (member.status !== 'Aktif') return sum;
    const memberRows = state.ledger.filter(r => isSameMemberId(r.noAhli, member.noAhli));
    const totalLebihanKredit = memberRows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);
    const dues = calculateOutstandingDues(member.noAhli, state.ledger, state.members, state.kadarYuranSebulan || 3);
    const actualDues = Math.max(0, dues - totalLebihanKredit);
    return sum + actualDues;
  }, 0);

  return (
    <div className="space-y-6 font-sans" id="overview-component">
      {/* Immersive Brand Header Banner Panel mapping Snapshot 1 */}
      <div className="bg-gradient-to-r from-slate-900 to-[#12221b] text-white p-6 rounded-xl border border-slate-800 shadow-md flex justify-between items-center relative overflow-hidden" id="overview-welcome-card">
        {/* Subtle Decorative abstract element */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-5 pointer-events-none flex items-center justify-center">
          <UsersBigIcon />
        </div>

        <div className="space-y-2 max-w-3xl z-10">
          <span className="bg-emerald-650/35 border border-emerald-500/25 text-emerald-300 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full font-mono">
            Kampung Gong Badak
          </span>
          <h2 className="text-lg md:text-xl font-extrabold tracking-tight leading-snug text-slate-100 font-sans">
            Portal Pengurusan Pertubuhan Khairat Kematian Dan Kebajikan Kampung Gong Badak
          </h2>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Sistem pengurusan keahlian dan kutipan sumbangan khairat (yuran bulanan RM{state.kadarYuranSebulan || 3}.00) bersepadu Kampung Gong Badak. Mendaftar ahli baru di borang sebelah kiri atau kemas kini rekod pembayaran yuran untuk menjamin dana kebajikan waris.
          </p>
        </div>
      </div>

      {/* Grid of Four Responsive Stat Cards mirroring the mockup exactly */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-dashboard">
        {/* Total Members Card */}
        <div className="bg-white p-4 rounded-xl border-l-4 border-slate-700 border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Jumlah Keseluruhan Ahli</span>
          <div className="flex items-baseline gap-1.5 mt-2.5">
            <span className="text-2xl font-black text-slate-905 font-mono">{totalMembers}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">daftar</span>
          </div>
        </div>

        {/* Active Members Card */}
        <div className="bg-white p-4 rounded-xl border-l-4 border-emerald-600 border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Jumlah Ahli Aktif</span>
          <div className="flex items-baseline gap-1.5 mt-2.5">
            <span className="text-2xl font-black text-emerald-700 font-mono">{activeMembers}</span>
            <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150 uppercase tracking-wider">Keahlian</span>
          </div>
        </div>

        {/* Inactive Members Card */}
        <div className="bg-white p-4 rounded-xl border-l-4 border-amber-500 border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Ahli Tidak Aktif / Tangguh</span>
          <div className="flex items-baseline gap-1.5 mt-2.5">
            <span className="text-2xl font-black text-amber-600 font-mono">{inactiveMembers}</span>
            <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-150 uppercase tracking-wider">status</span>
          </div>
        </div>

        {/* Outstanding Dues Card */}
        <div className="bg-white p-4 rounded-xl border-l-4 border-rose-600 border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Anggaran Yuran Tertunggak</span>
          <div className="flex items-baseline gap-1 font-mono mt-1">
            <span className="text-rose-600 font-extrabold text-xs mr-0.5">RM</span>
            <span className="text-2xl font-black text-rose-600 leading-none">{totalOutstanding}</span>
            <span className="text-[9px] font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-150 uppercase tracking-wider ml-1.5 self-center">Tunggak</span>
          </div>
        </div>
      </div>

      {/* Two-Column Responsive Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-workspace-grid">
        {/* Left Column: Register Form or Guest Welcomer */}
        {currentRole === 'admin' ? (
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col" id="register-member-form-card">
            <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-4 bg-white">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <UserPlus className="h-4.5 w-4.5 text-slate-800" />
                Daftar Ahli Baru (B9-B13)
              </h3>
              <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-150 rounded px-2.5 py-0.5 uppercase">
                Pendaftaran
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* No. Ahli & Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* No. Ahli Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">
                    No. Ahli <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 012"
                      className="flex-grow bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-mono font-bold tracking-tight"
                      value={noAhli}
                      onChange={(e) => setNoAhli(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleApplySuggestion}
                      className="px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[10px] rounded uppercase flex items-center gap-1 transition shadow-3xs cursor-pointer select-none"
                      title="Dapatkan No. Ahli Cadangan seterusnya secara automatik"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                      <span>Cadangan</span>
                    </button>
                  </div>
                </div>

                {/* Status Select */}
                <div className="space-y-1 font-sans">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Status Keanggotaan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-bold"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Aktif">Aktif (Keahlian Penuh)</option>
                    <option value="Tidak Aktif">Tidak Aktif (Tangguh / Berpindah)</option>
                  </select>
                </div>
              </div>

              {/* Bulan & Tahun Pendaftaran (Mula Yuran) Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                {/* Bulan Mendaftar */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Bulan Pendaftaran (Mula Yuran) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-bold"
                    value={bulanDaftar}
                    onChange={(e) => setBulanDaftar(parseInt(e.target.value, 10))}
                  >
                    {monthsMalay.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Tahun Pendaftaran */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Tahun Pendaftaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-bold"
                    value={tahunDaftar}
                    onChange={(e) => setTahunDaftar(parseInt(e.target.value, 10))}
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nama Penuh */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">
                  Nama Penuh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Haji Sulaiman bin Kassim"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-bold capitalize"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                />
              </div>

              {/* No. IC */}
              <div className="space-y-1 font-sans">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  No. Kad Pengenalan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 821012-11-5431"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-mono text-[11px]"
                  value={ic}
                  onChange={(e) => setIc(e.target.value)}
                />
              </div>

              {/* Alamat */}
              <div className="space-y-1 font-sans">
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">
                  Alamat Berdaftar <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Alamat tempat tinggal lengkap di Gong Badak..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded p-3 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                />
              </div>

              {/* Ruang Tanggungan (Sumbangan/Dependents) */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Users className="h-4 w-4 text-emerald-600" />
                    Ruang Tanggungan Ahli Baru (1, 2)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddTanggungan}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-black rounded uppercase flex items-center gap-1 cursor-pointer transition-all border border-emerald-200"
                  >
                    <Plus className="h-3 w-3" /> Tambah Tanggungan
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">Masukkan nama ahli keluarga di bawah tanggungan ahli utama (Jika ada). Anda boleh menambah baris jika lebih daripada 2 tanggungan.</p>
                
                <div className="space-y-2">
                  {tanggunganList.map((t, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md relative">
                      {/* Nama */}
                      <div className="md:col-span-5 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block">Nama Tanggungan</label>
                        <input
                          type="text"
                          placeholder="Nama anak / isteri / suami..."
                          className="w-full bg-white border border-slate-300 text-slate-900 text-[11px] rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none font-semibold capitalize"
                          value={t.nama}
                          onChange={(e) => handleUpdateTanggungan(idx, 'nama', e.target.value)}
                        />
                      </div>
                      
                      {/* IC / Surat Beranak */}
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block">No. IC / Surat Beranak</label>
                        <input
                          type="text"
                          placeholder="Contoh: 151212-11-0421"
                          className="w-full bg-white border border-slate-300 text-slate-900 text-[11px] rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                          value={t.ic}
                          onChange={(e) => handleUpdateTanggungan(idx, 'ic', e.target.value)}
                        />
                      </div>
                      
                      {/* Hubungan */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block">Hubungan</label>
                        <select
                          className="w-full bg-white border border-slate-300 text-slate-900 text-[11px] rounded px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none font-bold"
                          value={t.hubungan}
                          onChange={(e) => handleUpdateTanggungan(idx, 'hubungan', e.target.value)}
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
                      
                      {/* Padam Button */}
                      <div className="md:col-span-1 flex items-end justify-center pb-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveTanggungan(idx)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-700 rounded transition cursor-pointer"
                          title="Padam tanggungan ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feedback messages */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded font-bold text-xs flex items-center gap-2 font-sans animate-pulse">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-bold text-xs flex items-center gap-2 font-sans">
                  <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs uppercase rounded transition border-b-4 border-emerald-950 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-700/10"
                >
                  <PlusCircle className="h-4 w-4" />
                  Daftar Ahli Baru
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-[#f8fafc]/95 p-6 rounded-xl border border-slate-200 text-slate-900 flex flex-col justify-center space-y-4 shadow-3xs" id="visitor-welcome-card">
            <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-150 flex items-center justify-center text-emerald-600 mb-2">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-155 rounded px-2.5 py-0.5 tracking-wider font-sans">
                Sesi Tetamu (Baca Sahaja)
              </span>
              <h3 className="text-sm font-extrabold text-slate-800 font-sans pt-1">
                Selamat Datang Ke Portal Khairat Kematian dan Kebajikan Kampung Gong Badak, Kuala Nerus, Terengganu
              </h3>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed font-sans">
              Anda kini sedang mengakses sistem menggunakan kebenaran pelawat awam. Untuk memelihara keutuhan & ketepatan pangkalan data kariah, fungsi penulisan seperti pendaftaran ahli baru, kemas kini butiran profil, dan perekodan transaksi sumbangan dikunci secara dwi-hala dan hanya boleh diubah suai oleh Admin berdaftar sahaja.
            </p>
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2.5">
              <h4 className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                Fungsi Yang Boleh Diakses Dalam Sesi Pembacaan Ini:
              </h4>
              <ul className="space-y-1.5 text-[11px] text-slate-600 font-sans list-disc pl-4">
                <li><strong className="text-slate-800">Menyaring & Semak Tunggakan Peribadi</strong>: Layari tab <strong>&quot;Carian Ahli&quot;</strong>, taip nama atau No. KP untuk melihat status dan memuat turun Sijil Perakuan.</li>
                <li><strong className="text-slate-800">Pangkalan Data Rekod</strong>: Lihat senarai keseluruhan ahli kariah di tab <strong>&quot;Pangkalan Data Ahli&quot;</strong>.</li>
                <li><strong className="text-slate-800">Jadual Pembayaran Am</strong>: Semak sejarah pembayaran lengkap kariah Gong Badak di tab <strong>&quot;Jadual Pembayaran&quot;</strong>.</li>
                <li><strong className="text-slate-800">Cetak Rumusan Am</strong>: Akses tab <strong>&quot;Rumusan Khairat&quot;</strong> untuk menjana set Laporan PDF sumbangan.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Right Column: Guide & active stats status */}
        <div className="space-y-6" id="overview-info-rail">
          {/* Guide Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pb-1 border-b border-slate-150 font-sans">
              Panduan Automasi Pintar
            </h4>

            <ul className="space-y-4 text-xs font-sans">
              <li className="flex gap-3">
                <span className="h-6 w-6 font-mono font-black text-[11px] text-slate-705 bg-slate-100 rounded-full flex items-center justify-center shrink-0 border border-slate-205">1</span>
                <div>
                  <strong className="text-slate-800 font-bold block">Daftar Ahli Baru:</strong>
                  <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">Masukkan No. Ahli dan No. IC untuk menetapkan nama baharu dalam rekod.</p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="h-6 w-6 font-mono font-black text-[11px] text-slate-705 bg-slate-100 rounded-full flex items-center justify-center shrink-0 border border-slate-205">2</span>
                <div>
                  <strong className="text-slate-800 font-bold block">Bayar Yuran RM3:</strong>
                  <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">Alokasi yuran bulanan automatik dikira berdasarkan nilai bayaran keseluruhan secepat mungkin.</p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="h-6 w-6 font-mono font-black text-[11px] text-slate-705 bg-slate-100 rounded-full flex items-center justify-center shrink-0 border border-slate-205">3</span>
                <div>
                  <strong className="text-slate-800 font-bold block">Segerak Google Sheets:</strong>
                  <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">Akses dwi-hala selamat dengan pangkalan data jauh dwi-hala aktif.</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Active Ledger Status Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-3 font-sans">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-sans">Status Lejar Aktif</span>
            <div className="space-y-1">
              <div className="flex items-baseline gap-1 font-sans">
                <span className="text-xl font-extrabold text-slate-900 font-mono">{state.ledger.length}</span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">halaman setahun</span>
              </div>
              <p className="text-slate-450 text-[10px] leading-relaxed">
                Sumbangan penuh yuran tahunan ahli khairat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple illustrative SVG component
function UsersBigIcon() {
  return (
    <svg className="w-44 h-44 text-slate-100" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}
