// Navigation & History Stack Management Service
// Prevents accidental website exit on browser Back button / mobile gesture
// and provides step-by-step reverse navigation for views, tabs, and modals.

export type AppView = 'landing' | 'portal' | 'login' | 'test-request';

interface ModalEntry {
  id: string;
  onClose: () => void;
  pushedHistory: boolean;
  consumed?: boolean;
}

type ViewChangeSubscriber = (view: AppView, meta?: { tab?: string; fromPop?: boolean }) => void;
type ToastSubscriber = (message: string) => void;

class NavigationHistoryService {
  private modalStack: ModalEntry[] = [];
  private viewSubscribers: Set<ViewChangeSubscriber> = new Set();
  private toastSubscribers: Set<ToastSubscriber> = new Set();
  
  // Track current state
  private currentView: AppView = 'landing';
  private viewHistory: { view: AppView; tab?: string }[] = [{ view: 'landing' }];
  
  // Monotonic counter for silent pops (replaces unreliable 80ms timer boolean)
  private pendingSilentPops: number = 0;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    // Detect initial view from hash if present
    const initialHash = window.location.hash.replace('#', '');
    let initialView: AppView = 'landing';
    if (initialHash === 'login') initialView = 'login';
    else if (initialHash === 'test-request') initialView = 'test-request';
    else if (initialHash.startsWith('portal')) initialView = 'portal';

    this.currentView = initialView;
    this.viewHistory = [{ view: initialView }];

    // Replace current state with root entry
    window.history.replaceState(
      { appNav: true, view: initialView, depth: 0, isRoot: true },
      '',
      window.location.hash || (initialView === 'landing' ? '#home' : `#${initialView}`)
    );

    // Push an anchor state so that hitting back at root doesn't immediately exit
    window.history.pushState(
      { appNav: true, view: initialView, depth: 1, isAnchor: true },
      '',
      window.location.hash || (initialView === 'landing' ? '#home' : `#${initialView}`)
    );

