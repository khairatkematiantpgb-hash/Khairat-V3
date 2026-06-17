/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Member, LedgerRow, AppState, MONTH_KEYS } from '../types';
import { defaultMembers, defaultLedger } from './defaultData';

const STATE_KEY = 'khairat_gong_badak';

// Helper to normalize the member ID (e.g., '1' -> '001', 'G2' -> 'G2')
export function normalizeMemberId(id: string | number | undefined | null): string {
  if (id === undefined || id === null) return '';
  const clean = id.toString().trim();
  // Strip starting single quote if present (sometimes Excel/CSV adds it for formatting)
  let base = clean;
  if (base.startsWith("'")) base = base.substring(1);
  if (base.endsWith("'")) base = base.substring(0, base.length - 1);
  base = base.trim();

  if (/^\d+$/.test(base)) {
    return base.padStart(3, '0');
  }
  return base;
}

// Loose equality check for member IDs to ignore leading zeros
export function isSameMemberId(id1: string | number | undefined | null, id2: string | number | undefined | null): boolean {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  return normalizeMemberId(id1) === normalizeMemberId(id2);
}

// Helper to merge duplicate members and ledger rows that result from conversion of '1' and '001'
export function mergeDuplicateMembersAndLedgers(members: Member[], ledger: LedgerRow[]): { members: Member[]; ledger: LedgerRow[] } {
  // 1. Normalize all Member IDs first
  const normalizedMembers = members.map(m => ({
    ...m,
    noAhli: normalizeMemberId(m.noAhli)
  }));

  const normalizedLedger = ledger.map(l => ({
    ...l,
    noAhli: normalizeMemberId(l.noAhli)
  }));

  // 2. Group members by normalized noAhli
  const memberGroups: { [key: string]: Member[] } = {};
  normalizedMembers.forEach(m => {
    if (!m.noAhli) return;
    if (!memberGroups[m.noAhli]) {
      memberGroups[m.noAhli] = [];
    }
    memberGroups[m.noAhli].push(m);
  });

  const mergedMembers: Member[] = [];
  Object.keys(memberGroups).forEach(id => {
    const list = memberGroups[id];
    if (list.length === 1) {
      mergedMembers.push(list[0]);
    } else {
      // Find the best description member (ignore simple 'x' placeholders if we have descriptive data)
      let best = list[0];
      let bestScore = -1;

      list.forEach(m => {
        let score = 0;
        const nameClean = m.nama.trim().toLowerCase();
        const icClean = m.ic.trim().toLowerCase();
        const alamatClean = m.alamat.trim().toLowerCase();

        if (nameClean && nameClean !== 'x' && nameClean !== 'test' && nameClean !== 'tiada') score += 10;
        if (icClean && icClean !== 'x' && icClean !== 'test' && icClean !== 'tiada') score += 10;
        if (alamatClean && alamatClean !== 'x' && alamatClean !== 'test' && alamatClean !== 'tiada') score += 10;
        
        if (m.status === 'Aktif') score += 5;
        
        score += m.nama.length * 0.1;
        score += m.ic.length * 0.1;

        if (score > bestScore) {
          bestScore = score;
          best = m;
        }
      });

      const mergedMember: Member = { ...best };
      // Gather any non-'x' details from others if the selected best had them as 'x'
      list.forEach(m => {
        const nameClean = m.nama.trim().toLowerCase();
        if ((mergedMember.nama.toLowerCase() === 'x' || !mergedMember.nama) && nameClean && nameClean !== 'x') {
          mergedMember.nama = m.nama;
        }
        const icClean = m.ic.trim().toLowerCase();
        if ((mergedMember.ic.toLowerCase() === 'x' || !mergedMember.ic) && icClean && icClean !== 'x') {
          mergedMember.ic = m.ic;
        }
        const alamatClean = m.alamat.trim().toLowerCase();
        if ((mergedMember.alamat.toLowerCase() === 'x' || !mergedMember.alamat) && alamatClean && alamatClean !== 'x') {
          mergedMember.alamat = m.alamat;
        }
      });
      mergedMembers.push(mergedMember);
    }
  });

  // 3. Group and merge ledger rows by noAhli and tahun
  const ledgerGroups: { [key: string]: LedgerRow[] } = {};
  normalizedLedger.forEach(l => {
    if (!l.noAhli) return;
    const key = `${l.noAhli}-${l.tahun}`;
    if (!ledgerGroups[key]) {
      ledgerGroups[key] = [];
    }
    ledgerGroups[key].push(l);
  });

  const mergedLedger: LedgerRow[] = [];
  Object.keys(ledgerGroups).forEach(key => {
    const list = ledgerGroups[key];
    const [noAhli, tahunStr] = key.split('-');
    const tahun = parseInt(tahunStr, 10);

    if (list.length === 1) {
      mergedLedger.push(list[0]);
    } else {
      const mergedRow: LedgerRow = { ...list[0] };
      const months: (keyof LedgerRow)[] = ['jan', 'feb', 'mac', 'apr', 'mei', 'jun', 'jul', 'ogo', 'sep', 'okt', 'nov', 'dis'];
      let maxCredit = mergedRow.lebihanKredit || 0;
      
      list.forEach((row, idx) => {
        if (idx === 0) return;
        months.forEach(mKey => {
          if (!mergedRow[mKey] && row[mKey]) {
            // @ts-ignore
            mergedRow[mKey] = row[mKey];
          }
        });
        if ((row.lebihanKredit || 0) > maxCredit) {
          maxCredit = row.lebihanKredit;
        }
      });
      mergedRow.lebihanKredit = maxCredit;

      const matchingMember = mergedMembers.find(m => m.noAhli === noAhli);
      if (matchingMember) {
        mergedRow.namaAhli = matchingMember.nama;
      }
      mergedLedger.push(mergedRow);
    }
  });

  return {
    members: mergedMembers,
    ledger: mergedLedger
  };
}

