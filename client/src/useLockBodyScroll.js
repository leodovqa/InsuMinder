import { useEffect } from 'react';

/**
 * Global Reference-Counted Body Scroll Lock
 *
 * Ensures that when ANY modal in the application is open:
 * 1. Background page scrolling (document.body & html) is strictly disabled (overflow: hidden, touch-action: none).
 * 2. Swiping/scrolling inside modals remains active and contained without chaining to the background.
 * 3. Safely handles multiple overlapping modals via reference counting.
 */

let activeLockCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalBodyTouchAction = '';

export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  activeLockCount++;
  if (activeLockCount === 1) {
    originalBodyOverflow = document.body.style.overflow;
    originalHtmlOverflow = document.documentElement.style.overflow;
    originalBodyTouchAction = document.body.style.touchAction;

    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  activeLockCount = Math.max(0, activeLockCount - 1);
  if (activeLockCount === 0) {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.overflow = originalBodyOverflow;
    document.documentElement.style.overflow = originalHtmlOverflow;
    document.body.style.touchAction = originalBodyTouchAction;
  }
}

export function getActiveLockCount() {
  return activeLockCount;
}

export function resetBodyScrollLock() {
  activeLockCount = 0;
  if (typeof document === 'undefined') return;
  document.body.classList.remove('modal-open');
  document.documentElement.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.style.touchAction = '';
}

export default function useLockBodyScroll(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}

