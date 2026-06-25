/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppState } from './types';
import { getDefaultAppState } from './lib/defaultData';
import { fetchFromAppsScript } from './lib/appsScript';
import Navbar from './components/Navbar';
import Overview from './components/Overview';
import MemberDatabase from './components/MemberDatabase';
import PaymentGate from './components/PaymentGate';
import PaymentLedger from './components/PaymentLedger';
import ProfileDashboard from './components/ProfileDashboard';
import ReportsSummary from './components/ReportsSummary';
import IntegrationPanel from './components/IntegrationPanel';
import PenyataKiraKira from './components/PenyataKiraKira';
import { ShieldAlert, LogIn, Users, HelpCircle, FileText, CheckCircle2, Lock, ArrowLeft } from 'lucide-react';

export default function App() {
  // 1. App State & Role Management
  const [state, setState] = useState<AppState>(() => {
    let saved = localStorage.getItem('khairat_gong_badak');
    if (!saved) {
      saved = localStorage.getItem('khairat_gong_badak_state_v1');
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const OLD_URL_ID = 'AKfycbzWl9ccXM2e39h2rjYlezESn2Y-DOtQKxu3mqVZ45b64u_NtN6yeJWTGiy5eBWspo0T';
        const NEW_URL = 'https://script.google.com/macros/s/AKfycbzyNGrOIKVN80Hcyb05LKTFxXCeLvzRVyF6YKKdtTYWVyyH0lCQF7otWmNfmb8rxK6r/exec';
        const NEW_SHEET_ID = '1JLSTFs3fQ0fzZ6beESzchHbjQea0ucS4Y2gaoxRQakQ';
        
        let upgraded = false;
        if (!parsed.appsScriptUrl || parsed.appsScriptUrl.includes(OLD_URL_ID) || parsed.appsScriptUrl.trim() === '') {
          parsed.appsScriptUrl = NEW_URL;
          upgraded = true;
        }
        if (!parsed.googleSheetsId || parsed.googleSheetsId.trim() === '' || parsed.googleSheetsId.startsWith('AKfycb')) {
          parsed.googleSheetsId = NEW_SHEET_ID;
          upgraded = true;
        }
        if (upgraded) {
          console.log('Migrasi Automatik: Menetapkan Google Sheets ID & Apps Script URL terkini dalam localStorage.');
          localStorage.setItem('khairat_gong_badak', JSON.stringify(parsed));
          localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) {
        console.error('Error parsing cached state, resetting...', e);
      }
    }
    return getDefaultAppState();
  });

  const [currentRole, setCurrentRole] = useState<'admin' | 'user' | 'ajk' | null>(() => {
    const cachedRole = localStorage.getItem('khairat_gong_badak_role_v1');
    return (cachedRole === 'admin' || cachedRole === 'user' || cachedRole === 'ajk') ? cachedRole as any : null; // null triggers Login Gate view
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isServerConnected, setIsServerConnected] = useState(false);

  // Admin authentication state
  const [showAdminPassInput, setShowAdminPassInput] = useState(false);
  const [adminPassAttempt, setAdminPassAttempt] = useState('');
  const [showAjkPassInput, setShowAjkPassInput] = useState(false);
  const [ajkPassAttempt, setAjkPassAttempt] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // 2. State Persister & Server Synchronization Hook
  const handleChangeState = async (newState: AppState) => {
    setState(newState);
    localStorage.setItem('khairat_gong_badak', JSON.stringify(newState));
    localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(newState));
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: newState }),
      });
    } catch (e) {
      console.warn('Gagal menyimpan keadaan ke pelayan:', e);
    }
  };

  // 3. Automated Google Sheets Synchronization Pull Trigger
  const handleRefreshFromSheets = async () => {
    if (!state.useGoogleSheets || !state.appsScriptUrl) {
      return;
    }

    setSyncLoading(true);
    setSyncError(null);

    try {
      const result = await fetchFromAppsScript(state.appsScriptUrl);
      if (result.success && result.data) {
        const mergedState = {
          ...state,
          members: result.data.members || state.members,
          ledger: result.data.ledger || state.ledger,
          kewangan: result.data.kewangan || state.kewangan || [],
          googleSheetsId: result.data.spreadsheetId || state.googleSheetsId
        };
        await handleChangeState(mergedState);
      } else {
        setSyncError(result.message || 'Gagal berkomunikasi dengan Google Sheets remote.');
      }
    } catch (e: any) {
      setSyncError(`Ralat rangkaian: ${e.message || 'Sila semak semula Web App URL anda.'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // Load centralized shared state from the server on startup so all devices display raw up-to-date live data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scriptUrlParam = params.get('script') || params.get('s');
    
    // Default Apps Script URL terbaharu yang sahih dan aktif bagi Kampung Gong Badak
    const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzyNGrOIKVN80Hcyb05LKTFxXCeLvzRVyF6YKKdtTYWVyyH0lCQF7otWmNfmb8rxK6r/exec';
    
    let needsUpdate = false;
    let decodedUrl = '';
    
    if (scriptUrlParam) {
      try {
        decodedUrl = decodeURIComponent(scriptUrlParam);
        if (decodedUrl.startsWith('https://script.google.com/')) {
          needsUpdate = true;
        }
      } catch (err) {
        console.error('Failed to parse URL query script URL parameter:', err);
      }
    } else if (!state.appsScriptUrl || state.appsScriptUrl.trim() === '' || state.appsScriptUrl.includes('AKfycbzWl9ccXM2e39h2rjYlezESn2Y-DOtQKxu3mqVZ45b64u_NtN6yeJWTGiy5eBWspo0T')) {
      // Jika pengguna melayari URL bersih (m.g. / sahaja) tanpa sebarang parametre, dan tiada pautan tersimpan,
      // kita setkan pautan Google Sheets lalai secara automatik supaya mereka tidak mendapat ralat 404!
      decodedUrl = DEFAULT_APPS_SCRIPT_URL;
      needsUpdate = true;
    }

    if (needsUpdate && decodedUrl) {
      console.log('Sistem mengkonfigurasi Google Apps Script secara automatik:', decodedUrl);
      
      let saved = localStorage.getItem('khairat_gong_badak') || localStorage.getItem('khairat_gong_badak_state_v1');
      let currentState = state;
      if (saved) {
        try {
          currentState = JSON.parse(saved);
        } catch (e) {}
      }

      const updatedState = {
        ...currentState,
        useGoogleSheets: true,
        appsScriptUrl: decodedUrl,
        googleSheetsId: '1JLSTFs3fQ0fzZ6beESzchHbjQea0ucS4Y2gaoxRQakQ'
      };
      
      setState(updatedState);
      localStorage.setItem('khairat_gong_badak', JSON.stringify(updatedState));
      localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(updatedState));
      
      // Auto-set peranan pelawat 'user' supaya tetamu terus dibawa ke dashboard tanpa halangan kata laluan
      if (!localStorage.getItem('khairat_gong_badak_role_v1')) {
        setCurrentRole('user');
        localStorage.setItem('khairat_gong_badak_role_v1', 'user');
      }
    }
  }, []);

  useEffect(() => {
    const loadSharedStateOnBoot = async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          setIsServerConnected(true);
          
          const localSaved = localStorage.getItem('khairat_gong_badak');
          let localState: AppState | null = null;
          if (localSaved) {
            try {
              localState = JSON.parse(localSaved);
            } catch (e) {}
          }

          if (data.success && data.state) {
            // Check if local state is richer/newer (e.g., admin device which has 333 members, while server has default 11)
            const localCount = localState?.members?.length || 0;
            const remoteCount = data.state?.members?.length || 0;
            
            // Safety: if our local state has more records than the server state AND local state has substantial records (e.g. >15)
            // we should PRESERVE the local state to prevent accidental local data clobbering by the server
            if (localState && localCount > remoteCount && localCount > 15) {
              console.log('Preserving rich local state of', localCount, 'members over remote', remoteCount, 'members');
              const cachedRole = localStorage.getItem('khairat_gong_badak_role_v1') || currentRole;
              if (cachedRole === 'admin') {
                await fetch('/api/state', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ state: localState }),
                });
              }
              setState(localState);
            } else {
              // Adopt remote centered live database
              setState(data.state);
              localStorage.setItem('khairat_gong_badak', JSON.stringify(data.state));
              localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(data.state));
            }
          } else {
            // Server has no state file yet (first time or starting up). 
            // If we are admin or we have a richer local state, push it. Otherwise, initialize.
            const localCount = localState?.members?.length || 0;
            const activeStateToIncept = (localState && localCount > 11) ? localState : state;
            
            await fetch('/api/state', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ state: activeStateToIncept }),
            });
            if (activeStateToIncept !== state) {
              setState(activeStateToIncept);
            }
          }
        } else {
          setIsServerConnected(`HTTP ${res.status}`);
        }
      } catch (err) {
        setIsServerConnected(err instanceof Error ? err.message : String(err));
        console.warn('Failed to pull bootstrapped state from container server:', err);
      }
    };
    loadSharedStateOnBoot();
  }, [currentRole]);

  // Setup standard dynamic polling for guest/visitor devices to get live database updates automatically
  useEffect(() => {
    if (currentRole === 'admin') return; // Admin updates are pushed transactionally. Guests poll.

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          setIsServerConnected(true);
          if (data.success && data.state) {
            const currentString = localStorage.getItem('khairat_gong_badak');
            const newString = JSON.stringify(data.state);
            if (currentString !== newString) {
              setState(data.state);
              localStorage.setItem('khairat_gong_badak', newString);
              localStorage.setItem('khairat_gong_badak_state_v1', newString);
            }
          }
        } else {
          setIsServerConnected(`HTTP ${res.status}`);
        }
      } catch (err) {
        setIsServerConnected(err instanceof Error ? err.message : String(err));
        console.warn('Failed to sync state during background poll:', err);
      }
    }, 8000); // Sync every 8 seconds

    return () => clearInterval(pollInterval);
  }, [currentRole]);

  // Background polling untuk Google Sheets apabila berjalan di persekitaran offline / tanpa server (Vercel)
  useEffect(() => {
    if (currentRole === 'admin' || !state.useGoogleSheets || !state.appsScriptUrl) return;

    const sheetsPollInterval = setInterval(async () => {
      try {
        console.log('Sedang menyegerak latar belakang dari Google Sheets...');
        const result = await fetchFromAppsScript(state.appsScriptUrl!);
        if (result.success && result.data) {
          setState(prevState => {
            const mergedState = {
              ...prevState,
              members: result.data.members || prevState.members,
              ledger: result.data.ledger || prevState.ledger,
              kewangan: result.data.kewangan || prevState.kewangan || [],
              googleSheetsId: result.data.spreadsheetId || prevState.googleSheetsId
            };
            
            const currentString = localStorage.getItem('khairat_gong_badak');
            const newString = JSON.stringify(mergedState);
            if (currentString !== newString) {
              localStorage.setItem('khairat_gong_badak', newString);
              localStorage.setItem('khairat_gong_badak_state_v1', newString);
              return mergedState;
            }
            return prevState;
          });
        }
      } catch (e) {
        console.warn('Gagal melakukan segelong latar belakang Google Sheets:', e);
      }
    }, 15000); // Segelong setiap 15 saat

    return () => clearInterval(sheetsPollInterval);
  }, [currentRole, state.useGoogleSheets, state.appsScriptUrl]);

  // Pull remote data on load if configured
  useEffect(() => {
    if (currentRole && state.useGoogleSheets && state.appsScriptUrl) {
      handleRefreshFromSheets();
    }
  }, [currentRole, state.useGoogleSheets, state.appsScriptUrl]);

  // Handle simulated login
  const handleLogin = async (role: 'admin' | 'user' | 'ajk') => {
    setCurrentRole(role);
    localStorage.setItem('khairat_gong_badak_role_v1', role);
    // If user is visitor (read-only) or AJK (read-only with financial statement), safety-switch tab to overview if it was integrasi or payment
    if (role === 'user' || role === 'ajk') {
      setActiveTab('overview');
    }

    if (role === 'admin') {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.state) {
            const localSaved = localStorage.getItem('khairat_gong_badak');
            if (localSaved) {
              const localState: AppState = JSON.parse(localSaved);
              const localCount = localState?.members?.length || 0;
              const remoteCount = data.state?.members?.length || 0;
              if (localState && localCount > remoteCount) {
                console.log('Pushing local admin state on login:', localCount, 'vs remote', remoteCount);
                await fetch('/api/state', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ state: localState }),
                });
                setState(localState);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Silent local state sync on admin login failed:', e);
      }
    }
  };

  // Handle simulated logout
  const handleLogout = () => {
    setCurrentRole(null);
    localStorage.removeItem('khairat_gong_badak_role_v1');
    setShowAdminPassInput(false);
    setAdminPassAttempt('');
    setShowAjkPassInput(false);
    setAjkPassAttempt('');
    setLoginError(null);
  };

  const handleAdminAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const correctPassword = state.adminPassword || 'gongbadak123';
    if (adminPassAttempt === correctPassword) {
      handleLogin('admin');
      setShowAdminPassInput(false);
      setAdminPassAttempt('');
    } else {
      setLoginError('Kata laluan salah! Sila hubungi ketua pentadbir.');
    }
  };

  const handleAjkAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const correctPassword = state.ajkPassword || 'khairat123';
    if (ajkPassAttempt === correctPassword) {
      handleLogin('ajk');
      setShowAjkPassInput(false);
      setAjkPassAttempt('');
    } else {
      setLoginError('Kata laluan salah! Sila hubungi urus setia / bendahari.');
    }
  };

  // Render simulated Welfare Portal Login Gate
  if (!currentRole) {
    return (
      <div className="min-h-screen bg-slate-900 border-t-8 border-emerald-750 flex flex-col items-center justify-center p-4 relative" id="login-gate font-sans">
        
        {/* Background abstract overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e3a2f_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

        <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 relative z-10 text-center font-sans">
          
          {/* Logo Crest */}
          <div className="mx-auto h-16 w-16 bg-[#064e3b] text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-900/10">
            <Users className="h-7 w-7" />
          </div>

          <div className="space-y-1.5">
            <span className="bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-3 py-0.8 rounded-full font-mono">
              Kampung Gong Badak
            </span>
            <h1 className="text-sm md:text-[15px] font-extrabold text-slate-100 uppercase tracking-wide leading-tight">
              Sistem Khairat Kematian dan Kebajikan Kampung Gong Badak, Kuala Nerus, Terengganu
            </h1>
            <p className="text-slate-400 text-xxs">
              Portal Pendaftaran, Merekod Sumbangan Yuran Bulanan (RM3), dan Integrasi Lembaran Awan dwi-hala Google Sheets.
            </p>
          </div>

          {!showAdminPassInput && !showAjkPassInput ? (
            <div className="space-y-3 pt-3">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sila Pilih Sesi Akses Portal:</span>
              
              <div className="grid grid-cols-1 gap-2.5">
                
                {/* Admin Button option */}
                <button
                  onClick={() => {
                    setShowAdminPassInput(true);
                    setShowAjkPassInput(false);
                    setAdminPassAttempt('');
                    setLoginError(null);
                  }}
                  className="p-3.5 bg-slate-900 hover:bg-[#122c23] border border-slate-800 hover:border-emerald-600/40 text-left rounded-xl group transition-all duration-150 cursor-pointer text-slate-300 hover:text-white"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-extrabold text-xs block group-hover:text-emerald-400">BENDAHARI (ADMIN)</span>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Akses penuh: Mendaftar ahli, merekod kutipan resit yuran RM3, import Excel pukal, dan menyelaraskan Google Sheets.</p>
                    </div>
                    <LogIn className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-emerald-400 transition" />
                  </div>
                </button>

                {/* Ahli Jawatankuasa (AJK) Button option */}
                <button
                  onClick={() => {
                    setShowAjkPassInput(true);
                    setShowAdminPassInput(false);
                    setAjkPassAttempt('');
                    setLoginError(null);
                  }}
                  className="p-3.5 bg-slate-900 hover:bg-[#1e1b4b] border border-slate-800 hover:border-amber-600/40 text-left rounded-xl group transition-all duration-150 cursor-pointer text-slate-300 hover:text-white"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-extrabold text-xs block group-hover:text-amber-400">AHLI JAWATANKUASA (AJK)</span>
                      <p className="text-[10px] text-slate-550 mt-0.5 leading-relaxed font-sans">Akses laporan: Semua tab tetamu ditambah dengan Penyata Kira-Kira, serta dibenarkan mencetak PDF dan mengeksport Excel.</p>
                    </div>
                    <LogIn className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-amber-400 transition" />
                  </div>
                </button>

                {/* Read-Only visitor Button option */}
                <button
                  onClick={() => handleLogin('user')}
                  className="p-3.5 bg-slate-900 hover:bg-[#131f2f] border border-slate-800 hover:border-indigo-650/30 text-left rounded-xl group transition-all duration-150 cursor-pointer text-slate-300 hover:text-white"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-extrabold text-xs block group-hover:text-indigo-400">TETAMU (BACA SAHAJA)</span>
                      <p className="text-[10px] text-slate-555 mt-0.5 leading-relaxed">Akses telus: Menyaring & menyemak status tunggakan keahlian peribadi, melihat lejar am, serta cetak Sijil Perakuan.</p>
                    </div>
                    <LogIn className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-indigo-400 transition" />
                  </div>
                </button>

              </div>
            </div>
          ) : showAdminPassInput ? (
            <form onSubmit={handleAdminAuthSubmit} className="space-y-4 pt-3 text-left">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminPassInput(false);
                    setLoginError(null);
                  }}
                  className="p-1 text-slate-400 hover:text-white transition rounded cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Log Masuk Pentadbir (Admin)</span>
              </div>

              {loginError && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-[10px] font-semibold rounded-lg flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1.5 focus-within:text-emerald-400">
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Kata Laluan Pentadbir</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Lock className="h-3.8 w-3.8" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan kata laluan..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 text-slate-100 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-bold tracking-wider"
                    value={adminPassAttempt}
                    onChange={(e) => setAdminPassAttempt(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminPassInput(false);
                    setLoginError(null);
                  }}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white transition rounded-xl text-[10px] font-bold uppercase cursor-pointer text-center border border-slate-800"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#047857] hover:bg-emerald-700 text-white transition rounded-xl text-[10px] font-black uppercase cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sahkan & Masuk
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAjkAuthSubmit} className="space-y-4 pt-3 text-left">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAjkPassInput(false);
                    setLoginError(null);
                  }}
                  className="p-1 text-slate-400 hover:text-white transition rounded cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider text-amber-400">Log Masuk Ahli Jawatankuasa (AJK)</span>
              </div>

              {loginError && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-[10px] font-semibold rounded-lg flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1.5 focus-within:text-amber-400">
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Kata Laluan AJK</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Lock className="h-3.8 w-3.8" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan kata laluan AJK..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 text-slate-100 text-xs rounded-xl focus:outline-none focus:border-amber-500 font-bold tracking-wider"
                    value={ajkPassAttempt}
                    onChange={(e) => setAjkPassAttempt(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAjkPassInput(false);
                    setLoginError(null);
                  }}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white transition rounded-xl text-[10px] font-bold uppercase cursor-pointer text-center border border-slate-800"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white transition rounded-xl text-[10px] font-black uppercase cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sahkan & Masuk
                </button>
              </div>
            </form>
          )}

          <div className="pt-2 border-t border-slate-900 flex justify-center text-slate-600 font-mono text-[9px]">
            <span>Portal Pengurusan Khairat &copy; Terengganu v2.0.0</span>
          </div>
        </div>
      </div>
    );
  }

  // Render Active Portal Tab Screen
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" id="khairat-portal-view">
      
      {/* Dynamic Header Navbar navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        state={state}
        currentRole={currentRole}
        onLogout={handleLogout}
        isServerConnected={isServerConnected}
      />

      {/* Sync Error Ribbon */}
      {syncError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-rose-800 text-xs font-bold font-sans flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
          <span>Amaran Segerak Gagal: {syncError}</span>
          <button onClick={() => setSyncError(null)} className="ml-auto text-rose-500 hover:text-rose-700 font-black">&times;</button>
        </div>
      )}

      {/* Master Content Area wrapping the modules based on Navbar tab */}
      <main className="flex-grow p-4 md:p-6 max-w-7xl w-full mx-auto pb-12">
        <div id="active-tab-container">
          {activeTab === 'overview' && (
            <Overview
              state={state}
              onChangeState={handleChangeState}
              onNavigate={setActiveTab}
              currentRole={currentRole}
            />
          )}

          {activeTab === 'database' && (
            <MemberDatabase
              state={state}
              onChangeState={handleChangeState}
              onRefresh={handleRefreshFromSheets}
              syncLoading={syncLoading}
              currentRole={currentRole}
              onViewProfile={(noAhli) => {
                setSelectedMemberId(noAhli);
                setActiveTab('profile');
              }}
            />
          )}

          {activeTab === 'payment' && currentRole === 'admin' && (
            <PaymentGate
              state={state}
              onChangeState={handleChangeState}
            />
          )}

          {activeTab === 'ledger' && currentRole !== 'user' && (
            <PaymentLedger
              state={state}
              onChangeState={handleChangeState}
              onRefresh={handleRefreshFromSheets}
              syncLoading={syncLoading}
              currentRole={currentRole}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileDashboard
              state={state}
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              onChangeState={handleChangeState}
              currentRole={currentRole}
            />
          )}

          {activeTab === 'rumusan' && (
            <ReportsSummary
              state={state}
              currentRole={currentRole}
              onViewProfile={(noAhli) => {
                setSelectedMemberId(noAhli);
                setActiveTab('profile');
              }}
            />
          )}

          {activeTab === 'kewangan' && (currentRole === 'admin' || currentRole === 'ajk') && (
            <PenyataKiraKira
              state={state}
              onChangeState={handleChangeState}
              currentRole={currentRole}
            />
          )}

          {activeTab === 'integrasi' && currentRole === 'admin' && (
            <IntegrationPanel
              state={state}
              onChangeState={handleChangeState}
              onRefresh={handleRefreshFromSheets}
              isServerConnected={isServerConnected}
              syncLoading={syncLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}