export function getInitialState(): AppState {
  let cached = localStorage.getItem(STATE_KEY);
  if (!cached) {
    cached = localStorage.getItem('khairat_gong_badak_state_v1');
  }
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.members) && Array.isArray(parsed.ledger)) {
        const { members, ledger } = mergeDuplicateMembersAndLedgers(parsed.members, parsed.ledger);
        return {
          members,
          ledger,
          googleSheetsId: parsed.googleSheetsId || '1sQWxn0TVSjwUZa8KkwzZi0Uv1z7CdW3O-D8rN4kJ6zI',
          appsScriptUrl: parsed.appsScriptUrl || '',
          useGoogleSheets: parsed.useGoogleSheets || false,
          kadarYuranSebulan: typeof parsed.kadarYuranSebulan === 'number' ? parsed.kadarYuranSebulan : 3,
          adminPassword: parsed.adminPassword || 'gongbadak123'
        };
      }
    } catch (e) {
      console.error('Failed to parse cached state:', e);
    }
  }

  // Set default state with sample records
  const { members, ledger } = mergeDuplicateMembersAndLedgers(defaultMembers, defaultLedger);
  return {
    members,
    ledger,
    googleSheetsId: '1sQWxn0TVSjwUZa8KkwzZi0Uv1z7CdW3O-D8rN4kJ6zI',
    appsScriptUrl: '',
    useGoogleSheets: false,
    kadarYuranSebulan: 3,
    adminPassword: 'gongbadak123'
  };
}

export function saveState(state: AppState) {
  const { members, ledger } = mergeDuplicateMembersAndLedgers(state.members, state.ledger);
  const normalizedState = {
    ...state,
    members,
    ledger
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(normalizedState));
}

// Helper to sort the ledger strictly according to the specs
export function sortLedger(ledger: LedgerRow[]): LedgerRow[] {
  return [...ledger].sort((a, b) => {
    // Sort by No. Ahli ascending
    const idCompare = normalizeMemberId(a.noAhli).localeCompare(normalizeMemberId(b.noAhli), undefined, { numeric: true });
    if (idCompare !== 0) return idCompare;
    // Then by Year ascending
    return a.tahun - b.tahun;
  });
}

