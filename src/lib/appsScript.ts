/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const APPS_SCRIPT_CODE = `/**
 * Google Apps Script Web App - Integrasi Dwi-Hala Sistem Khairat Gong Badak
 * 
 * Sila salin keseluruhan kod ini ke Editor Apps Script Google Sheets anda:
 * Extensions > Apps Script
 * 
 * Pastikan nama tab atau helaian anda di Google Sheets adalah:
 * 1. "Pangkalan Data Ahli"  - (Mengandungi Lajur: No. Ahli, Nama, No. IC, Alamat, Status, Catatan, Tanggungan, No. Telefon)
 * 2. "Rekod Jadual Pembayaran (Lejar)" - (Mengandungi Lajur: No. Ahli, Nama, Tahun, JAN, FEB, MAC, APR, MEI, JUN, JUL, OGO, SEP, OKT, NOV, DIS, Lebih)
 * 3. "Penyata Kira-Kira (Kewangan)" - (Mengandungi Lajur: ID, Tarikh, Kenyataan, Kategori Akaun, Jenis Transaksi, Amaun)
 */

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Tab Pangkalan Data Ahli jika belum ada
  let sheetAhli = ss.getSheetByName("Pangkalan Data Ahli");
  if (!sheetAhli) {
    sheetAhli = ss.insertSheet("Pangkalan Data Ahli");
    sheetAhli.appendRow(["No. Ahli", "Nama", "No. IC", "Alamat", "Status", "Catatan", "Tanggungan", "No. Telefon"]);
    sheetAhli.getRange("A1:H1").setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
    sheetAhli.setFrozenRows(1);
  } else {
    // Pastikan pengepala mempunyai sekurang-kurangnya 8 kolum termasuk Tanggungan & No. Telefon
    const lastCol = sheetAhli.getLastColumn();
    if (lastCol < 7) {
      sheetAhli.getRange(1, 7).setValue("Tanggungan");
      sheetAhli.getRange("G1").setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
    }
    if (lastCol < 8) {
      sheetAhli.getRange(1, 8).setValue("No. Telefon");
      sheetAhli.getRange("H1").setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
    }
  }
  
  // 2. Setup Tab Rekod Jadual Pembayaran jika belum ada
  let sheetLejar = ss.getSheetByName("Rekod Jadual Pembayaran (Lejar)");
  if (!sheetLejar) {
    sheetLejar = ss.insertSheet("Rekod Jadual Pembayaran (Lejar)");
    sheetLejar.appendRow(["No. Ahli", "Nama", "Tahun", "JAN", "FEB", "MAC", "APR", "MEI", "JUN", "JUL", "OGO", "SEP", "OKT", "NOV", "DIS", "Lebih"]);
    sheetLejar.getRange("A1:P1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
    sheetLejar.setFrozenRows(1);
  }

  // 3. Setup Tab Penyata Kira-Kira jika belum ada
  let sheetKewangan = ss.getSheetByName("Penyata Kira-Kira (Kewangan)");
  if (!sheetKewangan) {
    sheetKewangan = ss.insertSheet("Penyata Kira-Kira (Kewangan)");
    sheetKewangan.appendRow(["ID", "Tarikh", "Kenyataan", "Kategori Akaun", "Jenis Transaksi", "Amaun"]);
    sheetKewangan.getRange("A1:F1").setBackground("#475569").setFontColor("#ffffff").setFontWeight("bold");
    sheetKewangan.setFrozenRows(1);
  }
}

// Buka akses CORS dengan membalas respons yang betul
function replyJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  
  if (action === "getData") {
    try {
      const sheetAhli = ss.getSheetByName("Pangkalan Data Ahli");
      const sheetLejar = ss.getSheetByName("Rekod Jadual Pembayaran (Lejar)");
      const sheetKewangan = ss.getSheetByName("Penyata Kira-Kira (Kewangan)");
      
      // Ambil Rekod Ahli
      const dataAhli = sheetAhli.getDataRange().getValues();
      const members = [];
      for (let i = 1; i < dataAhli.length; i++) {
        if (!dataAhli[i][0]) continue;
        let tanggungan = [];
        if (dataAhli[i].length > 6 && dataAhli[i][6]) {
          try {
            tanggungan = JSON.parse(String(dataAhli[i][6]));
          } catch(e) {}
        }
        let tel = "";
        if (dataAhli[i].length > 7 && dataAhli[i][7]) {
          tel = String(dataAhli[i][7]);
        }
        members.push({
          noAhli: String(dataAhli[i][0]),
          nama: String(dataAhli[i][1]),
          ic: String(dataAhli[i][2]),
          alamat: String(dataAhli[i][3]),
          status: String(dataAhli[i][4]),
          catatan: String(dataAhli[i][5] || ""),
          tanggungan: Array.isArray(tanggungan) ? tanggungan : [],
          tel: tel
        });
      }
      
      // Ambil Rekod Lejar
      const dataLejar = sheetLejar.getDataRange().getValues();
      const ledger = [];
      const monthKeys = ["jan", "feb", "mac", "apr", "mei", "jun", "jul", "ogo", "sep", "okt", "nov", "dis"];
      
      for (let i = 1; i < dataLejar.length; i++) {
        if (!dataLejar[i][0]) continue;
        const row = {
          noAhli: String(dataLejar[i][0]),
          namaAhli: String(dataLejar[i][1]),
          tahun: Number(dataLejar[i][2]) || new Date().getFullYear(),
          jan: "", feb: "", mac: "", apr: "", mei: "", jun: "",
          jul: "", ogo: "", sep: "", okt: "", nov: "", dis: "",
          lebihanKredit: Number(dataLejar[i][15]) || 0
        };
        
        // Pautkan resit bulanan
        for (let m = 0; m < 12; m++) {
          row[monthKeys[m]] = String(dataLejar[i][3 + m] || "");
        }
        ledger.push(row);
      }

      // Ambil Rekod Penyata Kira-Kira (Kewangan)
      const kewangan = [];
      if (sheetKewangan) {
        const dataKewangan = sheetKewangan.getDataRange().getValues();
        for (let i = 1; i < dataKewangan.length; i++) {
          if (!dataKewangan[i][0]) continue;
          let tarikhVal = dataKewangan[i][1];
          let tarikhStr = "";
          if (tarikhVal instanceof Date) {
            tarikhStr = Utilities.formatDate(tarikhVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else {
            tarikhStr = String(tarikhVal);
          }
          kewangan.push({
            id: String(dataKewangan[i][0]),
            tarikh: tarikhStr,
            kenyataan: String(dataKewangan[i][2]),
            kategoriAkaun: String(dataKewangan[i][3]),
            jenisTransaksi: String(dataKewangan[i][4]),
            amaun: Number(dataKewangan[i][5]) || 0
          });
        }
      }
      
      return replyJSON({
        status: "success",
        spreadsheetId: ss.getId(),
        members: members,
        ledger: ledger,
        kewangan: kewangan
      });
    } catch (err) {
      return replyJSON({ status: "error", message: err.toString() });
    }
  }
  
  return replyJSON({ status: "error", message: "Aksi GET tidak ditemui." });
}

function doPost(e) {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return replyJSON({ status: "error", message: "Payload JSON tidak sah." });
  }
  
  const action = payload.action;
  const sheetAhli = ss.getSheetByName("Pangkalan Data Ahli");
  const sheetLejar = ss.getSheetByName("Rekod Jadual Pembayaran (Lejar)");
  const sheetKewangan = ss.getSheetByName("Penyata Kira-Kira (Kewangan)");
  
  if (action === "padamAhli") {
    const noAhli = String(payload.noAhli);
    
    // Padam dalam Ahli
    const dataAhli = sheetAhli.getDataRange().getValues();
    for (let i = dataAhli.length - 1; i >= 1; i--) {
      if (String(dataAhli[i][0]) === noAhli) {
        sheetAhli.deleteRow(i + 1);
      }
    }
    
    // Padam dalam Lejar
    const dataLejar = sheetLejar.getDataRange().getValues();
    for (let i = dataLejar.length - 1; i >= 1; i--) {
      if (String(dataLejar[i][0]) === noAhli) {
        sheetLejar.deleteRow(i + 1);
      }
    }
    
    return getDirectData(ss, "Berjaya memadam ahli " + noAhli);
  }
  
  if (action === "padamSemuaData") {
    // Kosongkan seluruh rekod kecuali baris pengepala (header)
    if (sheetAhli.getLastRow() > 1) {
      sheetAhli.getRange(2, 1, sheetAhli.getLastRow() - 1, sheetAhli.getLastColumn()).clearContent();
    }
    if (sheetLejar.getLastRow() > 1) {
      sheetLejar.getRange(2, 1, sheetLejar.getLastRow() - 1, sheetLejar.getLastColumn()).clearContent();
    }
    if (sheetKewangan && sheetKewangan.getLastRow() > 1) {
      sheetKewangan.getRange(2, 1, sheetKewangan.getLastRow() - 1, sheetKewangan.getLastColumn()).clearContent();
    }
    
    return getDirectData(ss, "Seluruh pangkalan data telah dikosongkan.");
  }
  
  if (action === "syncLocalToSheets") {
    try {
      // 1. Kosongkan semua data lama terlebih dahulu menggunakan clearContent bagi mengelakkan ralat Google Sheets
      if (sheetAhli.getLastRow() > 1) {
        sheetAhli.getRange(2, 1, sheetAhli.getLastRow() - 1, sheetAhli.getLastColumn()).clearContent();
      }
      if (sheetLejar.getLastRow() > 1) {
        sheetLejar.getRange(2, 1, sheetLejar.getLastRow() - 1, sheetLejar.getLastColumn()).clearContent();
      }
      if (sheetKewangan && sheetKewangan.getLastRow() > 1) {
        sheetKewangan.getRange(2, 1, sheetKewangan.getLastRow() - 1, sheetKewangan.getLastColumn()).clearContent();
      }
      
      // 2. Tulis Senarai Ahli Baru
      const members = payload.members || [];
      if (members.length > 0) {
        const rowsAhli = members.map(m => [
          m.noAhli, m.nama, m.ic, m.alamat, m.status, m.catatan || "", JSON.stringify(m.tanggungan || []), m.tel || ""
        ]);
        sheetAhli.getRange(2, 1, rowsAhli.length, 8).setValues(rowsAhli);
      }
      
      // 3. Tulis Rekod Lejar Baru
      const ledger = payload.ledger || [];
      if (ledger.length > 0) {
        const monthKeys = ["jan", "feb", "mac", "apr", "mei", "jun", "jul", "ogo", "sep", "okt", "nov", "dis"];
        const rowsLejar = ledger.map(l => {
          const rowArr = [l.noAhli, l.namaAhli, l.tahun];
          monthKeys.forEach(k => {
            rowArr.push(l[k] || "");
          });
          rowArr.push(l.lebihanKredit || 0);
          return rowArr;
        });
        sheetLejar.getRange(2, 1, rowsLejar.length, 16).setValues(rowsLejar);
      }

      // 4. Tulis Rekod Kewangan (Penyata Kira-Kira) Baru
      const kewangan = payload.kewangan || [];
      if (kewangan.length > 0 && sheetKewangan) {
        const rowsKewangan = kewangan.map(k => [
          k.id, k.tarikh, k.kenyataan, k.kategoriAkaun, k.jenisTransaksi, Number(k.amaun) || 0
        ]);
        sheetKewangan.getRange(2, 1, rowsKewangan.length, 6).setValues(rowsKewangan);
      }
      
      return getDirectData(ss, "Penyegerakan tempatan ke Cloud dwi-hala berjaya.");
    } catch (err) {
      return replyJSON({ status: "error", message: err.toString() });
    }
  }
  
  return replyJSON({ status: "error", message: "Aksi POST tidak ditemui." });
}

// Pembantu untuk mengembalikan status live selepas aksi update
function getDirectData(ss, infoMessage) {
  const sheetAhli = ss.getSheetByName("Pangkalan Data Ahli");
  const sheetLejar = ss.getSheetByName("Rekod Jadual Pembayaran (Lejar)");
  const sheetKewangan = ss.getSheetByName("Penyata Kira-Kira (Kewangan)");
  
  const dataAhli = sheetAhli.getDataRange().getValues();
  const members = [];
  for (let i = 1; i < dataAhli.length; i++) {
    if (!dataAhli[i][0]) continue;
    let tanggungan = [];
    if (dataAhli[i].length > 6 && dataAhli[i][6]) {
      try {
        tanggungan = JSON.parse(String(dataAhli[i][6]));
      } catch(e) {}
    }
    let tel = "";
    if (dataAhli[i].length > 7 && dataAhli[i][7]) {
      tel = String(dataAhli[i][7]);
    }
    members.push({
      noAhli: String(dataAhli[i][0]),
      nama: String(dataAhli[i][1]),
      ic: String(dataAhli[i][2]),
      alamat: String(dataAhli[i][3]),
      status: String(dataAhli[i][4]),
      catatan: String(dataAhli[i][5] || ""),
      tanggungan: Array.isArray(tanggungan) ? tanggungan : [],
      tel: tel
    });
  }
  
  const dataLejar = sheetLejar.getDataRange().getValues();
  const ledger = [];
  const monthKeys = ["jan", "feb", "mac", "apr", "mei", "jun", "jul", "ogo", "sep", "okt", "nov", "dis"];
  for (let i = 1; i < dataLejar.length; i++) {
    if (!dataLejar[i][0]) continue;
    const row = {
      noAhli: String(dataLejar[i][0]),
      namaAhli: String(dataLejar[i][1]),
      tahun: Number(dataLejar[i][2]) || new Date().getFullYear(),
      jan: "", feb: "", mac: "", apr: "", mei: "", jun: "",
      jul: "", ogo: "", sep: "", okt: "", nov: "", dis: "",
      lebihanKredit: Number(dataLejar[i][15]) || 0
    };
    for (let m = 0; m < 12; m++) {
      row[monthKeys[m]] = String(dataLejar[i][3 + m] || "");
    }
    ledger.push(row);
  }

  const kewangan = [];
  if (sheetKewangan) {
    const dataKewangan = sheetKewangan.getDataRange().getValues();
    for (let i = 1; i < dataKewangan.length; i++) {
      if (!dataKewangan[i][0]) continue;
      let tarikhVal = dataKewangan[i][1];
      let tarikhStr = "";
      if (tarikhVal instanceof Date) {
        tarikhStr = Utilities.formatDate(tarikhVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        tarikhStr = String(tarikhVal);
      }
      kewangan.push({
        id: String(dataKewangan[i][0]),
        tarikh: tarikhStr,
        kenyataan: String(dataKewangan[i][2]),
        kategoriAkaun: String(dataKewangan[i][3]),
        jenisTransaksi: String(dataKewangan[i][4]),
        amaun: Number(dataKewangan[i][5]) || 0
      });
    }
  }
  
  return replyJSON({
    status: "success",
    message: infoMessage,
    spreadsheetId: ss.getId(),
    data: {
      members: members,
      ledger: ledger,
      kewangan: kewangan
    }
  });
}
`;

