/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppState, LedgerRow, MONTH_KEYS, MONTH_LABELS } from '../types';
import { sortLedger, calculateOutstandingDues, isSameMemberId, fillMissingLedgerRows } from '../lib/database';
import { Search, Calendar, Sparkles, Trash2, Edit3, PlusCircle, Check, X, FileSpreadsheet, FileText, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface PaymentLedgerProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
  onRefresh: () => Promise<void>;
  syncLoading: boolean;
  currentRole: 'admin' | 'user';
}

export default function PaymentLedger({ state, onChangeState, onRefresh, syncLoading, currentRole }: PaymentLedgerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('Semua');

  // EDIT STATE DEFINITIONS
  const [editingRow, setEditingRow] = useState<LedgerRow | null>(null);
  const [originalRowKey, setOriginalRowKey] = useState<{ noAhli: string; tahun: number } | null>(null);

  // ADD NEW LEDGER ROW STATES
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowMemberId, setNewRowMemberId] = useState('');
  const [newRowYear, setNewRowYear] = useState<number>(new Date().getFullYear());

  // DELETE & RESET & ALERTS STATE
  const [rowToDelete, setRowToDelete] = useState<LedgerRow | null>(null);
  const [rowToReset, setRowToReset] = useState<LedgerRow | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customAlertText, setCustomAlertText] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Automatically fill missing ledger years for active members on mount
  React.useEffect(() => {
    const filledLedger = fillMissingLedgerRows(state.members, state.ledger);
    if (filledLedger.length > state.ledger.length) {
      const addedCount = filledLedger.length - state.ledger.length;
      const newState = {
        ...state,
        ledger: filledLedger
      };
      onChangeState(newState);
      localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
      showToast('success', `Sistem mengesan & menambah ${addedCount} baris tahun tunggakan belum bayar secara automatik.`);
    }
  }, []);

  const handleAutoFillArrears = () => {
    const filledLedger = fillMissingLedgerRows(state.members, state.ledger);
    if (filledLedger.length > state.ledger.length) {
      const addedCount = filledLedger.length - state.ledger.length;
      const newState = {
        ...state,
        ledger: filledLedger
      };
      onChangeState(newState);
      localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
      showToast('success', `Sukses! Selesai menyuntik ${addedCount} baris tahun tunggakan belum bayar baru secara automatik.`);
    } else {
      showToast('success', 'Semua baris tahun tunggakan sudah lengkap di dalam pangkalan data.');
    }
  };

  const triggerAlert = (msg: string) => {
    setCustomAlertText(msg);
  };

  // BULK PASTE STATES
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [ignoreWarnings, setIgnoreWarnings] = useState<boolean>(true);

  const handleParseBulkText = (text: string) => {
    setBulkPasteText(text);
    if (!text.trim()) {
      setParsedRows([]);
      setParsingError(null);
      return;
    }

    try {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
      if (lines.length === 0) {
        setParsedRows([]);
        return;
      }

      // Check if the first line is likely a header
      let cells0 = lines[0].split('\t');
      if (cells0.length === 1) {
        cells0 = lines[0].split(',');
      }

      const isHeaderRow = (cells: string[]) => {
        return cells.some(cell => {
          const val = cell.toLowerCase().trim();
          return val.includes('ahli') || val.includes('nama') || val.includes('tahun') || val.includes('jan') || val.includes('yuran') || val.includes('resit') || val.includes('lebihan');
        });
      };

      let startIdx = 0;
      if (isHeaderRow(cells0)) {
        startIdx = 1;
      }

      const rows: any[] = [];
      const currentYear = new Date().getFullYear();

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        let cells = line.split('\t');
        if (cells.length === 1) {
          cells = line.split(',');
        }

        // Clean cells
        const cleanedCells = cells.map(c => {
          let val = c.trim();
          // Remove wrapping quotes
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1).trim();
          }
          return val;
        });

        if (cleanedCells.length < 3) {
          continue; // Skip lines that don't have enough columns
        }

        const noAhliRaw = cleanedCells[0];
        let noAhli = noAhliRaw;
        // Strip any leading or trailing single quotes (e.g. '005)
        if (noAhli.startsWith("'")) {
          noAhli = noAhli.substring(1);
        }
        if (noAhli.endsWith("'")) {
          noAhli = noAhli.substring(0, noAhli.length - 1);
        }
        noAhli = noAhli.trim();

        // If it's purely numeric, convert to padded 3-digit ID (e.g. 005)
        if (/^\d+$/.test(noAhli)) {
          noAhli = noAhli.padStart(3, '0');
        }

        // Find member in DB
        const member = state.members.find(m => isSameMemberId(m.noAhli, noAhli));
        const nameInSheetsDb = member ? member.nama : '';
        const namaAhli = cleanedCells[1] || nameInSheetsDb || 'Ahli Tidak Diketahui';

        let tahun = parseInt(cleanedCells[2]);
        if (isNaN(tahun)) {
          tahun = currentYear;
        }

        // Parse months data
        const monthsData: { [key: string]: string } = {};
        MONTH_KEYS.forEach((key, index) => {
          const rawVal = cleanedCells[3 + index] || '';
          const cleanVal = (rawVal === '-' || rawVal === '.' || rawVal.toLowerCase() === 'null' || rawVal.toLowerCase() === 'tiada') ? '' : rawVal;
          monthsData[key] = cleanVal;
        });

        // Parse excess credit (lebihanKredit)
        let lebihanKredit = parseFloat(cleanedCells[15] || '0');
        if (isNaN(lebihanKredit)) {
          lebihanKredit = 0;
        }

        const existsLocally = state.ledger.some(r => isSameMemberId(r.noAhli, noAhli) && r.tahun === tahun);

        rows.push({
          noAhli,
          namaAhli,
          tahun,
          jan: monthsData.jan,
          feb: monthsData.feb,
          mac: monthsData.mac,
          apr: monthsData.apr,
          mei: monthsData.mei,
          jun: monthsData.jun,
          jul: monthsData.jul,
          ogo: monthsData.ogo,
          sep: monthsData.sep,
          okt: monthsData.okt,
          nov: monthsData.nov,
          dis: monthsData.dis,
          lebihanKredit,
          memberExists: !!member,
          existsLocally,
          rawLine: line
        });
      }

      setParsedRows(rows);
      setParsingError(null);
    } catch (err: any) {
      console.error('Error parsing bulk text:', err);
      setParsingError(`Gagal membaca data: ${err.message || 'Sila pastikan format disalin dengan betul.'}`);
      setParsedRows([]);
    }
  };

  const handleSaveBulkPaste = () => {
    if (parsedRows.length === 0) {
      triggerAlert('Sila tampal data yang sah terlebih dahulu.');
      return;
    }

    const validRowsToImport = ignoreWarnings 
      ? parsedRows.filter(r => r.memberExists)
      : parsedRows;

    if (validRowsToImport.length === 0) {
      triggerAlert('Tiada sebarang rekod yang sah untuk dimport (Mungkin semua No. Ahli ralat atau disekat).');
      return;
    }

    let updatedLedger = JSON.parse(JSON.stringify(state.ledger)) as LedgerRow[];

    validRowsToImport.forEach(importRow => {
      const targetIndex = updatedLedger.findIndex(
        r => isSameMemberId(r.noAhli, importRow.noAhli) && r.tahun === importRow.tahun
      );

      const parsedRowObject: LedgerRow = {
        noAhli: importRow.noAhli,
        namaAhli: importRow.namaAhli,
        tahun: importRow.tahun,
        jan: importRow.jan,
        feb: importRow.feb,
        mac: importRow.mac,
        apr: importRow.apr,
        mei: importRow.mei,
        jun: importRow.jun,
        jul: importRow.jul,
        ogo: importRow.ogo,
        sep: importRow.sep,
        okt: importRow.okt,
        nov: importRow.nov,
        dis: importRow.dis,
        lebihanKredit: importRow.lebihanKredit
      };

      if (targetIndex > -1) {
        updatedLedger[targetIndex] = parsedRowObject;
      } else {
        updatedLedger.push(parsedRowObject);
      }
    });

    const newState = {
      ...state,
      ledger: sortLedger(updatedLedger)
    };

    onChangeState(newState);
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));

    setBulkPasteText('');
    setParsedRows([]);
    setShowBulkPasteModal(false);

    triggerAlert(`Sukses! ${validRowsToImport.length} rekod lejar pembayaran telah berjaya diimport/dikemaskini secara pukal.\n\nSila segerakkan (sync) perubahan ke Google Sheet jika anda mengaktifkan integrasi di tab Integrasi.`);
  };

  const handleStartEdit = (row: LedgerRow) => {
    setEditingRow(JSON.parse(JSON.stringify(row))); // deep copy
    setOriginalRowKey({ noAhli: row.noAhli, tahun: row.tahun });
  };

  const handleSaveEditRow = () => {
    if (!editingRow || !originalRowKey) return;

    if (editingRow.tahun !== originalRowKey.tahun) {
      const yearDuplicateExists = state.ledger.some(
        (r) => isSameMemberId(r.noAhli, editingRow.noAhli) && r.tahun === editingRow.tahun
      );
      if (yearDuplicateExists) {
        showToast('error', `Ralat: Ahli ini sudah mempunyai rekod lejar bagi tahun ${editingRow.tahun}. Sila kemaskini rekod tersebut secara langsung.`);
        return;
      }
    }

    const updatedLedger = state.ledger.map((row) => {
      if (isSameMemberId(row.noAhli, originalRowKey.noAhli) && row.tahun === originalRowKey.tahun) {
        return editingRow;
      }
      return row;
    });

    const newState = {
      ...state,
      ledger: sortLedger(updatedLedger)
    };

    onChangeState(newState);
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
    setEditingRow(null);
    setOriginalRowKey(null);
    showToast('success', 'Rekod lejar berjaya dikemaskini.');
  };

  const handleCreateNewLedgerRow = () => {
    if (!newRowMemberId) {
      showToast('error', 'Sila pilih ahli terlebih dahulu.');
      return;
    }

    const member = state.members.find((m) => isSameMemberId(m.noAhli, newRowMemberId));
    if (!member) {
      showToast('error', 'Ahli tidak sah.');
      return;
    }

    const duplicate = state.ledger.some(
      (r) => isSameMemberId(r.noAhli, newRowMemberId) && r.tahun === newRowYear
    );
    if (duplicate) {
      showToast('error', `Ralat: Ahli ini sudah mempunyai rekod lejar bagi tahun ${newRowYear}.`);
      return;
    }

    const newRow: LedgerRow = {
      noAhli: newRowMemberId,
      namaAhli: member.nama,
      tahun: newRowYear,
      jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
      jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
      lebihanKredit: 0
    };

    const updatedLedger = [...state.ledger, newRow];
    const newState = {
      ...state,
      ledger: sortLedger(updatedLedger)
    };

    onChangeState(newState);
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
    setShowAddRowModal(false);
    setNewRowMemberId('');
    showToast('success', `Rekod lejar bagi tahun ${newRowYear} untuk ${member.nama} berjaya ditambah.`);
  };

  // Grab all unique years present in the ledger to populate the filter dropdown
  const uniqueYears = Array.from(new Set(state.ledger.map(row => row.tahun))).sort((a, b) => b - a);

  // Filter ledger rows
  const filteredLedger = state.ledger
    .filter((row) => {
      const cleanSearch = searchTerm.trim().toLowerCase();
      if (!cleanSearch) return true;

      const isNumeric = /^\d+$/.test(cleanSearch);
      let matchesSearch = false;

      if (isNumeric) {
        // If it is a pure number, match the member ID exactly (loose matching of zeros)
        matchesSearch = isSameMemberId(row.noAhli, cleanSearch);
      } else {
        // Otherwise, do name substring, exact ID, or payments receipt search
        matchesSearch =
          row.namaAhli.toLowerCase().includes(cleanSearch) ||
          row.noAhli.toLowerCase().includes(cleanSearch) ||
          isSameMemberId(row.noAhli, cleanSearch) ||
          (row.jan + row.feb + row.mac + row.apr + row.mei + row.jun + row.jul + row.ogo + row.sep + row.okt + row.nov + row.dis)
            .toLowerCase()
            .includes(cleanSearch);
      }

      return matchesSearch;
    })
    .filter((row) => {
      const matchesYear = selectedYear === 'Semua' || row.tahun.toString() === selectedYear;
      return matchesYear;
    });

  // Export table content to Excel/CSV format
  const downloadExcel = () => {
    const headers = [
      'No. Ahli',
      'Nama Ahli',
      'Tahun',
      ...MONTH_LABELS,
      'Baki Lebihan (RM)',
      'Tunggakan (RM)',
      'Catatan'
    ];

    const rows = filteredLedger.map((row) => {
      const rawTunggakan = calculateOutstandingDues(row.noAhli, state.ledger, state.members, state.kadarYuranSebulan || 3, row.tahun);
      const actualTunggakan = Math.max(0, rawTunggakan - row.lebihanKredit);
      const member = state.members.find(m => isSameMemberId(m.noAhli, row.noAhli));
      const mCatatan = member ? member.catatan || '' : '';
      return [
        row.noAhli,
        row.namaAhli,
        row.tahun,
        ...MONTH_KEYS.map((k) => row[k] ? row[k] : '-'),
        row.lebihanKredit,
        actualTunggakan > 0 ? `RM ${actualTunggakan}` : 'LUNAS',
        mCatatan
      ];
    });

    // Generate CSV content with quotes to handle commas in names
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    // UTF-8 with BOM prefix so Excel opens Malay names correctly
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekod_Jadual_Pembayaran_Gong_Badak_${selectedYear === 'Semua' ? 'Semua_Tahun' : `Tahun_${selectedYear}`}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export table content to printable/saveable PDF
  const downloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('error', 'Ralat: Sila benarkan pop-up di pelayar web anda untuk mencetak atau memuat turun PDF.');
      return;
    }

    const filterDesc = selectedYear === 'Semua' ? 'Semua Tahun' : `Tahun ${selectedYear}`;

    // Total stats for report header
    const totalDues = filteredLedger.reduce((acc, row) => {
      const rawTunggakan = calculateOutstandingDues(row.noAhli, state.ledger, state.members, state.kadarYuranSebulan || 3, row.tahun);
      return acc + Math.max(0, rawTunggakan - row.lebihanKredit);
    }, 0);

    const totalExcess = filteredLedger.reduce((acc, row) => acc + (row.lebihanKredit || 0), 0);

    const tableRowsHtml = filteredLedger.map((row) => {
      const rawTunggakan = calculateOutstandingDues(row.noAhli, state.ledger, state.members, state.kadarYuranSebulan || 3, row.tahun);
      const actualTunggakan = Math.max(0, rawTunggakan - row.lebihanKredit);
      const member = state.members.find(m => isSameMemberId(m.noAhli, row.noAhli));
      const mCatatan = member ? member.catatan || '-' : '-';
      
      const monthCellsHtml = MONTH_KEYS.map((k) => {
        const val = row[k] as string;
        const color = val ? '#065f46' : '#94a3b8';
        const bg = val ? '#d1fae5' : '#ffffff';
        const weight = val ? 'bold' : 'normal';
        return `<td style="border: 1px solid #cbd5e1; padding: 4px; font-family: monospace; font-size: 8px; text-align: center; background-color: ${bg}; color: ${color}; font-weight: ${weight};">${val || '-'}</td>`;
      }).join('');

      return `
        <tr style="font-size: 9px; page-break-inside: avoid;">
          <td style="border: 1px solid #cbd5e1; padding: 5px; font-family: monospace; font-weight: bold; text-align: center;">${row.noAhli}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; font-weight: bold; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${row.namaAhli}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold;">${row.tahun}</td>
          ${monthCellsHtml}
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; font-family: monospace;">RM ${row.lebihanKredit}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; font-family: monospace; font-weight: bold; ${actualTunggakan > 0 ? 'color: #be123c; background-color: #fef2f2;' : 'color: #047857; background-color: #f0fdf4;'}">${actualTunggakan > 0 ? `RM ${actualTunggakan}` : 'LUNAS'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${mCatatan}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rekod Jadual Pembayaran - Pertubuhan Khairat Kematian dan Kebajikan Kampung Gong Badak</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #1e293b;
            margin: 15px;
            font-size: 10px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px double #0f172a;
            padding-bottom: 8px;
          }
          .title {
            font-size: 14px;
            font-weight: bold;
            color: #0f172a;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .subtitle {
            font-size: 9px;
            font-weight: bold;
            color: #475569;
            margin-top: 3px;
            text-transform: uppercase;
          }
          .meta-box {
            display: table;
            width: 100%;
            margin-bottom: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 8px;
            border-radius: 4px;
            box-sizing: border-box;
          }
          .meta-col {
            display: table-cell;
            width: 50%;
            vertical-align: middle;
            font-size: 9px;
            line-height: 1.4;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 15px;
          }
          th {
            background-color: #f1f5f9;
            color: #1e293b;
            font-size: 8px;
            font-weight: bold;
            border: 1px solid #cbd5e1;
            padding: 5px;
            text-align: center;
          }
          .summary-box {
            display: table;
            width: 100%;
            margin-top: 15px;
            padding-top: 8px;
            border-top: 1px dashed #cbd5e1;
            font-size: 9px;
          }
          .summary-col {
            display: table-cell;
            width: 50%;
          }
          @media print {
            .no-print { display: none !important; }
            body { margin: 8mm; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 6px 12px; background-color: #047857; color: white; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 10px;">Cetak / Muat Turun PDF</button>
          <button onclick="window.close()" style="padding: 6px 12px; background-color: #e11d48; color: white; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; margin-left: 6px; font-size: 10px;">Tutup</button>
        </div>
        
        <div class="header">
          <h1 class="title">Sistem Pengurusan Pertubuhan Khairat Kematian dan Kebajikan Kampung Gong Badak, Kuala Nerus, Terengganu</h1>
          <div class="subtitle">REKOD JADUAL PEMBAYARAN ELEKTRONIK (LEJAR AM)</div>
        </div>

        <div class="meta-box">
          <div class="meta-col">
            <strong>Kriteria Penapisan Tahun:</strong> ${filterDesc}<br>
            <strong>Carian Kata Kunci:</strong> ${searchTerm ? `"${searchTerm}"` : 'Semua Rekod'}
          </div>
          <div class="meta-col" style="text-align: right;">
            <strong>Jumlah Laporan:</strong> ${filteredLedger.length} Rekod Ahli<br>
            <strong>Tarikh Dijana:</strong> ${new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 55px;">NO. AHLI</th>
              <th>NAMA AHLI KHAIRAT</th>
              <th style="width: 35px;">TAHUN</th>
              <th>JAN</th><th>FEB</th><th>MAC</th><th>APR</th><th>MEI</th><th>JUN</th>
              <th>JUL</th><th>OGO</th><th>SEP</th><th>OKT</th><th>NOV</th><th>DIS</th>
              <th style="width: 55px; text-align: right;">LEBIHAN (RM)</th>
              <th style="width: 55px; text-align: right;">TUNGGAKAN (RM)</th>
              <th style="width: 90px;">CATATAN</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || `<tr><td colspan="18" style="text-align: center; padding: 25px; font-style: italic; color: #64748b;">Tiada rekod lejar pembayaran dijumpai.</td></tr>`}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="summary-col" style="color: #64748b; font-style: italic;">
            * Dokumen lejar ini dijana secara langsung dari pangkalan data disegerak Kampung Gong Badak.
          </div>
          <div class="summary-col" style="text-align: right; font-weight: bold; font-size: 9px; line-height: 1.5;">
            <span>Jumlah Tunggakan Paparan: <span style="font-family: monospace; color: #be123c;">RM ${totalDues}</span></span><br>
            <span>Jumlah Lebih Bayar Laporan: <span style="font-family: monospace; color: #4338ca;">RM ${totalExcess}</span></span>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Action to reset/clear details in a specific ledger row (Delete Row Data requirement in e)
  const handleResetLedgerRow = (targetRow: LedgerRow) => {
    setRowToReset(targetRow);
  };

  const confirmResetLedgerRow = () => {
    if (!rowToReset) return;
    const targetRow = rowToReset;

    const updatedLedger = state.ledger.map((row) => {
      if (isSameMemberId(row.noAhli, targetRow.noAhli) && row.tahun === targetRow.tahun) {
        return {
          ...row,
          jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
          jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
          lebihanKredit: 0
        };
      }
      return row;
    });

    const newState = {
      ...state,
      ledger: sortLedger(updatedLedger)
    };

    onChangeState(newState);
    
    // Save to localStorage
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
    setRowToReset(null);
    showToast('success', `Rekod lejar bagi No. Ahli ${targetRow.noAhli} pada tahun ${targetRow.tahun} telah dikosongkan.`);
  };

  // Action to delete a specific ledger row entirely
  const handleDeleteLedgerRow = (targetRow: LedgerRow) => {
    setRowToDelete(targetRow);
  };

  const confirmDeleteLedgerRow = () => {
    if (!rowToDelete) return;
    const targetRow = rowToDelete;

    const updatedLedger = state.ledger.filter(
      (row) => !(isSameMemberId(row.noAhli, targetRow.noAhli) && row.tahun === targetRow.tahun)
    );

    const newState = {
      ...state,
      ledger: sortLedger(updatedLedger)
    };

    onChangeState(newState);
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
    setRowToDelete(null);
    showToast('success', `Baris lejar No. Ahli ${targetRow.noAhli} bagi tahun ${targetRow.tahun} berjaya dipadam.`);
  };

  return (
    <div className="space-y-4 font-sans" id="payment-ledger-component">
      {/* Top Ledger Information and Filter Panel */}
      <div className="bg-white border border-slate-200 rounded shadow-sm flex flex-col">
        {/* Panel Header */}
        <div className="p-3 border-b border-slate-150 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Rekod Jadual Pembayaran (Lejar)</h3>
            <p className="text-[10px] text-slate-400">Lejar bulanan yang menjejaki rekod sumbangan RM{state.kadarYuranSebulan || 3}/bulan daripada ahli berserta rujukan nombor resit. Row bermula dari Row 3.</p>
          </div>
          <div className="flex gap-2">
            {currentRole !== 'user' && (
              <>
                <button
                  onClick={() => {
                    setShowBulkPasteModal(true);
                    setBulkPasteText('');
                    setParsedRows([]);
                    setParsingError(null);
                  }}
                  className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-all shadow-xxs cursor-pointer uppercase font-sans"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Tampal Pukal (Excel)
                </button>
                <button
                  onClick={handleAutoFillArrears}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-all shadow-xxs cursor-pointer uppercase font-sans flex items-center"
                  title="Jana baris kosong bagi tahun-tahun tunggakan secara automatik untuk semua ahli yang aktif"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Jana Baris Tunggakan
                </button>
                <button
                  onClick={() => {
                    setShowAddRowModal(true);
                    setNewRowMemberId('');
                    setNewRowYear(new Date().getFullYear());
                  }}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-all shadow-xxs cursor-pointer uppercase font-sans"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  TAMBAH REKOD LEJAR
                </button>
              </>
            )}
            <button
              onClick={onRefresh}
              disabled={syncLoading}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-[10px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-all shadow-xxs disabled:opacity-50 cursor-pointer font-sans"
            >
              <RefreshCw className={`h-3 w-3 text-slate-500 ${syncLoading ? 'animate-spin' : ''}`} />
              Segarkan Google Sheet
            </button>
          </div>
        </div>

        {/* Filters Group */}
        <div className="bg-slate-50/50 border-b border-slate-200 p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {/* Search bar */}
          <div className="relative col-span-1 sm:col-span-3">
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Cari lejar mengikut Nama Ahli, No. Ahli, atau No. Resit..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 text-slate-905 text-xs rounded focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium font-sans"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Year selector */}
          <div className="relative col-span-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <select
              className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 text-slate-905 text-xs rounded focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-bold font-sans"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="Semua">Semua Tahun</option>
              {uniqueYears.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Export / Download Action Toolbar */}
        <div className="bg-slate-55 border-b border-slate-205 px-3 py-2 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
            Memaparkan <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150">{filteredLedger.length} Rekod</span> untuk penapisan semasa
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={downloadExcel}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-50 hover:bg-emerald-105 border border-emerald-200 text-emerald-850 text-[10px] font-black rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase shadow-3xs"
              title="Muat turun jadual lejar ke bentuk fail Excel (CSV)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-650" />
              <span>Muat Turun Excel</span>
            </button>
            <button
              onClick={downloadPDF}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-50 hover:bg-rose-105 border border-rose-200 text-rose-850 text-[10px] font-black rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase shadow-3xs"
              title="Cetak atau simpan jadual lejar ke bentuk dokumen PDF"
            >
              <FileText className="h-3.5 w-3.5 text-rose-655" />
              <span>Muat Turun PDF / Cetak</span>
            </button>
          </div>
        </div>

        {/* Main ledger grid table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="border-b border-slate-205 bg-slate-100/50 text-slate-650 text-[10px] font-bold uppercase tracking-wider font-sans">
                <th className="px-3 py-2 text-center w-16">No. Ahli</th>
                <th className="px-4 py-2 min-w-[160px]">Nama Ahli</th>
                <th className="px-2.5 py-2 text-center w-16">Tahun</th>
                {MONTH_LABELS.map((lbl) => (
                  <th key={lbl} className="px-2 py-2 text-center min-w-[65px] font-mono text-[9px] font-black">
                    {lbl}
                  </th>
                ))}
                <th className="px-3 py-2 text-center min-w-[90px]">Baki Lebihan</th>
                <th className="px-3 py-2 text-center min-w-[90px]">Tunggakan</th>
                <th className="px-3 py-2 min-w-[120px]">Catatan</th>
                {currentRole !== 'user' && (
                  <th className="px-3 py-2 text-center min-w-[170px]">Tindakan</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-xs">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={currentRole === 'user' ? 18 : 19} className="text-center py-8 text-slate-400 font-sans italic">
                    Tiada sebarang baris lejar yang dijumpai sepadan dengan penapisan semasa.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row) => {
                  return (
                    <tr
                      key={`${row.noAhli}-${row.tahun}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* No. Ahli Column A */}
                      <td className="px-3 py-2 text-center font-mono font-bold text-slate-950 text-[11px] tracking-tight">
                        {row.noAhli}
                      </td>

                      {/* Nama Ahli Column B */}
                      <td className="px-4 py-2 font-bold text-slate-900 truncate max-w-[180px] tracking-tight" title={row.namaAhli}>
                        {row.namaAhli}
                      </td>

                      {/* Tahun Column C */}
                      <td className="px-2.5 py-2 text-center font-bold text-slate-700 bg-slate-50/50">
                        {row.tahun}
                      </td>

                      {/* Month Columns D to O */}
                      {MONTH_KEYS.map((key) => {
                        const cellVal = row[key] as string;
                        const filled = !!cellVal;
                        return (
                          <td
                            key={key}
                            className={`p-1 text-center font-mono font-extrabold text-[9px] transition-all ${
                              filled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-white text-slate-300'
                            }`}
                            title={filled ? `No. Resit: ${cellVal}` : 'Belum Berbayaran'}
                          >
                            <div className="truncate max-w-[55px] mx-auto">
                              {filled ? cellVal : '.'}
                            </div>
                          </td>
                        );
                      })}

                      {/* Lebihan Kredit Column P */}
                      <td className="px-3 py-2 text-center font-mono font-bold text-slate-900 bg-slate-50/40">
                        {row.lebihanKredit > 0 ? (
                          <span className="text-indigo-700 bg-indigo-50 border border-indigo-150 px-1.5 py-0.2 rounded text-[10px]">
                            RM {row.lebihanKredit}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">RM 0</span>
                        )}
                      </td>

                      {/* Tunggakan Column */}
                      <td className="px-3 py-2 text-center font-mono font-bold text-slate-900 bg-slate-50/20">
                        {(() => {
                          const rawTunggakan = calculateOutstandingDues(row.noAhli, state.ledger, state.members, state.kadarYuranSebulan || 3, row.tahun);
                          const actualTunggakan = Math.max(0, rawTunggakan - row.lebihanKredit);
                          return actualTunggakan > 0 ? (
                            <span className="text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.2 rounded text-[10px]">
                              RM {actualTunggakan}
                            </span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded text-[10px] font-extrabold">
                              LUNAS
                            </span>
                          );
                        })()}
                      </td>

                      {/* Catatan Column */}
                      <td className="px-3 py-2 text-slate-500 font-sans text-[11px] max-w-[150px] truncate" title={(() => {
                        const m = state.members.find(member => isSameMemberId(member.noAhli, row.noAhli));
                        return m ? m.catatan || '-' : '-';
                      })()}>
                        {(() => {
                          const m = state.members.find(member => isSameMemberId(member.noAhli, row.noAhli));
                          return m ? m.catatan || '-' : '-';
                        })()}
                      </td>

                       {/* Row Specific Actions */}
                      {currentRole !== 'user' && (
                        <td className="px-3 py-2 text-center">
                          <div className="flex gap-1.5 justify-center items-center">
                            <button
                              onClick={() => handleStartEdit(row)}
                              className="px-2 py-0.8 bg-white hover:bg-emerald-600 border border-slate-200 hover:border-emerald-600 text-slate-700 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
                              title="Kemaskini Rekod Lejar / Resit"
                            >
                              <Edit3 className="h-3 w-3 shrink-0" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleResetLedgerRow(row)}
                              className="px-1.5 py-0.8 bg-white hover:bg-amber-500 border border-slate-200 hover:border-amber-500 text-slate-400 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center shrink-0"
                              title="Kosongkan Lejar Tahun ini"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteLedgerRow(row)}
                              className="px-2 py-0.8 bg-rose-50 hover:bg-rose-600 border border-rose-150 hover:border-rose-600 text-rose-700 hover:text-white rounded text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
                              title="Padam baris rekod lejar ahli ini sepenuhnya"
                            >
                              <Trash2 className="h-3 w-3 shrink-0" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Ledger Bottom Summary Card */}
        <div className="bg-slate-55 p-2.5 border-t border-slate-150 flex items-center justify-between text-[10px] text-slate-450 font-sans">
          <span>
            Memaparkan <strong className="text-slate-800">{filteredLedger.length} baris</strong> rekod pusingan pembayaran.
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-600" />
            Menyusun secara automatik berpandukan No. Ahli (A-Z) dan Tahun (Menaik).
          </span>
        </div>
      </div>

      {/* EDIT ROW INDIVIDUAL MODAL DIALOG */}
      {editingRow && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded border border-slate-200 shadow-xl max-w-lg w-full flex flex-col overflow-hidden text-left font-sans">
            <div className="bg-slate-900 text-white p-3 flex justify-between items-center bg-[#131924]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">Kemaskini Rekod Lejar</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Ahli: {editingRow.noAhli} - {editingRow.namaAhli}</p>
              </div>
              <button onClick={() => { setEditingRow(null); setOriginalRowKey(null); }} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleSaveEditRow();
            }} className="p-4 space-y-4 font-sans">
              
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-150">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tahun Rekod</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-bold"
                    value={editingRow.tahun}
                    onChange={(e) => setEditingRow({ ...editingRow, tahun: parseInt(e.target.value) || new Date().getFullYear() })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">Baki Lebihan Kredit (RM)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-bold"
                    value={editingRow.lebihanKredit}
                    onChange={(e) => setEditingRow({ ...editingRow, lebihanKredit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">No. Resit Pembayaran Bulanan (Contoh: R-101)</h4>
                <div className="grid grid-cols-3 gap-2">
                  {MONTH_KEYS.map((key, index) => (
                    <div key={key}>
                      <label className="block text-[9px] font-black text-slate-505 uppercase mb-0.5">{MONTH_LABELS[index]}</label>
                      <input
                        type="text"
                        placeholder="."
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-emerald-805 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        value={editingRow[key] || ''}
                        onChange={(e) => setEditingRow({ ...editingRow, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2.5 flex justify-end gap-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => { setEditingRow(null); setOriginalRowKey(null); }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 text-[10px] font-bold rounded uppercase tracking-wider cursor-pointer"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-805 text-white text-[10px] font-extrabold rounded uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" /> SIMPAN REKOD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ROW TRIGGER DIALOG OVERLAY */}
      {showAddRowModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded border border-slate-205 shadow-xl max-w-sm w-full flex flex-col overflow-hidden text-left">
            <div className="bg-slate-900 text-white p-3 flex justify-between items-center bg-[#131924]">
              <h3 className="text-xs font-bold uppercase tracking-wider">Tambah Rekod Lejar Baru</h3>
              <button onClick={() => setShowAddRowModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateNewLedgerRow();
            }} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pilih Ahli</label>
                <select
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold"
                  value={newRowMemberId}
                  onChange={(e) => setNewRowMemberId(e.target.value)}
                >
                  <option value="">-- PILIH AHLI --</option>
                  {state.members.map((m) => (
                    <option key={m.noAhli} value={m.noAhli}>
                      [{m.noAhli}] {m.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tahun Rekod</label>
                <input
                  type="number"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold"
                  value={newRowYear}
                  onChange={(e) => setNewRowYear(parseInt(e.target.value) || new Date().getFullYear())}
                />
              </div>

              <div className="pt-2.5 flex justify-end gap-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-705 text-[10px] font-bold rounded uppercase tracking-wider cursor-pointer"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-805 text-white text-[10px] font-extrabold rounded uppercase tracking-wider cursor-pointer"
                >
                  TAMBAH REKOD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK PASTE DIALOG OVERLAY */}
      {showBulkPasteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded border border-slate-200 shadow-xl max-w-4xl w-full flex flex-col overflow-hidden text-left my-8 font-sans">
            <div className="bg-indigo-900 text-white p-4 flex justify-between items-center bg-[#1e1b4b]">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <FileSpreadsheet className="h-4 w-4 text-white" />
                  Sistem Import & Tampal Lejar Pukal (Copy-Paste Excel)
                </h3>
                <p className="text-[10px] text-indigo-200 mt-0.5">Sesuai untuk memasukkan ratusan rekod lama secara serentak mengikut susunan kolum lejar.</p>
              </div>
              <button 
                onClick={() => {
                  setShowBulkPasteModal(false);
                  setBulkPasteText('');
                  setParsedRows([]);
                }} 
                className="text-indigo-300 hover:text-white cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto font-sans">
              
              {/* Petunjuk format */}
              <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded text-xs text-indigo-950 space-y-2">
                <h4 className="font-bold flex items-center gap-1.5 uppercase text-[11px] text-indigo-900 leading-none">
                  <Info className="h-4 w-4" /> Arahan Penggunaan Penting:
                </h4>
                <p className="text-[11px] leading-relaxed">
                  1. Sila buka Microsoft Excel atau Google Sheets yang mengandungi rekod yuran lama anda.
                  <br />
                  2. Susun kolum fail Excel/Sheets anda <strong>Tepat Mengikut Urutan 16 Kolum Lejar</strong> seperti di bawah.
                  <br />
                  3. Highlight baris data ahli anda, salin (<kbd className="bg-indigo-200 px-1 py-0.2 rounded font-bold font-mono text-[10px]">Ctrl + C</kbd>), dan tampalkan (<kbd className="bg-indigo-200 px-1 py-0.2 rounded font-bold font-mono text-[10px]">Ctrl + V</kbd>) ke dalam zon teks di bawah.
                </p>

                {/* Grid Visual Format */}
                <div className="pt-2">
                  <span className="block text-[10px] font-bold text-indigo-805 uppercase tracking-wider mb-1">Turutan Kolum Excel Yang Diperlukan (Kiri ke Kanan):</span>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 bg-white p-2 rounded border border-indigo-150 text-center font-mono text-[9px] font-bold overflow-x-auto select-all">
                    <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">1. No. Ahli</span>
                    <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">2. Nama</span>
                    <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">3. Tahun</span>
                    <span className="bg-emerald-50 p-1 text-emerald-800 border border-emerald-200 rounded">4. JAN</span>
                    <span className="bg-emerald-50 p-1 text-emerald-800 border border-emerald-200 rounded">5. FEB</span>
                    <span className="bg-emerald-50 p-1 text-emerald-800 border border-emerald-200 rounded">6. MAC</span>
                    <span className="bg-emerald-50 p-1 text-emerald-800 border border-emerald-200 rounded">7. APR</span>
                    <span className="bg-emerald-50 p-1 text-emerald-850 border border-emerald-200 rounded">8. MEI</span>
                    <span className="bg-emerald-50 p-1 text-emerald-850 border border-emerald-200 rounded">9. JUN</span>
                    <span className="bg-emerald-50 p-1 text-emerald-850 border border-emerald-200 rounded">10. JUL</span>
                    <span className="bg-emerald-50 p-1 text-emerald-850 border border-emerald-200 rounded">11. OGO</span>
                    <span className="bg-emerald-50 p-1 text-emerald-850 border border-emerald-200 rounded">12. SEP</span>
                    <span className="bg-emerald-50 p-1 text-emerald-850 border border-emerald-200 rounded">13. OKT</span>
                    <span className="bg-emerald-50 p-1 text-emerald-855 border border-emerald-200 rounded">14. NOV</span>
                    <span className="bg-emerald-50 p-1 text-emerald-855 border border-emerald-200 rounded">15. DIS</span>
                    <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">16. Lebih</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-2.5 gap-2">
                    <span className="text-[10px] text-indigo-705 font-semibold leading-relaxed">* Jika tiada nilai pada kolum Nama atau Bulan, biarkan kosong sahaja dalam fail Excel anda.</span>
                    <button
                      type="button"
                      onClick={() => {
                        const sampleData = `001\tAhli 1\t2026\tR001\tR001\tR001\t\t\t\t\t\t\t\t\t\t0\n002\tAhli 2\t2026\tR099\tR099\tR099\tR099\tR099\tR099\tR200\tR200\tR200\tR200\tR200\tR200\t1.5`;
                        handleParseBulkText(sampleData);
                      }}
                      className="text-[10px] bg-white border border-indigo-250 px-2 py-0.5 rounded text-indigo-805 font-bold hover:bg-indigo-50 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      Muat Contoh Data Tampalan (Try Demo)
                    </button>
                  </div>
                </div>
              </div>

              {/* Textarea Tampal */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide font-sans">Zon Tampalan Data (Paste Area)</label>
                <textarea
                  className="w-full h-32 bg-slate-50 border border-slate-300 rounded p-3 text-xs font-mono tracking-tight focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Klik di sini kemudian tekan Ctrl+V untuk menampal baris data terus dari Google Sheets / Excel..."
                  value={bulkPasteText}
                  onChange={(e) => handleParseBulkText(e.target.value)}
                />
              </div>

              {parsingError && (
                <div className="p-3 bg-rose-50 border border-rose-250 text-rose-800 rounded font-bold text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <span>{parsingError}</span>
                </div>
              )}

              {/* Live Preview Panel */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-205">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      Pratinjau Data Dikesan ({parsedRows.length} baris)
                    </h4>
                    <div className="flex gap-4 items-center text-xs">
                      <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer font-bold select-none text-[11px] font-sans">
                        <input
                          type="checkbox"
                          checked={ignoreWarnings}
                          onChange={(e) => setIgnoreWarnings(e.target.checked)}
                          className="rounded text-indigo-650 focus:ring-indigo-550 border-slate-305 h-3.5 w-3.5 cursor-pointer"
                        />
                        Abaikan No. Ahli ralat/tidak wujud (Disyorkan)
                      </label>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
                    <span className="bg-indigo-50 border border-indigo-150 text-indigo-800 px-2 py-0.5 rounded">
                      Jumlah: {parsedRows.length} baris
                    </span>
                    <span className="bg-emerald-50 border border-emerald-150 text-emerald-800 px-2 py-0.5 rounded">
                      Sedia diimport (Sah): {parsedRows.filter(r => r.memberExists).length} baris
                    </span>
                    <span className="bg-amber-50 border border-amber-100 text-amber-850 px-2 py-0.5 rounded">
                      Kemaskini sedia ada: {parsedRows.filter(r => r.memberExists && r.existsLocally).length} baris
                    </span>
                    <span className="bg-sky-50 border border-sky-100 text-sky-850 px-2 py-0.5 rounded">
                      Rekod baru: {parsedRows.filter(r => r.memberExists && !r.existsLocally).length} baris
                    </span>
                    {parsedRows.some(r => !r.memberExists) && (
                      <span className="bg-rose-50 border border-rose-150 text-rose-800 px-2 py-0.5 rounded">
                        Ralat No. Ahli: {parsedRows.filter(r => !r.memberExists).length} baris
                      </span>
                    )}
                  </div>

                  {/* Micro Table for Live Preview */}
                  <div className="max-h-56 overflow-y-auto border border-slate-205 rounded">
                    <table className="w-full text-left table-auto text-xs">
                      <thead className="bg-slate-55 text-[10px] font-bold text-slate-605 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 w-20 text-center font-sans">No. Ahli</th>
                          <th className="px-3 py-2 font-sans">Nama Ahli</th>
                          <th className="px-3 py-2 text-center w-16 font-sans">Tahun</th>
                          <th className="px-3 py-2 text-center font-sans">Bulan Berbayar (Jan-Dis)</th>
                          <th className="px-3 py-2 text-right w-24 font-sans">Lebihan (RM)</th>
                          <th className="px-3 py-2 text-center w-24 font-sans">Status Ahli</th>
                          <th className="px-3 py-2 text-center w-24 font-sans">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-sans">
                        {parsedRows.map((row, index) => {
                          return (
                            <tr
                              key={index}
                              className={`hover:bg-slate-50 transition-colors ${
                                !row.memberExists ? 'bg-rose-50/40 text-slate-505' : ''
                              }`}
                            >
                              <td className="px-3 py-1.5 text-center font-mono font-bold">
                                {row.noAhli}
                              </td>
                              <td className="px-3 py-1.5 font-bold text-slate-800 truncate max-w-[150px]" title={row.namaAhli}>
                                {row.namaAhli}
                              </td>
                              <td className="px-3 py-1.5 text-center font-bold">
                                {row.tahun}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <div className="flex gap-0.5 justify-center">
                                  {MONTH_KEYS.map((k, mIdx) => (
                                    <span
                                      key={k}
                                      className={`text-[8px] px-1 font-black rounded ${
                                        row[k] ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-350'
                                      }`}
                                      title={row[k] ? `${MONTH_LABELS[mIdx]}: ${row[k]}` : MONTH_LABELS[mIdx]}
                                    >
                                      {MONTH_LABELS[mIdx].substring(0, 1)}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-600">
                                RM {row.lebihanKredit}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {row.memberExists ? (
                                  <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-emerald-100 uppercase">
                                    <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                                    DB Sah
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 bg-rose-50 text-rose-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-rose-100 uppercase">
                                    <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
                                    Bukan Ahli
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {row.memberExists ? (
                                  row.existsLocally ? (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100">
                                      Kemaskini
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-100">
                                      Baru
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[10px] font-bold text-rose-650 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100">
                                    {ignoreWarnings ? 'Abaikan' : 'Ralat'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkPasteModal(false);
                    setBulkPasteText('');
                    setParsedRows([]);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded uppercase tracking-wider cursor-pointer font-sans"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={handleSaveBulkPaste}
                  disabled={parsedRows.length === 0 || (ignoreWarnings && parsedRows.filter(r => r.memberExists).length === 0)}
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-805 disabled:opacity-50 text-white text-xs font-black rounded uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xxs font-sans"
                >
                  <Check className="h-4 w-4" /> Sahkan & Masukkan Rekod Pukal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="ledger-toast"
          className={`fixed top-4 right-4 z-[70] flex items-center p-3 rounded-lg shadow-lg border max-w-sm w-full transition-all duration-300 animate-fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-250 text-emerald-800'
              : 'bg-rose-50 border-rose-250 text-rose-800'
          }`}
        >
          <div className="mr-2.5 shrink-0">
            {toastMessage.type === 'success' ? (
              <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5 text-rose-600" />
            )}
          </div>
          <p className="text-[11px] font-bold leading-relaxed">{toastMessage.text}</p>
          <button onClick={() => setToastMessage(null)} className="ml-auto text-slate-400 hover:text-slate-650 font-bold p-0.5 ml-2 text-sm">&times;</button>
        </div>
      )}

      {customAlertText && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in font-sans">
          <div className="bg-[#1e1b4b] text-white p-3 flex justify-between items-center bg-indigo-950">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Info className="h-4 w-4 text-indigo-300" />
              Makluman
            </h3>
            <button onClick={() => setCustomAlertText(null)} className="text-slate-400 hover:text-white cursor-pointer p-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 text-xs font-semibold text-slate-805 leading-relaxed whitespace-pre-line font-sans">
            {customAlertText}
          </div>
          <div className="bg-slate-50 p-2.5 flex justify-end">
            <button
              onClick={() => setCustomAlertText(null)}
              className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-850 text-white text-xxs font-bold rounded uppercase cursor-pointer transition-colors"
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {rowToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded-lg border border-slate-205 shadow-xl max-w-md w-full flex flex-col overflow-hidden text-left font-sans animate-zoom-in">
            <div className="bg-rose-900 text-white p-4 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Trash2 className="h-4.5 w-4.5" />
                Padam Rekod Lejar
              </h3>
              <button onClick={() => setRowToDelete(null)} className="text-rose-200 hover:text-white cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs font-medium text-slate-700 leading-relaxed font-sans">
                Adakah anda pasti mahu memadamkan baris lejar tahun <strong className="text-rose-750 font-black">{rowToDelete.tahun}</strong> sepenuhnya bagi ahli berikut?
              </p>
              
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded text-xs space-y-1 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-400">No. Ahli:</span>
                  <span className="font-mono font-bold text-slate-900">{rowToDelete.noAhli}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nama Ahli:</span>
                  <span className="font-bold text-slate-900">{rowToDelete.namaAhli}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tahun:</span>
                  <span className="font-bold text-slate-900">{rowToDelete.tahun}</span>
                </div>
              </div>

              <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-900 rounded-[6px] text-[10px] leading-relaxed flex gap-2 font-bold font-sans">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-700 shrink-0" />
                <span>Amaran: Tindakan ini tidak boleh diundurkan dan rekod bayaran baki lejar tahun berkenaan akan dipadam secara kekal.</span>
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-150">
              <button
                onClick={() => setRowToDelete(null)}
                className="px-4 py-1.8 bg-slate-200 hover:bg-slate-250 text-slate-700 hover:text-slate-800 text-[10px] font-bold rounded uppercase cursor-pointer transition-colors font-sans"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteLedgerRow}
                className="px-4 py-1.8 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded uppercase cursor-pointer flex items-center gap-1.5 transition-colors shadow-3xs font-sans"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Sahkan Padam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {rowToReset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded-lg border border-slate-205 shadow-xl max-w-md w-full flex flex-col overflow-hidden text-left font-sans">
            <div className="bg-amber-600 text-white p-4 flex justify-between items-center bg-amber-653">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="h-4.5 w-4.5 text-white animate-spin-once" />
                Kosongkan Rekod Lejar
              </h3>
              <button onClick={() => setRowToReset(null)} className="text-amber-100 hover:text-white cursor-pointer font-sans">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="p-5 space-y-3 font-sans">
              <p className="text-xs font-medium text-slate-700 leading-relaxed font-sans">
                Adakah anda pasti mahu mengosongkan seluruh bayaran yuran lejar bagi ahli berikut pada tahun <strong className="text-amber-700 font-bold">{rowToReset.tahun}</strong>?
              </p>
              
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded text-xs space-y-1 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-400">No. Ahli:</span>
                  <span className="font-mono font-bold text-slate-905">{rowToReset.noAhli}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nama Ahli:</span>
                  <span className="font-bold text-slate-905">{rowToReset.namaAhli}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tahun:</span>
                  <span className="font-bold text-slate-905">{rowToReset.tahun}</span>
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-100 text-amber-900 rounded-[6px] text-[10px] leading-relaxed flex gap-2 font-bold font-sans">
                <Info className="h-4.5 w-4.5 text-amber-750 shrink-0" />
                <span>Info: Tindakan ini akan mengosongkan semua rekod resit bulan (Jan-Dis) untuk tahun ini kembali kepada kosong, tetapi baris ahli tetap dikekalkan.</span>
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-150">
              <button
                onClick={() => setRowToReset(null)}
                className="px-4 py-1.8 bg-slate-200 hover:bg-slate-250 text-slate-705 hover:text-slate-800 text-[10px] font-bold rounded uppercase cursor-pointer transition-colors font-sans"
              >
                Batal
              </button>
              <button
                onClick={confirmResetLedgerRow}
                className="px-4 py-1.8 bg-amber-600 hover:bg-amber-750 text-white text-[10px] font-black rounded uppercase cursor-pointer flex items-center gap-1.5 transition-colors shadow-3xs font-sans"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sahkan Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