// Automatically populate missing ledger rows for active members from their earliest record year up to current year
export function fillMissingLedgerRows(members: Member[], ledger: LedgerRow[]): LedgerRow[] {
  const currentYear = new Date().getFullYear();
  const updatedLedger = [...ledger];
  
  members.forEach(member => {
    if (member.status !== 'Aktif') return;
    
    // Find all ledger rows for this member
    const memberRows = updatedLedger.filter(r => isSameMemberId(r.noAhli, member.noAhli));
    
    if (memberRows.length === 0) {
      // If no records at all, insert for current year
      updatedLedger.push({
        noAhli: normalizeMemberId(member.noAhli),
        namaAhli: member.nama,
        tahun: currentYear,
        jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
        jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
        lebihanKredit: 0
      });
      return;
    }
    
    // Find min year of their ledger rows
    const years = memberRows.map(r => r.tahun);
    const minYear = Math.min(...years);
    
    // Generate missing years from minYear up to currentYear
    for (let yr = minYear; yr <= currentYear; yr++) {
      const exists = memberRows.some(r => r.tahun === yr);
      if (!exists) {
        updatedLedger.push({
          noAhli: normalizeMemberId(member.noAhli),
          namaAhli: member.nama,
          tahun: yr,
          jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
          jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
          lebihanKredit: 0
        });
      }
    }
  });
  
  return sortLedger(updatedLedger);
}

// 1. DAFTAR AHLI BARU (React state implementation)
export function runDaftarAhliBaru(
  state: AppState,
  params: { noAhli: string; nama: string; ic: string; alamat: string; status: string }
): { newState: AppState; error?: string } {
  const { nama, ic, alamat, status } = params;
  const noAhli = normalizeMemberId(params.noAhli);

  // Validation
  if (!nama.trim() || !ic.trim() || !alamat.trim()) {
    return { newState: state, error: 'Sila pastikan Nama, No. Kad Pengenalan, dan Alamat telah diisi!' };
  }
  if (!noAhli) {
    return { newState: state, error: 'Sila isi No. Ahli!' };
  }
  if (!/^\d+$/.test(noAhli)) {
    return { newState: state, error: 'No. Ahli mestilah nombor sahaja (contoh: 001, bukan huruf + nombor)!' };
  }

  // "tidak boleh berundur atau menggunakan no ahli yang lepas"
  const numericIds = state.members
    .map(m => {
      const clean = m.noAhli.replace(/\D/g, '');
      return clean ? parseInt(clean, 10) : 0;
    })
    .filter(id => id > 0);
  const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
  const enteredVal = parseInt(noAhli, 10);

  if (enteredVal <= maxId) {
    return { newState: state, error: `Ralat: No. Ahli tidak boleh berundur atau menggunakan nombor lama yang lepas (Mestilah melebihi ${maxId.toString().padStart(3, '0')})!` };
  }

  // Pendua check
  const exists = state.members.some(m => isSameMemberId(m.noAhli, noAhli));
  if (exists) {
    return { newState: state, error: `Ralat: No. Ahli '${noAhli}' sudah wujud dalam pangkalan data!` };
  }

  const newMember: Member = {
    noAhli,
    nama: nama.trim(),
    ic: ic.trim(),
    alamat: alamat.trim(),
    status: status || 'Aktif'
  };

  const currentYear = new Date().getFullYear();
  const newLedgerRow: LedgerRow = {
    noAhli,
    namaAhli: nama.trim(),
    tahun: currentYear,
    jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
    jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
    lebihanKredit: 0
  };

  const updatedMembers = [...state.members, newMember];
  const updatedLedger = sortLedger([...state.ledger, newLedgerRow]);

  const newState = {
    ...state,
    members: updatedMembers,
    ledger: updatedLedger
  };

  saveState(newState);

  return { newState };
}

