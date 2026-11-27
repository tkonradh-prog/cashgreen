'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Database,
  History,
  Landmark,
  LogOut,
  ScanFace,
  User,
  Wallet,
} from 'lucide-react';
import { formatPLN } from '@/lib/format';
import { Account, AppTab, Transaction } from '@/lib/types';
import { useFinance } from './FinanceProvider';
import { AccountModal } from './modals/AccountModal';
import { CookieDbModal } from './modals/CookieDbModal';
import { ReconcileModal } from './modals/ReconcileModal';
import { SecurityModal } from './modals/SecurityModal';
import { TargetsModal } from './modals/TargetsModal';
import { TransactionEditModal } from './modals/TransactionEditModal';
import { AnimatedPLN } from './ui/AnimatedPLN';
import { CashFlowLogo } from './ui/CashFlowLogo';
import { AddTransactionView } from './views/AddTransactionView';
import { AnalyticsView } from './views/AnalyticsView';
import { HistoryView } from './views/HistoryView';
import { WealthView } from './views/WealthView';

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  mobileTitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'add', label: 'Portfel', mobileTitle: 'Portfel', icon: Wallet },
  { id: 'history', label: 'Historia', mobileTitle: 'Historia', icon: History },
  { id: 'analytics', label: 'Analityka', mobileTitle: 'Analityka', icon: BarChart3 },
  { id: 'wealth', label: 'Majątek', mobileTitle: 'Majątek', icon: Landmark },
];

