/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppState } from '../types';
import { LayoutDashboard, Users, CreditCard, Table, Search, FileText, Settings, LogOut, Database, HelpCircle } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  state: AppState;
  currentRole: 'admin' | 'user';
  onLogout: () => void;
}

export default function Navbar({ activeTab, onTabChange, state, currentRole, onLogout }: NavbarProps) {
  // Navigation tabs mapping
  const tabs = [
    { id: 'overview', label: 'Paparan Keseluruhan', icon: LayoutDashboard, role: 'both' },
    { id: 'database', label: 'Pangkalan Data Ahli', icon: Users, role: 'both' },
    { id: 'payment', label: 'Bayaran Yuran Ahli', icon: CreditCard, role: 'admin' },
    { id: 'ledger', label: 'Rekod Jadual Pembayaran', icon: Table, role: 'both' },
    { id: 'profile', label: 'Dashboard Carian Ahli', icon: Search, role: 'both' },
    { id: 'rumusan', label: 'Rumusan Khairat', icon: FileText, role: 'both' },
    { id: 'integrasi', label: 'Integrasi', icon: Settings, role: 'admin' },
  ];

  // Helper to trim down Sheet ID to look exactly like the screenshot: G1-hdkw...zg9A
  const getDisplaySheetId = (id: string) => {
    if (!id) return '';
    if (id.length <= 12) return id;
    return `${id.substring(0, 6)}...${id.substring(id.length - 4)}`;
  };

  return (
    <header className="w-full flex flex-col font-sans shrink-0 shadow-sm" id="portal-header">
      {/* Top Emerald Header Panel */}
      <div className="bg-[#064e3b] text-white px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 border-b border-[#047857]">
        {/* Title and Branding */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg text-emerald-900 shadow-sm shrink-0 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h1 className="text-xs sm:text-sm font-extrabold uppercase leading-tight tracking-wide">
              Sistem Pengurusan Pertubuhan Khairat Kematian dan Kebajikan Kampung Gong Badak
            </h1>
            <p className="text-[10px] text-emerald-205 font-bold uppercase tracking-wider">
              Kuala Nerus, Terengganu
            </p>
          </div>
        </div>

        {/* Status Indicators & Session Controls */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3.5 text-xs">
          {/* Connection Sheet status light indicator (Green/Orange) */}
          <div className="flex items-center gap-1.5 bg-[#022c22]/55 p-1.5 px-3 rounded-full border border-emerald-800 font-mono text-[10px] text-emerald-250">
            <span className={`inline-block h-2 w-2 rounded-full ${state.useGoogleSheets && state.appsScriptUrl ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span>
              {state.useGoogleSheets && state.appsScriptUrl 
                ? `Database: Connected Sheet (ID: ${getDisplaySheetId(state.googleSheetsId)})`
                : 'Database: Offline Local Storage'
              }
            </span>
          </div>

          {/* Access status Indicator */}
          <div className="bg-[#022c22]/70 border border-emerald-700 px-3 py-1.5 rounded-md text-[10px] uppercase font-black tracking-wider text-emerald-300">
            {currentRole === 'admin' ? 'Akses: Admin (Utama)' : 'Akses: Pelawat (Baca Sahaja)'}
          </div>

          {/* Log Out Control */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-extrabold text-[10px] tracking-wide uppercase px-3 py-1.5 rounded-md cursor-pointer transition-colors shadow-2xs border-b border-red-900"
            title="Keluar dari portal pengurusan"
          >
            <LogOut className="h-3 w-3" />
            <span>Log Keluar</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation panel */}
      <div className="bg-[#0f172a] text-slate-300 px-4 py-1.5 flex overflow-x-auto select-none gap-1 scrollbar-none border-b border-slate-950">
        {tabs.map((tab) => {
          const isAllowed = tab.role === 'both' || currentRole === 'admin';
          if (!isAllowed) return null;

          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.8 text-xs font-bold rounded transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-700 text-white font-black shadow-inner border-b-2 border-white/30'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
              }`}
            >
              <Icon className="h-3.8 w-3.8 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
