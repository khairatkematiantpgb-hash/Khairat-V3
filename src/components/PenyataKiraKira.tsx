import React, { useState, useMemo } from 'react';
import { AppState, KewanganTransaction } from '../types';
import { PlusCircle, Trash2, Printer, Search, Calendar, FileSpreadsheet, ArrowDownCircle, ArrowUpCircle, Info, Pencil, X, Loader2 } from 'lucide-react';
import { writeToAppsScript } from '../lib/database';
import { createPortal } from 'react-dom';

interface PenyataKiraKiraProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
  currentRole: 'admin' | 'user' | null;
}

export const ACCOUNTS_LIST = [
  'Pelaburan Bank Rakyat (33007456390002/2024/TM/ 10.11.2026)',
  'Pelaburan Bank Rakyat (33007456390003/2024/TM/ 28.04.2026)',
  'Pelaburan Bank Rakyat (33007456390004/2024/TM/ 28.01.2026)',
  'Bank',
  'Tunai'
];

// Display names for columns to save space but keep it clear
export const SHORT_NAMES: { [key: string]: string } = {
  'Pelaburan Bank Rakyat (33007456390002/2024/TM/ 10.11.2026)': 'Pelaburan Rakyat 1',
  'Pelaburan Bank Rakyat (33007456390003/2024/TM/ 28.04.2026)': 'Pelaburan Rakyat 2',
  'Pelaburan Bank Rakyat (33007456390004/2024/TM/ 28.01.2026)': 'Pelaburan Rakyat 3',
  'Bank': 'Bank',
  'Tunai': 'Tunai'
};

