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
 * 4. "Carta Organisasi" - (Mengandungi Lajur: Jawatan ID, Nama, No. Telefon, No. Ahli)
 * 5. "Pekeliling & Hebahan" - (Mengandungi Lajur: ID, No. Rujukan, Tarikh, Tarikh Berkuatkuasa, Jenis, Tajuk, Kandungan, Penerbit, Jawatan Penerbit, Kepentingan)
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

  // 4. Setup Tab Carta Organisasi jika belum ada
  let sheetCarta = ss.getSheetByName("Carta Organisasi");
  if (!sheetCarta) {
    sheetCarta = ss.insertSheet("Carta Organisasi");
    sheetCarta.appendRow(["Jawatan ID", "Nama", "No. Telefon", "No. Ahli"]);
    sheetCarta.getRange("A1:D1").setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold");
    sheetCarta.setFrozenRows(1);
    
    // Default roles on initial install
    const defaultRoles = [
      ["pengerusi", "LAKSAMANA DATO' PAHLAWAN HJ. SULAIMAN BIN MOHAMAD (B)", "013-5871409", ""],
      ["timb_pengerusi", "IR. HJ. ABDUL RAHIM BIN JAAFAR", "019-5581192", ""],
      ["setiausaha", "HJ. SALLEH BIN HASHIM", "019-5514670", ""],
      ["pen_setiausaha", "HJ. AHMAD BIN HAMZAH", "012-4565905", ""],
      ["bendahari", "HJ. JAMALUDDIN BIN MOHAMAD", "013-4842213", ""],
      ["pemeriksa_kira1", "HJ. WAN SALLEH BIN WAN MAT", "019-9430113", ""],
      ["pemeriksa_kira2", "HJ. MOHD NORDIN BIN MAT ISMAIL", "019-9150033", ""],
      ["ajk1", "HJ. HASBULLAH BIN ABD RAHMAN", "019-9556391", ""],
      ["ajk2", "HJ. MOHD NOOR BIN MAMAT", "019-9896791", ""],
      ["ajk3", "EN. NIK AB GHANI BIN NIK WAN", "012-9214713", ""],
      ["ajk4", "EN. AMRAN BIN ISMAIL", "013-9828236", ""],
      ["ajk5", "HJ. MOHD RAMLI BIN YUSOF", "019-9060049", ""],
      ["ajk6", "HJ. MOHD SAFIAI BIN HARUN", "019-9130767", ""],
      ["ajk7", "EN. WAN NIK BIN WAN ISMAIL", "011-10515152", ""],
      ["ajk8", "EN. ISMAIL BIN EMBONG", "019-9152285", ""],
      ["ajk9", "HJ. IBRAHIM BIN DOLLAH", "013-9394344", ""]
    ];
    sheetCarta.getRange(2, 1, defaultRoles.length, 4).setValues(defaultRoles);
  }

  // 5. Setup Tab Pekeliling & Hebahan jika belum ada
  let sheetPekeliling = ss.getSheetByName("Pekeliling & Hebahan");
  if (!sheetPekeliling) {
    sheetPekeliling = ss.insertSheet("Pekeliling & Hebahan");
    sheetPekeliling.appendRow(["ID", "No. Rujukan", "Tarikh", "Tarikh Berkuatkuasa", "Jenis", "Tajuk", "Kandungan", "Penerbit", "Jawatan Penerbit", "Kepentingan"]);
    sheetPekeliling.getRange("A1:J1").setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold");
    sheetPekeliling.setFrozenRows(1);

    const defaultPekeliling = [
      [
        "pekeliling-1",
        "KKKGB/01/2026-T1",
        "2026-05-15",
        "2026-05-15",
        "Pekeliling",
        "Penyelarasan Kadar Yuran Khairat Kematian Mulai 2026",
        "Sila ambil perhatian bahawa kadar sumbangan tahunan khairat kematian diselaraskan untuk menjamin kelangsungan tabung kebajikan serta menampung kos pengurusan jenazah kariah Kampung Gong Badak.",
        "HJ. SALLEH BIN HASHIM",
        "Setiausaha",
        "Penting"
      ],
      [
        "pekeliling-2",
        "KKKGB/02/2026-H1",
        "2026-06-01",
        "2026-06-10",
        "Hebahan",
        "Hebahan Majlis Tahlil Perdana & Solat Hajat Kariah",
        "Semua kariah dijemput hadir ke Majlis Tahlil Perdana & Solat Hajat yang akan diadakan di Masjid An-Nasriyah Kampung Gong Badak pada tarikh berkuatkuasa bagi mendoakan kesejahteraan seluruh ahli kariah.",
        "LAKSAMANA DATO' PAHLAWAN HJ. SULAIMAN BIN MOHAMAD (B)",
        "Pengerusi",
        "Biasa"
      ]
    ];
    sheetPekeliling.getRange(2, 1, defaultPekeliling.length, 10).setValues(defaultPekeliling);
  }

  // Tetapkan format teks biasa (@) bagi kolum kritikal untuk mengelakkan kehilangan '0' di depan
  sheetAhli.getRange("A:A").setNumberFormat("@"); // No. Ahli
  sheetAhli.getRange("C:C").setNumberFormat("@"); // No. IC
  sheetAhli.getRange("H:H").setNumberFormat("@"); // No. Telefon

  sheetLejar.getRange("A:A").setNumberFormat("@"); // No. Ahli
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
      const sheetCarta = ss.getSheetByName("Carta Organisasi");
      const sheetPekeliling = ss.getSheetByName("Pekeliling & Hebahan");
      
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
        if (dataAhli[i].length > 7 && dataAhli[i][7] !== undefined && dataAhli[i][7] !== null) {
          tel = String(dataAhli[i][7]).trim();
          if (tel && !tel.startsWith("0") && /^\d+$/.test(tel)) {
            tel = "0" + tel;
          }
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

      // Ambil Rekod Carta Organisasi (Roles)
      const chartRoles = {};
      if (sheetCarta) {
        const dataCarta = sheetCarta.getDataRange().getValues();
        for (let i = 1; i < dataCarta.length; i++) {
          const roleId = String(dataCarta[i][0]).trim();
          if (!roleId) continue;
          chartRoles[roleId] = {
            nama: String(dataCarta[i][1] || ""),
            tel: String(dataCarta[i][2] || ""),
            noAhli: String(dataCarta[i][3] || "")
          };
        }
      }

      // Ambil Rekod Pekeliling
      const pekelilingList = [];
      if (sheetPekeliling) {
        const dataPekeliling = sheetPekeliling.getDataRange().getValues();
        for (let i = 1; i < dataPekeliling.length; i++) {
          if (!dataPekeliling[i][0]) continue;
          
          let tarikhVal = dataPekeliling[i][2];
          let tarikhStr = "";
          if (tarikhVal instanceof Date) {
            tarikhStr = Utilities.formatDate(tarikhVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else {
            tarikhStr = String(tarikhVal || "");
          }

          let tarikhBVal = dataPekeliling[i][3];
          let tarikhBStr = "";
          if (tarikhBVal instanceof Date) {
            tarikhBStr = Utilities.formatDate(tarikhBVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else {
            tarikhBStr = String(tarikhBVal || "");
          }

          pekelilingList.push({
            id: String(dataPekeliling[i][0]),
            noRujukan: String(dataPekeliling[i][1] || ""),
            tarikh: tarikhStr,
            tarikhBerkuatkuasa: tarikhBStr,
            jenis: String(dataPekeliling[i][4] || "Pekeliling"),
            tajuk: String(dataPekeliling[i][5] || ""),
            kandungan: String(dataPekeliling[i][6] || ""),
            penerbit: String(dataPekeliling[i][7] || ""),
            jawatanPenerbit: String(dataPekeliling[i][8] || ""),
            kepentingan: String(dataPekeliling[i][9] || "Biasa")
          });
        }
      }
      
      return replyJSON({
        status: "success",
        spreadsheetId: ss.getId(),
        members: members,
        ledger: ledger,
        kewangan: kewangan,
        chartRoles: chartRoles,
        pekelilingList: pekelilingList
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
  const sheetCarta = ss.getSheetByName("Carta Organisasi");
  const sheetPekeliling = ss.getSheetByName("Pekeliling & Hebahan");
  
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
    if (sheetCarta && sheetCarta.getLastRow() > 1) {
      sheetCarta.getRange(2, 1, sheetCarta.getLastRow() - 1, sheetCarta.getLastColumn()).clearContent();
    }
    if (sheetPekeliling && sheetPekeliling.getLastRow() > 1) {
      sheetPekeliling.getRange(2, 1, sheetPekeliling.getLastRow() - 1, sheetPekeliling.getLastColumn()).clearContent();
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
      if (sheetCarta && sheetCarta.getLastRow() > 1) {
        sheetCarta.getRange(2, 1, sheetCarta.getLastRow() - 1, sheetCarta.getLastColumn()).clearContent();
      }
      if (sheetPekeliling && sheetPekeliling.getLastRow() > 1) {
        sheetPekeliling.getRange(2, 1, sheetPekeliling.getLastRow() - 1, sheetPekeliling.getLastColumn()).clearContent();
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

      // 5. Tulis Carta Organisasi Baru
      const chartRolesObj = payload.chartRoles || {};
      const chartRoleKeys = Object.keys(chartRolesObj);
      if (chartRoleKeys.length > 0 && sheetCarta) {
        const rowsCarta = chartRoleKeys.map(k => [
          k, chartRolesObj[k].nama || "", chartRolesObj[k].tel || "", chartRolesObj[k].noAhli || ""
        ]);
        sheetCarta.getRange(2, 1, rowsCarta.length, 4).setValues(rowsCarta);
      }

      // 6. Tulis Pekeliling Baru
      const pekelilingListArr = payload.pekelilingList || [];
      if (pekelilingListArr.length > 0 && sheetPekeliling) {
        const rowsPekeliling = pekelilingListArr.map(p => [
          p.id, p.noRujukan || "", p.tarikh || "", p.tarikhBerkuatkuasa || "", p.jenis || "Pekeliling", p.tajuk || "", p.kandungan || "", p.penerbit || "", p.jawatanPenerbit || "", p.kepentingan || "Biasa"
        ]);
        sheetPekeliling.getRange(2, 1, rowsPekeliling.length, 10).setValues(rowsPekeliling);
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
  const sheetCarta = ss.getSheetByName("Carta Organisasi");
  const sheetPekeliling = ss.getSheetByName("Pekeliling & Hebahan");
  
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
    if (dataAhli[i].length > 7 && dataAhli[i][7] !== undefined && dataAhli[i][7] !== null) {
      tel = String(dataAhli[i][7]).trim();
      if (tel && !tel.startsWith("0") && /^\d+$/.test(tel)) {
        tel = "0" + tel;
      }
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

  // Ambil Rekod Carta Organisasi (Roles)
  const chartRoles = {};
  if (sheetCarta) {
    const dataCarta = sheetCarta.getDataRange().getValues();
    for (let i = 1; i < dataCarta.length; i++) {
      const roleId = String(dataCarta[i][0]).trim();
      if (!roleId) continue;
      chartRoles[roleId] = {
        nama: String(dataCarta[i][1] || ""),
        tel: String(dataCarta[i][2] || ""),
        noAhli: String(dataCarta[i][3] || "")
      };
    }
  }

  // Ambil Rekod Pekeliling
  const pekelilingList = [];
  if (sheetPekeliling) {
    const dataPekeliling = sheetPekeliling.getDataRange().getValues();
    for (let i = 1; i < dataPekeliling.length; i++) {
      if (!dataPekeliling[i][0]) continue;
      
      let tarikhVal = dataPekeliling[i][2];
      let tarikhStr = "";
      if (tarikhVal instanceof Date) {
        tarikhStr = Utilities.formatDate(tarikhVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        tarikhStr = String(tarikhVal || "");
      }

      let tarikhBVal = dataPekeliling[i][3];
      let tarikhBStr = "";
      if (tarikhBVal instanceof Date) {
        tarikhBStr = Utilities.formatDate(tarikhBVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        tarikhBStr = String(tarikhBVal || "");
      }

      pekelilingList.push({
        id: String(dataPekeliling[i][0]),
        noRujukan: String(dataPekeliling[i][1] || ""),
        tarikh: tarikhStr,
        tarikhBerkuatkuasa: tarikhBStr,
        jenis: String(dataPekeliling[i][4] || "Pekeliling"),
        tajuk: String(dataPekeliling[i][5] || ""),
        kandungan: String(dataPekeliling[i][6] || ""),
        penerbit: String(dataPekeliling[i][7] || ""),
        jawatanPenerbit: String(dataPekeliling[i][8] || ""),
        kepentingan: String(dataPekeliling[i][9] || "Biasa")
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
      kewangan: kewangan,
      chartRoles: chartRoles,
      pekelilingList: pekelilingList
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