// 2. SIMPAN YURAN AHLI (React state implementation of the RM3/month allocation)
export function runSimpanBayaranYuranAhli(
  state: AppState,
  params: { noAhli: string; noResit: string; jumlahBayaran: number }
): { newState: AppState; error?: string } {
  const { noAhli, noResit, jumlahBayaran } = params;

  const cleanNoAhli = normalizeMemberId(noAhli);
  const cleanNoResit = noResit.trim();

  if (!cleanNoAhli || !cleanNoResit || jumlahBayaran <= 0) {
    return { newState: state, error: 'Ralat: Sila isi No. Ahli, No. Resit and Jumlah Bayaran yang sah.' };
  }

  // Find member's name
  const member = state.members.find(m => isSameMemberId(m.noAhli, cleanNoAhli));
  if (!member) {
    return { newState: state, error: `Ralat: No. Ahli '${cleanNoAhli}' tidak dijumpai di dalam pangkalan data ahli!` };
  }

  // Find all ledger rows for this member
  let memberRows = state.ledger
    .map((row, index) => ({ row, originalIndex: index }))
    .filter(item => isSameMemberId(item.row.noAhli, cleanNoAhli));

  // If no ledger rows exist, initialize first row
  if (memberRows.length === 0) {
    const currentYear = new Date().getFullYear();
    const initialRow: LedgerRow = {
      noAhli: cleanNoAhli,
      namaAhli: member.nama,
      tahun: currentYear,
      jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
      jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
      lebihanKredit: 0
    };
    
    const newLedger = [...state.ledger, initialRow];
    state.ledger = sortLedger(newLedger);
    // Re-grab rows after sorting
    memberRows = state.ledger
      .map((row, index) => ({ row, originalIndex: index }))
      .filter(item => isSameMemberId(item.row.noAhli, cleanNoAhli));
  }

  // Sort rows by year ascending
  memberRows.sort((a, b) => a.row.tahun - b.row.tahun);

  // Retrieve total old credit and flush old credits to 0
  let totalOldCredit = 0;
  const ledgerCopy = JSON.parse(JSON.stringify(state.ledger)) as LedgerRow[];

  memberRows.forEach(item => {
    const freshRow = ledgerCopy.find(r => isSameMemberId(r.noAhli, cleanNoAhli) && r.tahun === item.row.tahun);
    if (freshRow) {
      totalOldCredit += freshRow.lebihanKredit;
      freshRow.lebihanKredit = 0;
    }
  });

  const kadarYuran = state.kadarYuranSebulan || 3;
  const totalAvailableFunds = totalOldCredit + jumlahBayaran;
  let monthsEarned = Math.floor(totalAvailableFunds / kadarYuran);
  const remainingCreditChange = totalAvailableFunds % kadarYuran;

  let mIdx = 0;
  
  while (monthsEarned > 0) {
    let currentRow: LedgerRow | undefined = undefined;

    if (mIdx < memberRows.length) {
      const yearToTarget = memberRows[mIdx].row.tahun;
      currentRow = ledgerCopy.find(r => isSameMemberId(r.noAhli, cleanNoAhli) && r.tahun === yearToTarget);
    } else {
      // Kehabisan tahun, buat tahun baru
      const maxYear = Math.max(...ledgerCopy.filter(r => isSameMemberId(r.noAhli, cleanNoAhli)).map(r => r.tahun));
      const nextYear = maxYear + 1;
      
      const newYearRow: LedgerRow = {
        noAhli: cleanNoAhli,
        namaAhli: member.nama,
        tahun: nextYear,
        jan: '', feb: '', mac: '', apr: '', mei: '', jun: '',
        jul: '', ogo: '', sep: '', okt: '', nov: '', dis: '',
        lebihanKredit: 0
      };
      
      ledgerCopy.push(newYearRow);
      currentRow = newYearRow;
    }

    if (currentRow) {
      // Fill empty slots chronologically
      for (const key of MONTH_KEYS) {
        if (monthsEarned === 0) break;
        if (!currentRow[key]) {
          (currentRow[key] as string) = cleanNoResit;
          monthsEarned--;
        }
      }
    }

    mIdx++;
  }

  // Update final row's credit
  const remainingRows = ledgerCopy.filter(r => isSameMemberId(r.noAhli, cleanNoAhli));
  remainingRows.sort((a, b) => a.tahun - b.tahun);
  const finalRow = remainingRows[remainingRows.length - 1];
  if (finalRow) {
    finalRow.lebihanKredit = remainingCreditChange;
  }

  const newState = {
    ...state,
    ledger: sortLedger(ledgerCopy)
  };

  saveState(newState);

  return { newState };
}