    window.addEventListener('popstate', this.handlePopState);
  }

  private handlePopState = (event: PopStateEvent) => {
    if (this.pendingSilentPops > 0) {
      this.pendingSilentPops--;
      return;
    }

    // 1. If any modal is open, close the topmost modal first!
    if (this.modalStack.length > 0) {
      const topModal = this.modalStack.pop();
      if (topModal) {
        topModal.consumed = true;
        try {
          topModal.onClose();
        } catch (e) {
          console.error('Error in modal onClose:', e);
        }
      }
      return;
    }

    // 2. If we have sub-step history in the app (e.g. was on login, test-request, or subtab)
    if (this.viewHistory.length > 1) {
      const top = this.viewHistory[this.viewHistory.length - 1];
      const previous = this.viewHistory[this.viewHistory.length - 2];

      // If currently in portal and previous view is landing or login, do NOT leave portal!
      if (this.currentView === 'portal' && previous && previous.view !== 'portal') {
        this.notifyToast(
          typeof document !== 'undefined' && document.documentElement?.lang === 'en'
            ? 'Please use the logout button to exit the portal'
            : 'جهت خروج از پرتال مدیریت، از دکمه خروج استفاده فرمایید'
        );
        window.history.pushState(
          { appNav: true, view: 'portal', depth: 1, isAnchor: true },
          '',
          '#portal'
        );
        return;
      }

      // Pop the current view
      this.viewHistory.pop();
      if (previous) {
        this.currentView = previous.view;
        this.notifyViewSubscribers(previous.view, { tab: previous.tab, fromPop: true });
        
        // Update URL hash smoothly
        const targetHash = previous.view === 'landing' ? '#home' : `#${previous.view}${previous.tab ? `/${previous.tab}` : ''}`;
        window.history.replaceState(
          { appNav: true, view: previous.view, tab: previous.tab, depth: this.viewHistory.length },
          '',
          targetHash
        );
        return;
      }
    }

    // 3. At root view: Never auto-exit. Exiting must only happen via explicit logout.
    if (this.currentView === 'portal') {
      this.notifyToast(
        typeof document !== 'undefined' && document.documentElement?.lang === 'en'
          ? 'Please use the logout button to exit the portal'
          : 'جهت خروج از پرتال مدیریت، از دکمه خروج استفاده فرمایید'
      );
      window.history.pushState(
        { appNav: true, view: 'portal', depth: 1, isAnchor: true },
        '',
        '#portal'
      );
      return;
    }

    this.notifyToast(
      typeof document !== 'undefined' && document.documentElement?.lang === 'en'
        ? 'Please use the logout button to exit'
        : 'جهت خروج از سامانه، از دکمه خروج استفاده فرمایید'
    );

    // Always re-push anchor state to keep the user inside the app safely
    const rootHash = this.currentView === 'landing' ? '#home' : `#${this.currentView}`;
    window.history.pushState(
      { appNav: true, view: this.currentView, depth: 1, isAnchor: true },
      '',
      rootHash
    );
  };

  /**
   * Navigate to a new primary view (e.g. landing, login, test-request, portal)
   */
  public navigateView(view: AppView, meta?: { tab?: string; replace?: boolean }) {
    const isSame = this.currentView === view && !meta?.tab && !meta?.replace;
    this.currentView = view;

    if (view === 'portal' && (!meta?.tab || meta?.replace)) {
      this.viewHistory = [{ view: 'portal', tab: meta?.tab }];
    } else if (meta?.replace) {
      if (this.viewHistory.length > 0) {
        this.viewHistory[this.viewHistory.length - 1] = { view, tab: meta?.tab };
      } else {
        this.viewHistory.push({ view, tab: meta?.tab });
      }
    } else if (!isSame) {
      // Don't push duplicates of the exact same state consecutively
      const last = this.viewHistory[this.viewHistory.length - 1];
      if (!last || last.view !== view || last.tab !== meta?.tab) {
        this.viewHistory.push({ view, tab: meta?.tab });
      }
    }

    const hash = view === 'landing' ? '#home' : `#${view}${meta?.tab ? `/${meta.tab}` : ''}`;

    if (meta?.replace) {
      window.history.replaceState(
        { appNav: true, view, tab: meta?.tab, depth: this.viewHistory.length },
        '',
        hash
      );
    } else {
      window.history.pushState(
        { appNav: true, view, tab: meta?.tab, depth: this.viewHistory.length },
        '',
        hash
      );
    }

    this.notifyViewSubscribers(view, { tab: meta?.tab, fromPop: false });
  }

  /**
   * Navigate to a tab inside the current view (e.g. reports in portal)
   */
  public navigateTab(tab: string) {
    const last = this.viewHistory[this.viewHistory.length - 1];
    if (last && last.view === this.currentView && last.tab === tab) {
      return;
    }

    this.viewHistory.push({ view: this.currentView, tab });
    const hash = `#${this.currentView}/${tab}`;

    window.history.pushState(
      { appNav: true, view: this.currentView, tab, depth: this.viewHistory.length },
      '',
      hash
    );
  }

  /**
   * Programmatic back navigation (identical to browser Back button)
   */
  public goBack() {
    // 1. If any modal is open, close it
    if (this.modalStack.length > 0) {
      const modal = this.modalStack.pop();
      if (modal) {
        if (modal.pushedHistory && !modal.consumed) {
          modal.consumed = true;
          this.pendingSilentPops++;
          window.history.back();
        }
        modal.onClose();
      }
      return;
    }

    // 2. If we have views in history
    if (this.viewHistory.length > 1) {
      const top = this.viewHistory[this.viewHistory.length - 1];
      const previous = this.viewHistory[this.viewHistory.length - 2];

      if (this.currentView === 'portal' && previous && previous.view !== 'portal') {
        this.notifyToast(
          typeof document !== 'undefined' && document.documentElement?.lang === 'en'
            ? 'Please use the logout button to exit the portal'
            : 'جهت خروج از پرتال مدیریت، از دکمه خروج استفاده فرمایید'
        );
        return;
      }

      this.viewHistory.pop();
      if (previous) {
        this.currentView = previous.view;
        this.notifyViewSubscribers(previous.view, { tab: previous.tab, fromPop: true });
        const hash = previous.view === 'landing' ? '#home' : `#${previous.view}${previous.tab ? `/${previous.tab}` : ''}`;
        window.history.replaceState(
          { appNav: true, view: previous.view, tab: previous.tab, depth: this.viewHistory.length },
          '',
          hash
        );
        return;
      }
    }

    // 3. Fallback:
    if (this.currentView === 'portal') {
      this.notifyToast(
        typeof document !== 'undefined' && document.documentElement?.lang === 'en'
          ? 'Please use the logout button to exit the portal'
          : 'جهت خروج از پرتال مدیریت، از دکمه خروج استفاده فرمایید'
      );
      return;
    }

    if (this.currentView !== 'landing') {
      this.navigateView('landing');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Register a modal so that pressing browser Back closes it instead of exiting the site
   * Returns an unregister cleanup function.
   */
  public registerModal(id: string, onClose: () => void): () => void {
    // Check if already registered
    const existingIdx = this.modalStack.findIndex(m => m.id === id);
    if (existingIdx !== -1) {
      return () => this.unregisterModal(id);
    }

    // Push history state for this modal
    window.history.pushState(
      { appNav: true, isModal: true, modalId: id },
      '',
      window.location.hash
    );

    this.modalStack.push({
      id,
      onClose,
      pushedHistory: true,
      consumed: false
    });

    return () => this.unregisterModal(id);
  }

  /**
   * Unregister a modal when closed via UI button (X, Cancel, ESC, etc.)
   */
  public unregisterModal(id: string) {
    const idx = this.modalStack.findIndex(m => m.id === id);
    if (idx !== -1) {
      const [removed] = this.modalStack.splice(idx, 1);
      if (removed && removed.pushedHistory && !removed.consumed) {
        // Pop the state that was pushed for this modal quietly
        removed.consumed = true;
        this.pendingSilentPops++;
        window.history.back();
      }
    }
  }

  public subscribeView(cb: ViewChangeSubscriber): () => void {
    this.viewSubscribers.add(cb);
    return () => this.viewSubscribers.delete(cb);
  }

  public subscribeToast(cb: ToastSubscriber): () => void {
    this.toastSubscribers.add(cb);
    return () => this.toastSubscribers.delete(cb);
  }

  private notifyViewSubscribers(view: AppView, meta?: { tab?: string; fromPop?: boolean }) {
    this.viewSubscribers.forEach(cb => {
      try {
        cb(view, meta);
      } catch (e) {
        console.error('Error in nav subscriber:', e);
      }
    });
  }

  public notifyToast(msg: string) {
    this.toastSubscribers.forEach(cb => {
      try {
        cb(msg);
      } catch (e) {}
    });
  }

  public getCurrentView(): AppView {
    return this.currentView;
  }
}

export const navHistory = new NavigationHistoryService();
