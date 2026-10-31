import React, { useState, useEffect, lazy, Suspense } from 'react';
import { UserProfile, Customer, TestReport, Invoice, AccountingRecord } from './types';
import { labDb, LAB_INFO } from './services/supabase';
import { Language, translations } from './utils/i18n';
import { Navbar } from './components/common/Navbar';
import { LandingPage } from './components/landing/LandingPage';
import { ForcePasswordChangeModal } from './components/auth/ForcePasswordChangeModal';
import { CompanyLogo } from './components/common/CompanyLogo';
import { navHistory, AppView } from './services/navigationHistory';
import { Building2, Phone, Instagram, Linkedin, Send, Globe, ArrowRight, ArrowLeft } from 'lucide-react';

// PERF: heavy role-based views are code-split into lazily-loaded chunks so the
// initial bundle only ships the landing/login shell.
const SqlSchemaModal = lazy(() => import('./components/common/SqlSchemaModal').then(m => ({ default: m.SqlSchemaModal })));
const LoginView = lazy(() => import('./components/auth/LoginView').then(m => ({ default: m.LoginView })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const OperatorDashboard = lazy(() => import('./components/operator/OperatorDashboard').then(m => ({ default: m.OperatorDashboard })));
const CustomerPortal = lazy(() => import('./components/customer/CustomerPortal').then(m => ({ default: m.CustomerPortal })));
const TestRequestPage = lazy(() => import('./components/landing/TestRequestPage').then(m => ({ default: m.TestRequestPage })));

function ViewFallback({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="animate-pulse text-sm text-slate-400">{label || 'Loading…'}</div>
    </div>
  );
}

export function App() {
  // Navigation View State ('landing' | 'portal' | 'login' | 'test-request')
  const [activeView, setActiveView] = useState<'landing' | 'portal' | 'login' | 'test-request'>(() => navHistory.getCurrentView() || 'landing');

  // Unified navigation helper that guarantees immediate React state update + browser history sync
  const navigateToView = (view: 'landing' | 'portal' | 'login' | 'test-request', meta?: { tab?: string; replace?: boolean }) => {
    setActiveView(view);
    navHistory.navigateView(view, meta);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Theme State (Dark / Light) - Default to Dark Mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Language State (fa / en)
  const [language, setLanguage] = useState<Language>('fa');

  // Database Reactive State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => labDb.getCurrentUser());
  const [reports, setReports] = useState<TestReport[]>(() => labDb.getReports());
  const [customers, setCustomers] = useState<Customer[]>(() => labDb.getCustomers());
  const [invoices, setInvoices] = useState<Invoice[]>(() => labDb.getInvoices());
  const [accountingRecords, setAccountingRecords] = useState<AccountingRecord[]>(() => labDb.getAccountingRecords());
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => labDb.getProfiles());

  // SQL Schema Modal State
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Gentle root exit guard toast message
  const [appToast, setAppToast] = useState<string | null>(null);

  // Forced password-change gate (mustChangePassword flow)
  const [pendingForcedChangeUser, setPendingForcedChangeUser] = useState<UserProfile | null>(null);

  // Session restoration state (prevents premature ejection to login/landing)
  const [sessionRestoring, setSessionRestoring] = useState<boolean>(() => {
    return (!!labDb.getSessionToken() || !!labDb.getRefreshToken()) && !labDb.getCurrentUser();
  });
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  // Subscribe to session expiration events
  useEffect(() => {
    const unsubExpired = labDb.onSessionExpired(() => {
      setSessionExpired(true);
      setCurrentUser(null);
      navigateToView('login');
    });
    return () => unsubExpired();
  }, []);

  // Subscribe to Navigation History popstate & view changes
  useEffect(() => {
    const unsubNav = navHistory.subscribeView((view) => {
      setActiveView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    const unsubToast = navHistory.subscribeToast((msg) => {
      setAppToast(msg);
      setTimeout(() => setAppToast(null), 2500);
    });
    return () => {
      unsubNav();
      unsubToast();
    };
  }, []);

  // Clean obsolete keys from older releases if present, without wiping entire origin storage.
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const obsoleteKeys = ['lab_session_token', 'concrete_lab_storage', 'demo_database', 'azma_mock_db'];
        for (const k of obsoleteKeys) {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        }
      }
    } catch (e) {}

    // Restore user session from signed token or refresh token if present
    const token = labDb.getSessionToken();
    const hasRefreshToken = !!labDb.getRefreshToken();

    if (token) {
      if (!labDb.getCurrentUser()) {
        setSessionRestoring(true);
      }
      fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (res.status === 401 && hasRefreshToken) {
            const refreshed = await labDb.tryRefreshSession();
            if (refreshed) {
              const freshUser = labDb.getCurrentUser();
              if (freshUser) {
                setCurrentUser(freshUser);
                setSessionRestoring(false);
                if (window.location.hash.startsWith('#portal') || activeView === 'portal') {
                  navigateToView('portal', { replace: true });
                }
                return;
              }
            }
          }
          const json = await res.json().catch(() => null);
          if (res.ok && json?.success && json?.user) {
            labDb.setCurrentUser(json.user);
            setCurrentUser(json.user);
            if (window.location.hash.startsWith('#portal') || activeView === 'portal') {
              navigateToView('portal', { replace: true });
            }
          } else if (res.status === 401 && !hasRefreshToken) {
            labDb.setSessionToken(null);
            if (activeView === 'portal') {
              navigateToView('login');
            }
          }
          setSessionRestoring(false);
        })
        .catch(() => {
          // On network error, retain existing tokens and avoid ejecting the user
          setSessionRestoring(false);
        });
    } else if (hasRefreshToken) {
      // Session token absent or expired, but persistent refresh token exists
      setSessionRestoring(true);
      labDb.tryRefreshSession()
        .then((refreshed) => {
          if (refreshed) {
            const freshUser = labDb.getCurrentUser();
            if (freshUser) {
              setCurrentUser(freshUser);
              if (window.location.hash.startsWith('#portal') || activeView === 'portal') {
                navigateToView('portal', { replace: true });
              }
            }
          } else if (activeView === 'portal') {
            navigateToView('login');
          }
          setSessionRestoring(false);
        })
        .catch(() => {
          setSessionRestoring(false);
        });
    } else {
      setSessionRestoring(false);
    }
  }, []);

  // Sync Theme with HTML Document Class & Attributes
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Sync Language & RTL/LTR with HTML Document
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', language === 'fa' ? 'rtl' : 'ltr');
  }, [language]);

  // Subscribe to Realtime Data Engine Changes
  useEffect(() => {
    const unsubscribe = labDb.subscribe(() => {
      setCurrentUser(labDb.getCurrentUser());
      setReports(labDb.getReports());
      setCustomers(labDb.getCustomers());
      setInvoices(labDb.getInvoices());
      setAccountingRecords(labDb.getAccountingRecords());
      setAllUsers(labDb.getProfiles());
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (user: UserProfile) => {
    // Forced password-change gate: if the server flagged this account as still
    // using a default/legacy credential, show the change-password modal BEFORE
    // entering the portal. The session token stays active for the update call.
    if (user.mustChangePassword) {
      setPendingForcedChangeUser(user);
      return;
    }
    labDb.setCurrentUser(user);
    setCurrentUser(user);
    navigateToView('portal');
  };

  const handleForcedChangeSuccess = (updatedUser: UserProfile) => {
    setPendingForcedChangeUser(null);
    labDb.setCurrentUser(updatedUser);
    setCurrentUser(updatedUser);
    navigateToView('portal');
  };

  const handleForcedChangeCancel = () => {
    // User declined to change the password -> abort login entirely.
    setPendingForcedChangeUser(null);
    labDb.setCurrentUser(null);
    setCurrentUser(null);
    navigateToView('login');
  };

  const handleLogout = async () => {
    // BUG FIX (mass-logout #4): logout used to only clear local state and send
    // the user back to the landing page. The server-side session (jti) and the
    // refresh token stayed alive on the VPS, and navigating to 'landing' made
    // an intentional logout indistinguishable from a spurious redirect.
    // Now we revoke the session on the server first, then go to 'login'.
    try {
      await labDb.logout();
    } catch (e) {
      // Even if the revoke call fails (offline / server down), still clear
      // local state so the user is never stuck in a half-logged-in UI.
      console.warn('logout: server-side revoke failed', e);
    }
    labDb.setCurrentUser(null);
    setCurrentUser(null);
    navigateToView('login');
  };

  const handleSwitchUser = (user: UserProfile) => {
    labDb.setCurrentUser(user);
    setCurrentUser(user);
    navigateToView('portal');
  };

  const [activeSection, setActiveSection] = useState<string>('home');

  const scrollToTarget = (sectionId: string) => {
    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const targetId = sectionId === 'home' ? 'hero-section' :
      sectionId === 'services' ? 'section-services' :
      sectionId === 'about' ? 'section-process' :
      sectionId === 'gallery' ? 'section-simulations' :
      sectionId === 'contact' ? 'section-contact' : sectionId;

    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNavigateSection = (sectionId: string) => {
    setActiveSection(sectionId);
    if (activeView !== 'landing') {
      navigateToView('landing');
      setTimeout(() => {
        scrollToTarget(sectionId);
      }, 120);
    } else {
      scrollToTarget(sectionId);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'fa' ? 'en' : 'fa');
  };

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const currentRole = currentUser?.role;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Navigation Bar - Render on landing and login */}
      {activeView !== 'portal' && (
        <Navbar
          currentUser={currentUser}
          onLogout={handleLogout}
          language={language}
          onToggleLanguage={toggleLanguage}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          currentRole={currentRole || 'customer'}
          onOpenLogin={() => navigateToView('login')}
          onOpenPortal={() => navigateToView('portal')}
          onNavigateHome={() => {
            navigateToView('landing');
            setActiveSection('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateSection={handleNavigateSection}
          activeSection={activeSection}
          activeView={activeView}
          onOpenTestRequest={() => {
            navigateToView('test-request');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {/* Main Container */}
      <Suspense fallback={<ViewFallback />}>
          {activeView === 'landing' ? (
            <main className="w-full">
              <LandingPage
                onOpenLogin={() => navigateToView('login')}
                onLogin={handleLogin}
                availableUsers={allUsers}
                language={language}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                onOpenTestRequest={() => {
                  navigateToView('test-request');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                isDarkMode={isDarkMode}
              />
            </main>
          ) : activeView === 'test-request' ? (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <TestRequestPage
                onBack={() => navHistory.goBack()}
                language={language}
                isDarkMode={isDarkMode}
              />
            </main>
          ) : sessionRestoring ? (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {language === 'fa' ? 'در حال بازیابی نشست کاربری...' : 'Restoring user session...'}
              </p>
            </main>
          ) : activeView === 'login' ? (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {sessionExpired && (
                <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-bold text-center">
                  {language === 'fa'
                    ? 'نشست کاربری شما منقضی شده است. لطفاً جهت ادامه کار مجدداً وارد شوید.'
                    : 'Your session has expired. Please log in again to continue.'}
                </div>
              )}
              <div className="space-y-4">
                <button
                  onClick={() => navHistory.goBack()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#062436] border border-slate-200 dark:border-cyan-500/30 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#083344] transition shadow-xs cursor-pointer group"
                >
                  {language === 'fa' ? (
                    <ArrowRight className="w-4 h-4 text-teal-600 dark:text-[#00c49f] group-hover:translate-x-0.5 transition-transform" />
                  ) : (
                    <ArrowLeft className="w-4 h-4 text-teal-600 dark:text-[#00c49f] group-hover:-translate-x-0.5 transition-transform" />
                  )}
                  <span>{language === 'fa' ? 'بازگشت به مرحله قبل' : 'Back'}</span>
                </button>
                <LoginView
                  onLogin={handleLogin}
                  availableUsers={allUsers}
                  language={language}
                />
              </div>
            </main>
          ) : !currentUser ? (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {language === 'fa' ? 'در حال بارگذاری اطلاعات حساب کاربری...' : 'Loading user profile...'}
              </p>
            </main>
          ) : !currentRole || !['admin', 'operator', 'customer'].includes(currentRole) ? (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[50vh]">
              <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-center max-w-md">
                <p className="font-bold text-sm mb-2">
                  {language === 'fa' ? 'خطای شناسایی نقش کاربری' : 'Role Identification Error'}
                </p>
                <p className="text-xs mb-4">
                  {language === 'fa' ? 'نقش کاربری شما نامعتبر است. لطفاً مجدداً وارد سامانه شوید.' : 'Invalid user role. Please log in again.'}
                </p>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
                >
                  {language === 'fa' ? 'ورود مجدد به سامانه' : 'Log In Again'}
                </button>
              </div>
            </main>
          ) : currentRole === 'admin' ? (
            <AdminDashboard
              currentUser={currentUser}
              language={language}
              onLogout={handleLogout}
              onNavigateHome={() => navHistory.navigateView('landing')}
              allUsers={allUsers}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          ) : currentRole === 'operator' ? (
            <OperatorDashboard
              currentUser={currentUser}
              language={language}
              onLogout={handleLogout}
              onNavigateHome={() => navHistory.navigateView('landing')}
              allUsers={allUsers}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          ) : (
            <CustomerPortal
              currentUser={currentUser}
              language={language}
              onLogout={handleLogout}
              onNavigateHome={() => navHistory.navigateView('landing')}
              allUsers={allUsers}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          )}
      </Suspense>

      {/* Footer - matching uploaded design and new cyan/mint theme */}
      {activeView !== 'portal' && (
        <footer className="border-t border-slate-200 dark:border-cyan-500/20 py-8 bg-slate-100 dark:bg-[#031826] text-slate-800 dark:text-white no-print relative overflow-hidden transition-colors">
          {/* Subtle background glow */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00c49f]/60 to-transparent" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-start">
              
              {/* Right section (Logo & Brand in RTL) */}
              <div className="flex items-center gap-3">
                <CompanyLogo className="w-10 h-10 rounded-xl shadow-xs border border-slate-300 dark:border-cyan-500/30" />
                <div className="text-start">
                  <p className="font-black text-sm text-slate-900 dark:text-white tracking-wide">
                    {language === 'fa' ? 'آزما بتن پایش خاک و پی جهان بین' : 'Azma Beton Payesh Khak o Pey Jahan Bin'}
                  </p>
                  <p className="text-[11px] text-teal-700 dark:text-[#2dd4bf] font-medium">
                    {language === 'fa' ? 'آزمایشگاه تخصصی مقاومت مصالح، بتن و ژئوتکنیک' : 'Specialized Materials Resistance, Concrete & Geotechnical Lab'}
                  </p>
                </div>
              </div>

              {/* Center section (Official Slogan matching new brand palette) */}
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-[#00c49f]/10 border border-teal-200 dark:border-[#00c49f]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c49f] animate-pulse"></span>
                  <p className="font-black text-xs sm:text-sm text-teal-800 dark:text-cyan-300 tracking-wider">
                    {language === 'fa' ? '«دقت در آزمون - اطمینان در ساخت»' : 'Accuracy in Testing, Confidence in Construction'}
                  </p>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c49f] animate-pulse"></span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  {language === 'fa' ? 'مدیریت: مهندس صادقی نیا | شهرکرد، بلوار آیت الله کاشانی، انتهای کوچه ۳۰' : 'Management: Eng. Sadeghinia | Shahrekord, Kashani Blvd'}
                </p>
              </div>

              {/* Left section (Social Icons + Copyright in RTL) */}
              <div className="flex items-center gap-4">
                {/* Social icons */}
                <div className="flex items-center gap-2">
                  <a 
                    href="https://t.me" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title="Telegram"
                    aria-label="کانال تلگرام آزمایشگاه"
                    className="w-8 h-8 rounded-full bg-white dark:bg-[#083344] hover:bg-cyan-600 dark:hover:bg-cyan-600 text-slate-700 dark:text-cyan-200 hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-cyan-500/30 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5 rtl:-scale-x-100" />
                  </a>
                  <a 
                    href="https://instagram.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title="Instagram"
                    aria-label="صفحه اینستاگرام آزمایشگاه"
                    className="w-8 h-8 rounded-full bg-white dark:bg-[#083344] hover:bg-pink-600 text-slate-700 dark:text-cyan-200 hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-cyan-500/30 shadow-xs"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                  </a>
                  <a 
                    href="https://linkedin.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title="LinkedIn"
                    aria-label="صفحه لینکدین آزمایشگاه"
                    className="w-8 h-8 rounded-full bg-white dark:bg-[#083344] hover:bg-blue-600 text-slate-700 dark:text-cyan-200 hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-cyan-500/30 shadow-xs"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                  </a>
                  <a 
                    href={`tel:${LAB_INFO.phone}`} 
                    title="Call"
                    aria-label="تماس با تلفن دفتر آزمایشگاه"
                    className="w-8 h-8 rounded-full bg-white dark:bg-[#083344] hover:bg-[#00c49f] hover:text-slate-950 text-slate-700 dark:text-cyan-200 flex items-center justify-center transition border border-slate-200 dark:border-cyan-500/30 shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a 
                    href="https://www.azmajahanbin.ir" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title="وب‌سایت رسمی www.azmajahanbin.ir"
                    aria-label="وب‌سایت رسمی آزما بتن جهان بین"
                    className="h-8 px-2.5 rounded-full bg-white dark:bg-[#083344] hover:bg-[#00c49f] hover:text-slate-950 text-teal-700 dark:text-cyan-200 flex items-center gap-1.5 transition text-[11px] font-mono font-bold border border-slate-200 dark:border-cyan-500/30 shadow-xs"
                    dir="ltr"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>azmajahanbin.ir</span>
                  </a>
                </div>

                <div className="h-5 w-px bg-slate-300 dark:bg-cyan-800/80 hidden sm:block" />

                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                  {language === 'fa' ? '1405 کلیه حقوق محفوظ است.' : '© 2026 All Rights Reserved.'}
                </span>
              </div>

            </div>
          </div>
        </footer>
      )}

      {/* Supabase PostgreSQL Schema & RLS Policies Modal */}
      <SqlSchemaModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />

      {/* Forced Password Change Gate (mustChangePassword) */}
      {pendingForcedChangeUser && (
        <ForcePasswordChangeModal
          user={pendingForcedChangeUser}
          language={language}
          onSuccess={handleForcedChangeSuccess}
          onCancel={handleForcedChangeCancel}
        />
      )}

      {/* Root Exit Guard Toast Notice */}
      {appToast && (
        <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
          <div className="bg-slate-900/95 text-white dark:bg-[#062436]/95 dark:text-cyan-200 border border-slate-700 dark:border-cyan-500/40 px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 backdrop-blur-md animate-bounce">
            <ArrowRight className="w-4 h-4 text-[#00c49f] rtl:rotate-0 ltr:rotate-180" />
            <span>{appToast}</span>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
