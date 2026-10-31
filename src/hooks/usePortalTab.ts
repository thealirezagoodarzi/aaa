import { useCallback, useEffect, useState } from 'react';
import { navHistory } from '../services/navigationHistory';

/** Keep portal tabs and the browser's Back button in sync. */
export function usePortalTab<T extends string>(defaultTab: T, validTabs: readonly T[]) {
  const hashTab = window.location.hash.startsWith('#portal/') ? window.location.hash.slice(8) : '';
  const [activeTab, setActiveTab] = useState<T>(validTabs.includes(hashTab as T) ? hashTab as T : defaultTab);

  useEffect(() => navHistory.subscribeView((view, meta) => {
    if (view === 'portal' && meta?.fromPop) {
      setActiveTab(meta.tab && validTabs.includes(meta.tab as T) ? meta.tab as T : defaultTab);
    }
  }), [defaultTab, validTabs]);

  const navigateTab = useCallback((tab: T) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    navHistory.navigateTab(tab);
  }, [activeTab]);

  return [activeTab, navigateTab] as const;
}
