/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Member, AppState } from '../types';
import { runPadamAhli, writeToAppsScript, isSameMemberId, mergeDuplicateMembersAndLedgers, normalizeMemberId, normalizePhoneNumber, normalizeIcNumber } from '../lib/database';
import { Search, Trash2, Filter, AlertTriangle, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, PlusCircle, Check, X, Info, CheckCircle, Users, User, Phone, CreditCard, Download, Upload, ArrowRight, Sparkles } from 'lucide-react';

interface MemberDatabaseProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
  onRefresh: () => Promise<void>;
  syncLoading: boolean;
  currentRole: 'admin' | 'user' | 'ajk' | null;
  onViewProfile?: (noAhli: string) => void;
}

export default function MemberDatabase({ state, onChangeState, onRefresh, syncLoading, currentRole, onViewProfile }: MemberDatabaseProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Deletion locks
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [globalDeleteConfirm, setGlobalDeleteConfirm] = useState(false);
  const [globalSecurityText, setGlobalSecurityText] = useState('');

  // BULK PASTE & UPDATE STATES
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'ic_tel' | 'all'>('ic_tel');
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);

  // TOAST, ALERT & OVERLAY STATES
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customAlertText, setCustomAlertText] = useState<string | null>(null);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const triggerAlert = (msg: string) => {
    setCustomAlertText(msg);
  };

  // Helper to format IC number with dashes if it's 12 continuous digits (e.g. 850512115431 -> 850512-11-5431)
  const formatIcNumber = (raw: string) => {
    return normalizeIcNumber(raw);
  };

  // Helper to format phone number (restoring leading 0 if stripped by Excel)
  const formatPhoneNumber = (raw: string) => {
    return normalizePhoneNumber(raw);
  };

  // Smart CSV/TSV line splitter that handles tabs, commas, and semicolons while respecting quotes
  const splitBulkLine = (line: string): string[] => {
    if (line.includes('\t')) {
      return line.split('\t').map(c => {
        let val = c.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).replace(/""/g, '"').trim();
        }
        return val;
      });
    }

    const delimiter = !line.includes(',') && line.includes(';') ? ';' : ',';
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const isLikelyPhoneValue = (val: string): boolean => {
    const clean = val.replace(/^'/, '').trim();
    if (!clean) return false;
    const digits = clean.replace(/[^0-9]/g, '');
    if (/^(\+?60|01)\d{7,10}$/.test(digits)) return true;
    // Excel stripped leading 0 from Malaysian mobile number (e.g. 199123456 or 1112345678)
    if ((digits.length === 9 || digits.length === 10) && /^1[0-9]/.test(digits) && !clean.includes('-')) return true;
    // Formatted with dash like 019-1234567 or 19-1234567
    if (/^0?1\d-\d{6,8}$/.test(clean.replace(/\s+/g, ''))) return true;
    return false;
  };

  const isLikelyIcValue = (val: string): boolean => {
    const clean = val.replace(/^'/, '').trim();
    if (!clean) return false;
    if (/^\d{6}-\d{2}-\d{4}$/.test(clean)) return true;
    const digits = clean.replace(/[^0-9]/g, '');
    if (digits.length === 12 && !/^(\+?60|01)/.test(digits)) return true;
    return false;
  };

  const handleUploadBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      handleParseBulkText(content, bulkMode);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleParseBulkText = (text: string, currentMode = bulkMode) => {
    setBulkPasteText(text);
    if (!text.trim()) {
      setParsedRows([]);
      setParsingError(null);
      return;
    }

    try {
      const rawLines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');
      if (rawLines.length === 0) {
        setParsedRows([]);
        return;
      }

      // Check if the first line is likely a header
      const cells0 = splitBulkLine(rawLines[0]);

      const isHeaderRow = (cells: string[]) => {
        return cells.some(cell => {
          const val = cell.toLowerCase().trim();
          return val.includes('ahli') || val.includes('nama') || val.includes('ic') || val.includes('kp') || val.includes('pengenalan') || val.includes('tel') || val.includes('telefon') || val.includes('alamat') || val.includes('status');
        });
      };

      let startIdx = 0;
      let headerMap: { noAhli?: number; nama?: number; ic?: number; tel?: number; alamat?: number; status?: number; catatan?: number } | null = null;

      if (isHeaderRow(cells0)) {
        startIdx = 1;
        headerMap = {};
        cells0.forEach((h, idx) => {
          const val = h.toLowerCase().trim();
          if (headerMap!.noAhli === undefined && (val.includes('no. ahli') || val.includes('no ahli') || val === 'ahli' || val === 'id' || val === 'no')) {
            headerMap!.noAhli = idx;
          } else if (headerMap!.nama === undefined && val.includes('nama')) {
            headerMap!.nama = idx;
          } else if (headerMap!.ic === undefined && (val.includes('ic') || val.includes('kp') || val.includes('pengenalan'))) {
            headerMap!.ic = idx;
          } else if (headerMap!.tel === undefined && (val.includes('tel') || val.includes('hp') || val.includes('bimbit') || val.includes('phone'))) {
            headerMap!.tel = idx;
          } else if (headerMap!.alamat === undefined && val.includes('alamat')) {
            headerMap!.alamat = idx;
          } else if (headerMap!.status === undefined && val.includes('status')) {
            headerMap!.status = idx;
          } else if (headerMap!.catatan === undefined && val.includes('catatan')) {
            headerMap!.catatan = idx;
          }
        });
      }

      const rows: any[] = [];

      for (let i = startIdx; i < rawLines.length; i++) {
        const line = rawLines[i];
        const cleanedCells = splitBulkLine(line);

        if (cleanedCells.length < 2 || cleanedCells.every(c => !c)) {
          continue;
        }

        const noAhliCol = headerMap?.noAhli !== undefined ? headerMap.noAhli : 0;
        let noAhli = (cleanedCells[noAhliCol] || '').replace(/^'/, '').replace(/'$/, '').trim();
        if (!noAhli) continue;
        if (/^\d+$/.test(noAhli)) {
          noAhli = noAhli.padStart(3, '0');
        }

        const existingMember = state.members.find(m => isSameMemberId(m.noAhli, noAhli));

        if (currentMode === 'ic_tel') {
          // MODE IC & TEL: Flexible column extraction
          let nama = existingMember?.nama || '';
          let ic = '';
          let tel = '';

          if (headerMap && (headerMap.ic !== undefined || headerMap.tel !== undefined)) {
            if (headerMap.nama !== undefined && cleanedCells[headerMap.nama]) {
              nama = cleanedCells[headerMap.nama];
            }
            if (headerMap.ic !== undefined && cleanedCells[headerMap.ic]) {
              ic = cleanedCells[headerMap.ic];
            }
            if (headerMap.tel !== undefined && cleanedCells[headerMap.tel]) {
              tel = cleanedCells[headerMap.tel];
            }
          } else if (cleanedCells.length >= 4) {
            // Format: No Ahli, Nama Ahli, No IC, No Telefon
            nama = cleanedCells[1] || nama;
            ic = cleanedCells[2] || '';
            tel = cleanedCells[3] || '';
          } else if (cleanedCells.length === 3) {
            // Check if Col 1 is IC, Tel, or Nama
            const col1 = cleanedCells[1];
            const col2 = cleanedCells[2];
            if (isLikelyIcValue(col1) || (!isLikelyPhoneValue(col1) && /^\d[\d-\s]+$/.test(col1))) {
              // Format: No Ahli, No IC, No Telefon
              ic = col1;
              tel = col2;
            } else if (isLikelyPhoneValue(col1) && isLikelyIcValue(col2)) {
              // Format: No Ahli, No Telefon, No IC
              tel = col1;
              ic = col2;
            } else {
              // Format: No Ahli, Nama, IC or Tel
              nama = col1 || nama;
              if (isLikelyPhoneValue(col2)) {
                tel = col2;
              } else {
                ic = col2;
              }
            }
          } else if (cleanedCells.length === 2) {
            // Format: No Ahli, IC/Tel
            const val = cleanedCells[1];
            if (isLikelyPhoneValue(val)) {
              tel = val;
            } else {
              ic = val;
            }
          }

          ic = formatIcNumber(ic);
          tel = formatPhoneNumber(tel);
          const currentIc = existingMember?.ic || '';
          const currentTel = existingMember?.tel || '';
          const isChanged = Boolean((ic && ic !== currentIc) || (tel && tel !== currentTel));

          rows.push({
            noAhli,
            nama: existingMember?.nama || nama || 'Ahli Tidak Ditemui',
            ic,
            tel,
            currentIc,
            currentTel,
            isChanged,
            existsLocally: !!existingMember,
            rawLine: line
          });
        } else {
          // MODE FULL IMPORT
          const nama = cleanedCells[headerMap?.nama ?? 1] || existingMember?.nama || 'Ahli Tanpa Nama';
          const ic = formatIcNumber(cleanedCells[headerMap?.ic ?? 2] || '');
          let tel = existingMember?.tel || '';
          let alamat = '';
          let status = 'Aktif';
          let catatan = '';

          if (headerMap && (headerMap.tel !== undefined || headerMap.alamat !== undefined)) {
            if (headerMap.tel !== undefined) tel = formatPhoneNumber(cleanedCells[headerMap.tel] || '');
            if (headerMap.alamat !== undefined) alamat = cleanedCells[headerMap.alamat] || '';
            if (headerMap.status !== undefined) {
              const statusRaw = cleanedCells[headerMap.status] || 'Aktif';
              if (statusRaw.toLowerCase().includes('tidak') || statusRaw.toLowerCase().includes('tangguh')) {
                status = 'Tidak Aktif';
              }
            }
            if (headerMap.catatan !== undefined) catatan = cleanedCells[headerMap.catatan] || '';
          } else if (cleanedCells.length >= 7) {
            tel = formatPhoneNumber(cleanedCells[3] || '');
            alamat = cleanedCells[4] || '';
            const statusRaw = cleanedCells[5] || 'Aktif';
            if (statusRaw.toLowerCase().includes('tidak') || statusRaw.toLowerCase().includes('tangguh')) {
              status = 'Tidak Aktif';
            }
            catatan = cleanedCells[6] || '';
          } else {
            // Check if column 3 is actually a phone number
            if (isLikelyPhoneValue(cleanedCells[3] || '')) {
              tel = formatPhoneNumber(cleanedCells[3] || '');
              alamat = cleanedCells[4] || existingMember?.alamat || '';
              const statusRaw = cleanedCells[5] || existingMember?.status || 'Aktif';
              if (statusRaw.toLowerCase().includes('tidak') || statusRaw.toLowerCase().includes('tangguh')) {
                status = 'Tidak Aktif';
              }
            } else {
              alamat = cleanedCells[3] || '';
              const statusRaw = cleanedCells[4] || 'Aktif';
              if (statusRaw.toLowerCase().includes('tidak') || statusRaw.toLowerCase().includes('tangguh')) {
                status = 'Tidak Aktif';
              }
              catatan = cleanedCells[5] || '';
            }
          }

          rows.push({
            noAhli,
            nama,
            ic,
            tel,
            alamat,
            status,
            catatan,
            existsLocally: !!existingMember,
            rawLine: line
          });
        }
      }

      setParsedRows(rows);
      setParsingError(null);
    } catch (err: any) {
      console.error('Error parsing bulk member text:', err);
      setParsingError(`Gagal membaca data: ${err.message || 'Sila pastikan format disalin dengan betul.'}`);
      setParsedRows([]);
    }
  };

  // Export Member list template for Bulk IC & Tel update
  const downloadBulkUpdateTemplate = () => {
    const headers = ['No. Ahli', 'Nama Ahli', 'No. Kad Pengenalan (IC)', 'No. Telefon'];
    const sorted = [...state.members].sort((a, b) =>
      normalizeMemberId(a.noAhli).localeCompare(normalizeMemberId(b.noAhli), undefined, { numeric: true })
    );

    const rows = sorted.map(m => [
      m.noAhli,
      m.nama,
      m.ic || '',
      m.tel || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Templat_Kemaskini_Pukal_IC_Tel_Gong_Badak.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveBulkPaste = () => {
    if (parsedRows.length === 0) {
      triggerAlert('Sila tampal data yang sah terlebih dahulu.');
      return;
    }

    setShowBulkConfirmModal(true);
  };

  const executeSaveBulkPaste = async () => {
    if (bulkMode === 'ic_tel') {
      let updatedCount = 0;
      const updatedMembers = state.members.map(member => {
        const updateRow = parsedRows.find(r => isSameMemberId(r.noAhli, member.noAhli));
        if (updateRow) {
          const newIc = updateRow.ic ? formatIcNumber(updateRow.ic.trim()) : member.ic;
          const newTel = updateRow.tel ? formatPhoneNumber(updateRow.tel.trim()) : (member.tel || '');
          if (newIc !== member.ic || newTel !== (member.tel || '')) {
            updatedCount++;
          }
          return {
            ...member,
            ic: newIc,
            tel: newTel
          };
        }
        return member;
      });

      const newState = {
        ...state,
        members: updatedMembers
      };

      onChangeState(newState);
      localStorage.setItem('khairat_gong_badak', JSON.stringify(newState));
      localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));

      setBulkPasteText('');
      setParsedRows([]);
      setShowBulkPasteModal(false);
      setShowBulkConfirmModal(false);

      // Sync to backend /api/state
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState })
      }).catch(console.error);

      // Sync to Google Sheets if connected
      if (state.useGoogleSheets && state.appsScriptUrl) {
        showToast('success', `Menyimpan & menyegerakkan ${updatedCount} rekod ahli ke Google Sheets...`);
        writeToAppsScript(state.appsScriptUrl, {
          action: 'syncLocalToSheets',
          members: updatedMembers,
          ledger: state.ledger,
          kewangan: state.kewangan || []
        }).then(res => {
          if (res.success) {
            showToast('success', `Berjaya! ${updatedCount} rekod IC & No. Telefon telah dikemaskini di Aplikasi & Google Sheets.`);
          } else {
            showToast('error', `Disimpan di Aplikasi, tetapi ralat Google Sheets: ${res.message}`);
          }
        }).catch(console.error);
      }

      triggerAlert(`Alhamdulillah! Sebanyak ${updatedCount} rekod ahli telah berjaya dikemaskini No. Kad Pengenalan dan No. Telefon secara serentak.\n\nData telah disimpan terus ke Storan Pusat${state.useGoogleSheets && state.appsScriptUrl ? ' dan disegerakkan ke Google Sheets (Pangkalan Data Ahli)' : ''}. Maklumat alamat, tanggungan, status, dan rekod lejar yuran kekal terpelihara.`);
      return;
    }

    // MODE FULL IMPORT
    let updatedMembers = JSON.parse(JSON.stringify(state.members)) as Member[];
    let updatedLedger = JSON.parse(JSON.stringify(state.ledger)) as any[];
    const currentYear = new Date().getFullYear();

    parsedRows.forEach(importRow => {
      const targetIndex = updatedMembers.findIndex(
        m => isSameMemberId(m.noAhli, importRow.noAhli)
      );

      if (targetIndex > -1) {
        const existing = updatedMembers[targetIndex];
        updatedMembers[targetIndex] = {
          ...existing,
          nama: importRow.nama,
          ic: importRow.ic,
          ...(importRow.tel ? { tel: importRow.tel } : {}),
          ...(importRow.alamat ? { alamat: importRow.alamat } : {}),
          ...(importRow.status ? { status: importRow.status } : {}),
          ...(importRow.catatan ? { catatan: importRow.catatan } : {})
        };
        
        updatedLedger = updatedLedger.map(l => {
          if (isSameMemberId(l.noAhli, importRow.noAhli)) {
            return { ...l, namaAhli: importRow.nama };
          }
          return l;
        });
      } else {
        const parsedMember: Member = {
          noAhli: importRow.noAhli,
          nama: importRow.nama,
          ic: importRow.ic,
          tel: importRow.tel || '',
          alamat: importRow.alamat || '',
          status: importRow.status || 'Aktif',
          ...(importRow.catatan ? { catatan: importRow.catatan } : {})
        };
        updatedMembers.push(parsedMember);
        
        const hasLedger = updatedLedger.some(l => isSameMemberId(l.noAhli, importRow.noAhli));
        if (!hasLedger) {
          updatedLedger.push({
            noAhli: importRow.noAhli,
            namaAhli: importRow.nama,
            tahun: currentYear,
            jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
            jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
            lebihanKredit: 0
          });
        }
      }
    });

    updatedLedger.sort((a, b) => {
      const idCompare = a.noAhli.toString().localeCompare(b.noAhli.toString(), undefined, { numeric: true });
      if (idCompare !== 0) return idCompare;
      return (Number(a.tahun) || currentYear) - (Number(b.tahun) || currentYear);
    });

    const { members: cleanMembers, ledger: cleanLedger } = mergeDuplicateMembersAndLedgers(updatedMembers, updatedLedger);

    const newState = {
      ...state,
      members: cleanMembers,
      ledger: cleanLedger
    };

    onChangeState(newState);
    localStorage.setItem('khairat_gong_badak', JSON.stringify(newState));
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));

    // Sync to backend /api/state
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState })
    }).catch(console.error);

    // Sync to Google Sheets if connected
    if (state.useGoogleSheets && state.appsScriptUrl) {
      writeToAppsScript(state.appsScriptUrl, {
        action: 'syncLocalToSheets',
        members: cleanMembers,
        ledger: cleanLedger,
        kewangan: state.kewangan || []
      }).then(res => {
        if (res.success) {
          showToast('success', `Berjaya menyegerakkan ${totalImported} rekod ahli ke Google Sheets!`);
        }
      }).catch(console.error);
    }

    const totalImported = parsedRows.length;
    setBulkPasteText('');
    setParsedRows([]);
    setShowBulkPasteModal(false);
    setShowBulkConfirmModal(false);

    triggerAlert(`Sukses! ${totalImported} rekod pangkalan ahli telah berjaya dimasukkan/dikemas kini secara pukal dan disegerakkan ke pangkalan data.`);
  };

  // Filter and sort members based on search and status
  const filteredMembers = state.members
    .filter((m) => {
      const cleanSearch = searchTerm.trim().toLowerCase();
      if (!cleanSearch) {
        return statusFilter === 'Semua' || m.status === statusFilter;
      }

      const isNumericSearch = /^\d+$/.test(cleanSearch);
      const cleanDigits = cleanSearch.replace(/[^0-9]/g, '');
      const memberIcDigits = String(m.ic || '').replace(/[^0-9]/g, '');
      const memberTelDigits = String(m.tel || '').replace(/[^0-9]/g, '');

      let matchesSearch = false;
      if (isNumericSearch && cleanSearch.length <= 4) {
        // If search is short numeric (1-4 digits), match member ID (ignoring leading zeros)
        matchesSearch = isSameMemberId(m.noAhli, cleanSearch);
      } else {
        // Search by name, exact ID, IC (with/without dashes), or Phone Number (with/without dashes)
        matchesSearch =
          String(m.nama || '').toLowerCase().includes(cleanSearch) ||
          String(m.noAhli || '').toLowerCase().includes(cleanSearch) ||
          isSameMemberId(m.noAhli, cleanSearch) ||
          (Boolean(m.ic) && (String(m.ic).toLowerCase().includes(cleanSearch) || (cleanDigits.length >= 5 && memberIcDigits.includes(cleanDigits)))) ||
          (Boolean(m.tel) && (String(m.tel).toLowerCase().includes(cleanSearch) || (cleanDigits.length >= 5 && memberTelDigits.includes(cleanDigits))));
      }

      const memberStatus = m.status || 'Aktif';
      const matchesStatus = statusFilter === 'Semua' || memberStatus === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort member list ascending numerically by No. Ahli
      return normalizeMemberId(a.noAhli).localeCompare(normalizeMemberId(b.noAhli), undefined, { numeric: true });
    });

  // Export Member list to Excel (CSV format)
  const downloadExcel = () => {
    const showIc = currentRole !== 'user';
    const headers = [
      'No. Ahli',
      'Nama Ahli',
      ...(showIc ? ['No. Kad Pengenalan (IC)'] : []),
      'No. Telefon',
      'Alamat Berdaftar',
      'Status Keahlian'
    ];

    const rows = filteredMembers.map((m) => [
      m.noAhli,
      m.nama,
      ...(showIc ? [m.ic] : []),
      m.tel || '',
      m.alamat,
      m.status
    ]);

    // Generate CSV content with quotes to handle commas in names and addresses
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    // UTF-8 with BOM prefix so Excel opens Malay names correctly
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Pangkalan_Data_Ahli_Gong_Badak_${statusFilter === 'Semua' ? 'Semua_Status' : `Status_${statusFilter}`}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Member list to printable/saveable PDF
  const downloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      triggerAlert('Ralat: Sila benarkan pop-up di pelayar web anda untuk memuat turun PDF.');
      return;
    }

    const filterDesc = statusFilter === 'Semua' ? 'Semua Keahlian' : `Status ${statusFilter}`;
    const showIc = currentRole !== 'user';

    const tableRowsHtml = filteredMembers.map((m) => {
      return `
        <tr style="font-size: 10px; page-break-inside: avoid;">
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-weight: bold; text-align: center;">${m.noAhli}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${m.nama}</td>
          ${showIc ? `<td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${m.ic}</td>` : ''}
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${m.tel || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; color: #475569;">${m.alamat}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">
            <span style="font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px; ${
              m.status === 'Aktif' 
                ? 'background-color: #d1fae5; color: #065f46;' 
                : 'background-color: #f1f5f9; color: #475569;'
            }">${m.status}</span>
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sistem Pengurusan Pertubuhan Khairat Kematian dan Kebajikan Kampung Gong Badak</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #1e293b;
            margin: 15px;
            font-size: 11px;
          }
          .header {
            text-align: center;
            margin-bottom: 25px;
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
            margin-top: 3.5px;
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
            font-size: 9px;
            font-weight: bold;
            border: 1px solid #cbd5e1;
            padding: 6px;
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
          <button onclick="window.print()" style="padding: 6px 14px; background-color: #047857; color: white; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 10px;">Cetak / Muat Turun PDF</button>
          <button onclick="window.close()" style="padding: 6px 14px; background-color: #e11d48; color: white; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; margin-left: 6px; font-size: 10px;">Tutup</button>
        </div>
        
        <div class="header">
          <h1 class="title">Sistem Pengurusan Pertubuhan Khairat Kematian dan Kebajikan Kampung Gong Badak, Kuala Nerus, Terengganu</h1>
          <div class="subtitle">PANGKALAN DATA REKOD AHLI BERDAFTAR</div>
        </div>

        <div class="meta-box">
          <div class="meta-col">
            <strong>Penapisan Keahlian:</strong> ${filterDesc}<br>
            <strong>Carian Kata Kunci:</strong> ${searchTerm ? `"${searchTerm}"` : 'Semua Rekod'}
          </div>
          <div class="meta-col" style="text-align: right;">
            <strong>Jumlah Ahli Dipaparkan:</strong> ${filteredMembers.length} Ahli<br>
            <strong>Tarikh Laporan:</strong> ${new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 70px;">NO. AHLI</th>
              <th>NAMA REKOD AHLI KHAIRAT</th>
              ${showIc ? '<th style="width: 110px;">NO. KAD PENGENALAN (IC)</th>' : ''}
              <th style="width: 100px;">NO. TELEFON</th>
              <th>ALAMAT BERDAFTAR</th>
              <th style="width: 75px;">STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || `<tr><td colspan="${showIc ? 6 : 5}" style="text-align: center; padding: 25px; font-style: italic; color: #64748b;">Tiada rekod ahli berdaftar dijumpai.</td></tr>`}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="summary-col" style="color: #64748b; font-style: italic;">
            * Sila simpan laporan bertulis ini untuk tujuan pemfailan rasmi Kampung Gong Badak.
          </div>
          <div class="summary-col" style="text-align: right; font-weight: bold; font-size: 9px;">
            <span>Disahkan Oleh: Urus Setia Jawatankuasa Khairat Kampung Gong Badak</span>
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

  // Pagination calculation
  const totalItems = filteredMembers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleDeleteMemberConfirm = async () => {
    if (!deleteMemberTarget) return;

    setIsDeleting(true);
    const targetNoAhli = deleteMemberTarget.noAhli;

    if (state.useGoogleSheets && state.appsScriptUrl) {
      // Sync Google Sheets
      const payload = {
        action: 'padamAhli',
        noAhli: targetNoAhli
      };

      try {
        const result = await writeToAppsScript(state.appsScriptUrl, payload);
        if (result.success && result.data) {
          onChangeState({
            ...state,
            members: result.data.members,
            ledger: result.data.ledger,
            kewangan: result.data.kewangan || state.kewangan || []
          });
          showToast('success', `Berjaya memadam ahli ${targetNoAhli} daripada Google Sheet secara langsung!`);
        } else {
          showToast('error', `Ralat memadam di Google Sheet: ${result.message}`);
        }
      } catch (e) {
        console.error('Failed to sync delete with Sheets:', e);
      }
    } else {
      // Local Only
      const newState = runPadamAhli(state, targetNoAhli);
      onChangeState(newState);
    }

    setIsDeleting(false);
    setDeleteMemberTarget(null);
  };

  const handleGlobalResetConfirm = async () => {
    if (globalSecurityText !== 'SAYA MAHU PADAM UNTUK DATA BARU') {
      showToast('error', 'Sila taip perkataan pengesahan yang betul untuk meneruskan.');
      return;
    }

    setIsDeleting(true);

    if (state.useGoogleSheets && state.appsScriptUrl) {
      const payload = {
        action: 'padamSemuaData'
      };
      const result = await writeToAppsScript(state.appsScriptUrl, payload);
      if (result.success && result.data) {
        onChangeState({
          ...state,
          members: result.data.members,
          ledger: result.data.ledger,
          kewangan: result.data.kewangan || state.kewangan || []
        });
        triggerAlert('Google Sheets berjaya dikosongkan secara sepenuhnya!');
      } else {
        showToast('error', `Gagal memadam di Google Sheet: ${result.message}`);
      }
    } else {
      // Offline local reset
      const clearedState = {
        ...state,
        members: [],
        ledger: []
      };
      localStorage.setItem('khairat_gong_badak', JSON.stringify(clearedState));
      onChangeState(clearedState);
      triggerAlert('Pangkalan data lokal berjaya dikosongkan untuk kemasukan data baru!');
    }

    setIsDeleting(false);
    setGlobalDeleteConfirm(false);
    setGlobalSecurityText('');
  };

  return (
    <div className="space-y-4" id="member-database-component">
      {/* Unified Table Panel */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Panel Header */}
        <div className="p-3 border-b border-slate-150 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight font-sans">Pendaftaran & Rekod Ahli</h3>
            <p className="text-[10px] text-slate-400">Melihat, menapis, menyaring, dan mengemas kini senarai ahli Khairat.</p>
          </div>
          <div className="flex items-center gap-2">
            {currentRole === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setBulkMode('ic_tel');
                    setShowBulkPasteModal(true);
                    setBulkPasteText('');
                    setParsedRows([]);
                    setParsingError(null);
                  }}
                  className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-xxs cursor-pointer uppercase font-sans border-b border-emerald-900"
                  title="Kemaskini No. Kad Pengenalan & No. Telefon ahli secara pukal dari Excel"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Kemaskini Pukal (IC & Tel)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkMode('all');
                    setShowBulkPasteModal(true);
                    setBulkPasteText('');
                    setParsedRows([]);
                    setParsingError(null);
                  }}
                  className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-xxs cursor-pointer uppercase font-sans border-b border-indigo-900"
                  title="Daftar atau import maklumat ahli secara pukal dari Excel"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-300" />
                  <span>Daftar Pukal (Excel)</span>
                </button>
              </>
            )}
            <button
              onClick={onRefresh}
              disabled={syncLoading}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-[10px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-all shadow-xxs disabled:opacity-50 cursor-pointer font-sans"
            >
              <RefreshCw className={`h-3 w-3 text-slate-500 ${syncLoading ? 'animate-spin text-emerald-600' : ''}`} />
              SEGARKAN GOOGLE SHEET
            </button>
          </div>
        </div>

        {/* Filter Toolbar Sub-Bar */}
        <div className="bg-slate-50/50 border-b border-slate-200 p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Search Input */}
          <div className="relative col-span-1 sm:col-span-2">
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Cari ahli berdasarkan Nama, No. Kad Pengenalan, No. Telefon atau No. Ahli..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 text-slate-905 text-xs rounded focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Filter className="h-3.5 w-3.5" />
            </div>
            <select
              className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 text-slate-905 text-xs rounded focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-bold"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="Semua">Semua Keahlian</option>
              <option value="Aktif">Aktif</option>
              <option value="Tidak Aktif">Tidak Aktif / Tangguh</option>
            </select>
          </div>
        </div>

        {/* Export / Download Action Toolbar */}
        <div className="bg-slate-55 border-b border-slate-205 px-3 py-2 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight font-sans">
            Memaparkan <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150">{filteredMembers.length} Rekod Ahli</span> untuk penapisan semasa
          </div>
          {currentRole !== 'user' && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={downloadExcel}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-50 hover:bg-emerald-105 border border-emerald-200 text-emerald-850 text-[10px] font-black rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase shadow-3xs font-sans"
                title="Muat turun senarai ahli berdaftar ke bentuk fail Excel (CSV)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-650" />
                <span>Muat Turun Excel</span>
              </button>
              <button
                onClick={downloadPDF}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-50 hover:bg-rose-105 border border-rose-200 text-rose-850 text-[10px] font-black rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase shadow-3xs font-sans"
                title="Cetak atau simpan senarai ahli berdaftar ke bentuk dokumen PDF"
              >
                <FileText className="h-3.5 w-3.5 text-rose-650" />
                <span>Muat Turun PDF / Cetak</span>
              </button>
            </div>
          )}
        </div>

        {/* Dense Table Representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-205 bg-slate-50/50 text-slate-550 text-[10px] font-bold uppercase tracking-wider font-sans">
                <th className="px-4 py-2">No. Ahli</th>
                <th className="px-4 py-2">Nama Ahli</th>
                {currentRole !== 'user' && <th className="px-4 py-2">No. IC (Kad Pengenalan)</th>}
                <th className="px-4 py-2">No. Telefon</th>
                <th className="px-4 py-2">Alamat Kediaman</th>
                <th className="px-4 py-2">Tanggungan</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-sans">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={currentRole === 'user' ? 7 : 8} className="text-center py-8 text-slate-400 italic">
                    Sistem tidak menemui sebarang rekod ahli yang sepadan dengan carian.
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => (
                  <tr key={member.noAhli} className="hover:bg-slate-50 transition-colors duration-100">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-950 text-[11px] tracking-tight">
                      {member.noAhli}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900 tracking-tight">
                      {member.nama}
                    </td>
                    {currentRole !== 'user' && (
                      <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">
                        {member.ic}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-slate-700 font-mono text-[11px]">
                      {member.tel || <span className="text-slate-400 italic">Tiada</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] max-w-xs truncate text-slate-500" title={member.alamat}>
                      {member.alamat}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600 max-w-xs">
                      {member.tanggungan && member.tanggungan.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                          {member.tanggungan.map((dep, dIdx) => (
                            <span key={dIdx} className="inline-block bg-emerald-50 border border-emerald-100 text-emerald-850 text-[9px] px-1.5 py-0.5 rounded font-medium" title={`IC: ${dep.ic || '-'}`}>
                              {dep.nama} <span className="text-emerald-600 font-bold">({dep.hubungan})</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Tiada</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                          member.status === 'Aktif'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-150 text-slate-600'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right flex justify-end gap-1.5 items-center">
                      <button
                        onClick={() => onViewProfile?.(member.noAhli)}
                        className="px-2 py-1 text-emerald-805 hover:text-white bg-emerald-50 hover:bg-emerald-700 border border-emerald-200 hover:border-emerald-700 rounded text-[9px] font-black transition-all cursor-pointer flex items-center gap-1 uppercase"
                        title="Lihat Profil & Cetak Sijil Ahli"
                      >
                        <User className="h-3 w-3" />
                        <span>Profil</span>
                      </button>

                      {currentRole === 'admin' && (
                        <button
                          onClick={() => setDeleteMemberTarget(member)}
                          className="p-1 text-slate-400 hover:text-rose-650 hover:bg-rose-50 rounded border border-transparent hover:border-rose-100 transition-all cursor-pointer inline-flex items-center"
                          title="Padam Ahli ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Table Pagination */}
        <div className="bg-slate-55 p-2.5 border-t border-slate-150 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-[10px] text-slate-500 font-sans">
            Menunjukkan <strong className="text-slate-800">{paginatedMembers.length}</strong> daripada{' '}
            <strong className="text-slate-800">{totalItems}</strong> rekod ahli yang berdaftar.
          </span>
          <div className="flex gap-1 font-sans">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 px-1.5 text-xs text-slate-600 border border-slate-300 hover:bg-slate-100 bg-white disabled:opacity-40 rounded cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {(() => {
              const range: (number | string)[] = [];
              const maxVisibleNeighbors = 1; // Show current, previous 1, next 1
              
              if (totalPages <= 5) {
                for (let i = 1; i <= totalPages; i++) {
                  range.push(i);
                }
              } else {
                // First page
                range.push(1);
                
                const startNeighbor = Math.max(2, currentPage - maxVisibleNeighbors);
                const endNeighbor = Math.min(totalPages - 1, currentPage + maxVisibleNeighbors);
                
                if (startNeighbor > 2) {
                  range.push('...');
                }
                
                for (let i = startNeighbor; i <= endNeighbor; i++) {
                  range.push(i);
                }
                
                if (endNeighbor < totalPages - 1) {
                  range.push('...');
                }
                
                // Last page
                range.push(totalPages);
              }
              
              return range.map((page, index) => {
                if (page === '...') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 py-1 text-[10px] font-bold text-slate-400 select-none flex items-center">
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={`page-${page}`}
                    onClick={() => handlePageChange(page as number)}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                      currentPage === page
                        ? 'bg-[#0f172a] text-white border border-slate-900'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              });
            })()}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 px-1.5 text-xs text-slate-600 border border-slate-300 hover:bg-slate-100 bg-white disabled:opacity-40 rounded cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Padam Data Section (Request E - Button to clear database) */}
      {currentRole === 'admin' && (
        <div className="bg-red-50 border border-red-200 rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4" id="danger-zone">
          <div className="space-y-1">
            <span className="text-[10px] text-red-700 font-extrabold uppercase tracking-widest block font-sans">Panel Pentadbir / Kerisauan Keselamatan (e)</span>
            <p className="text-[11px] text-red-800 max-w-2xl leading-normal font-sans">
              Gunakan butang ini untuk mengosongkan keseluruhan rekod lejar sumbangan serta pangkalan data ahli bagi persediaan tahun kewangan baru. Rekod di Google Sheets yang terhubung juga akan dibasuh secara langsung.
            </p>
          </div>
          <button
            onClick={() => setGlobalDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] rounded tracking-wide uppercase shadow-sm transition-all shrink-0 cursor-pointer font-sans"
          >
            PADAM SEMUA DATA
          </button>
        </div>
      )}

      {/* Modal Confirm Deletion (Single Member) */}
      {deleteMemberTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-100 max-w-md w-full overflow-hidden shadow-2xl relative p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold font-sans">Sahkan Pemadaman Ahli</h3>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed font-sans">
              Anda mahu memadamkan ahli <strong className="text-slate-900">{deleteMemberTarget.nama} ({deleteMemberTarget.noAhli})</strong>? 
              Tindakan ini juga secara automatik akan memadam semua rekod lejar yuran tahunan yang berkaitan dengannya di pangkalan lejar.
            </p>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteMemberTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-705 bg-white hover:bg-slate-100 transition rounded-lg text-xs font-semibold font-sans"
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                onClick={handleDeleteMemberConfirm}
                className="px-4 py-2 hover:bg-rose-700 bg-rose-600 text-white transition rounded-lg text-xs font-bold flex items-center gap-1 font-sans"
                disabled={isDeleting}
              >
                {isDeleting ? 'Sedang memadam...' : 'Ya, Padam Penuh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Global Clear (Entire Database) */}
      {globalDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-100 max-w-lg w-full overflow-hidden shadow-2xl relative p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="h-7 w-7" />
              <h3 className="text-lg font-black font-sans">PENGESAHAN MAKSIMUM: Padam Semua Data</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Anda sedang memulakan proses untuk memadamkan <strong>SELURUH senarai pangkalan data ahli</strong> dan 
              <strong> semua rekod jadual lejar bayaran bulanan</strong>. 
              {state.useGoogleSheets && state.appsScriptUrl && (
                <span className="text-rose-600 block mt-1 font-semibold">
                  Amaran! Data juga akan dikosongkan dan dipadam pada helaian Google Sheets anda yang terhubung!
                </span>
              )}
            </p>

            <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 space-y-2">
              <label className="text-xs font-bold text-rose-805 uppercase block font-sans">
                Sila taip frasa pengesahan di bawah untuk meneruskan:
              </label>
              <span className="text-xs text-rose-600 block font-mono bg-white p-1.5 rounded border border-rose-100 text-center select-all">
                SAYA MAHU PADAM UNTUK DATA BARU
              </span>
              <input
                type="text"
                className="w-full p-2.5 bg-white border border-rose-300 text-rose-900 rounded-lg text-xs font-bold focus:outline-rose-500 text-center font-mono"
                placeholder="Taip perkataan di atas sama seketul"
                value={globalSecurityText}
                onChange={(e) => setGlobalSecurityText(e.target.value)}
                disabled={isDeleting}
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setGlobalDeleteConfirm(false);
                  setGlobalSecurityText('');
                }}
                className="px-4 py-2 border border-slate-200 text-slate-705 bg-white hover:bg-slate-1D0 transition rounded-lg text-xs font-semibold font-sans"
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                onClick={handleGlobalResetConfirm}
                disabled={globalSecurityText !== 'SAYA MAHU PADAM UNTUK DATA BARU' || isDeleting}
                className="px-4 py-2 bg-rose-600 text-white transition rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-40 font-sans"
              >
                {isDeleting ? 'Sedang memproses...' : 'PADAM SEMUA SEKARANG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER BULK PASTE & UPDATE DIALOG OVERLAY */}
      {showBulkPasteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden text-left my-6 font-sans">
            {/* Modal Header */}
            <div className="bg-[#1e1b4b] text-white p-4 flex justify-between items-center bg-indigo-950 border-b border-indigo-900">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 font-sans">
                  {bulkMode === 'ic_tel' ? (
                    <>
                      <Phone className="h-4 w-4 text-emerald-400" />
                      <span>Kemaskini Pukal No. Kad Pengenalan & No. Telefon</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4 text-indigo-300" />
                      <span>Sistem Import & Pendaftaran Ahli Pukal (Excel)</span>
                    </>
                  )}
                </h3>
                <p className="text-[10.5px] text-indigo-200/90 mt-0.5 font-sans">
                  {bulkMode === 'ic_tel' 
                    ? 'Kemaskini nombor IC dan nombor telefon bagi ahli sedia ada secara serentak. Alamat, tanggungan, status, dan rekod lejar yuran sedia ada KEKAL SELAMAT tanpa sebarang gangguan.'
                    : 'Sesuai untuk memasukkan ratusan rekod pendaftaran ahli baharu mengikut susunan kolum lengkap dari Excel.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowBulkPasteModal(false);
                  setBulkPasteText('');
                  setParsedRows([]);
                }} 
                className="text-indigo-300 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Switching Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100/90 px-4 pt-2.5 gap-2 font-sans">
              <button
                type="button"
                onClick={() => {
                  setBulkMode('ic_tel');
                  if (bulkPasteText) handleParseBulkText(bulkPasteText, 'ic_tel');
                }}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer ${
                  bulkMode === 'ic_tel'
                    ? 'bg-white text-emerald-800 border-t-2 border-x border-slate-200 border-t-emerald-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                <span>1. Kemaskini IC & No. Telefon Sahaja (Disyorkan)</span>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">Pantas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkMode('all');
                  if (bulkPasteText) handleParseBulkText(bulkPasteText, 'all');
                }}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer ${
                  bulkMode === 'all'
                    ? 'bg-white text-indigo-900 border-t-2 border-x border-slate-200 border-t-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
                <span>2. Daftar Penuh / Semua Kolum</span>
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto font-sans">
              {bulkMode === 'ic_tel' ? (
                /* TAB 1: KEMASKINI IC & TEL */
                <div className="space-y-4">
                  <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-xl text-xs text-emerald-950 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-bold flex items-center gap-1.5 uppercase text-[11px] text-emerald-900 leading-none">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        Panduan Kemaskini Pukal IC & No. Telefon:
                      </h4>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={downloadBulkUpdateTemplate}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-black uppercase flex items-center gap-1.5 transition shadow-xs cursor-pointer font-sans"
                          title="Muat turun templat Excel CSV dengan senarai kesemua ahli semasa"
                        >
                          <Download className="h-3 w-3" />
                          <span>1. Muat Turun Templat (CSV)</span>
                        </button>

                        <label
                          className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-[10px] font-black uppercase flex items-center gap-1.5 transition shadow-xs cursor-pointer font-sans"
                          title="Muat naik terus fail CSV yang telah dikemaskini dalam Excel"
                        >
                          <Upload className="h-3 w-3" />
                          <span>2. Muat Naik Fail CSV</span>
                          <input
                            type="file"
                            accept=".csv,.txt,.tsv"
                            onChange={handleUploadBulkFile}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            const demoText = `001\tHaji Ahmad bin Hassan\t580214-11-5433\t019-9123456\n002\tSiti Zaleha binti Ismail\t620510-11-5822\t012-9876543\n003\tMohd Khairul bin Azman\t880922-11-5091\t013-4455667`;
                            handleParseBulkText(demoText, 'ic_tel');
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-100/70 border border-emerald-300 text-emerald-800 rounded text-[10px] font-bold uppercase flex items-center gap-1.5 transition cursor-pointer font-sans"
                        >
                          <span>Contoh Demo</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] leading-relaxed text-emerald-900/90 font-sans">
                      1. Muat turun templat atau sediakan lajur dalam fail Excel/Google Sheets anda mengikut salah satu turutan di bawah.
                      <br />
                      2. Salin (<kbd className="bg-emerald-250/50 px-1 py-0.2 rounded font-bold font-mono text-[10px]">Ctrl + C</kbd>) baris dari Excel, dan tampal (<kbd className="bg-emerald-250/50 px-1 py-0.2 rounded font-bold font-mono text-[10px]">Ctrl + V</kbd>) ke zon teks di bawah.
                    </p>

                    {/* Format options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                        <span className="font-extrabold text-emerald-800 block text-[10px] uppercase mb-1">Pilihan A (4 Kolum - Paling Biasa):</span>
                        <div className="font-mono text-[9px] bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-700 flex gap-1">
                          <span className="font-bold">1. No. Ahli</span> &rarr; 
                          <span>2. Nama</span> &rarr; 
                          <span className="text-emerald-700 font-bold">3. No. IC</span> &rarr; 
                          <span className="text-emerald-700 font-bold">4. No. Tel</span>
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                        <span className="font-extrabold text-emerald-800 block text-[10px] uppercase mb-1">Pilihan B (3 Kolum Ringkas):</span>
                        <div className="font-mono text-[9px] bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-700 flex gap-1">
                          <span className="font-bold">1. No. Ahli</span> &rarr; 
                          <span className="text-emerald-700 font-bold">2. No. IC</span> &rarr; 
                          <span className="text-emerald-700 font-bold">3. No. Tel</span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] text-emerald-800 font-semibold block italic">
                      * Sistem memadankan ahli mengikut <strong>No. Ahli</strong> secara automatik. Nombor IC 12 digit tanpa sempang (contoh: 850512115431) akan diformatkan secara automatik kepada 850512-11-5431.
                    </span>
                  </div>

                  {/* Textarea */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                      <span>Zon Tampalan Data (Paste Area)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Tampal dari Excel atau Google Sheets</span>
                    </label>
                    <textarea
                      className="w-full h-32 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono tracking-tight focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                      placeholder="Klik di sini kemudian tekan Ctrl+V untuk menampal baris data ahli dari Excel (Contoh: 001	850512-11-5431	019-9123456)..."
                      value={bulkPasteText}
                      onChange={(e) => handleParseBulkText(e.target.value, 'ic_tel')}
                    />
                  </div>

                  {parsingError && (
                    <div className="p-3 bg-rose-50 border border-rose-250 text-rose-800 rounded-lg font-bold text-xs flex items-center gap-2">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                      <span>{parsingError}</span>
                    </div>
                  )}

                  {/* Live Preview Panel for IC & Tel */}
                  {parsedRows.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap justify-between items-center pb-1 border-b border-slate-200 gap-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          Pratinjau Kemaskini IC & Telefon ({parsedRows.length} baris dikesan)
                        </h4>

                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded">
                            Jumlah: {parsedRows.length}
                          </span>
                          <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded">
                            Ahli Ditemui: {parsedRows.filter(r => r.existsLocally).length}
                          </span>
                          <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded">
                            Perubahan Dikesan: {parsedRows.filter(r => r.existsLocally && r.isChanged).length}
                          </span>
                          {parsedRows.filter(r => !r.existsLocally).length > 0 && (
                            <span className="bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded">
                              No. Ahli Tidak Wujud: {parsedRows.filter(r => !r.existsLocally).length}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Micro Table for Live Preview */}
                      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left table-auto text-xs">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 w-20 text-center">No. Ahli</th>
                              <th className="px-3 py-2">Nama Ahli</th>
                              <th className="px-3 py-2">No. IC (Semasa &rarr; Baharu)</th>
                              <th className="px-3 py-2">No. Telefon (Semasa &rarr; Baharu)</th>
                              <th className="px-3 py-2 text-center w-32">Status Padanan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {parsedRows.map((row, index) => {
                              const icChanged = row.ic && row.ic !== row.currentIc;
                              const telChanged = row.tel && row.tel !== row.currentTel;

                              return (
                                <tr key={index} className={`hover:bg-slate-50 transition-colors ${!row.existsLocally ? 'bg-rose-50/40' : ''}`}>
                                  <td className="px-3 py-2 text-center font-mono font-bold text-slate-900">
                                    {row.noAhli}
                                  </td>
                                  <td className="px-3 py-2 font-bold text-slate-800 truncate max-w-[160px]" title={row.nama}>
                                    {row.nama}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px]">
                                    {row.ic ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400 line-through text-[10px]">{row.currentIc || '(Tiada)'}</span>
                                        <ArrowRight className="h-3 w-3 text-slate-400" />
                                        <span className={`font-bold ${icChanged ? 'text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200' : 'text-slate-700'}`}>
                                          {row.ic}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">Kekal: {row.currentIc || '-'}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px]">
                                    {row.tel ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400 line-through text-[10px]">{row.currentTel || '(Tiada)'}</span>
                                        <ArrowRight className="h-3 w-3 text-slate-400" />
                                        <span className={`font-bold ${telChanged ? 'text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200' : 'text-slate-700'}`}>
                                          {row.tel}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">Kekal: {row.currentTel || '-'}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {row.existsLocally ? (
                                      <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        Ditemui
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                        <X className="h-3 w-3 text-rose-600" />
                                        Tidak Ditemui
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
                </div>
              ) : (
                /* TAB 2: IMPORT PENUH (ALL COLUMNS) */
                <div className="space-y-4">
                  <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-xl text-xs text-indigo-950 space-y-2">
                    <h4 className="font-bold flex items-center gap-1.5 uppercase text-[11px] text-indigo-900 leading-none">
                      <Info className="h-4 w-4" /> Arahan Import Penuh Ahli:
                    </h4>
                    <p className="text-[11px] leading-relaxed">
                      1. Susun kolum fail Excel/Sheets mengikut urutan kolum ahli di bawah.
                      <br />
                      2. Highlight baris data ahli anda, salin (<kbd className="bg-indigo-200 px-1 py-0.2 rounded font-bold font-mono text-[10px]">Ctrl + C</kbd>), dan tampalkan (<kbd className="bg-indigo-200 px-1 py-0.2 rounded font-bold font-mono text-[10px]">Ctrl + V</kbd>) ke dalam zon teks di bawah.
                    </p>

                    <div className="pt-2">
                      <span className="block text-[10px] font-bold text-indigo-805 uppercase tracking-wider mb-1">Turutan Kolum Excel Yang Diperlukan:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-7 gap-1 bg-white p-2 rounded border border-indigo-150 text-center font-mono text-[9px] font-bold overflow-x-auto select-all">
                        <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">1. No. Ahli</span>
                        <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">2. Nama Ahli</span>
                        <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">3. No. IC</span>
                        <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">4. No. Telefon</span>
                        <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">5. Alamat</span>
                        <span className="bg-slate-100 p-1 text-slate-800 border border-slate-200 rounded truncate">6. Status</span>
                        <span className="bg-slate-100 p-1 text-slate-500 border border-slate-200 rounded truncate">7. Catatan</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Zon Tampalan Data Penuh</label>
                    <textarea
                      className="w-full h-32 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono tracking-tight focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Klik di sini kemudian tekan Ctrl+V untuk menampal baris data ahli dari Google Sheets / Excel..."
                      value={bulkPasteText}
                      onChange={(e) => handleParseBulkText(e.target.value, 'all')}
                    />
                  </div>

                  {parsingError && (
                    <div className="p-3 bg-rose-50 border border-rose-250 text-rose-800 rounded font-bold text-xs flex items-center gap-2">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                      <span>{parsingError}</span>
                    </div>
                  )}

                  {parsedRows.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-205">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          Pratinjau Data Dikesan ({parsedRows.length} baris)
                        </h4>
                      </div>

                      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded">
                        <table className="w-full text-left table-auto text-xs">
                          <thead className="bg-[#f8fafc] text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 w-20 text-center">No. Ahli</th>
                              <th className="px-3 py-2">Nama Ahli</th>
                              <th className="px-3 py-2 text-center w-32">No. IC</th>
                              <th className="px-3 py-2 text-center w-28">No. Tel</th>
                              <th className="px-3 py-2">Alamat</th>
                              <th className="px-3 py-2 text-center w-20">Status</th>
                              <th className="px-3 py-2 text-center w-24">Tindakan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 font-sans">
                            {parsedRows.map((row, index) => (
                              <tr key={index} className="hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-1.5 text-center font-mono font-bold">{row.noAhli}</td>
                                <td className="px-3 py-1.5 font-bold text-slate-800 truncate max-w-[140px]">{row.nama}</td>
                                <td className="px-3 py-1.5 text-center font-mono">{row.ic || '-'}</td>
                                <td className="px-3 py-1.5 text-center font-mono">{row.tel || '-'}</td>
                                <td className="px-3 py-1.5 text-slate-500 truncate max-w-[160px]">{row.alamat || '-'}</td>
                                <td className="px-3 py-1.5 text-center">
                                  <span className={`inline-flex px-1.5 py-0.2 rounded font-bold text-[9px] uppercase ${row.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-150 text-slate-600'}`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  {row.existsLocally ? (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100">
                                      Kemaskini
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-sky-605 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-100">
                                      Ahli Baru
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-150">
                <div className="text-[11px] text-slate-500 font-sans">
                  {bulkMode === 'ic_tel' ? (
                    <span>
                      {parsedRows.filter(r => r.existsLocally).length} daripada {parsedRows.length} baris sedia untuk dikemaskini.
                    </span>
                  ) : (
                    <span>
                      {parsedRows.length} rekod sedia untuk dimasukkan/dikemas kini.
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkPasteModal(false);
                      setBulkPasteText('');
                      setParsedRows([]);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer font-sans transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBulkPaste}
                    disabled={parsedRows.length === 0 || (bulkMode === 'ic_tel' && parsedRows.filter(r => r.existsLocally).length === 0)}
                    className={`px-5 py-2 text-white text-xs font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm transition disabled:opacity-40 font-sans ${
                      bulkMode === 'ic_tel'
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : 'bg-indigo-700 hover:bg-indigo-800'
                    }`}
                  >
                    <Check className="h-4 w-4" /> 
                    <span>
                      {bulkMode === 'ic_tel' 
                        ? `Sahkan & Kemaskini IC & Tel (${parsedRows.filter(r => r.existsLocally).length} Ahli)` 
                        : 'Sahkan & Masukkan Rekod Pukal'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="member-toast"
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
              <AlertCircle className="h-4.5 w-4.5 text-rose-600" />
            )}
          </div>
          <p className="text-[11px] font-bold leading-relaxed">{toastMessage.text}</p>
          <button onClick={() => setToastMessage(null)} className="ml-auto text-slate-400 hover:text-slate-650 font-bold p-0.5 ml-2 text-sm">&times;</button>
        </div>
      )}

      {/* Info Alert Dialog Overlay */}
      {customAlertText && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white rounded border border-slate-200 shadow-xl max-w-sm w-full flex flex-col overflow-hidden text-left font-sans">
            <div className="bg-[#1e1b4b] text-white p-3 flex justify-between items-center bg-indigo-950">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Info className="h-4 w-4 text-indigo-300" />
                Makluman
              </h3>
              <button onClick={() => setCustomAlertText(null)} className="text-slate-400 hover:text-white cursor-pointer p-0.5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 text-xs font-semibold text-slate-850 leading-relaxed whitespace-pre-line font-sans">
              {customAlertText}
            </div>
            <div className="bg-slate-50 p-2.5 flex justify-end">
              <button
                onClick={() => setCustomAlertText(null)}
                className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-805 text-white text-[10px] font-bold rounded uppercase cursor-pointer transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK MEMBER IMPORT CONFIRMATION MODAL */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full flex flex-col overflow-hidden text-left font-sans">
            <div className={`text-white p-4 flex justify-between items-center ${
              bulkMode === 'ic_tel' ? 'bg-emerald-900' : 'bg-indigo-950'
            }`}>
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                {bulkMode === 'ic_tel' ? (
                  <>
                    <Phone className="h-4.5 w-4.5 text-emerald-300" />
                    <span>Sahkan Kemaskini IC & No. Telefon</span>
                  </>
                ) : (
                  <>
                    <Users className="h-4.5 w-4.5 text-indigo-300" />
                    <span>Sahkan Pengemaskinian Pukal</span>
                  </>
                )}
              </h3>
              <button onClick={() => setShowBulkConfirmModal(false)} className="text-slate-300 hover:text-white cursor-pointer select-none">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {bulkMode === 'ic_tel' ? (
                <>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">
                    Adakah anda pasti mahu mengemaskini No. Kad Pengenalan dan No. Telefon bagi <strong className="text-emerald-700 font-extrabold">{parsedRows.filter(r => r.existsLocally).length} rekod ahli</strong> yang ditemui?
                  </p>
                  
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-lg text-[10.5px] leading-relaxed flex gap-2 font-medium font-sans">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      <strong>Jaminan Keselamatan Data:</strong> Maklumat alamat kediaman, nama ahli, senarai tanggungan, status keahlian, dan buku lejar bayaran yuran TIDAK akan dipadam atau diubah.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">
                    Adakah anda pasti mahu mengimport & mengemaskini sebanyak <strong className="text-indigo-700 font-extrabold">{parsedRows.length} rekod ahli</strong> ke dalam pangkalan data ahli secara pukal?
                  </p>
                  
                  <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-950 rounded-lg text-[10px] leading-relaxed flex gap-2 font-bold font-sans">
                    <Info className="h-4.5 w-4.5 text-indigo-700 shrink-0" />
                    <span>Info: Sekiranya No. Ahli sudah wujud, data ahli yang sedia ada akan dikemaskini. Rekod lejar baharu juga akan dibina bagi ahli yang baharu didaftarkan.</span>
                  </div>
                </>
              )}
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 hover:text-slate-800 text-[10px] font-bold rounded-lg uppercase cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeSaveBulkPaste}
                className={`px-4 py-2 text-white text-[10px] font-black rounded-lg uppercase cursor-pointer flex items-center gap-1.5 transition-colors shadow-sm ${
                  bulkMode === 'ic_tel'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-indigo-700 hover:bg-indigo-800'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                <span>{bulkMode === 'ic_tel' ? 'Ya, Sahkan Kemaskini IC & Tel' : 'Ya, Sahkan Import'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