export const EXCEL_FORMULA = `=LET(
  ahli, 'Pangkalan Data Ahli'!A2:E200,
  lejar, 'Rekod Jadual Pembayaran (Lejar)'!A2:P200,
  filt_ahli, FILTER(ahli, INDEX(ahli,,1)<>""),
  tahun_ini, YEAR(TODAY()),
  bulan_ini, MONTH(TODAY()),
  laporan, BYROW(filt_ahli, LAMBDA(row,
    LET(
      no, INDEX(row, 1, 1),
      nama, INDEX(row, 1, 2),
      ic, INDEX(row, 1, 3),
      alamat, INDEX(row, 1, 4),
      status, INDEX(row, 1, 5),
      catatan, INDEX(row, 1, 6),
      baris_lejar, FILTER(lejar, (INDEX(lejar,,1)=no)*(INDEX(lejar,,3)=tahun_ini), "TIADA"),
      tunggakan, IF(status="Tidak Aktif", 0, 
        LET(
          jan_ke_kini, INDEX(baris_lejar, 1, SEQUENCE(1, bulan_ini, 4)),
          unpaid_count, COUNTBLANK(jan_ke_kini),
          unpaid_count * 3
        )
      ),
      HSTACK(no, nama, ic, alamat, status, IF(LEN(catatan)>0, catatan, "Sumbangan Khairat"), tunggakan)
    )
  )),
  laporan
)`;

export function getAppsScriptGoogleCode(): string {
  return APPS_SCRIPT_CODE;
}

export async function fetchFromAppsScript(url: string): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const fetchUrl = `${url}?action=getData`;
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error: status ${response.status}`);
    }
    const result = await response.json();
    if (result.status === 'success') {
      return { success: true, data: result };
    } else {
      return { success: false, message: result.message || 'Ralat tidak diketahui.' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Sambungan ke Google Sheet gagal.' };
  }
}

export async function writeToAppsScript(url: string, payload: any): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'follow', // Handles Google Apps Script typical redirect mechanics
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // Handles easy CORS pre-flight bypass
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`HTTP Error: status ${response.status}`);
    }
    const result = await response.json();
    if (result.status === 'success') {
      return { success: true, data: result.data, message: result.message };
    } else {
      return { success: false, message: result.message || 'Ralat memuat naik data.' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Sambungan penghantaran gagal.' };
  }
}

