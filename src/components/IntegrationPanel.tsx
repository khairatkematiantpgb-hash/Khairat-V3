/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppState } from '../types';
import { fetchFromAppsScript, writeToAppsScript } from '../lib/appsScript';
import { getAppsScriptGoogleCode } from '../lib/appsScript';
import { Radio, ToggleLeft, ToggleRight, Check, CheckCircle, Info, Key, AlertTriangle, RefreshCw, Layers, ExternalLink, HelpCircle, FileText, CheckCircle2, Share2 } from 'lucide-react';

interface IntegrationPanelProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
  onRefresh: () => Promise<void>;
  syncLoading: boolean;
  isServerConnected?: boolean | string;
}

export default function IntegrationPanel({ state, onChangeState, onRefresh, syncLoading, isServerConnected = false }: IntegrationPanelProps) {
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState(state.appsScriptUrl || '');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Script copy success state
  const [copiedScript, setCopiedScript] = useState(false);

  const [kadarYuranInput, setKadarYuranInput] = useState(state.kadarYuranSebulan.toString());
  const [adminPasswordInput, setAdminPasswordInput] = useState(state.adminPassword || 'gongbadak123');
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);
  const [guestDomainChoice, setGuestDomainChoice] = useState<'vercel' | 'shared_app' | 'current'>('vercel');

  // Central live server states & handlers
  const [centralLoading, setCentralLoading] = useState(false);
  const [centralResult, setCentralResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleForcePushToCentralServer = async () => {
    setCentralLoading(true);
    setCentralResult(null);
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCentralResult({
            success: true,
            message: `Selesai! Pangkalan data tempatan (${state.members?.length || 0} ahli) telah disimpan secara pusat ke Server Live. Peranti tetamu lain akan disegerak secara automatik seketika lagi!`
          });
        } else {
          setCentralResult({ success: false, message: `Ralat maklum balas server: ${data.message}` });
        }
      } else {
        setCentralResult({ success: false, message: `Gagal HTTP dengan status kerosakan ${res.status}` });
      }
    } catch (e: any) {
      setCentralResult({ success: false, message: `Ralat sambungan: ${e.message}` });
    } finally {
      setCentralLoading(false);
    }
  };

  const handleForcePullFromCentralServer = async () => {
    setCentralLoading(true);
    setCentralResult(null);
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.state) {
          onChangeState(data.state);
          localStorage.setItem('khairat_gong_badak', JSON.stringify(data.state));
          localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(data.state));
          setCentralResult({
            success: true,
            message: `Selesai! Berjaya menyegerak pangkalan data terkini daripada Server Live (${data.state.members?.length || 0} ahli ditemui).`
          });
        } else {
          setCentralResult({ success: false, message: `Server tidak mempunyai dokumen simpanan: ${data.message || 'Kosong'}` });
        }
      } else {
        setCentralResult({ success: false, message: `Gagal HTTP dengan status kerosakan ${res.status}` });
      }
    } catch (e: any) {
      setCentralResult({ success: false, message: `Ralat sambungan: ${e.message}` });
    } finally {
      setCentralLoading(false);
    }
  };

  // Save custom portal parameters (fee & admin password)
  const handleUpdatePortalSettings = () => {
    const fee = parseFloat(kadarYuranInput) || 3;
    const pass = adminPasswordInput.trim() || 'gongbadak123';
    
    const newState = {
      ...state,
      kadarYuranSebulan: fee,
      adminPassword: pass
    };
    onChangeState(newState);
    localStorage.setItem('khairat_gong_badak', JSON.stringify(newState));
    setSaveSettingsSuccess(true);
    setTimeout(() => setSaveSettingsSuccess(false), 3500);
  };

  // Toggle Sheets Integration trigger
  const handleToggleIntegration = () => {
    const isNowEnabled = !state.useGoogleSheets;
    const newState = {
      ...state,
      useGoogleSheets: isNowEnabled
    };
    onChangeState(newState);
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
  };

  // Save the Apps Script Web App URL to application settings
  const handleSaveUrl = () => {
    const cleanUrl = appsScriptUrlInput.trim();
    const newState = {
      ...state,
      appsScriptUrl: cleanUrl
    };
    onChangeState(newState);
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
    setTestResult({ success: true, message: 'URL telah berjaya disimpan ke dalam pelayar!' });
  };

  // Test communication with the web app URL
  const handleTestConnection = async () => {
    if (!appsScriptUrlInput.trim()) {
      setTestResult({ success: false, message: 'Harap masukkan URL web app Google Apps Script terlebih dahulu.' });
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const result = await fetchFromAppsScript(appsScriptUrlInput.trim());
      if (result.success && result.data) {
        setTestResult({
          success: true,
          message: `Sambungan berjaya! Sistem mengenal pasti ${result.data.members?.length || 0} ahli dan ${result.data.ledger?.length || 0} lejar sumbangan aktif di Google Sheet.`
        });
      } else {
        setTestResult({
          success: false,
          message: `Sambungan ralat: ${result.message || 'Sila pastikan kebenaran "Anyone" diakses penuh.'}`
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `Ralat komunikasi rangkaian: ${e.message || 'Sila semak semula Web App URL anda.'}`
      });
    }
    setTestLoading(false);
  };

  // Force Push Local State to Remote Google Sheets spreadsheet overwrite (Arah dwi-hala)
  const handleForcePushToSheets = async () => {
    if (!state.appsScriptUrl) {
      setTestResult({ success: false, message: 'Ralat: Sila simpan URL Web App terlebih dahulu sebelum menyegerak.' });
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    const payload = {
      action: 'syncLocalToSheets',
      members: state.members,
      ledger: state.ledger
    };

    try {
      const result = await writeToAppsScript(state.appsScriptUrl, payload);
      if (result.success && result.data) {
        onChangeState({
          ...state,
          members: result.data.members,
          ledger: result.data.ledger
        });
        setTestResult({
          success: true,
          message: `Segerak PUSH Berjaya! Pangkalan Google Sheets di atas talian telah dikemaskinikan sepenuhnya.`
        });
      } else {
        setTestResult({
          success: false,
          message: `Gagal menolak data: ${result.message}`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Gagal berkomunikasi: ${err.message}`
      });
    }
    setTestLoading(false);
  };

  // Force Pull data from Sheets
  const handleForcePull = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      await onRefresh();
      setTestResult({
        success: true,
        message: 'Data terbaharu berjaya ditarik turun dari Google Sheets secara bersih!'
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Gagal menarik data: ${err.message}`
      });
    }
    setTestLoading(false);
  };

  const handleCopyCodeText = () => {
    navigator.clipboard.writeText(getAppsScriptGoogleCode());
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 4000);
  };

  return (
    <div className="space-y-6 font-sans" id="integration-panel-component">
      
      {/* Sub-Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" id="integration-workspace">
        
        {/* Left Column: API URLs & Switches */}
        <div className="lg:col-span-3 space-y-4" id="integration-controls-rail">
          
          {/* Central Live Server Sync Console */}
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-950 shadow-md space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className={`h-2.5 w-2.5 rounded-full ${isServerConnected === true ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500 animate-pulse'}`}></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-205">Penyegerakan Fail Pusat (Kontena / Vercel)</h3>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">Sistem memantau mod hubungan pelayan dan membimbing persediaan awan.</p>
              </div>
            </div>

            {isServerConnected === 'HTTP 404' || String(isServerConnected).includes('404') ? (
              <div className="bg-amber-950/70 border border-amber-850 p-4 rounded-xl space-y-3">
                <div className="flex gap-2 text-amber-250 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Sebab ralat HTTP 404 di Vercel:</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
                  Pautan <code className="bg-amber-950 px-1 py-0.5 rounded text-amber-300 font-mono">khairat-v3.vercel.app</code> dihoskan secara <strong>statik (serverless)</strong> di sistem cloud Vercel. Vercel secara lalai tiada pelayan backend Node.js yang aktif untuk menyimpan fail JSON. Oleh itu ralat status <strong>HTTP 404</strong> berlaku kerana pelayan kontena tempatan tidak berjalan di Vercel.
                </p>
                <div className="bg-amber-950/90 p-3 rounded-lg border border-amber-900/60 font-sans text-[11px] text-amber-100">
                  <p className="font-semibold text-emerald-450 flex items-center gap-1.5 mb-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    Penyelesaian Mudah & Kekal:
                  </p>
                  Sila aktifkan <strong>"Kefungsian Integrasi Google Sheets"</strong> di kotak sebelah kanan ini! Integrasi Google Sheets berjalan terus dari pelayar web (client-side) secara percuma untuk menyegerak dan berkongsi pangkalan data dengan lebih 333+ ahli serta peranti tetamu tanpa had.
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                Sistem ini membolehkan data anda disegerak secara langsung (real-time) antara peranti <strong>Pentadbir (Admin)</strong> dan peranti <strong>Tetamu/Pelawat</strong> menggunakan simpanan server kontena tanpa memerlukan persediaan manual Google Sheet.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-[10px]">
              <div>
                <span className="text-slate-450 block uppercase tracking-tight">Ahli Lokal (Pelayar Ini):</span>
                <span className="text-xs font-bold text-white">{state.members?.length || 0} Orang Berdaftar</span>
              </div>
              <div>
                <span className="text-slate-450 block uppercase tracking-tight">Status Hubungan Pusat:</span>
                <span className={`text-xs font-bold flex items-center gap-1 ${isServerConnected === true ? 'text-emerald-300' : 'text-rose-350'}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${isServerConnected === true ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                  {isServerConnected === true ? 'Terhubung (Server Kontena)' : 'Mod Offline / Vercel (Lokal)'}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest font-sans">Aksi Penyegerkan Pusat Pentadbir:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleForcePushToCentralServer}
                  disabled={centralLoading}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-[10px] uppercase rounded-lg tracking-wider transition border-b-2 border-emerald-900 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  title="Tekan ini untuk hantar data ahli anda ke server"
                >
                  <RefreshCw className={`h-3 w-3 ${centralLoading ? 'animate-spin' : ''}`} />
                  <span>Tolak Data ke Server (Push)</span>
                </button>
                <button
                  type="button"
                  onClick={handleForcePullFromCentralServer}
                  disabled={centralLoading}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-extrabold text-[10px] uppercase rounded-lg tracking-wider transition border-b-2 border-slate-950 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  title="Ambil data terbaharu dari server"
                >
                  <RefreshCw className="h-3 w-3 text-slate-400" />
                  <span>Tarik Data Server (Pull)</span>
                </button>
              </div>
              <span className="text-[9px] text-slate-450 block leading-relaxed font-sans italic">
                *Nota: Sekiranya menggunakan Vercel, sila abaikan butang "Tolak/Tarik Data Server" ini dan gunakan Google Sheets di sebelah kanan.
              </span>
            </div>

            {centralResult && (
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                centralResult.success
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-250'
                  : 'bg-rose-950/80 border-rose-900 text-rose-250'
              }`}>
                <div className="flex gap-2 font-sans font-medium text-[10.5px]">
                  {centralResult.success ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-450 shrink-0" />
                  )}
                  <span>{centralResult.message}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
            
            {/* Column Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-150">
              <div>
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">Kefungsian Integrasi Google Sheets (A1-H1)</h3>
                <p className="text-[10px] text-slate-400">Penyegerakan awan dwi-hala aktif bagi Kampung Gong Badak.</p>
              </div>
              
              {/* Clean Interactive Role Toggle Indicator Switch mapped */}
              <button
                onClick={handleToggleIntegration}
                className={`p-1 rounded cursor-pointer transition-all ${
                  state.useGoogleSheets ? 'text-emerald-600 hover:text-emerald-800' : 'text-slate-400 hover:text-slate-500'
                }`}
                title={state.useGoogleSheets ? 'Nyahaktif Integrasi' : 'Aktifkan Integrasi'}
              >
                {state.useGoogleSheets ? (
                  <ToggleRight className="h-9 w-9 stroke-1.5" />
                ) : (
                  <ToggleLeft className="h-9 w-9 stroke-1.5" />
                )}
              </button>
            </div>

            {/* Connection Status Description Card */}
            <div className={`p-4 rounded-lg border text-xs leading-relaxed flex gap-3 ${
              state.useGoogleSheets
                ? 'bg-emerald-50/70 border-emerald-150 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <Radio className={`h-5 w-5 shrink-0 ${state.useGoogleSheets ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
              <div>
                <strong className="block text-[11px] uppercase tracking-wide">
                  {state.useGoogleSheets ? 'STATUS: Integrasi Diaktifkan' : 'STATUS: Mod Luar Talian (Offline Only)'}
                </strong>
                <p className="mt-0.5 text-[10px]">
                  {state.useGoogleSheets
                    ? 'Aplikasi sedang dipautkan mengikut dwi-hala remote Google Sheets. Sebarang pembatasan yuran baru atau ahli didaftar akan cuba disegerak terus ke Web App URL anda.'
                    : 'Aplikasi kini hanya beroperasi di atas storan lokal pelayar web ini sahaja. Data lejar anda selamat, namun tidak terpusat dalam rekod Google Sheets Kampung Gong Badak.'}
                </p>
              </div>
            </div>

            {/* API Web App URL Fields Setup */}
            <div className="space-y-2.5 pt-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans">
                Google Apps Script Web App URL (A1)
              </label>
              
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-grow bg-slate-50 border border-slate-300 text-slate-905 text-xs rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-mono text-[11px]"
                  value={appsScriptUrlInput}
                  onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                  disabled={!state.useGoogleSheets}
                />
                <button
                  type="button"
                  onClick={handleSaveUrl}
                  disabled={!state.useGoogleSheets}
                  className="px-4 py-2.5 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-45 text-white font-bold text-[10px] uppercase rounded-lg transition shadow-xs cursor-pointer select-none font-sans"
                >
                  Simpan URL
                </button>
              </div>
              <span className="text-xxs text-slate-400 block leading-relaxed font-sans">
                Akses ini wajib mengandungi pengenal-maklumat web app `exec` hujung Google Sheet anda.
              </span>
            </div>

            {/* Pautan Perkongsian Tetamu (Untuk Vercel / Tanpa Server) */}
            {state.useGoogleSheets && state.appsScriptUrl && (() => {
              // Automatically convert "ais-dev-..." to "ais-pre-..." to prevent 403 Forbidden
              const currentOrigin = window.location.origin;
              const autoSharedOrigin = currentOrigin.replace('ais-dev-', 'ais-pre-');
              
              // Local state or variable for domain choice
              // Let us render a select picker or simple choice bar to allow the user to select their desired production URL.
              // We'll store this choice in a local state inside the component by declaring it. Let's see if we should define it first.
              return (
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/60 space-y-3 font-sans">
                  <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-950 uppercase tracking-wide">
                    <Share2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Pautan Kongsi Ahli / Tetamu (Sangat Penting):</span>
                  </div>

                  {/* Penjelasan Ralat 403 */}
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-[10.5px] text-rose-950 space-y-1.5 leading-relaxed">
                    <p className="font-extrabold flex items-center gap-1 text-rose-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      Kenapa Tetamu Mendapat Ralat 403 (Forbidden)?
                    </p>
                    <p>
                      Pautan yang bermula dengan <code className="bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-mono">ais-dev-...</code> adalah <strong>persekitaran pembangunan peribadi anda (Admin sandbox)</strong>. Google Cloud melindunginya daripada akses luar.
                    </p>
                    <p className="font-semibold text-emerald-900">
                      <strong>Penyelesaian:</strong> Tukar pilihan domain di bawah ke <strong>Aplikasi Vercel</strong> atau <strong>Shared App (ais-pre-...)</strong> sebelum menyalin dan menghantar pautan kepada ahli/tetamu!
                    </p>
                  </div>

                  {/* Pemilihan Base Domain */}
                  <div className="space-y-1">
                    <span className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Pilih Domain Untuk Tetamu:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          (window as any)._guestDomainChoice = 'vercel';
                          // trigger force-update on state or local variable by mimicking state via a small trick
                          // Since we want this to be responsive, we can use a small local state or simply store in state. 
                          // Let's add direct state to IntegrationPanel component for this.
                          setGuestDomainChoice('vercel');
                        }}
                        className={`px-2 py-1.5 rounded text-[10px] uppercase font-bold tracking-tight text-center border cursor-pointer select-none transition ${
                          guestDomainChoice === 'vercel'
                            ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Aplikasi Vercel
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setGuestDomainChoice('shared_app');
                        }}
                        className={`px-2 py-1.5 rounded text-[10px] uppercase font-bold tracking-tight text-center border cursor-pointer select-none transition ${
                          guestDomainChoice === 'shared_app'
                            ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Shared App (pre)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGuestDomainChoice('current');
                        }}
                        className={`px-2 py-1.5 rounded text-[10px] uppercase font-bold tracking-tight text-center border cursor-pointer select-none transition ${
                          guestDomainChoice === 'current'
                            ? 'bg-rose-100 border-rose-300 text-rose-950 font-black'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                        title="Hanya untuk kegunaan penguji persendirian sahaja"
                      >
                        Dev URL (Lalai/Private)
                      </button>
                    </div>
                  </div>

                  {/* Domain yang dipilih */}
                  {guestDomainChoice === 'vercel' && (
                    <div className="bg-slate-100 p-2 rounded text-[10px] text-slate-700 leading-snug font-sans">
                      <strong>Domain Terpilih: Vercel Production.</strong> Sila salin pautan di bawah. Pautan ini paling disyorkan kerana tiada sekatan akses untuk tetamu global.
                    </div>
                  )}
                  {guestDomainChoice === 'shared_app' && (
                    <div className="bg-indigo-50 p-2 rounded text-[10px] text-indigo-900 leading-snug font-sans">
                      <strong>Domain Terpilih: Shared App AI Studio (ais-pre-...).</strong> Membolehkan sesiapa sahaja mencuba aplikasi di platform Google tanpa sekatan 403.
                    </div>
                  )}
                  {guestDomainChoice === 'current' && (
                    <div className="bg-rose-50 p-2 rounded text-[10px] text-rose-900 leading-snug font-sans">
                      <strong>Amaran: Dev URL Terpilih.</strong> Tetamu yang tidak log masuk sebagai pentadbir di Google Cloud Run kacak ini akan mendapat <strong>Ralat 403 Forbidden</strong>.
                    </div>
                  )}

                  {/* Penjana Pautan Terakhir */}
                  {(() => {
                    let baseOrigin = currentOrigin;
                    if (guestDomainChoice === 'vercel') {
                      baseOrigin = 'https://khairat-v3.vercel.app';
                    } else if (guestDomainChoice === 'shared_app') {
                      baseOrigin = autoSharedOrigin;
                    }
                    
                    const finalShareUrl = `${baseOrigin}${window.location.pathname}?s=${encodeURIComponent(state.appsScriptUrl)}`;
                    
                    return (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          id="guest-share-url-input"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="flex-grow bg-white border border-emerald-300 text-emerald-950 text-[10px] rounded px-3 py-2 focus:outline-none font-mono"
                          value={finalShareUrl}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(finalShareUrl);
                            alert(`Berjaya menyalin pautan tetamu (${guestDomainChoice.toUpperCase()}) ke dalam clipboard! Sila kongsikannya kepada ahli kariah.`);
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase rounded transition cursor-pointer select-none shrink-0"
                        >
                          Salin Pautan
                        </button>
                      </div>
                    );
                  })()}
                  
                  <span className="text-[9px] text-slate-500 font-sans block leading-snug">
                    *Nota: Sebaik sahaja ahli kariah membuka pautan ini, sistem akan terus mendaftar ke dalam mod <strong>Pelawat (Read-Only)</strong> dan memperoleh senarai <strong>333 nama secara langsung (live)</strong>.
                  </span>
                </div>
              );
            })()}

            {/* Sync Action Controllers */}
            {state.useGoogleSheets && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans">Manual Sync & Ujian Komunikasi</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={testLoading || syncLoading}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[9px] font-black uppercase rounded transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                  >
                    <RefreshCw className={`h-3 w-3 ${testLoading ? 'animate-spin' : ''}`} />
                    Uji Sambungan
                  </button>
                  <button
                    onClick={handleForcePull}
                    disabled={testLoading || syncLoading}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-105 border border-indigo-200 text-indigo-850 text-[9px] font-black uppercase rounded transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                  >
                    <RefreshCw className="h-3 w-3 text-indigo-505" />
                    Tarik Data (Pull)
                  </button>
                  <button
                    onClick={handleForcePushToSheets}
                    disabled={testLoading || syncLoading}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-105 border border-emerald-200 text-emerald-850 text-[9px] font-black uppercase rounded transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                  >
                    <RefreshCw className="h-3 w-3 text-emerald-600" />
                    Tolak Data (Push)
                  </button>
                </div>
              </div>
            )}

            {/* Debugging / Testing Feedback Logs placeholder wrapper */}
            {testResult && (
              <div className={`p-3.5 rounded-lg border text-xs ${
                testResult.success
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-805'
                  : 'bg-rose-50/70 border-rose-200 text-rose-805'
              }`}>
                <div className="flex gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <span className="font-extrabold block text-[10px] uppercase tracking-wide">Log Transaksi Sistem</span>
                    <p className="text-[11px] leading-relaxed font-sans">{testResult.message}</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Custom Backup & Sync Card Requested by User */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4 font-sans">
            <div>
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">Pengurusan Penyegerakan & Sandaran</h3>
              <p className="text-[10px] text-slate-400">Pastikan integriti data disandarkan secara berkala ke pangkalan awan bersepadu anda.</p>
            </div>

            {state.useGoogleSheets && state.appsScriptUrl ? (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Menyalin dan memuat naik semua data ahli kariah, status keahlian, dan rekod lejar bayaran sumbangan yang disimpan dalam pelayar tempatan terus ke lembaran kerja Google Sheets anda. Tindakan ini akan mengemas kini sandaran awan anda mengikut maklumat terkini.
                </p>
                
                <button
                  type="button"
                  onClick={handleForcePushToSheets}
                  disabled={testLoading || syncLoading}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs uppercase rounded-lg tracking-wider transition border-b-4 border-emerald-950 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-700/10"
                >
                  <RefreshCw className={`h-4 w-4 ${testLoading || syncLoading ? 'animate-spin' : ''}`} />
                  <span>Muat Naik (Push) Data Tempatan ke Google Sheets</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block text-[10px] uppercase tracking-wide">Fungsi Dinonaktifkan</span>
                  Sila aktifkan <strong>Kefungsian Integrasi Google Sheets</strong> di atas dan masukkan URL Web App yang sah terlebih dahulu untuk menguruskan fungsi muat naik dan sandaran data tempatan secara penuh.
                </div>
              </div>
            )}
          </div>

          {/* Custom Portal Parameters Configuration Card (Fee rate & password changes) */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">Tetapan Sistem Utama</h3>
              <p className="text-[10px] text-slate-400">Konfigurasi kadar yuran semasa dan kata laluan keselamatan admin.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fee Rate field */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans">
                  Kadar Yuran Bulanan (RM)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-505 font-bold text-xs">
                    RM
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg pl-9 pr-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-bold font-sans"
                    value={kadarYuranInput}
                    onChange={(e) => setKadarYuranInput(e.target.value)}
                  />
                </div>
                <span className="text-xxs text-slate-400 block font-sans">
                  Kiraan tunggakan dilaraskan mengikut kadar ini. (Nilai lalai: RM3)
                </span>
              </div>

              {/* Security password changing */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans">
                  Kata Laluan Pentadbir (Admin)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Key className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg pl-9 pr-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-bold font-mono text-[11px]"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="gongbadak123"
                  />
                </div>
                <span className="text-xxs text-slate-400 block font-sans">
                  Menukar kata laluan akses pentadbir dalam gerbang log masuk.
                </span>
              </div>
            </div>

            {saveSettingsSuccess && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-150 rounded-lg text-emerald-805 text-xxs font-bold flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>Tetapan portal telah berjaya dikemaskini dan disimpan secara lokal!</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleUpdatePortalSettings}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[10px] uppercase rounded-lg transition shadow-xs cursor-pointer select-none font-sans border-b border-emerald-900"
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-2 font-sans">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pb-1 border-b border-slate-150 font-sans">
              Formulas & Google Spill Setup
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed font-sans">
              Untuk mengelakkan kerosakan format lejar di Google Sheets, kod Google Apps Script kami membenarkan pengiraan yuran secara automatik. Namun sekiranya anda mahu formula lekatan tersuai (Spill Formula) dibasuh secara terus ke komputer anda, sila lihat formula terperinci di palam sebelah kanan.
            </p>
          </div>

        </div>

        {/* Right Column: Steps to Deploy Sheet Script */}
        <div className="lg:col-span-2 space-y-4" id="integration-instructions-rail">
          
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
            
            <h4 className="text-[10px] font-black text-slate-505 uppercase tracking-widest block pb-1.5 border-b border-slate-150 font-sans">
              Manual Pemasangan Apps Script
            </h4>

            <div className="space-y-3.5 text-xs leading-relaxed font-sans text-slate-605">
              
              <div className="space-y-1">
                <span className="font-bold text-slate-800 block">Langkah A: Bina File Google Sheet</span>
                <p className="text-slate-500 text-[11px]">Bina satu helaian Spreadsheet baru di akaun Google Drive anda. Namakan tab pertama sebagai <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-xs">Members</code> dan tab kedua sebagai <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-xs">Ledger</code>.</p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 block">Langkah B: Masuk Menu Extensions</span>
                <p className="text-slate-500 text-[11px]">Pada Google Sheet anda, klik menu <strong className="text-slate-700">Extensions</strong> &rarr; pilih <strong className="text-slate-700">Apps Script</strong>.</p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 block">Langkah C: Lekatkan Kod Jauh</span>
                <p className="text-slate-500 text-[11px]">Padam sebarang kod lalai di dalam editor <code className="font-mono bg-slate-100 px-1 rounded text-xs">Code.gs</code>. Klik butang penyalin di bawah untuk mendapatkan kod enjin automasi lejar Kampung Gong Badak kami, seterusnya lekatkan di Apps Script.</p>
                
                <button
                  onClick={handleCopyCodeText}
                  className="w-full mt-1.5 py-2 bg-indigo-50 border border-indigo-255 hover:bg-indigo-100 text-[#1e1b4b] text-[10px] font-black uppercase rounded transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  {copiedScript ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 animate-bounce" />
                      <span>Berjaya Disalin Ke Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5" />
                      <span>Salin Kod Google Apps Script</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 block">Langkah D: Deploy Baharu (New Deployment)</span>
                <p className="text-slate-500 text-[11px]">
                  Klik butang biru <strong className="text-slate-700">Deploy</strong> &rarr; pilih <strong className="text-slate-700">New Deployment</strong>. <br />
                  &bull; Tukar jenis (Gear icon) kepada <strong className="text-slate-700">Web App</strong>. <br />
                  &bull; Set "Execute As" sebagai <strong className="text-slate-700">Me (Akaun anda)</strong>. <br />
                  &bull; Set "Who has access" sebagai <strong className="text-slate-700 font-extrabold text-[#be123c]">Anyone</strong> (Penting!).
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 block">Langkah E: Pautkan Web App URL</span>
                <p className="text-slate-500 text-[11px]">Salin Web App URL yang dijana (Contoh: Berakhir dengan <code className="font-mono bg-slate-100 rounded px-1 text-[10px]">/exec</code>) dan letakkan di dalam ruang URL di bahagian sebelah kiri lejar anda.</p>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