// 3. KEMASKINI MAKLUMAT AHLI (React state implementation)
export function runKemaskiniMaklumatAhli(
  state: AppState,
  params: {
    noAhli: string;
    namaBaru: string;
    icBaru: string;
    alamatBaru: string;
    statusBaru: string;
    catatanBaru?: string;
  }
): { newState: AppState; error?: string } {
  const { noAhli, namaBaru, icBaru, alamatBaru, statusBaru, catatanBaru } = params;

  const cleanNoAhli = normalizeMemberId(noAhli);
  if (!cleanNoAhli) {
    return { newState: state, error: 'Sila masukkan No. Ahli terlebih dahulu!' };
  }

  const isCatatanNew = catatanBaru !== undefined;
  if (!namaBaru.trim() && !icBaru.trim() && !alamatBaru.trim() && !statusBaru.trim() && (!isCatatanNew)) {
    return { newState: state, error: 'Sila masukkan sekurang-kurangnya satu medan maklumat baru!' };
  }

  const memberIndex = state.members.findIndex(m => isSameMemberId(m.noAhli, cleanNoAhli));
  if (memberIndex === -1) {
    return { newState: state, error: `Ralat: No. Ahli '${cleanNoAhli}' tidak dijumpai di Pangkalan Data Ahli!` };
  }

  const updatedMembers = [...state.members];
  const targetMember = { ...updatedMembers[memberIndex] };

  if (namaBaru.trim()) targetMember.nama = namaBaru.trim();
  if (icBaru.trim()) targetMember.ic = icBaru.trim();
  if (alamatBaru.trim()) targetMember.alamat = alamatBaru.trim();
  if (statusBaru.trim()) targetMember.status = statusBaru.trim();
  if (catatanBaru !== undefined) targetMember.catatan = catatanBaru.trim();

  updatedMembers[memberIndex] = targetMember;

  // Sync nama in Ledger
  let updatedLedger = [...state.ledger];
  if (namaBaru.trim()) {
    updatedLedger = updatedLedger.map(row => {
      if (isSameMemberId(row.noAhli, cleanNoAhli)) {
        return { ...row, namaAhli: namaBaru.trim() };
      }
      return row;
    });
  }

  const newState = {
    ...state,
    members: updatedMembers,
    ledger: updatedLedger
  };

  saveState(newState);

  return { newState };
}

// 4. PADAM AHLI (Both DB and Ledger)
export function runPadamAhli(state: AppState, noAhli: string): AppState {
  const cleanNoAhli = normalizeMemberId(noAhli);
  const updatedMembers = state.members.filter(m => !isSameMemberId(m.noAhli, cleanNoAhli));
  const updatedLedger = state.ledger.filter(l => !isSameMemberId(l.noAhli, cleanNoAhli));

  const newState = {
    ...state,
    members: updatedMembers,
    ledger: updatedLedger
  };

  saveState(newState);
  return newState;
}

// 5. PADAM SEMUA DATA (Keluarkan data kosong)
export function runPadamSemuaData(state: AppState): AppState {
  const newState = {
    ...state,
    members: [],
    ledger: []
  };
  saveState(newState);
  return newState;
}

