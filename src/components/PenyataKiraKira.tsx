import React, { useState, useMemo } from 'react';
import { AppState, KewanganTransaction } from '../types';
import { PlusCircle, Trash2, Printer, Search, Calendar, FileSpreadsheet, ArrowDownCircle, ArrowUpCircle, Info, Pencil, X, Loader2, SlidersHorizontal, LayoutList, Table, Check } from 'lucide-react';
import { writeToAppsScript } from '../lib/database';
import { createPortal } from 'react-dom';

interface PenyataKiraKiraProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
  currentRole: 'admin' | 'user' | 'ajk' | null;
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

  // Account Customization State
  const [renamingAccountKey, setRenamingAccountKey] = useState<string | null>(null);
  const [renamingAccountValue, setRenamingAccountValue] = useState<string>('');

  const getAccountDisplayName = (acc: string) => {
    if (state.customAccountNames && state.customAccountNames[acc]) {
      return state.customAccountNames[acc];
    }
    return SHORT_NAMES[acc] || acc;
  };

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
  const [printFormat, setPrintFormat] = useState<'lejar' | 'matriks'>('matriks'); // Default ke Matriks Saluran Melintang Sebelah Menyebelah
  const [printFontSize, setPrintFontSize] = useState<number>(10); // Default 10pt supaya muat padat semua 5 saluran pada 1 halaman
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [printAccountFilter, setPrintAccountFilter] = useState<'all' | 'bank_tunai' | 'bank' | 'tunai' | 'pelaburan'>('all');
  const [printRowSpacing, setPrintRowSpacing] = useState<'normal' | 'relaxed'>('normal');

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

  // Calculate the grand total of all current balances
  const totalBalance = useMemo(() => {
    return ACCOUNTS_LIST.reduce((sum, acc) => sum + (processedData.finalBalances[acc] || 0), 0);
  }, [processedData.finalBalances]);

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

  // Totals for printed statement
  const { totalPeriodMasuk, totalPeriodKeluar } = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    filteredDisplayRows.forEach(row => {
      ACCOUNTS_LIST.forEach(acc => {
        const data = row.accountsData[acc];
        if (data && !data.isBakiAwal) {
          if (data.masuk) masuk += data.masuk;
          if (data.keluar) keluar += data.keluar;
        }
      });
    });
    return { totalPeriodMasuk: masuk, totalPeriodKeluar: keluar };
  }, [filteredDisplayRows]);

  // Breakdown of active accounts for Matrix print filter
  const printMatrixAccounts = useMemo(() => {
    if (printAccountFilter === 'bank_tunai') {
      return ACCOUNTS_LIST.filter(acc => acc === 'Bank' || acc === 'Tunai');
    }
    if (printAccountFilter === 'bank') {
      return ACCOUNTS_LIST.filter(acc => acc === 'Bank');
    }
    if (printAccountFilter === 'tunai') {
      return ACCOUNTS_LIST.filter(acc => acc === 'Tunai');
    }
    if (printAccountFilter === 'pelaburan') {
      return ACCOUNTS_LIST.filter(acc => acc.startsWith('Pelaburan'));
    }
    return ACCOUNTS_LIST;
  }, [printAccountFilter]);

  // Flat Lejar rows for clear, big-font presentation (ideal for elderly committee members)
  const lejarRows = useMemo(() => {
    const rows: Array<{
      bil: number;
      tarikh: string;
      kenyataan: string;
      saluran: string;
      masuk?: number;
      keluar?: number;
      baki: number;
      isBakiAwal: boolean;
      allBakiAwalList?: Array<{ acc: string; baki: number }>;
    }> = [];

    let count = 0;

    filteredDisplayRows.forEach((row) => {
      const isBakiRow = row.kenyataan.toLowerCase().startsWith('baki');

      if (isBakiRow) {
        const bakiList: Array<{ acc: string; baki: number }> = [];
        let totalBakiAwal = 0;
        ACCOUNTS_LIST.forEach(acc => {
          if (row.accountsData[acc]?.hasTx || row.accountsData[acc]?.isBakiAwal) {
            const bal = row.accountsData[acc].baki;
            bakiList.push({ acc, baki: bal });
            totalBakiAwal += bal;
          }
        });

        count++;
        rows.push({
          bil: count,
          tarikh: row.tarikh,
          kenyataan: row.kenyataan,
          saluran: 'Semua Saluran (Baki Pembukaan)',
          baki: totalBakiAwal,
          isBakiAwal: true,
          allBakiAwalList: bakiList
        });
      } else {
        const activeAccounts = ACCOUNTS_LIST.filter(acc => {
          if (printAccountFilter === 'bank_tunai' && acc !== 'Bank' && acc !== 'Tunai') return false;
          if (printAccountFilter === 'bank' && acc !== 'Bank') return false;
          if (printAccountFilter === 'tunai' && acc !== 'Tunai') return false;
          if (printAccountFilter === 'pelaburan' && !acc.startsWith('Pelaburan')) return false;
          return row.accountsData[acc]?.hasTx && !row.accountsData[acc]?.isBakiAwal;
        });

        activeAccounts.forEach(acc => {
          const d = row.accountsData[acc];
          count++;
          rows.push({
            bil: count,
            tarikh: row.tarikh,
            kenyataan: row.kenyataan,
            saluran: getAccountDisplayName(acc),
            masuk: d.masuk,
            keluar: d.keluar,
            baki: d.baki,
            isBakiAwal: false
          });
        });
      }
    });

    return rows;
  }, [filteredDisplayRows, printAccountFilter, state.customAccountNames]);

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
        {currentRole === 'admin' && (
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
                      {idx + 1}. {getAccountDisplayName(acc)}
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
        )}

        {/* RIGHT CARD: Quick Stats Summary Cards + General Instructions */}
        <div className={`${currentRole === 'admin' ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col justify-between bg-slate-50/60 border border-slate-150 p-6 rounded-2xl`}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mt-2 mb-4">
            {ACCOUNTS_LIST.map((acc, keyIdx) => {
              const bal = processedData.finalBalances[acc];
              return (
                <div key={keyIdx} className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-3xs hover:border-emerald-300 transition-all">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block truncate" title={acc}>
                      {getAccountDisplayName(acc)}
                    </span>
                    {currentRole === 'admin' && (
                      <button 
                        onClick={() => {
                          setRenamingAccountKey(acc);
                          setRenamingAccountValue(getAccountDisplayName(acc));
                        }}
                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-650 rounded transition-colors cursor-pointer shrink-0"
                        title={`Ubah nama saluran ${getAccountDisplayName(acc)}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <strong className={`block text-xs md:text-sm font-mono font-black mt-1 ${bal < 0 ? 'text-rose-600' : 'text-emerald-850'}`}>
                    RM {formatCur(bal)}
                  </strong>
                </div>
              );
            })}
          </div>

          {/* Premium Grand Total Section - Placed Below & Enlarged */}
          <div className="bg-emerald-950 text-white border border-emerald-900 p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:bg-emerald-900/90 my-2">
            <div>
              <span className="text-[10px] font-extrabold text-emerald-350 uppercase tracking-widest block mb-0.5">
                JUMLAH KESELURUHAN (SEMUA SALURAN)
              </span>
              <p className="text-[11px] text-slate-300 font-sans leading-none">
                Gabungan keseluruhan nilai baki aktif dari lima akaun saluran pertubuhan.
              </p>
            </div>
            <div className="text-right">
              <strong className={`block text-2xl md:text-3xl font-mono font-black tracking-tight ${totalBalance < 0 ? 'text-rose-400' : 'text-amber-300'}`}>
                RM {formatCur(totalBalance)}
              </strong>
            </div>
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
                    <div className="flex items-center justify-center gap-1.5 px-1">
                      <span className="truncate text-[11px] tracking-wide font-black" title={acc}>
                        {getAccountDisplayName(acc)}
                      </span>
                      {currentRole === 'admin' && (
                        <button 
                          onClick={() => {
                            setRenamingAccountKey(acc);
                            setRenamingAccountValue(getAccountDisplayName(acc));
                          }}
                          className="p-0.5 hover:bg-slate-700 text-slate-355 hover:text-white rounded transition-colors cursor-pointer shrink-0"
                          title={`Ubah nama saluran ${getAccountDisplayName(acc)}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
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
                                  title={`Kemaskini pergerakan ${getAccountDisplayName(otx.kategoriAkaun)} - RM ${formatCur(otx.amaun)}`}
                                >
                                  <Pencil className="h-3.2 w-3.2" />
                                </button>
                                
                                {/* Delete button */}
                                <button
                                  onClick={() => setDeletingTransaction(otx)}
                                  className="p-1 hover:bg-rose-50 text-rose-500 rounded transition-colors cursor-pointer"
                                  title={`Padam pergerakan ${getAccountDisplayName(otx.kategoriAkaun)} - RM ${formatCur(otx.amaun)}`}
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
        <div id="print-area-outlet" className="fixed inset-0 bg-white z-[99999] p-8 md:p-12 overflow-y-auto text-slate-900 font-sans print:relative print:inset-auto print:p-0 print:m-0 print:overflow-visible print:bg-white print:block print:h-auto print:w-full">
          
          {/* Dynamic Page Orientation Style for Browser Print Engine */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: ${printOrientation};
                margin: 6mm 4mm;
              }
            }
          `}} />

          {/* Print controls Ribbon */}
          <div className="mb-6 bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl print:hidden shadow-md flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-amber-200/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 font-black rounded-xl shrink-0 shadow-xs">
                  <Printer className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-slate-900 text-sm font-black uppercase tracking-wide font-sans flex items-center gap-2">
                    Tetapan Cetakan Penyata Rasmi Mesyuarat
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Font 12+ Warga Emas
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 font-sans mt-0.5">
                    Format telah dilaras khusus agar tulisan dan angka lebih besar dan jelas dibaca oleh ahli jawatankuasa mesyuarat.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-end">
                <button
                  onClick={() => {
                    try {
                      window.print();
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs tracking-wide uppercase rounded-xl cursor-pointer shrink-0 transition flex items-center gap-2 shadow-sm"
                >
                  <Printer className="h-4 w-4" />
                  Cetak Fizikal / Muat Turun PDF
                </button>
                <button
                  onClick={() => setIsPrinting(false)}
                  className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs tracking-wide uppercase rounded-xl cursor-pointer shrink-0 transition"
                >
                  Tutup Pratonton
                </button>
              </div>
            </div>

            {/* Customizer Ribbon Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-1 text-xs">
              
              {/* 1. Format Penyata */}
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <LayoutList className="h-3.5 w-3.5 text-amber-600" />
                  Susunan / Format:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintFormat('matriks');
                      setPrintOrientation('landscape');
                    }}
                    className={`px-2 py-2 rounded-lg font-bold text-[11px] transition text-center cursor-pointer ${
                      printFormat === 'matriks'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    📊 5 Saluran Sebelah (Melintang)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintFormat('lejar');
                    }}
                    className={`px-2 py-2 rounded-lg font-bold text-[11px] transition text-center cursor-pointer ${
                      printFormat === 'lejar'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    🌟 Lejar Kronologi (7 Kolum)
                  </button>
                </div>
              </div>

              {/* 2. Saiz Tulisan */}
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Saiz Tulisan:</span>
                  <span className="text-emerald-700 font-black">
                    {printFontSize} pt {printFontSize <= 10 && printFormat === 'matriks' ? '(Muat Padat A4)' : ''}
                  </span>
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {[8, 9, 10, 11, 12, 13, 14].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPrintFontSize(size)}
                      className={`px-0.5 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer text-center ${
                        printFontSize === size
                          ? 'bg-amber-600 text-white shadow-xs font-black'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title={size === 10 ? 'Disyorkan untuk Matriks 5 Saluran' : size === 12 ? 'Disyorkan untuk Lejar 7 Kolum' : undefined}
                    >
                      {size}pt
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Orientasi Kertas */}
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 mb-1.5">
                  Orientasi Kertas A4:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('landscape')}
                    className={`px-2 py-2 rounded-lg font-bold text-[11px] transition cursor-pointer text-center ${
                      printOrientation === 'landscape'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Melintang (Landscape)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('portrait')}
                    className={`px-2 py-2 rounded-lg font-bold text-[11px] transition cursor-pointer text-center ${
                      printOrientation === 'portrait'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Menegak (Portrait)
                  </button>
                </div>
              </div>

              {/* 4. Penapis Saluran / Akaun */}
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 mb-1.5">
                  Pilihan Saluran / Akaun:
                </label>
                <select
                  value={printAccountFilter}
                  onChange={(e) => setPrintAccountFilter(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Semua Saluran (5 Akaun)</option>
                  <option value="bank_tunai">Bank & Tunai Sahaja (Paling Kerap)</option>
                  <option value="bank">Akaun Bank Sahaja</option>
                  <option value="tunai">Wang Tunai Sahaja</option>
                  <option value="pelaburan">3 Akaun Pelaburan Sahaja</option>
                </select>
              </div>

              {/* 5. Kepadatan Ruang Baris */}
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 mb-1.5">
                  Jarak Baris (Spacing):
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintRowSpacing('normal')}
                    className={`px-2 py-2 rounded-lg font-bold text-[11px] transition cursor-pointer text-center ${
                      printRowSpacing === 'normal'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintRowSpacing('relaxed')}
                    className={`px-2 py-2 rounded-lg font-bold text-[11px] transition cursor-pointer text-center ${
                      printRowSpacing === 'relaxed'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Selesa (Lapang)
                  </button>
                </div>
              </div>

            </div>

            {isInIframe && (
              <div className="bg-red-50 border border-red-200 text-red-900 p-3.5 rounded-xl text-xs leading-relaxed shadow-xs">
                <p className="font-extrabold text-xs mb-1 uppercase tracking-wide flex items-center gap-1 text-red-800">
                  🛑 MAKLUMAN PENTING CETAKAN DI DALAM SANDBOX:
                </p>
                <p className="mb-1 text-[11px]">
                  Jika pelayar tidak membuka dialog cetakan, klik butang anak panah <strong className="bg-red-100 px-1 py-0.5 rounded text-red-950 border border-red-200">"Open in a new tab"</strong> di sudut atas kanan skrin AI Studio untuk membuka di tab penuh pelayar, kemudian klik cetak semula.
                </p>
              </div>
            )}
          </div>

          {/* Letter Head */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-5 text-black">
            <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase font-display">
              Pertubuhan Khairat Kematian Dan Kebajikan Kampung Gong Badak
            </h1>
            <p className="text-xs md:text-sm text-slate-700 font-bold mt-1">21300 Kuala Nerus, Terengganu Darul Iman</p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Sistem Pengurusan Khairat Kematian | E-mel: khairatkematiantpgb@gmail.com</p>
          </div>

          {/* Report Title */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-300 pb-3 mb-5 text-slate-900 gap-2">
            <div>
              <h2 className="text-base md:text-lg font-black tracking-tight uppercase text-black flex items-center gap-2">
                LAPORAN PENYATA KIRA-KIRA ALIRAN TUNAI & PELABURAN
                <span className="text-xs font-bold font-sans bg-slate-200 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                  {printFormat === 'matriks' ? 'Susunan 5 Saluran Sebelah-Menyebelah (Melintang)' : 'Format Lejar Mesyuarat (7 Kolum)'}
                </span>
              </h2>
              <p className="text-xs text-slate-600 font-semibold mt-1">
                Laporan Kewangan bagi tahun {selectedYearFilter === 'semua' ? 'Keseluruhan' : selectedYearFilter} setakat {new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                {printAccountFilter !== 'all' && (
                  <span className="ml-2 text-emerald-800 font-bold">
                    (Tapisan: {printAccountFilter === 'bank_tunai' ? 'Bank & Tunai' : printAccountFilter === 'bank' ? 'Bank' : printAccountFilter === 'tunai' ? 'Tunai' : 'Pelaburan'})
                  </span>
                )}
              </p>
            </div>
            <div className="text-left md:text-right text-xs font-mono font-bold text-slate-700">
              Jumlah Transaksi: {printFormat === 'lejar' ? lejarRows.length : filteredDisplayRows.length} Rekod
            </div>
          </div>

          {/* Financial summary Cards on top of printable PDF - High contrast & large fonts */}
          <div className="mb-6 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 print:grid-cols-5 gap-2 md:gap-3 print:gap-2 bg-slate-100/80 p-2.5 md:p-3.5 print:p-2 rounded-xl border-2 border-slate-400">
              {ACCOUNTS_LIST.map((acc, keyIdx) => {
                const currentBal = processedData.finalBalances[acc];
                return (
                  <div key={keyIdx} className="text-center bg-white p-2 rounded-lg border border-slate-300 shadow-xs">
                    <span className="text-[11px] print:text-[9pt] font-black text-slate-700 uppercase block tracking-tight truncate mb-1">
                      {getAccountDisplayName(acc)}
                    </span>
                    <strong className="text-sm md:text-base print:text-[11pt] font-mono font-black text-slate-950 block">
                      RM {formatCur(currentBal)}
                    </strong>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-emerald-50 border-2 border-emerald-700 p-3.5 rounded-xl flex justify-between items-center px-6 shadow-xs">
              <div>
                <span className="text-xs md:text-sm print:text-[12pt] font-black text-emerald-950 uppercase tracking-wide block">
                  JUMLAH KESELURUHAN DANA KHAIRAT (SEMUA SALURAN)
                </span>
                <span className="text-[10px] md:text-xs print:text-[9.5pt] text-emerald-800 font-medium">
                  Baki terkumpul akhir dana khairat setakat tarikh laporan dijana
                </span>
              </div>
              <strong className="text-lg md:text-2xl print:text-[16pt] font-mono font-black text-emerald-950">
                RM {formatCur(totalBalance)}
              </strong>
            </div>
          </div>

          {/* ==================== FORMAT 1: FORMAT LEJAR MESYUARAT (DISYORKAN) ==================== */}
          {printFormat === 'lejar' && (
            <div className="overflow-x-auto">
              <table 
                className={`w-full text-left border-collapse border-2 border-slate-600 print-font-${printFontSize}`}
                style={{ fontSize: `${printFontSize}pt` }}
              >
                <thead className="bg-slate-200 text-black border-b-2 border-slate-600">
                  <tr className="uppercase font-extrabold text-slate-950">
                    <th className="px-2.5 py-3 text-center border-r border-slate-500 w-[45px]">BIL</th>
                    <th className="px-3 py-3 text-center border-r border-slate-500 w-[105px]">TARIKH</th>
                    <th className="px-3 py-3 border-r border-slate-500 text-left min-w-[240px]">KENYATAAN / BUTIRAN</th>
                    <th className="px-3 py-3 border-r border-slate-500 text-center w-[150px]">AKAUN / SALURAN</th>
                    <th className="px-3 py-3 border-r border-slate-500 text-right w-[140px] text-emerald-950">WANG MASUK (RM)</th>
                    <th className="px-3 py-3 border-r border-slate-500 text-right w-[140px] text-rose-950">WANG KELUAR (RM)</th>
                    <th className="px-3 py-3 text-right w-[150px] bg-slate-300/80 font-black text-slate-950">BAKI SALURAN (RM)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-400 text-slate-950">
                  {lejarRows.map((row, rowIdx) => {
                    const rowPad = printRowSpacing === 'relaxed' ? 'py-3.5 px-3' : 'py-2 px-3';
                    const isEven = rowIdx % 2 === 0;

                    if (row.isBakiAwal) {
                      return (
                        <tr key={rowIdx} className="page-break-inside-avoid bg-amber-50/70 border-b-2 border-slate-500">
                          <td className={`${rowPad} text-center font-mono font-bold border-r border-slate-400`}>
                            {row.bil}
                          </td>
                          <td className={`${rowPad} text-center font-mono font-bold border-r border-slate-400 whitespace-nowrap`}>
                            {parseDateMalay(row.tarikh)}
                          </td>
                          <td className={`${rowPad} text-left font-bold border-r border-slate-400`} colSpan={2}>
                            <div className="font-extrabold text-slate-950 uppercase tracking-tight mb-1">
                              {row.kenyataan}
                            </div>
                            {row.allBakiAwalList && (
                              <div className="flex flex-wrap gap-2 text-[10px] print:text-[9.5pt] font-mono text-slate-700">
                                {row.allBakiAwalList.map((item, bIdx) => (
                                  <span key={bIdx} className="bg-white px-2 py-0.5 rounded border border-slate-300">
                                    <strong>{getAccountDisplayName(item.acc)}:</strong> RM {formatCur(item.baki)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={`${rowPad} text-center font-bold text-slate-400 border-r border-slate-400`}>
                            -
                          </td>
                          <td className={`${rowPad} text-center font-bold text-slate-400 border-r border-slate-400`}>
                            -
                          </td>
                          <td className={`${rowPad} text-right font-mono font-black text-slate-950 bg-amber-100/80`}>
                            RM {formatCur(row.baki)}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr 
                        key={rowIdx} 
                        className={`page-break-inside-avoid border-b border-slate-300 ${
                          isEven ? 'bg-white' : 'bg-slate-100/70'
                        }`}
                      >
                        <td className={`${rowPad} text-center font-mono font-bold border-r border-slate-400`}>
                          {row.bil}
                        </td>
                        <td className={`${rowPad} text-center font-mono font-bold border-r border-slate-400 whitespace-nowrap`}>
                          {parseDateMalay(row.tarikh)}
                        </td>
                        <td className={`${rowPad} text-left font-sans font-bold leading-snug border-r border-slate-400 whitespace-normal break-words text-slate-950`}>
                          {row.kenyataan}
                        </td>
                        <td className={`${rowPad} text-center font-bold border-r border-slate-400 whitespace-nowrap`}>
                          <span className="inline-block px-2 py-0.5 bg-white rounded border border-slate-300 text-slate-800 font-extrabold">
                            {row.saluran}
                          </span>
                        </td>
                        <td className={`${rowPad} text-right font-mono font-extrabold text-emerald-950 border-r border-slate-400 whitespace-nowrap`}>
                          {row.masuk ? `RM ${formatCur(row.masuk)}` : '-'}
                        </td>
                        <td className={`${rowPad} text-right font-mono font-extrabold text-rose-950 border-r border-slate-400 whitespace-nowrap`}>
                          {row.keluar ? `RM ${formatCur(row.keluar)}` : '-'}
                        </td>
                        <td className={`${rowPad} text-right font-mono font-black text-slate-950 bg-slate-200/50 whitespace-nowrap`}>
                          RM {formatCur(row.baki)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer Totals */}
                <tfoot className="bg-slate-200 font-black border-t-2 border-slate-700 text-slate-950">
                  <tr className="border-b border-slate-400">
                    <td className="px-3 py-2.5 text-center border-r border-slate-500 font-extrabold" colSpan={4}>
                      JUMLAH PERGERAKAN WANG SEPANJANG TEMPOH LAPORAN:
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-950 border-r border-slate-500">
                      RM {formatCur(totalPeriodMasuk)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-950 border-r border-slate-500">
                      RM {formatCur(totalPeriodKeluar)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono bg-slate-300/80">
                      -
                    </td>
                  </tr>
                  <tr className="bg-slate-300/90 text-slate-950 text-sm print:text-[13pt]">
                    <td className="px-3 py-3 text-center border-r border-slate-500 font-black" colSpan={4}>
                      BAKI KESELURUHAN DANA KHAIRAT SEMUA SALURAN:
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-black text-emerald-950 border-r border-slate-500" colSpan={3}>
                      RM {formatCur(totalBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ==================== FORMAT 2: FORMAT MATRIKS SALURAN ==================== */}
          {printFormat === 'matriks' && (
            <div className="overflow-x-auto w-full print:overflow-visible">
              <table 
                className={`w-full text-left border-collapse border-2 border-slate-700 print-font-${printFontSize} table-matriks-print`}
                style={{ fontSize: `${printFontSize}pt` }}
              >
                <colgroup>
                  {/* Fixed meta columns: Bil, Tarikh, Butiran */}
                  <col style={{ width: '2.5%' }} />
                  <col style={{ width: '6.5%' }} />
                  <col style={{ width: '13%' }} />
                  {/* 5 channels x 3 sub-columns (Masuk, Keluar, Baki) = 15 cols = 78% total (5.2% per sub-column) */}
                  {printMatrixAccounts.map((_, idx) => (
                    <React.Fragment key={idx}>
                      <col style={{ width: '4.8%' }} />
                      <col style={{ width: '4.8%' }} />
                      <col style={{ width: '6.0%' }} />
                    </React.Fragment>
                  ))}
                </colgroup>
                <thead className="bg-slate-200 text-black border-b-2 border-slate-700">
                  <tr>
                    <th className="px-1 py-1.5 text-center border-r border-slate-500 font-black" rowSpan={2}>BIL</th>
                    <th className="px-1 py-1.5 text-center border-r border-slate-500 font-black whitespace-nowrap" rowSpan={2}>TARIKH</th>
                    <th className="px-1.5 py-1.5 border-r border-slate-600 text-left font-black" rowSpan={2}>KENYATAAN / BUTIRAN</th>
                    
                    {printMatrixAccounts.map((acc, idx) => (
                      <th key={idx} className="px-1 py-1 text-center border-r border-slate-600 font-black bg-slate-300/80 text-black tracking-tight" colSpan={3}>
                        {getAccountDisplayName(acc)}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-100 border-b-2 border-slate-700 text-black font-extrabold">
                    {printMatrixAccounts.map((_, idx) => (
                      <React.Fragment key={idx}>
                        <th className="px-0.5 py-0.5 text-right border-r border-slate-400 text-emerald-950 font-extrabold bg-emerald-50/40 text-[90%]">Masuk</th>
                        <th className="px-0.5 py-0.5 text-right border-r border-slate-400 text-rose-950 font-extrabold bg-rose-50/40 text-[90%]">Keluar</th>
                        <th className="px-1 py-0.5 text-right border-r border-slate-600 font-black bg-slate-200 text-slate-950 text-[90%]">Baki</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-400 text-slate-950 font-medium">
                  {filteredDisplayRows.map((row, rowIdx) => {
                    const isBakiRow = row.kenyataan.toLowerCase().startsWith('baki');
                    const rowPad = printRowSpacing === 'relaxed' ? 'py-2' : 'py-1';

                    return (
                      <tr 
                        key={rowIdx} 
                        className={`page-break-inside-avoid border-b border-slate-300 ${
                          isBakiRow 
                            ? 'bg-amber-50/80 font-bold border-b-2 border-slate-500' 
                            : (rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-100/70')
                        }`}
                      >
                        <td className={`px-1 ${rowPad} text-center font-mono font-bold border-r border-slate-400`}>{rowIdx + 1}</td>
                        <td className={`px-1 ${rowPad} text-center font-mono font-bold border-r border-slate-400 whitespace-nowrap`}>{parseDateMalay(row.tarikh)}</td>
                        <td className={`px-1.5 ${rowPad} text-left font-sans font-bold leading-tight border-r border-slate-600 whitespace-normal break-words text-slate-950`}>
                          {row.kenyataan}
                        </td>
                        
                        {printMatrixAccounts.map((acc, keyIdx) => {
                          const data = row.accountsData[acc] || { baki: 0, hasTx: false, isBakiAwal: false };
                          const showInBakiOnly = data.isBakiAwal;
                          
                          return (
                            <React.Fragment key={keyIdx}>
                              <td className={`px-0.5 ${rowPad} text-right border-r border-slate-300 font-mono font-bold text-emerald-950 ${data.masuk && !showInBakiOnly ? 'bg-emerald-50/30' : ''}`}>
                                {!showInBakiOnly && data.masuk ? formatCur(data.masuk) : ''}
                              </td>
                              <td className={`px-0.5 ${rowPad} text-right border-r border-slate-300 font-mono font-bold text-rose-950 ${data.keluar && !showInBakiOnly ? 'bg-rose-50/30' : ''}`}>
                                {!showInBakiOnly && data.keluar ? formatCur(data.keluar) : ''}
                              </td>
                              <td className={`px-1 ${rowPad} text-right border-r border-slate-600 font-mono font-black bg-slate-100/90 text-slate-950`}>
                                {data.hasTx ? formatCur(data.baki) : ''}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Cumulative balance Footer row */}
                  <tr className="bg-slate-300 font-black border-t-2 border-slate-700 border-b-2 text-black">
                    <td className="px-1 py-2 text-center border-r border-slate-600 font-black uppercase tracking-wider text-[90%]" colSpan={3}>
                      BAKI TERKUMPUL (RM)
                    </td>
                    
                    {printMatrixAccounts.map((acc, keyIdx) => {
                      const currentBal = processedData.finalBalances[acc];
                      return (
                        <React.Fragment key={keyIdx}>
                          <td className="px-0.5 py-2 bg-slate-200 border-r border-slate-300" colSpan={2}></td>
                          <td className="px-1 py-2 text-right font-mono font-black bg-slate-400/50 border-r border-slate-600 text-slate-950">
                            {formatCur(currentBal)}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Validation/Sign-off Fields - Clean & guaranteed together */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-slate-900 print:block print:mt-12 page-break-inside-avoid">
            <div className="print:inline-block print:w-[22%] text-center border-t-2 border-slate-800 pt-3">
              <p className="font-extrabold text-sm print:text-[12pt] pb-14 text-black underline">Disediakan Oleh:</p>
              <p className="text-xs print:text-[11pt] font-bold text-slate-800">Bendahari Pertubuhan</p>
              <p className="text-[10px] print:text-[9.5pt] text-slate-600 mt-1 font-mono">Tarikh: _______________</p>
            </div>
            
            <div className="print:inline-block print:w-[22%] print:ml-[4%] text-center border-t-2 border-slate-800 pt-3">
              <p className="font-extrabold text-sm print:text-[12pt] pb-14 text-black underline">Disemak Oleh:</p>
              <p className="text-xs print:text-[11pt] font-bold text-slate-800">Pemeriksa Kira-Kira 1</p>
              <p className="text-[10px] print:text-[9.5pt] text-slate-600 mt-1 font-mono">Tarikh: _______________</p>
            </div>

            <div className="print:inline-block print:w-[22%] print:ml-[4%] text-center border-t-2 border-slate-800 pt-3">
              <p className="font-extrabold text-sm print:text-[12pt] pb-14 text-black underline">Disemak Oleh:</p>
              <p className="text-xs print:text-[11pt] font-bold text-slate-800">Pemeriksa Kira-Kira 2</p>
              <p className="text-[10px] print:text-[9.5pt] text-slate-600 mt-1 font-mono">Tarikh: _______________</p>
            </div>

            <div className="print:inline-block print:w-[22%] print:ml-[4%] text-center border-t-2 border-slate-800 pt-3">
              <p className="font-extrabold text-sm print:text-[12pt] pb-14 text-black underline">Disahkan Oleh:</p>
              <p className="text-xs print:text-[11pt] font-bold text-slate-800">Pengerusi Jawatankuasa</p>
              <p className="text-[10px] print:text-[9.5pt] text-slate-600 mt-1 font-mono">Tarikh: _______________</p>
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
                <span className="font-black text-slate-750">{getAccountDisplayName(deletingTransaction.kategoriAkaun)}</span>
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

      {/* Custom Rename Account Modal */}
      {renamingAccountKey && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-emerald-850 mb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-755 rounded-xl">
                <Pencil className="h-5 w-5 shrink-0 animate-pulse text-emerald-600" />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase text-slate-800 tracking-tight">Kemas Kini Nama Saluran</h3>
                <p className="text-[10px] text-slate-400">Edit nama paparan ringkas saluran kewangan</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-655 leading-relaxed mb-4">
              Sila masukkan nama baharu untuk saluran akaun ini bagi memudahkan pengurusan dan penyata aliran tunai.
            </p>

            <div className="space-y-4 mb-5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nama Asal Saluran:</span>
                <span className="text-xs font-mono bg-slate-100 p-2 rounded-lg block text-slate-700 select-all leading-normal whitespace-pre-wrap break-all">
                  {renamingAccountKey}
                </span>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Nama Paparan Baharu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={renamingAccountValue}
                  onChange={(e) => setRenamingAccountValue(e.target.value)}
                  placeholder="Contoh: Pelaburan Khas, Tabung Kematian..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRenamingAccountKey(null)}
                className="flex-1 py-2.5 bg-slate-155 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer text-center select-none"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cleanVal = renamingAccountValue.trim();
                  if (!cleanVal) {
                    alert('Sila masukkan nama paparan yang sah.');
                    return;
                  }
                  
                  const updatedCustomNames = {
                    ...(state.customAccountNames || {}),
                    [renamingAccountKey]: cleanVal
                  };

                  setIsSyncing(true);
                  try {
                    const updatedState = {
                      ...state,
                      customAccountNames: updatedCustomNames
                    };
                    
                    // If Google Sheets connection is active, let's also sync the new names
                    if (state.useGoogleSheets && state.appsScriptUrl) {
                      const uploadPayload = {
                        action: 'syncLocalToSheets',
                        members: state.members,
                        ledger: state.ledger,
                        kewangan: state.kewangan,
                        customAccountNames: updatedCustomNames
                      };
                      const result = await writeToAppsScript(state.appsScriptUrl, uploadPayload);
                      if (result.success && result.data) {
                        onChangeState({
                          ...updatedState,
                          members: result.data.members || state.members,
                          ledger: result.data.ledger || state.ledger,
                          kewangan: result.data.kewangan || state.kewangan
                        });
                      } else {
                        onChangeState(updatedState);
                      }
                    } else {
                      onChangeState(updatedState);
                    }
                    
                    setRenamingAccountKey(null);
                  } catch (err) {
                    onChangeState({
                      ...state,
                      customAccountNames: updatedCustomNames
                    });
                    setRenamingAccountKey(null);
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer text-center select-none flex items-center justify-center gap-1.5"
              >
                {isSyncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
                <span>{isSyncing ? 'Menyimpan...' : 'Simpan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
