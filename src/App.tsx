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
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing cached state, resetting...', e);
      }
    }
    return getDefaultAppState();
  });

  const [currentRole, setCurrentRole] = useState<'admin' | 'user' | null>(() => {
    const cachedRole = localStorage.getItem('khairat_gong_badak_role_v1');
    return (cachedRole === 'admin' || cachedRole === 'user') ? cachedRole : null; // null triggers Login Gate view
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Admin authentication state
  const [showAdminPassInput, setShowAdminPassInput] = useState(false);
  const [adminPassAttempt, setAdminPassAttempt] = useState('');
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
    const loadSharedStateOnBoot = async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.state) {
            setState(data.state);
            localStorage.setItem('khairat_gong_badak', JSON.stringify(data.state));
            localStorage.setItem('khairat_gong_badak_state_v1', JSON.stringify(data.state));
          }
        }
      } catch (err) {
        console.warn('Failed to pull bootstrapped state from container server:', err);
      }
    };
    loadSharedStateOnBoot();
  }, []);

  // Pull remote data on load if configured
  useEffect(() => {
    if (currentRole && state.useGoogleSheets && state.appsScriptUrl) {
      handleRefreshFromSheets();
    }
  }, [currentRole]);

  // Handle simulated login
  const handleLogin = (role: 'admin' | 'user') => {
    setCurrentRole(role);
    localStorage.setItem('khairat_gong_badak_role_v1', role);
    // If user is visitor (read-only), safety-switch tab to overview if it was integrasi or payment
    if (role === 'user') {
      setActiveTab('overview');
    }
  };

  // Handle simulated logout
  const handleLogout = () => {
    setCurrentRole(null);
    localStorage.removeItem('khairat_gong_badak_role_v1');
    setShowAdminPassInput(false);
    setAdminPassAttempt('');
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

          {!showAdminPassInput ? (
            <div className="space-y-3 pt-3">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sila Pilih Sesi Akses Portal:</span>
              
              <div className="grid grid-cols-1 gap-2.5">
                
                {/* Admin Button option */}
                <button
                  onClick={() => {
                    setShowAdminPassInput(true);
                    setAdminPassAttempt('');
                    setLoginError(null);
                  }}
                  className="p-3.5 bg-slate-900 hover:bg-[#122c23] border border-slate-800 hover:border-emerald-600/40 text-left rounded-xl group transition-all duration-150 cursor-pointer text-slate-300 hover:text-white"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-extrabold text-xs block group-hover:text-emerald-400">PENGURUS JAWATANKUASA (ADMIN)</span>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Akses penuh: Mendaftar ahli, merekod kutipan resit yuran RM3, import Excel pukal, dan menyelaraskan Google Sheets.</p>
                    </div>
                    <LogIn className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-emerald-400 transition" />
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
                      <p className="text-[10px] text-slate-505 mt-0.5 leading-relaxed">Akses telus: Menyaring & menyemak status tunggakan keahlian peribadi, melihat lejar am, serta cetak Sijil Perakuan.</p>
                    </div>
                    <LogIn className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-indigo-400 transition" />
                  </div>
                </button>

              </div>
            </div>
          ) : (
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
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Kata Laluan Pentadbir (Lalai: gongbadak123)</label>
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

          {activeTab === 'ledger' && (
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
              onViewProfile={(noAhli) => {
                setSelectedMemberId(noAhli);
                setActiveTab('profile');
              }}
            />
          )}

          {activeTab === 'integrasi' && currentRole === 'admin' && (
            <IntegrationPanel
              state={state}
              onChangeState={handleChangeState}
              onRefresh={handleRefreshFromSheets}
              syncLoading={syncLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}