// 6. CALC OUTSTANDING DUES (Yuran tunggakan dikira berdasarkan kepada jumlah belum bayar dengan bulan pada tahun semasa)
export function calculateOutstandingDues(noAhli: string, ledger: LedgerRow[], members?: Member[], kadarYuran: number = 3, targetYear?: number): number {
  const cleanNoAhli = normalizeMemberId(noAhli);
  if (members) {
    const member = members.find(m => isSameMemberId(m.noAhli, cleanNoAhli));
    if (member && member.status === 'Tidak Aktif') {
      return 0;
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-indexed (0=Jan, 5=Jun for June)

  const monthsKeys: (keyof LedgerRow)[] = [
    'jan', 'feb', 'mac', 'apr', 'mei', 'jun',
    'jul', 'ogo', 'sep', 'okt', 'nov', 'dis'
  ];

  // Helper to check if they have paid any month beyond current month of current year, or any month in a year > currentYear.
  // "Ahli yang membayar lebih daripada bulan terkini tidak lagi ada tunggakan."
  const hasPaidBeyond = () => {
    const currentYearRow = ledger.find(r => isSameMemberId(r.noAhli, cleanNoAhli) && r.tahun === currentYear);
    if (currentYearRow) {
      for (let i = currentMonthIdx + 1; i < 12; i++) {
        if (currentYearRow[monthsKeys[i]]) {
          return true;
        }
      }
    }

    const futureYearRows = ledger.filter(r => isSameMemberId(r.noAhli, cleanNoAhli) && r.tahun > currentYear);
    if (futureYearRows.length > 0) {
      for (const row of futureYearRows) {
        for (let i = 0; i < 12; i++) {
          if (row[monthsKeys[i]]) {
            return true;
          }
        }
      }
    }
    return false;
  };

  if (hasPaidBeyond()) {
    return 0; // No arrears if paid up to or beyond current month
  }

  // Helper to count unpaid months in a specific year
  const countUnpaidInYear = (yr: number): number => {
    const row = ledger.find(r => isSameMemberId(r.noAhli, cleanNoAhli) && r.tahun === yr);
    let unpaid = 0;
    const limit = yr === currentYear ? currentMonthIdx : 11;
    for (let i = 0; i <= limit; i++) {
      const key = monthsKeys[i];
      const cellValue = row ? row[key] : '';
      if (!cellValue) {
        unpaid++;
      }
    }
    return unpaid;
  };

  if (targetYear !== undefined) {
    if (targetYear > currentYear) {
      return 0;
    }
    return countUnpaidInYear(targetYear) * kadarYuran;
  }

  // Calculate global/overall dues across all relevant years
  const memberLedgerRows = ledger.filter(r => isSameMemberId(r.noAhli, cleanNoAhli));
  if (memberLedgerRows.length === 0) {
    // No payment records at all. They owe for current year up to current month.
    return (currentMonthIdx + 1) * kadarYuran;
  }

  const years = memberLedgerRows.map(r => r.tahun);
  const minYear = Math.min(...years);

  let totalUnpaid = 0;
  for (let yr = minYear; yr <= currentYear; yr++) {
    totalUnpaid += countUnpaidInYear(yr);
  }

  return totalUnpaid * kadarYuran;
}

// ============================================
// LIVE GOOGLE SHEET SYNC ACTIONS (FOR CALLING GOOGLE APPS SCRIPT WEB APP)
// ============================================

export async function fetchFromAppsScript(url: string): Promise<{ members: Member[]; ledger: LedgerRow[] } | null> {
  try {
    const fetchUrl = `${url}?action=getData`;
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error('Pelayan gagal membalas.');
    const data = await res.json();
    if (data && Array.isArray(data.members) && Array.isArray(data.ledger)) {
      const { members, ledger } = mergeDuplicateMembersAndLedgers(data.members, data.ledger);
      return {
        members,
        ledger
      };
    }
    return null;
  } catch (e) {
    console.error('Failed to sync from Apps Script:', e);
    throw e;
  }
}

export async function writeToAppsScript(
  url: string,
  payload: any
): Promise<{ success: boolean; data?: { members: Member[]; ledger: LedgerRow[] }; message?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Bypass preflight CORS constraints in Apps Script Web Apps
      },
      mode: 'cors'
    });
    
    const data = await res.json();
    if (data && data.status === 'success') {
      let responseData = data.data;
      if (responseData && Array.isArray(responseData.members) && Array.isArray(responseData.ledger)) {
        const { members, ledger } = mergeDuplicateMembersAndLedgers(responseData.members, responseData.ledger);
        responseData.members = members;
        responseData.ledger = ledger;
      }
      return {
        success: true,
        data: responseData,
        message: data.message
      };
    }
    return {
      success: false,
      message: data?.message || 'Tindak balas tidak diketahui'
    };
  } catch (e: any) {
    console.error('Failed to write to Apps Script:', e);
    return {
      success: false,
      message: e.message || 'Ralat sambungan rangkaian'
    };
  }
}
