import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../../types';
import { translations, Language } from '../../utils/i18n';
import { CompanyLogo } from './CompanyLogo';
import { 
  Building2, 
  ShieldCheck, 
  HardHat, 
  UserCheck, 
  Sun, 
  Moon, 
  Languages, 
  Globe,
  LogOut, 
  LogIn,
  User,
  ChevronDown,
  LayoutGrid,
  LayoutDashboard,
  Menu,
  X,
  FileCheck,
  Phone
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile | null;
  onLogout: () => void;
  language: Language;
  onToggleLanguage: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSqlModal?: () => void;
  currentRole: string;
  onOpenLogin: () => void;
  onOpenPortal?: () => void;
  onNavigateHome: () => void;
  onNavigateSection?: (sectionId: string) => void;
  activeSection?: string;
  activeView?: 'landing' | 'portal' | 'login' | 'test-request';
  onOpenTestRequest?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  language,
  onToggleLanguage,
  isDarkMode,
  onToggleDarkMode,
  currentRole,
  onOpenLogin,
  onOpenPortal,
  onNavigateHome,
  onNavigateSection,
  activeSection = 'home',
  activeView = 'landing',
  onOpenTestRequest
}) => {
  const t = translations[language];
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const isFa = language === 'fa';

  const navLinks = [
    { id: 'home', labelFa: 'صفحه اصلی', labelEn: 'Home' },
    { id: 'services', labelFa: 'خدمات ما', labelEn: 'Services' },
    { id: 'about', labelFa: 'درباره ما', labelEn: 'About Us' },
    { id: 'contact', labelFa: 'تماس با ما', labelEn: 'Contact Us' },
  ];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          label: t.roleAdmin,
          bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-800',
          icon: ShieldCheck
        };
      case 'operator':
        return {
          label: t.roleOperator,
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          icon: HardHat
        };
      case 'customer':
      default:
        return {
          label: t.roleCustomer,
          bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          icon: UserCheck
        };
    }
  };

  const roleInfo = getRoleBadge(currentRole);
  const RoleIcon = roleInfo.icon;

  const currentActive = hoveredSection || activeSection;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-cyan-500/20 bg-white dark:bg-[#041d2d] shadow-xs transition-colors text-slate-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Title (Right side in RTL) */}
        <div 
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink min-w-0"
        >
          <div className="text-start min-w-0">
            <span className="font-black text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white block leading-tight truncate">
              {isFa ? 'آزما بتن جهان بین' : 'Azma Beton Jahan Bin'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] sm:text-xs text-teal-600 dark:text-[#00c49f] font-bold truncate block">
                {isFa ? 'آزمایشگاه تخصصی مقاومت مصالح، بتن و ژئوتکنیک' : 'Specialized Materials Resistance, Concrete & Geotechnical Lab'}
              </span>
            </div>
          </div>
          <CompanyLogo className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-sm border border-slate-200 dark:border-cyan-500/30 group-hover:scale-105 transition-transform shrink-0" />
        </div>

        {/* Center Navigation Links with Modern Mint/Turquoise Pill Active Indicator */}
        <nav 
          className="hidden lg:flex items-center gap-1 relative px-2 py-1.5 rounded-full bg-[#f1f5f9] dark:bg-[#082a3c] border border-slate-200/90 dark:border-cyan-500/20 shadow-xs"
          onMouseLeave={() => setHoveredSection(null)}
        >
          {navLinks.map((link) => {
            const isActive = currentActive === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  if (onNavigateSection) {
                    onNavigateSection(link.id);
                  } else {
                    onNavigateHome();
                  }
                }}
                onMouseEnter={() => setHoveredSection(link.id)}
                className={`relative px-5 py-2 text-xs sm:text-sm font-bold transition-all duration-200 rounded-full cursor-pointer z-10 ${
                  isActive
                    ? 'text-white font-black bg-[#00c49f] shadow-sm shadow-teal-500/30'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span>{isFa ? link.labelFa : link.labelEn}</span>
              </button>
            );
          })}
        </nav>

        {/* Left Navigation Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Subtle Language Toggle - hidden on tiny mobile, shown in drawer */}
          {(activeView === 'landing' || !currentUser) && (
            <button
              id="btn-toggle-language"
              onClick={onToggleLanguage}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-[#f1f5f9] dark:bg-[#082a3c] hover:bg-slate-200 dark:hover:bg-[#0d3b53] border border-slate-200/80 dark:border-cyan-500/20 transition cursor-pointer"
              title={isFa ? 'تغییر به زبان انگلیسی (Switch to English)' : 'تغییر به زبان فارسی (Switch to Persian)'}
              aria-label={isFa ? 'تغییر زبان به انگلیسی' : 'Switch language to Persian'}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="font-bold text-xs">{isFa ? 'FA' : 'EN'}</span>
            </button>
          )}

          <button
            id="btn-toggle-theme"
            onClick={onToggleDarkMode}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-full bg-[#f1f5f9] dark:bg-[#082a3c] hover:bg-slate-200 dark:hover:bg-[#0d3b53] border border-slate-200/80 dark:border-cyan-500/20 transition cursor-pointer"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700 dark:text-cyan-300" />}
          </button>

          {/* If NOT logged in: Clean Rounded "ورود به سامانه" Button. If logged in: Show Portal & Profile */}
          {!currentUser ? (
            <button
              id="btn-nav-login"
              onClick={onOpenLogin}
              className="px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-[#0a2e42] hover:bg-[#0f3d54] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition active:scale-95 cursor-pointer shadow-sm shrink-0"
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
              <span>{isFa ? 'ورود به سامانه' : 'Sign In'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Go to Dashboard */}
              <button
                onClick={onOpenPortal}
                className="px-3 sm:px-4 py-2 rounded-full bg-[#00c49f] hover:bg-[#00b08e] text-slate-950 text-xs font-black shadow-md shadow-teal-500/25 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isFa ? (currentRole === 'admin' ? 'پنل مدیریت' : currentRole === 'operator' ? 'پنل اپراتور' : 'پرتال کاربری') : 'Dashboard'}
                </span>
                <span className="sm:hidden">{isFa ? 'پنل' : 'App'}</span>
              </button>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  id="btn-user-menu"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white transition cursor-pointer"
                >
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${roleInfo.bg}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[90px]">{roleInfo.label}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showUserMenu && (
                  <div 
                    className="absolute end-0 mt-2 w-72 rounded-2xl bg-slate-900 shadow-2xl border border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-white"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <div className="px-4 py-3 border-b border-slate-800">
                      <p className="text-xs font-medium text-slate-400">{t.activeUser}:</p>
                      <p className="text-sm font-bold text-white">{currentUser.fullName}</p>
                      <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">
                          {currentUser.role === 'admin' ? (isFa ? 'مدیر ارشد' : 'Admin') : currentUser.role === 'operator' ? (isFa ? 'اپراتور' : 'Operator') : (isFa ? 'کارفرما / مشتری' : 'Customer')}
                        </span>
                        {currentUser.phone && (
                          <span className="text-[10px] font-mono text-slate-400" dir="ltr">
                            {currentUser.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-1 mt-1 px-2">
                      <button
                        id="btn-logout"
                        onClick={onLogout}
                        className="w-full text-start px-3 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 rounded-xl flex items-center gap-2 transition cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t.logout}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile Menu Hamburger Button (visible on screens < lg) */}
          <button
            id="btn-mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-cyan-500/20 bg-white/95 dark:bg-[#041d2d]/95 backdrop-blur-xl px-4 py-4 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onNavigateSection) {
                      onNavigateSection(link.id);
                    } else {
                      onNavigateHome();
                    }
                  }}
                  className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                    isActive
                      ? 'bg-teal-50 dark:bg-[#083344] text-teal-700 dark:text-[#00d2a0] font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#082a3c]'
                  }`}
                >
                  <span>{isFa ? link.labelFa : link.labelEn}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#00d2a0]" />}
                </button>
              );
            })}
          </div>

          {/* Quick Actions in Mobile Menu */}
          <div className="pt-2 border-t border-slate-100 dark:border-cyan-900/40 space-y-2">
            {/* Direct Login or Dashboard Button inside Drawer */}
            {!currentUser ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLogin();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#0a2e42] dark:hover:bg-[#0f3d54] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs border border-slate-700 dark:border-cyan-500/30 active:scale-98 transition cursor-pointer"
              >
                <User className="w-4 h-4 text-cyan-300" />
                <span>{isFa ? 'ورود به سامانه' : 'Sign In to Portal'}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenPortal) onOpenPortal();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#00c49f] hover:bg-[#00b08e] text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-xs active:scale-98 transition cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{isFa ? (currentRole === 'admin' ? 'ورود به پنل مدیریت' : currentRole === 'operator' ? 'ورود به پنل اپراتور' : 'ورود به پرتال مشتریان') : 'Go to Dashboard'}</span>
              </button>
            )}

            {/* Test Request Action */}
            {onOpenTestRequest && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenTestRequest();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00d2a0] to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-teal-500/20 active:scale-98 transition cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>{isFa ? 'ثبت درخواست خدمات و مشاوره' : 'Submit Service Request'}</span>
              </button>
            )}

            {/* Mobile Language & Call row */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onToggleLanguage}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#082a3c] text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-cyan-500/20"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>{isFa ? 'English (تغییر زبان)' : 'فارسی (Persian)'}</span>
              </button>

              <a
                href="tel:09131703177"
                className="py-2 px-3 rounded-xl bg-teal-50 dark:bg-[#083344] text-teal-700 dark:text-[#00d2a0] text-xs font-bold flex items-center justify-center gap-1.5 border border-teal-200 dark:border-cyan-500/30 font-mono"
                dir="ltr"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>09131703177</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