export default function PenyataKiraKira({ state, onChangeState, currentRole }: PenyataKiraKiraProps) {
  const transactions = state.kewangan || [];
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  // Form states
  const [tarikh, setTarikh] = useState('2026-06-20');
  const [kenyataan, setKenyataan] = useState('');
  const [kategoriAkaun, setKategoriAkaun] = useState(ACCOUNTS_LIST[4]); // Defaults to Tunai
  const [jenisTransaksi, setJenisTransaksi] = useState<'masuk' | 'keluar'>('masuk');
  const [amaunStr, setAmaunStr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<KewanganTransaction | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Search/Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState('2026');

  // PRINT PREVIEW OVERLAY STATE
  const [isPrinting, setIsPrinting] = useState(false);

  // Parse chronological order and compute running balances
  const processedData = useMemo(() => {
    // 1. Sort transactions by date ascending
    const sorted = [...transactions].sort((a, b) => {
      const dateDiff = new Date(a.tarikh).getTime() - new Date(b.tarikh).getTime();
      if (dateDiff !== 0) return dateDiff;
      // If same date, keep alphabetical order of id or treat "Baki pada" first
      const aIsBaki = a.kenyataan.toLowerCase().startsWith('baki');
      const bIsBaki = b.kenyataan.toLowerCase().startsWith('baki');
      if (aIsBaki && !bIsBaki) return -1;
      if (!aIsBaki && bIsBaki) return 1;
      return a.id.localeCompare(b.id);
    });

    // 2. Track running balances sequentially
    const runningBalances: { [key: string]: number } = {};
    ACCOUNTS_LIST.forEach(acc => {
      runningBalances[acc] = 0;
    });

    const txsWithBalances = sorted.map(tx => {
      const isBakiAwal = tx.kenyataan.toLowerCase().startsWith('baki pada');
      
      if (tx.jenisTransaksi === 'masuk') {
        runningBalances[tx.kategoriAkaun] += tx.amaun;
      } else if (tx.jenisTransaksi === 'keluar') {
        runningBalances[tx.kategoriAkaun] -= tx.amaun;
      }

      return {
        ...tx,
        isBakiAwal,
        balancesSnapshot: { ...runningBalances }
      };
    });

    // 3. Group by (tarikh, kenyataan)
    const groupedMap: { [key: string]: typeof txsWithBalances } = {};
    txsWithBalances.forEach(tx => {
      const groupKey = `${tx.tarikh}|||${tx.kenyataan}`;
      if (!groupedMap[groupKey]) {
        groupedMap[groupKey] = [];
      }
      groupedMap[groupKey].push(tx);
    });

    // 4. Construct final display rows
    const displayRows = Object.keys(groupedMap).map(key => {
      const groupTxs = groupedMap[key];
      const firstTx = groupTxs[0];
      
      // Compute grouped entries
      const accountsData: {
        [kategori: string]: {
          masuk?: number;
          keluar?: number;
          baki: number;
          hasTx: boolean;
          isBakiAwal: boolean;
        }
      } = {};

      ACCOUNTS_LIST.forEach(acc => {
        accountsData[acc] = {
          baki: 0,
          hasTx: false,
          isBakiAwal: false
        };
      });

      // Sum up same-category items in same row if any
      groupTxs.forEach(tx => {
        const item = accountsData[tx.kategoriAkaun];
        item.hasTx = true;
        item.isBakiAwal = tx.isBakiAwal;
        
        if (tx.jenisTransaksi === 'masuk') {
          item.masuk = (item.masuk || 0) + tx.amaun;
        } else if (tx.jenisTransaksi === 'keluar') {
          item.keluar = (item.keluar || 0) + tx.amaun;
        }
        // Take the balance at this transaction
        item.baki = tx.balancesSnapshot[tx.kategoriAkaun];
      });

      // Also carry forward the current balance for non-transaction accounts in this group
      // so we can reference it, though we only display it on screen when hasTx is true.
      // The last transaction in this group has the absolute latest running balance of ALL accounts.
      const lastTxInGroup = groupTxs[groupTxs.length - 1];
      ACCOUNTS_LIST.forEach(acc => {
        if (!accountsData[acc].hasTx) {
          accountsData[acc].baki = lastTxInGroup.balancesSnapshot[acc];
        }
      });

      return {
        tarikh: firstTx.tarikh,
        kenyataan: firstTx.kenyataan,
        accountsData,
        originalTxs: groupTxs // keep to allow deletion
      };
    });

    // Sort the display rows chronologically
    displayRows.sort((a, b) => new Date(a.tarikh).getTime() - new Date(b.tarikh).getTime());

    // Compute final cumulative footers
    const finalBalances: { [key: string]: number } = {};
    ACCOUNTS_LIST.forEach(acc => {
      finalBalances[acc] = runningBalances[acc];
    });

    return {
      displayRows,
      finalBalances,
      allSortedTxs: txsWithBalances
    };
  }, [transactions]);

  // Apply Search and Year Filters
  const filteredDisplayRows = useMemo(() => {
    return processedData.displayRows.filter(row => {
      // Filter by Search Keyword
      const matchesSearch = row.kenyataan.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            row.tarikh.includes(searchTerm);
      
      // Filter by Year
      let matchesYear = true;
      if (selectedYearFilter && selectedYearFilter !== 'semua') {
        const rowYear = new Date(row.tarikh).getFullYear().toString();
        matchesYear = rowYear === selectedYearFilter;
      }

      return matchesSearch && matchesYear;
    });
  }, [processedData.displayRows, searchTerm, selectedYearFilter]);

  // Unique years list for filter dropdown
  const yearsList = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach(t => {
      try {
        const y = new Date(t.tarikh).getFullYear();
        if (!isNaN(y)) {
          years.add(y.toString());
        }
      } catch (e) {}
    });
    // Ensure 2026 is always there
    years.add('2026');
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Handle entering edit mode
  const handleStartEdit = (tx: KewanganTransaction) => {
    if (currentRole !== 'admin') {
      alert('Hanya pentadbir (Admin) yang dibenarkan untuk memotong atau mengedit rekod transaksi.');
      return;
    }
    setEditingTransactionId(tx.id);
    setTarikh(tx.tarikh);
    setKenyataan(tx.kenyataan);
    setKategoriAkaun(tx.kategoriAkaun);
    setJenisTransaksi(tx.jenisTransaksi);
    setAmaunStr(tx.amaun.toString());
    setFormError(null);
    setFormSuccess(null);
  };

  // Cancel editing mode
  const handleCancelEdit = () => {
    setEditingTransactionId(null);
    setKenyataan('');
    setAmaunStr('');
    setFormError(null);
    setFormSuccess(null);
  };

  // Handle transaction creation & update
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (currentRole !== 'admin') {
      setFormError('Ralat: Akses Pelawat disekat daripada menambah rekod kewangan.');
      return;
    }

    if (!tarikh) {
      setFormError('Sila pilih tarikh transaksi.');
      return;
    }

    if (!kenyataan.trim()) {
      setFormError('Sila masukkan kenyataan bagi transaksi ini.');
      return;
    }

    const value = parseFloat(amaunStr);
    if (isNaN(value) || value <= 0) {
      setFormError('Sila masukkan amaun/nilai wang yang sah (RM > 0).');
      return;
    }

    const tYear = new Date(tarikh).getFullYear();
    const cleanKenyataan = kenyataan.trim();

    // Check custom instruction rules: "Kenyataan pertama untuk setiap tahun mestilah bermula dengan 'Baki pada 1 Jan [Tahun Tersebut]'"
    // Compare with transactions excluding the one being edited
    const yearTxs = transactions.filter(t => new Date(t.tarikh).getFullYear() === tYear && t.id !== editingTransactionId);
    if (yearTxs.length === 0) {
      const lowerKenyataan = cleanKenyataan.toLowerCase();
      if (!lowerKenyataan.startsWith('baki pada 1 jan')) {
        setFormError(`Sila ambil perhatian: Transaksi pertama untuk tahun ${tYear} mestilah 'Baki pada 1 Jan ${tYear}' bagi menetapkan baki pembukaan akaun.`);
        return;
      }
    }

    if (editingTransactionId) {
      // Update Mode
      const updatedKewangan = transactions.map(t => {
        if (t.id === editingTransactionId) {
          return {
            ...t,
            tarikh,
            kenyataan: cleanKenyataan,
            kategoriAkaun,
            jenisTransaksi,
            amaun: value
          };
        }
        return t;
      });

      if (state.useGoogleSheets && state.appsScriptUrl) {
        setIsSyncing(true);
        try {
          const uploadPayload = {
            action: 'syncLocalToSheets',
            members: state.members,
            ledger: state.ledger,
            kewangan: updatedKewangan
          };
          const result = await writeToAppsScript(state.appsScriptUrl, uploadPayload);
          if (result.success && result.data) {
            onChangeState({
              ...state,
              members: result.data.members || state.members,
              ledger: result.data.ledger || state.ledger,
              kewangan: result.data.kewangan || updatedKewangan
            });
            setEditingTransactionId(null);
            setKenyataan('');
            setAmaunStr('');
            setFormSuccess('Sukses! Rekod transaksi penyata kewangan telah berjaya dikemaskini dan disegerakkan ke Google Sheets.');
          } else {
            setFormError(`Gagal dikemaskini di Google Sheet: ${result.message}`);
          }
        } catch (err: any) {
          setFormError(`Gagal mensegerakkan: ${err.message || 'Ralat sambungan'}`);
        } finally {
          setIsSyncing(false);
        }
      } else {
        onChangeState({
          ...state,
          kewangan: updatedKewangan
        });
        setEditingTransactionId(null);
        setKenyataan('');
        setAmaunStr('');
        setFormSuccess('Sukses! Rekod transaksi penyata kewangan telah berjaya dikemaskini.');
      }
    } else {
      // Add Mode
      const newTx: KewanganTransaction = {
        id: `k-user-${Date.now()}-${Math.floor(Math.random() * 1005)}`,
        tarikh,
        kenyataan: cleanKenyataan,
        kategoriAkaun,
        jenisTransaksi,
        amaun: value
      };

      const updatedKewangan = [...transactions, newTx];

      if (state.useGoogleSheets && state.appsScriptUrl) {
        setIsSyncing(true);
        try {
          const uploadPayload = {
            action: 'syncLocalToSheets',
            members: state.members,
            ledger: state.ledger,
            kewangan: updatedKewangan
          };
          const result = await writeToAppsScript(state.appsScriptUrl, uploadPayload);
          if (result.success && result.data) {
            onChangeState({
              ...state,
              members: result.data.members || state.members,
              ledger: result.data.ledger || state.ledger,
              kewangan: result.data.kewangan || updatedKewangan
            });
            setKenyataan('');
            setAmaunStr('');
            setFormSuccess('Sukses! Rekod transaksi penyata kewangan baharu telah berjaya ditambah dan disegerakkan ke Google Sheets.');
          } else {
            setFormError(`Gagal dimuat naik ke Google Sheet: ${result.message}`);
          }
        } catch (err: any) {
          setFormError(`Gagal mensegerakkan: ${err.message || 'Ralat sambungan'}`);
        } finally {
          setIsSyncing(false);
        }
      } else {
        onChangeState({
          ...state,
          kewangan: updatedKewangan
        });
        setKenyataan('');
        setAmaunStr('');
        setFormSuccess('Sukses! Rekod transaksi penyata kewangan baharu telah berjaya ditambah.');
      }
    }
  };

  // Handle single transaction deletion (called after custom modal confirmation)
  const handleDeleteTransaction = async (id: string) => {
    if (currentRole !== 'admin') {
      setFormError('Hanya pentadbir (Admin) yang dibenarkan untuk memadam rekod transaksi.');
      return;
    }
    const updated = transactions.filter(t => t.id !== id);

    if (state.useGoogleSheets && state.appsScriptUrl) {
      setIsSyncing(true);
      try {
        const uploadPayload = {
          action: 'syncLocalToSheets',
          members: state.members,
          ledger: state.ledger,
          kewangan: updated
        };
        const result = await writeToAppsScript(state.appsScriptUrl, uploadPayload);
        if (result.success && result.data) {
          onChangeState({
            ...state,
            members: result.data.members || state.members,
            ledger: result.data.ledger || state.ledger,
            kewangan: result.data.kewangan || updated
          });
          setFormSuccess('Sukses! Rekod transaksi telah dipadam dan disegerakkan dari Google Sheets.');
          setDeletingTransaction(null);
        } else {
          setFormError(`Gagal memadam di Google Sheet: ${result.message}`);
        }
      } catch (err: any) {
        setFormError(`Gagal mensegerakkan: ${err.message || 'Ralat sambungan'}`);
      } finally {
        setIsSyncing(false);
      }
    } else {
      onChangeState({
        ...state,
        kewangan: updated
      });
      setFormSuccess('Rekod transaksi dipilih telah dipadam.');
      setDeletingTransaction(null);
    }
  };

  // Format ID for Malaysian localization Currency
  const formatCur = (num: number | undefined) => {
    if (num === undefined) return '';
    return num.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Human Readable Date
  const parseDateMalay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 font-sans relative">
      
      {/* Tab Header Panel */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-700 rounded-lg shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight uppercase">
              Penyata Kira-Kira Kewangan
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Sistem pemfailan buku lejar penyata kewangan (Aliran Masuk, Keluar, dan Baki Automatik) bersepadu Kampung Gong Badak.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsPrinting(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs tracking-wide uppercase px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all"
            title="Sediakan paparan cetak PDF laporan"
          >
            <Printer className="h-4 w-4" />
            <span>Paparan Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Top Section Grid: Form + Ringkasan Baki */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        
        {/* LEFT CARD: Input Form */}
        <div className={`lg:col-span-4 border p-5 rounded-2xl shadow-xs self-start transition-colors duration-300 ${
          editingTransactionId ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            {editingTransactionId ? (
              <Pencil className="h-4.5 w-4.5 text-amber-600 shrink-0" />
            ) : (
              <PlusCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            )}
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {editingTransactionId ? 'Kemaskini Transaksi' : 'Daftar Transaksi Baharu'}
            </h3>
          </div>

          <form onSubmit={handleAddTransaction} className="space-y-4">
            {/* Tarikh Input */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                Tarikh <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={tarikh}
                  onChange={(e) => setTarikh(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Kenyanyan Input */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                Kenyataan Perkara <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={kenyataan}
                onChange={(e) => setKenyataan(e.target.value)}
                placeholder="cth: Kutipan Yuran Ahli, Dividen, Saguhati, Kebajikan..."
                rows={3}
                className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-medium text-slate-850"
                required
              />
              <div className="mt-1 bg-amber-50/70 border border-amber-200/50 p-2 rounded-lg flex items-start gap-1.5">
                <Info className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[9px] text-amber-800 leading-normal">
                  <strong>Syarat khas:</strong> Kenyataan pertama setiap tahun baru mesti bermula dengan perkataan <span className="font-mono font-bold bg-amber-100 px-1 rounded">Baki pada 1 Jan</span> untuk menetapkan baki baki pembukaan akaun.
                </p>
              </div>
            </div>

            {/* Kategori Akaun Dropdown */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                Saluran Kategori Akaun <span className="text-rose-500">*</span>
              </label>
              <select
                value={kategoriAkaun}
                onChange={(e) => setKategoriAkaun(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {ACCOUNTS_LIST.map((acc, idx) => (
                  <option key={idx} value={acc}>
                    {idx + 1}. {acc}
                  </option>
                ))}
              </select>
            </div>

            {/* Jenis Transaksi Radio Button */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">
                Jenis Transaksi <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                  jenisTransaksi === 'masuk'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}>
                  <input
                    type="radio"
                    name="jenisTransaksi"
                    value="masuk"
                    checked={jenisTransaksi === 'masuk'}
                    onChange={() => setJenisTransaksi('masuk')}
                    className="sr-only"
                  />
                  <ArrowDownCircle className="h-3.5 w-3.5" />
                  <span>Masuk</span>
                </label>

                <label className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                  jenisTransaksi === 'keluar'
                    ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}>
                  <input
                    type="radio"
                    name="jenisTransaksi"
                    value="keluar"
                    checked={jenisTransaksi === 'keluar'}
                    onChange={() => setJenisTransaksi('keluar')}
                    className="sr-only"
                  />
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  <span>Keluar</span>
                </label>
              </div>
            </div>

            {/* Amaun/Nilai Input */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                Amaun Pindahan (RM) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 py-0.5 text-xs font-bold text-slate-400">RM</span>
                <input
                  type="number"
                  step="0.01"
                  value={amaunStr}
                  onChange={(e) => setAmaunStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-bold"
                  required
                />
              </div>
            </div>

            {/* Alerts */}
            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-[11px] leading-relaxed font-semibold">
                ⚠️ {formError}
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-2.5 rounded-xl text-[11px] leading-relaxed font-semibold">
                ✅ {formSuccess}
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={currentRole !== 'admin' || isSyncing}
                className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer select-none flex items-center justify-center gap-2 ${
                  currentRole === 'admin'
                    ? isSyncing
                      ? 'bg-slate-400 text-white cursor-not-allowed'
                      : editingTransactionId
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs active:scale-[0.98]'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs active:scale-[0.98]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSyncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
                <span>
                  {isSyncing ? 'Sedang Menyimpan...' : currentRole === 'admin' ? (editingTransactionId ? 'Simpan Pindaan' : 'Simpan Transaksi') : 'Sesi Pelawat (Kunci)'}
                </span>
              </button>

              {editingTransactionId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer select-none"
                >
                  Batal Pindaan
                </button>
              )}
            </div>
          </form>
        </div>

        {/* RIGHT CARD: Quick Stats Summary Cards + General Instructions */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-slate-50/60 border border-slate-150 p-6 rounded-2xl">
          <div>
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="p-1 px-1.5 bg-emerald-100 text-emerald-800 rounded-md">✓</span>
              Ringkasan Baki Semasa (RM) & Aliran Tunai
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl mb-4">
              Nilai di bawah merupakan baki bersih terkini yang terkumpul bagi setiap akaun aktif khairat Kampung Gong Badak. Formulasi dijana secara berterusan berdasarkan jurnal lejar.
            </p>
          </div>

          {/* Large, beautiful Quick Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 my-2">
            {ACCOUNTS_LIST.map((acc, keyIdx) => {
              const bal = processedData.finalBalances[acc];
              return (
                <div key={keyIdx} className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-3xs hover:border-emerald-300 transition-all">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block truncate" title={acc}>
                    {SHORT_NAMES[acc]}
                  </span>
                  <strong className={`block text-xs md:text-sm font-mono font-black mt-2 ${bal < 0 ? 'text-rose-600' : 'text-emerald-850'}`}>
                    RM {formatCur(bal)}
                  </strong>
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3 text-xs text-emerald-850">
            <Info className="h-4.5 w-4.5 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <strong className="block font-bold">Gerbang Buku Lejar Aliran Tunai & Pelaburan:</strong>
              <p className="text-[11px] leading-relaxed text-emerald-700 mt-0.5">
                Formulari lejar ini mengira aliran bersih (Masuk, Keluar, Baki) bagi 5 saluran akaun secara automatik mengikut aturan kronologi tarikh. Klik butang <strong className="bg-[#1e293b]/5 px-1 rounded inline-flex items-center gap-0.5 text-slate-800 font-semibold">Pencil</strong> pada senarai di bawah sekiranya ingin meminda kenyataan atau amaun sekiranya berlaku kesilapan merekod secara terus.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Section: Wider Full-Width Ledger Table */}
      <div className="border border-slate-200/80 rounded-2xl p-6 bg-white shadow-xs flex flex-col space-y-4">
        
        {/* Ribbon Header of table */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Katalog Aliran Tunai & Buku Lejar Sejarah</h3>
            <p className="text-xs text-slate-400 mt-0.5">Sejarah kronologi kemasukan, pengeluaran & baki harian bagi lima akaun pertubuhan.</p>
          </div>
          
          {/* Filtering Ribbon */}
          <div className="flex flex-col sm:flex-row gap-3 items-center shrink-0">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari dalam kenyataan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Year Filter */}
            <div className="flex items-center gap-2 shrink-0 justify-end w-full sm:w-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tapis Tahun:</span>
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 p-1.5 px-3 rounded-md focus:outline-none shadow-3xs"
              >
                <option value="semua">Semua Transaksi</option>
                {yearsList.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Ledger Table Wrapper */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs max-h-[640px]">
          <table className="w-full text-left border-collapse table-fixed min-w-[1500px]">
            
            {/* Table Group Titles Column Headers with slightly larger typography */}
            <thead className="bg-[#1e293b] text-white font-sans text-xs font-bold uppercase sticky top-0 z-10 border-b border-slate-900 shadow-xs">
              <tr>
                <th className="px-2.5 py-4.5 text-center border-r border-slate-700 w-[55px]" rowSpan={2}>BIL.</th>
                <th className="px-2.5 py-4.5 text-center border-r border-slate-700 w-[95px]" rowSpan={2}>TARIKH</th>
                <th className="px-4 py-4.5 border-r border-slate-700 w-[220px]" rowSpan={2}>KENYATAAN</th>
                
                {/* Account Header Groupings - w-[245px] is extremely roomier and prevents wrapping */}
                {ACCOUNTS_LIST.map((acc, keyIdx) => (
                  <th 
                    key={keyIdx} 
                    className="px-2 py-2.5 text-center border-r border-slate-700 w-[245px]" 
                    colSpan={3}
                  >
                    <div className="truncate text-[11px] tracking-wide font-black" title={acc}>
                      {SHORT_NAMES[acc]}
                    </div>
                  </th>
                ))}
                
                {/* Action Column for delete */}
                {currentRole === 'admin' && (
                  <th className="px-3 py-4.5 text-center w-[65px] bg-[#0f172a]" rowSpan={2}>SUNTING</th>
                )}
              </tr>
              <tr className="bg-[#334155] text-slate-100 text-[10px] font-bold">
                {/* Sub Header row: Masuk | Keluar | Baki */}
                {ACCOUNTS_LIST.map((_, idx) => (
                  <React.Fragment key={idx}>
                    <th className="px-2 py-2 text-right border-r border-slate-600 tracking-tight">Masuk</th>
                    <th className="px-2 py-2 text-right border-r border-slate-600 tracking-tight text-rose-200">Keluar</th>
                    <th className="px-2 py-2 text-right border-r border-slate-500 tracking-tight font-black bg-[#475569]">Baki</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {/* Table Body rows with larger font size for superb reading and clarity */}
            <tbody className="divide-y divide-slate-100 text-[12px] font-sans font-medium text-slate-700 bg-white">
              {filteredDisplayRows.length === 0 ? (
                <tr>
                  <td colSpan={currentRole === 'admin' ? 19 : 18} className="px-10 py-20 text-center text-slate-400 italic text-sm">
                    ⚠️ Tiada rekod transaksi dijumpai mengikut tapisan anda.
                  </td>
                </tr>
              ) : (
                filteredDisplayRows.map((row, rowIdx) => {
                  const parsedDate = parseDateMalay(row.tarikh);
                  
                  return (
                    <tr 
                      key={rowIdx} 
                      className={`hover:bg-slate-50/70 transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      <td className="px-2.5 py-3 text-center font-mono text-slate-400 border-r border-slate-100">{rowIdx + 1}</td>
                      <td className="px-2 py-3 text-center font-mono font-bold text-slate-600 border-r border-slate-100">{parsedDate}</td>
                      <td className="px-4 py-3 text-left font-sans font-extrabold text-slate-800 leading-normal border-r border-slate-100">
                        {row.kenyataan}
                      </td>
                      
                      {/* 5 Accounts Columns Render */}
                      {ACCOUNTS_LIST.map((acc, keyIdx) => {
                        const data = row.accountsData[acc];
                        
                        // Custom rule for opening balance: don't show under Masuk/Keluar columns, only show directly in Baki!
                        const showInBakiOnly = data.isBakiAwal;
                        
                        return (
                          <React.Fragment key={keyIdx}>
                            {/* MASUK column */}
                            <td className="px-2 py-3 text-right border-r border-slate-100 font-mono font-bold text-emerald-650">
                              {!showInBakiOnly && data.masuk ? formatCur(data.masuk) : ''}
                            </td>
                            {/* KELUAR column */}
                            <td className="px-2 py-3 text-right border-r border-slate-100 font-mono font-bold text-rose-550 row-cell-keluar">
                              {!showInBakiOnly && data.keluar ? formatCur(data.keluar) : ''}
                            </td>
                            {/* BAKI column */}
                            <td className="px-2 py-3 text-right border-r border-slate-200 font-mono font-black text-slate-900 bg-slate-50/50 shadow-inner">
                              {data.hasTx ? formatCur(data.baki) : ''}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      {/* Action column */}
                      {currentRole === 'admin' && (
                        <td className="px-2.5 py-2 text-center align-middle bg-slate-50 border-l border-slate-200">
                          <div className="flex flex-col gap-1.5 items-center justify-center">
                            {row.originalTxs.map((otx) => (
                              <div 
                                key={otx.id} 
                                className={`flex items-center gap-1.5 border rounded-lg p-1 bg-white shadow-3xs hover:shadow-2xs transition-all ${
                                  editingTransactionId === otx.id ? 'border-amber-400 ring-2 ring-amber-250 bg-amber-50/50' : 'border-slate-150'
                                }`}
                              >
                                {/* Edit button */}
                                <button
                                  onClick={() => handleStartEdit(otx)}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    editingTransactionId === otx.id 
                                      ? 'bg-amber-100 text-amber-800' 
                                      : 'hover:bg-amber-50 text-amber-650'
                                  }`}
                                  title={`Kemaskini pergerakan ${SHORT_NAMES[otx.kategoriAkaun]} - RM ${formatCur(otx.amaun)}`}
                                >
                                  <Pencil className="h-3.2 w-3.2" />
                                </button>
                                
                                {/* Delete button */}
                                <button
                                  onClick={() => setDeletingTransaction(otx)}
                                  className="p-1 hover:bg-rose-50 text-rose-500 rounded transition-colors cursor-pointer"
                                  title={`Padam pergerakan ${SHORT_NAMES[otx.kategoriAkaun]} - RM ${formatCur(otx.amaun)}`}
                                >
                                  <Trash2 className="h-3.2 w-3.2" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Cumulative balance Footer */}
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs text-slate-850 sticky bottom-0 z-5">
              <tr className="bg-slate-200 text-[#0f172a] uppercase font-black">
                <td className="px-3 py-4 text-center border-r border-slate-300" colSpan={3}>BAKI TERKUMPUL SECARA AUTOMATIK (RM)</td>
                
                {ACCOUNTS_LIST.map((acc, keyIdx) => {
                  const currentBal = processedData.finalBalances[acc];
                  return (
                    <React.Fragment key={keyIdx}>
                      <td className="px-2 py-4 text-right bg-slate-150 border-r border-slate-250 italic text-[9.5px] text-slate-500">Kutipan</td>
                      <td className="px-2 py-4 text-right bg-slate-150 border-r border-slate-250 italic text-[9.5px] text-slate-500">Belanja</td>
                      <td className="px-2 py-4 text-right font-mono font-black text-sm text-emerald-955 bg-emerald-100/90 border-r border-slate-300 shadow-inner">
                        {formatCur(currentBal)}
                      </td>
                    </React.Fragment>
                  );
                })}
                
                {currentRole === 'admin' && (
                  <td className="bg-slate-300"></td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* -------------------- PRINT VIEW LAPORAN PREVIEW OVERLAY -------------------- */}
      {isPrinting && createPortal(
        <div id="print-area-outlet" className="fixed inset-0 bg-white z-[99999] p-10 overflow-y-auto text-slate-900 font-sans print:relative print:inset-auto print:p-0 print:m-0 print:overflow-visible print:bg-white print:block print:h-auto print:w-full">
          
          {/* Print controls Ribbon */}
          <div className="mb-6 bg-amber-50 border border-amber-200 p-5 rounded-xl print:hidden flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-amber-500 text-amber-950 font-black rounded-lg shrink-0 text-sm">⚠️</span>
                <div>
                  <strong className="text-slate-800 text-xs block font-extrabold uppercase tracking-wide font-sans">Mod Pratonton Cetak Laporan Penyata</strong>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5 animate-pulse">Sila ambil perhatian: pencetakan tidak dibenarkan terus dari dalam bingkai pratonton sandboxed.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                <button
                  onClick={() => {
                    try {
                      window.print();
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs tracking-wide uppercase rounded-xl cursor-pointer shrink-0 transition"
                >
                  Cetak Fizikal / Muat Turun PDF
                </button>
                <button
                  onClick={() => setIsPrinting(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs tracking-wide uppercase rounded-xl cursor-pointer shrink-0 transition"
                >
                  Tutup Pratonton
                </button>
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
                  <li>Sila klik butang ikon anak panah <strong className="bg-red-100 px-1 py-0.5 rounded text-red-900 border border-red-250">"Open in a new tab"</strong> di bahagian atas kanan skrin kelabu AI Studio (luar bingkai putih aplikasi).</li>
                  <li>Selepas aplikasi dibuka di tab berasingan, anda boleh menekan semula butang hijau di atas untuk memanggil menu cetakan rasmi atau menyimpan terus sebagai dokumen PDF!</li>
                </ul>
              </div>
            )}
          </div>

          {/* Letter Head */}
          <div className="text-center border-b-2 border-slate-900 pb-5 mb-5 text-black">
            <h1 className="text-xl font-black tracking-tight uppercase font-display">Pertubuhan Khairat Kematian Dan Kebajikan Kampung Gong Badak</h1>
            <p className="text-xs text-slate-600 font-medium mt-1">21300 Kuala Nerus, Terengganu Darul Iman</p>
            <p className="text-[10px] text-slate-400 font-mono mt-1">Sistem Pengurusan Khairat Kematian Tambahan | Hubungi: khairatkematiantpgb@gmail.com</p>
          </div>

          {/* Report Title */}
          <div className="flex justify-between items-end border-b border-slate-200 pb-3 mb-5 text-slate-900">
            <div>
              <h2 className="text-sm font-extrabold tracking-tight uppercase text-black">LAPORAN PENYATA KIRA-KIRA ALIRAN TUNAI & PELABURAN</h2>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                Laporan Kewangan bagi tahun {selectedYearFilter === 'semua' ? 'Keseluruhan' : selectedYearFilter} setakat {new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-500">
              Jumlah Transaksi: {filteredDisplayRows.length} Baris
            </div>
          </div>

          {/* Financial summary Cards on top of printable PDF */}
          <div className="grid grid-cols-5 gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {ACCOUNTS_LIST.map((acc, keyIdx) => {
              const currentBal = processedData.finalBalances[acc];
              return (
                <div key={keyIdx} className="text-center">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block tracking-wider truncate mb-1">
                    {SHORT_NAMES[acc]}
                  </span>
                  <strong className="text-xs font-mono font-black text-slate-900">
                    RM {formatCur(currentBal)}
                  </strong>
                </div>
              );
            })}
          </div>

          {/* Printable Table */}
          <table className="w-full text-left border-collapse table-fixed text-[9.5px] border border-slate-300">
            <thead className="bg-slate-100 text-black border-b border-slate-400">
              <tr>
                <th className="px-1 py-2 text-center border-r border-slate-300 w-[35px]" rowSpan={2}>BIL</th>
                <th className="px-1.5 py-2 text-center border-r border-slate-300 w-[75px]" rowSpan={2}>TARIKH</th>
                <th className="px-2 py-2 border-r border-slate-300 text-left w-[200px]" rowSpan={2}>KENYATAAN</th>
                
                {ACCOUNTS_LIST.map((acc, idx) => (
                  <th key={idx} className="px-1.5 py-1 text-center border-r border-slate-300 text-[8px] tracking-tight font-black" colSpan={3}>
                    {SHORT_NAMES[acc]}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-100 border-b border-slate-300 text-[7.5px]">
                {ACCOUNTS_LIST.map((_, idx) => (
                  <React.Fragment key={idx}>
                    <th className="px-1 py-1 text-right border-r border-slate-300">Masuk</th>
                    <th className="px-1 py-1 text-right border-r border-slate-300 text-rose-800">Keluar</th>
                    <th className="px-1 py-1 text-right border-r border-slate-300 font-bold bg-slate-200">Baki</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredDisplayRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="page-break-inside-avoid">
                  <td className="px-1 py-1.5 text-center font-mono border-r border-slate-300">{rowIdx + 1}</td>
                  <td className="px-1 py-1.5 text-center font-mono border-r border-slate-300">{parseDateMalay(row.tarikh)}</td>
                  <td className="px-2 py-1.5 text-left font-sans font-bold leading-tight border-r border-slate-300 whitespace-normal break-words">
                    {row.kenyataan}
                  </td>
                  
                  {ACCOUNTS_LIST.map((acc, keyIdx) => {
                    const data = row.accountsData[acc];
                    const showInBakiOnly = data.isBakiAwal;
                    
                    return (
                      <React.Fragment key={keyIdx}>
                        <td className="px-1 py-1.5 text-right border-r border-slate-300 font-mono text-emerald-800 text-[8.5px]">
                          {!showInBakiOnly && data.masuk ? formatCur(data.masuk) : ''}
                        </td>
                        <td className="px-1 py-1.5 text-right border-r border-slate-300 font-mono text-rose-800 text-[8.5px]">
                          {!showInBakiOnly && data.keluar ? formatCur(data.keluar) : ''}
                        </td>
                        <td className="px-1 py-1.5 text-right border-r border-slate-300 font-mono font-bold bg-slate-50 text-[8.5px]">
                          {data.hasTx ? formatCur(data.baki) : ''}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}

              {/* Cumulative balance Footer row inside printed table */}
              <tr className="bg-slate-100 font-bold border-t border-slate-400 border-b text-black text-[9px]">
                <td className="px-1 py-2 text-center border-r border-slate-300" colSpan={3}>BAKI TERKUMPUL (RM)</td>
                
                {ACCOUNTS_LIST.map((acc, keyIdx) => {
                  const currentBal = processedData.finalBalances[acc];
                  return (
                    <React.Fragment key={keyIdx}>
                      <td className="px-1 py-2 bg-slate-100 border-r border-slate-200" colSpan={2}></td>
                      <td className="px-1 py-2 text-right font-mono font-bold bg-slate-200 border-r border-slate-300 text-emerald-950">
                        {formatCur(currentBal)}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>

          {/* Validation/Sign-off Fields */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-xs text-slate-800 print:block print:mt-16">
            <div className="print:inline-block print:w-[22%] text-center">
              <p className="font-bold underline pb-16">Disediakan Oleh:</p>
              <p className="text-[10px] text-slate-500">Bendahari Pertubuhan</p>
              <p className="text-[9px] text-slate-400 mt-1">Tarikh: _______________</p>
            </div>
            
            <div className="print:inline-block print:w-[22%] print:ml-[4%] text-center">
              <p className="font-bold underline pb-16 font-sans">Disemak Oleh:</p>
              <p className="text-[10px] text-slate-500">Pemeriksa Kira-Kira 1</p>
              <p className="text-[9px] text-slate-400 mt-1">Tarikh: _______________</p>
            </div>

            <div className="print:inline-block print:w-[22%] print:ml-[4%] text-center">
              <p className="font-bold underline pb-16 font-sans">Disemak Oleh:</p>
              <p className="text-[10px] text-slate-500">Pemeriksa Kira-Kira 2</p>
              <p className="text-[9px] text-slate-400 mt-1">Tarikh: _______________</p>
            </div>

            <div className="print:inline-block print:w-[22%] print:ml-[4%] text-center">
              <p className="font-bold underline pb-16">Disahkan Oleh:</p>
              <p className="text-[10px] text-slate-500">Pengerusi Jawatankuasa</p>
              <p className="text-[9px] text-slate-400 mt-1">Tarikh: _______________</p>
            </div>
          </div>

        </div>,
        document.body
      )}

      {/* Custom Deletion Confirmation Modal */}
      {deletingTransaction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-650 mb-4">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <Trash2 className="h-5 w-5 shrink-0" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Sahkan Padam Transaksi</h4>
                <p className="text-[10px] text-slate-400 font-sans">Tindakan ini tidak boleh dikembalikan</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-655 leading-relaxed mb-4">
              Adakah anda benar-benar pasti untuk memadamkan rekod transaksi lejar ini dari simpanan?
            </p>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-150 text-[11px] space-y-2 mb-5">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Tarikh Relevan:</span>
                <span className="font-mono font-bold text-slate-700">{parseDateMalay(deletingTransaction.tarikh)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Butiran Kenyataan:</span>
                <span className="font-extrabold text-slate-800 text-right max-w-[220px] truncate" title={deletingTransaction.kenyataan}>
                  {deletingTransaction.kenyataan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Saluran/Akaun:</span>
                <span className="font-black text-slate-750">{SHORT_NAMES[deletingTransaction.kategoriAkaun]}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-500 font-extrabold">Amaun Terlibat:</span>
                <strong className={`font-mono font-black text-xs ${deletingTransaction.jenisTransaksi === 'masuk' ? 'text-emerald-700' : 'text-rose-650'}`}>
                  {deletingTransaction.jenisTransaksi === 'masuk' ? 'MASUK' : 'KELUAR'} (RM {formatCur(deletingTransaction.amaun)})
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => setDeletingTransaction(null)}
                className="flex-1 py-2.5 bg-slate-155 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer text-center select-none disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => handleDeleteTransaction(deletingTransaction.id)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer text-center select-none disabled:bg-slate-400 flex items-center justify-center gap-1.5"
              >
                {isSyncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
                <span>{isSyncing ? 'Memadam...' : 'Ya, Padam!'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
