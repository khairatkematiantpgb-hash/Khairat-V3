/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppState, MONTH_KEYS, MONTH_LABELS } from '../types';
import { runSimpanBayaranYuranAhli, writeToAppsScript, isSameMemberId } from '../lib/database';
import { CreditCard, CheckCircle, AlertTriangle, Key, Sparkles, FileText, Info } from 'lucide-react';

interface PaymentGateProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
}

export default function PaymentGate({ state, onChangeState }: PaymentGateProps) {
  const [selectedNoAhli, setSelectedNoAhli] = useState('');
  const [noResit, setNoResit] = useState('');
  const [jumlahBayaran, setJumlahBayaran] = useState<number>(3);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsDeleting] = useState(false);

  // Auto-generate a receipt number
  const handleGenerateReceipt = () => {
    const randomNum = Math.floor(Math.random() * 90000) + 10000;
    setNoResit(`R-${randomNum}`);
    setErrorMsg('');
  };

  // Find member's details
  const selectedMember = state.members.find(m => isSameMemberId(m.noAhli, selectedNoAhli));
  const memberLedgerRows = state.ledger
    .filter(row => isSameMemberId(row.noAhli, selectedNoAhli))
    .sort((a, b) => a.tahun - b.tahun);

  // Get total existing cumulative credit for the selected member
  const totalOldCredit = memberLedgerRows.reduce((acc, r) => acc + (r.lebihanKredit || 0), 0);

  // Fee rate
  const kadarYuran = state.kadarYuranSebulan || 3;

  // Simulator Calculations
  const totalFunds = (Number(jumlahBayaran) || 0) + totalOldCredit;
  const calculatedMonths = Math.floor(totalFunds / kadarYuran);
  const remainingCredit = totalFunds % kadarYuran;

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedNoAhli) {
      setErrorMsg('Sila pilih No. Ahli terlebih dahulu!');
      return;
    }
    if (!noResit.trim()) {
      setErrorMsg('Sila masukkan atau jana No. Resit Pembayaran!');
      return;
    }
    if (jumlahBayaran <= 0) {
      setErrorMsg('Jumlah bayaran mestilah melebihi RM 0!');
      return;
    }

    setIsDeleting(true);

    if (state.useGoogleSheets && state.appsScriptUrl) {
      // Direct Sheet Sync
      const payload = {
        action: 'syncLocalToSheets', // We can sync local state or use direct execution
        // To be safe, execute locally first and push updated arrays
      };
      
      const { newState, error } = runSimpanBayaranYuranAhli(state, {
        noAhli: selectedNoAhli,
        noResit: noResit.trim(),
        jumlahBayaran: Number(jumlahBayaran)
      });

      if (error) {
        setErrorMsg(error);
        setIsDeleting(false);
        return;
      }

      // Push newState lists to server web app
      try {
        const uploadPayload = {
          action: 'syncLocalToSheets',
          members: newState.members,
          ledger: newState.ledger
        };

        const result = await writeToAppsScript(state.appsScriptUrl, uploadPayload);
        if (result.success && result.data) {
          onChangeState({
            ...state,
            members: result.data.members,
            ledger: result.data.ledger
          });
          setSuccessMsg(`Resit ${noResit} berjaya disimpan di Google Sheets! ${calculatedMonths} bulan sumbangan berjaya dialokasikan.`);
          
          // Clear payment inputs but leave member
          setNoResit('');
          setJumlahBayaran(kadarYuran);
        } else {
          setErrorMsg(`Gagal memuat naik ke Google Sheet: ${result.message}`);
        }
      } catch (err: any) {
        setErrorMsg(`Gagal mensegerakkan: ${err.message || 'Ralat sambungan'}`);
      }
    } else {
      // Offline local storage
      const { newState, error } = runSimpanBayaranYuranAhli(state, {
        noAhli: selectedNoAhli,
        noResit: noResit.trim(),
        jumlahBayaran: Number(jumlahBayaran)
      });

      if (error) {
        setErrorMsg(error);
      } else {
        onChangeState(newState);
        setSuccessMsg(`Resit ${noResit} berjaya disimpan! Sebanyak ${calculatedMonths} bulan sumbangan khairat telah dikreditkan untuk ahli ini secara automatik.`);
        
        // Clear outputs
        setNoResit('');
        setJumlahBayaran(kadarYuran);
      }
    }
    setIsDeleting(false);
  };

  // Build month-by-month paid status matrix for the current calendar simulator
  // Find which months are ALREADY paid vs will be covers by current payment
  const getSimulatedMonthStatus = () => {
    const statuses = Array(12).fill('unpaid'); // 'unpaid', 'already-paid', 'newly-covered'
    if (!selectedMember) return statuses;

    let totalSimMonths = calculatedMonths;

    // 1. Gather all existing paid slots
    let monthIdx = 0;
    memberLedgerRows.forEach(row => {
      MONTH_KEYS.forEach((mKey, idx) => {
        if (row[mKey]) {
          statuses[idx] = 'already-paid';
        }
      });
    });

    // 2. Overlay newly covered months chronologically
    MONTH_KEYS.forEach((mKey, idx) => {
      if (statuses[idx] === 'unpaid' && totalSimMonths > 0) {
        statuses[idx] = 'newly-covered';
        totalSimMonths--;
      }
    });

    return statuses;
  };

  const simulatedStatuses = getSimulatedMonthStatus();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 font-sans" id="payment-gate-component">
      
      {/* Left Column: Input submission form */}
      <form onSubmit={handleSubmitPayment} className="lg:col-span-3 bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col space-y-4">
        
        {/* Banner header bar */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-2">
          <div>
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">Gerbang Kemasukan Yuran (B4-B7)</h3>
            <p className="text-[10px] text-slate-400">Pendaftaran resit bayaran sumbangan khairat bulanan ahli jawatankuasa.</p>
          </div>
          <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-150 rounded px-2.5 py-0.5 uppercase tracking-wide">
            Sumit Bayaran
          </span>
        </div>

        {/* Member ID Input Selector (Manual Entry instead of dropdown) */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">
            No. Ahli / ID Pengguna (B4) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Masukkan No. Ahli secara manual (contoh: 001, 002...)"
              className="w-full bg-slate-50 border border-slate-350 text-slate-900 text-xs rounded-lg p-2.5 outline-none font-bold focus:bg-white focus:ring-1 focus:ring-emerald-500 font-mono"
              value={selectedNoAhli}
              onChange={(e) => {
                setSelectedNoAhli(e.target.value.trim());
                setSuccessMsg('');
                setErrorMsg('');
              }}
            />
          </div>
          
          {/* Real-time matched member indicator */}
          {selectedNoAhli && (
            <div className="p-2 border rounded-lg text-xs mt-1 transition-all bg-slate-50/50">
              {selectedMember ? (
                <div className="flex items-center justify-between text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded text-[9px] font-mono">
                      AHLI DILOCATE
                    </span>
                    <span className="font-extrabold">{selectedMember.nama}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    selectedMember.status === 'Aktif'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-150'
                      : 'bg-rose-50 text-rose-800 border border-rose-100'
                  }`}>
                    {selectedMember.status}
                  </span>
                </div>
              ) : (
                <div className="text-rose-600 font-semibold flex items-center gap-1.5 text-[10px]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>No. Ahli "{selectedNoAhli}" tidak didaftarkan dalam rekod kariah!</span>
                </div>
              )}
            </div>
          )}

          <span className="text-xxs text-slate-400 block mt-1 leading-relaxed">
            Sila taip No. Ahli kariah secara manual. Sistem akan memaparkan status nama bagi menjamin kesahihan rekod.
          </span>
        </div>

        {/* Receipt Code & Amount Payout Input grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* No. Resit Input with generation trigger */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">
              No. Resit Pembayaran (B6) <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Contoh: R-101"
                className="flex-grow bg-slate-50 border border-slate-350 text-slate-905 text-xs rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-mono font-bold uppercase"
                value={noResit}
                onChange={(e) => setNoResit(e.target.value)}
              />
              <button
                type="button"
                onClick={handleGenerateReceipt}
                className="px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg tracking-wide uppercase transition shadow-3xs cursor-pointer select-none"
              >
                Jana No.
              </button>
            </div>
          </div>

          {/* Jumlah Bayaran (RM) */}
          <div className="space-y-1.5 font-sans">
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Jumlah Bayaran (B7 - RM) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs pointer-events-none">RM</span>
              <input
                type="number"
                min={kadarYuran}
                step={kadarYuran}
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-355 text-slate-905 text-xs rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                value={jumlahBayaran}
                onChange={(e) => setJumlahBayaran(Number(e.target.value) || kadarYuran)}
              />
            </div>
          </div>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-150 text-rose-800 rounded-lg font-bold text-xs flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-lg font-bold text-xs flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.8 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wide rounded-lg transition border-b-4 border-emerald-950 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-700/10"
          >
            <CreditCard className="h-4 w-4" />
            <span>{isSubmitting ? 'MEREKOD RESIT...' : 'Simpan Bayaran Yuran Ahli'}</span>
          </button>
        </div>
      </form>

      {/* Right Column: Interactive payment allocation visual simulator */}
      <div className="lg:col-span-2 space-y-4" id="payout-simulator">
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-150">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-sans">
              Simulator Alokasi Yuran
            </h4>
            <span className="bg-indigo-50 border border-indigo-150 text-indigo-850 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase">
              RM {kadarYuran} / Sebulan
            </span>
          </div>

          <p className="text-slate-450 text-[11px] leading-relaxed font-sans mt-1">
            Sistem secara automatik menstrukturkan pelunasan bulan daripada yuran tertua yang tertunggak.
          </p>

          {/* Calculations Summary block */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-2 font-mono">
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Bayaran Semasa:</span>
              <span className="font-bold text-slate-900">RM {Number(jumlahBayaran) || 0}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Baki Kredit Lama:</span>
              <span className="font-bold text-slate-900">+ RM {totalOldCredit}</span>
            </div>
            <div className="flex justify-between border-t border-slate-150 pt-1.5 text-[12px] font-black">
              <span className="text-slate-800">Jumlah Dana:</span>
              <span className="text-emerald-700">RM {totalFunds}</span>
            </div>
          </div>

          {/* Contribution Coverage indicators */}
          <div className="space-y-2.5" id="monthly-coverage-mapping">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Liputan Sumbangan:</span>
              <span className="bg-emerald-100 text-emerald-800 font-mono text-[9px] font-black px-2 py-0.5 rounded border border-emerald-150 uppercase tracking-wider">
                +{calculatedMonths} Bulan
              </span>
            </div>

            {/* Simulated monthly covered check list grid B1 to B12 */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {MONTH_LABELS.map((mLabel, mIdx) => {
                const status = simulatedStatuses[mIdx];
                return (
                  <div
                    key={mLabel}
                    className={`p-2 rounded text-center border font-mono text-[9px] font-black uppercase transition-all ${
                      status === 'already-paid'
                        ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                        : status === 'newly-covered'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-3xs scale-102 font-extrabold animate-pulse'
                        : 'bg-white text-slate-350 border-slate-200 border-dashed'
                    }`}
                    title={
                      status === 'already-paid'
                        ? `${mLabel}: Sudah Berbayar (Baki lama)`
                        : status === 'newly-covered'
                        ? `${mLabel}: Dilunaskan oleh Bayaran ini`
                        : `${mLabel}: Tiada bayaran lagi`
                    }
                  >
                    B{mIdx + 1}
                    <span className="block font-sans text-[8px] mt-0.5 font-normal tracking-wide">{mLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* Excess credit indicator */}
            <div className="flex justify-between items-center text-xs font-mono border-t border-slate-100 pt-3">
              <span className="font-bold text-slate-600 font-sans">Lebihan Baki (Silisih Kredit):</span>
              <span className="font-black text-indigo-705">RM {remainingCredit}</span>
            </div>
          </div>

          {/* Information box at the bottom */}
          <div className="bg-indigo-50/50 border border-indigo-100 text-indigo-950 p-3 rounded-lg text-[10px] leading-relaxed flex gap-2 font-medium font-sans">
            <Info className="h-4.5 w-4.5 text-indigo-700 shrink-0" />
            <span>Dana yang dihantar melunaskan bulan tertunggak sekiranya ada, baki diletakkan sebagai kredit untuk dipautkan ke tahun berikutnya secara automatik.</span>
          </div>

        </div>
      </div>
    </div>
  );
}
