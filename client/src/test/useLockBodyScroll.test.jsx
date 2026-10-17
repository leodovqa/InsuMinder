import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLockBodyScroll, { lockBodyScroll, unlockBodyScroll, resetBodyScrollLock, getActiveLockCount } from '../useLockBodyScroll';

describe('useLockBodyScroll Hook & Body Scroll Manager', () => {
  beforeEach(() => {
    resetBodyScrollLock();
    document.body.className = '';
    document.documentElement.className = '';
  });

  it('adds modal-open class to body and html when locked', () => {
    expect(document.body.classList.contains('modal-open')).toBe(false);

    lockBodyScroll();
    expect(document.body.classList.contains('modal-open')).toBe(true);
    expect(document.documentElement.classList.contains('modal-open')).toBe(true);
    expect(getActiveLockCount()).toBe(1);

    unlockBodyScroll();
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.documentElement.classList.contains('modal-open')).toBe(false);
    expect(getActiveLockCount()).toBe(0);
  });

  it('manages nested/overlapping locks with reference counting', () => {
    lockBodyScroll();
    lockBodyScroll();
    expect(getActiveLockCount()).toBe(2);
    expect(document.body.classList.contains('modal-open')).toBe(true);

    unlockBodyScroll();
    // Still 1 lock remaining
    expect(getActiveLockCount()).toBe(1);
    expect(document.body.classList.contains('modal-open')).toBe(true);

    unlockBodyScroll();
    expect(getActiveLockCount()).toBe(0);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('automatically locks on mount and unlocks on unmount via hook', () => {
    const { unmount } = renderHook(() => useLockBodyScroll(true));
    expect(document.body.classList.contains('modal-open')).toBe(true);

    unmount();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('does nothing when isLocked is false', () => {
    renderHook(() => useLockBodyScroll(false));
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(getActiveLockCount()).toBe(0);
  });
});

