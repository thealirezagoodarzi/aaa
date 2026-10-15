import { useEffect, useRef } from 'react';
import { navHistory } from '../services/navigationHistory';

/**
 * Hook to connect any modal or dialog to the browser back button.
 * When open, pressing browser Back (or mobile back gesture) will smoothly
 * close the modal instead of exiting the website.
 */
export function useModalBack(isOpen: boolean, onClose: () => void, modalId: string) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const unregister = navHistory.registerModal(modalId, () => {
      onCloseRef.current();
    });

    return () => {
      unregister();
    };
  }, [isOpen, modalId]);
}