export function FinanceApp({
  username = 'admin',
  onLoggedOut,
}: {
  username?: string;
  onLoggedOut?: () => void;
}) {
  const router = useRouter();
  const { accountsSummary, supabaseConfig } = useFinance();

  const [activeTab, setActiveTab] = useState<AppTab>('add');
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | null>(null);
  const [historyMonthFilter, setHistoryMonthFilter] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Modals state
  const [reconcileAccountId, setReconcileAccountId] = useState<string | undefined>(undefined);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [targetsModalOpen, setTargetsModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const openReconcile = (accountId?: string) => {
    setReconcileAccountId(accountId);
    setReconcileOpen(true);
  };

  const handleInspectMonth = (ym: string) => {
    setHistoryMonthFilter(ym);
    handleSelectTab('history');
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } finally {
      onLoggedOut?.();
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-transparent text-white">
      {/* ===================================================================== */}
      {/* DESKTOP SIDEBAR (md+) — iOS Frosted Glass Sidebar                     */}
      {/* ===================================================================== */}
      <aside className="hidden md:flex md:w-64 lg:w-70 shrink-0 flex-col justify-between border-r border-white/[0.08] bg-[#090c12]/60 backdrop-blur-2xl backdrop-saturate-180 sticky top-0 h-screen p-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
        <div className="space-y-6">
          {/* Brand header */}
          <button
            type="button"
            onClick={() => handleSelectTab('add')}
            className="flex items-center gap-3 text-left cursor-pointer group active:scale-[0.98] transition-transform"
          >
            <CashFlowLogo size="md" className="group-hover:scale-105 transition-transform duration-200" />
            <div>
              <div className="text-lg font-extrabold tracking-tight text-white leading-none">
                CashFlow
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-medium">Business Suite</div>
            </div>
          </button>

          {/* Liquid Capital Balance Card */}
          <button
            type="button"
            onClick={() => handleSelectTab('wealth')}
            className="w-full rounded-2xl finte-card-elevated hover:border-white/25 p-4 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer space-y-1.5"
          >
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Dostępne środki
            </div>
            <div className="text-2xl font-extrabold tabular-nums tracking-tight text-white">
              <AnimatedPLN valueGrosze={accountsSummary.liquidTotalGrosze} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1.5 border-t border-white/[0.08] tabular-nums font-medium gap-1.5">
              <span className="whitespace-nowrap">Gotówka: <strong className="text-white font-bold">{formatPLN(accountsSummary.cashTotalGrosze)}</strong></span>
              <span className="whitespace-nowrap">Konta: <strong className="text-white font-bold">{formatPLN(accountsSummary.bankTotalGrosze)}</strong></span>
            </div>
          </button>

          {/* Desktop Nav Items with Sliding iOS Pill */}
          <nav aria-label="Nawigacja desktopowa" className="relative flex flex-col gap-1">
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-0 h-10 rounded-xl bg-white/95 shadow-[0_4px_18px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,0.8)] pointer-events-none ios-spring-glide"
              style={{
                transform: `translateY(${Math.max(0, NAV_ITEMS.findIndex((n) => n.id === activeTab)) * 44}px)`,
              }}
            />
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`relative z-10 h-10 w-full flex items-center gap-3 px-3.5 rounded-xl text-sm font-semibold transition-colors duration-200 active:scale-[0.98] cursor-pointer ${
                    active
                      ? 'text-black font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-300 ${active ? 'text-black scale-110' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile & Backup */}
        <div className="space-y-3 pt-4 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => setCookieModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-neutral-400" />
              <span>Baza danych</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-neutral-300 font-mono">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  supabaseConfig.tablesReady ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {supabaseConfig.tablesReady ? 'Supabase' : 'Lokalna'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSecurityModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ScanFace className="w-3.5 h-3.5 text-[#2dd4bf]" />
              <span>Face ID / Biometria</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-neutral-300">
              Passkey
            </span>
          </button>

          <div className="rounded-2xl ios-glass-inset p-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSecurityModalOpen(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
            >
              <span className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0 group-hover:border-white/40 transition-colors">
                <User className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{username}</div>
                <div className="text-[10px] text-neutral-400 truncate">Konto i biometria</div>
              </div>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Wyloguj się"
              className="p-2 rounded-xl ios-glass-pill hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* MOBILE SMARTPHONE TOP BAR (< md) — iOS Translucent Frosted Bar        */}
      {/* ===================================================================== */}
      <header className="md:hidden sticky top-0 z-30 border-b border-white/[0.09] bg-[#07090e]/65 backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <div className="px-4 h-14 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleSelectTab('add')}
            className="flex items-center gap-2.5 active:scale-95 transition-transform cursor-pointer"
          >
            <CashFlowLogo size="sm" />
            <span className="text-base font-extrabold tracking-tight text-white">CashFlow</span>
          </button>

          <div className="flex items-center gap-1.5">
            {activeTab !== 'add' && (
              <button
                type="button"
                onClick={() => handleSelectTab('wealth')}
                className="px-2.5 py-1 rounded-full ios-glass-pill text-[11px] font-bold tabular-nums text-white active:scale-95 transition-all cursor-pointer animate-fade-in"
              >
                <AnimatedPLN valueGrosze={accountsSummary.liquidTotalGrosze} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSecurityModalOpen(true)}
              aria-label="Face ID i konto"
              className="p-1.5 rounded-full ios-glass-pill text-neutral-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            >
              <ScanFace className="w-3.5 h-3.5 text-[#2dd4bf]" />
            </button>
            <button
              type="button"
              onClick={() => setCookieModalOpen(true)}
              aria-label="Kopia danych"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ios-glass-pill text-xs font-bold text-neutral-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  supabaseConfig.tablesReady ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Wyloguj"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full ios-glass-pill text-xs font-bold text-neutral-300 hover:text-red-400 active:scale-95 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN WORKSPACE                                                        */}
      {/* ===================================================================== */}
      <main className="flex-1 min-w-0 pb-28 md:pb-12 bg-transparent">
        <div
          key={activeTab}
          className="max-w-[1140px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-3.5 md:pt-8 animate-view-enter"
        >
          {activeTab === 'add' && (
            <AddTransactionView
              preselectedAccountId={preselectedAccountId}
              onClearPreselectedAccount={() => setPreselectedAccountId(null)}
              onOpenReconcile={(id) => openReconcile(id)}
              onEditTransaction={(tx) => setEditingTx(tx)}
              onNavigateTab={handleSelectTab}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              onEditTransaction={(tx) => setEditingTx(tx)}
              onNavigateTab={handleSelectTab}
              initialMonthFilter={historyMonthFilter}
              onClearInitialMonthFilter={() => setHistoryMonthFilter(null)}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              onOpenTargets={() => setTargetsModalOpen(true)}
              onInspectMonth={handleInspectMonth}
            />
          )}

          {activeTab === 'wealth' && (
            <WealthView
              onAddAccount={() => {
                setEditingAccount(null);
                setAccountModalOpen(true);
              }}
              onEditAccount={(acc) => {
                setEditingAccount(acc);
                setAccountModalOpen(true);
              }}
              onOpenReconcile={(id) => openReconcile(id)}
              onQuickAddForAccount={(id) => {
                setPreselectedAccountId(id);
                handleSelectTab('add');
              }}
            />
          )}
        </div>
      </main>

      {/* ===================================================================== */}
      {/* MOBILE SMARTPHONE FLOATING DOCK (< md) — iOS 18 Sliding Liquid Dock   */}
      {/* ===================================================================== */}
      <nav
        aria-label="Nawigacja mobilna"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-safe pointer-events-none"
      >
        <div className="relative pointer-events-auto mx-auto max-w-md mb-1 rounded-[28px] bg-[#131722]/72 backdrop-blur-3xl backdrop-saturate-200 border border-white/[0.17] shadow-[0_20px_50px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.04)] p-1.5 grid grid-cols-4 gap-1">
          {/* Sliding Active Pill */}
          <span
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 left-1.5 rounded-[22px] bg-white/95 shadow-[0_4px_18px_rgba(255,255,255,0.28),inset_0_1px_0_rgba(255,255,255,0.9)] pointer-events-none ios-spring-glide"
            style={{
              width: 'calc((100% - 24px) / 4)',
              transform: `translateX(calc(${Math.max(0, NAV_ITEMS.findIndex((n) => n.id === activeTab))} * (100% + 4px)))`,
            }}
          />

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`relative z-10 flex flex-col items-center justify-center gap-0.5 py-2 rounded-[22px] transition-colors duration-200 active:scale-90 cursor-pointer ${
                  active
                    ? 'text-black font-bold'
                    : 'text-neutral-300/80 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] transition-transform duration-300 ease-[cubic-bezier(0.32,1.28,0.56,1)] ${
                    active ? 'text-black scale-110 -translate-y-0.5' : 'text-neutral-300/80'
                  }`}
                />
                <span className="text-[10.5px] font-semibold tracking-tight leading-tight">
                  {item.mobileTitle}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <ReconcileModal
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        initialAccountId={reconcileAccountId}
      />

      <AccountModal
        open={accountModalOpen}
        onClose={() => {
          setAccountModalOpen(false);
          setEditingAccount(null);
        }}
        editingAccount={editingAccount}
      />

      <TransactionEditModal
        transaction={editingTx}
        onClose={() => setEditingTx(null)}
      />

      <CookieDbModal
        open={cookieModalOpen}
        onClose={() => setCookieModalOpen(false)}
      />

      <TargetsModal
        open={targetsModalOpen}
        onClose={() => setTargetsModalOpen(false)}
      />

      <SecurityModal
        open={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
        username={username}
      />
    </div>
  );
}
