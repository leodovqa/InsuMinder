import { describe, it, expect, beforeEach } from 'vitest';
import {
  pad2,
  getTabFromUrl,
  updateUrlForTab,
  formatDateOnly,
  formatTimeOnly,
  formatDateTime,
  formatRelativeTime,
  isPast,
  getStartOfWeek,
  getWeeksBelongingToMonth,
  getWeekDisplayInfo,
  getWeeklyTrendData,
  getRapidInjections
} from '../utils';

describe('Utility Functions & Helpers', () => {
  describe('pad2', () => {
    it('pads single digit numbers with a leading zero', () => {
      expect(pad2(5)).toBe('05');
      expect(pad2(0)).toBe('00');
    });

    it('keeps two digit numbers as is', () => {
      expect(pad2(12)).toBe('12');
      expect(pad2(59)).toBe('59');
    });
  });

  describe('getTabFromUrl', () => {
    it('returns "home" by default when no search param exists', () => {
      expect(getTabFromUrl('')).toBe('home');
      expect(getTabFromUrl('?')).toBe('home');
    });

    it('returns "logs" when page=logs or tab=logs is present', () => {
      expect(getTabFromUrl('?page=logs')).toBe('logs');
      expect(getTabFromUrl('?tab=logs')).toBe('logs');
      expect(getTabFromUrl('?other=1&page=logs')).toBe('logs');
    });

    it('returns "settings" when page=settings or tab=settings is present', () => {
      expect(getTabFromUrl('?page=settings')).toBe('settings');
      expect(getTabFromUrl('?tab=settings')).toBe('settings');
    });

    it('falls back to "home" for unknown page values', () => {
      expect(getTabFromUrl('?page=unknown')).toBe('home');
      expect(getTabFromUrl('?page=profile')).toBe('home');
    });
  });

  describe('updateUrlForTab', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/');
    });

    it('updates URL search params to ?page=logs for logs tab', () => {
      updateUrlForTab('logs');
      expect(window.location.search).toContain('page=logs');
    });

    it('updates URL search params to ?page=settings for settings tab', () => {
      updateUrlForTab('settings');
      expect(window.location.search).toContain('page=settings');
    });

    it('removes page parameter when navigating to home', () => {
      updateUrlForTab('logs');
      expect(window.location.search).toContain('page=logs');
      updateUrlForTab('home');
      expect(window.location.search).not.toContain('page=logs');
    });
  });

  describe('Date & Time Formatters', () => {
    it('formats date only correctly', () => {
      const dateStr = '2026-10-09T14:30:00Z';
      const formatted = formatDateOnly(dateStr);
      expect(formatted).toMatch(/09\/10\/2026/);
    });

    it('returns empty string when value is null or undefined', () => {
      expect(formatDateOnly(null)).toBe('');
      expect(formatTimeOnly(null)).toBe('');
      expect(formatDateTime(null)).toBe('');
      expect(formatRelativeTime(null)).toBe('');
    });

    it('formats relative time for past and future correctly', () => {
      const now = Date.now();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const inThirtyMin = new Date(now + 30 * 60 * 1000 + 2000).toISOString();

      expect(formatRelativeTime(tenMinutesAgo)).toBe('10 minutes ago');
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
      expect(formatRelativeTime(inThirtyMin)).toBe('in 30 min');
    });

    it('checks isPast correctly', () => {
      const pastTime = new Date(Date.now() - 5000).toISOString();
      const futureTime = new Date(Date.now() + 50000).toISOString();

      expect(isPast(pastTime)).toBe(true);
      expect(isPast(futureTime)).toBe(false);
      expect(isPast(null)).toBe(false);
    });
  });

  describe('Israeli Calendar Week Navigation (Sunday to Saturday)', () => {
    it('calculates Sunday as start of week for any day', () => {
      // Friday Oct 9, 2026
      const friday = new Date(2026, 9, 9);
      const start = getStartOfWeek(friday);

      expect(start.getDay()).toBe(0); // Sunday
      expect(start.getDate()).toBe(4); // Sunday Oct 4, 2026
      expect(start.getMonth()).toBe(9); // October
    });

    it('calculates Sunday correctly when date is already Sunday', () => {
      const sunday = new Date(2026, 9, 4);
      const start = getStartOfWeek(sunday);

      expect(start.getDay()).toBe(0);
      expect(start.getDate()).toBe(4);
    });

    it('calculates Sunday correctly when date is Saturday', () => {
      const saturday = new Date(2026, 9, 10);
      const start = getStartOfWeek(saturday);

      expect(start.getDay()).toBe(0);
      expect(start.getDate()).toBe(4);
    });

    it('generates continuous Sunday-Saturday weeks belonging to a month', () => {
      // October 2026
      const weeks = getWeeksBelongingToMonth(2026, 9);
      expect(weeks.length).toBeGreaterThanOrEqual(4);

      // Verify every week starts on Sunday
      weeks.forEach(w => {
        expect(w.getDay()).toBe(0);
      });

      // Verify weeks are 7 days apart
      for (let i = 1; i < weeks.length; i++) {
        const diffMs = weeks[i].getTime() - weeks[i - 1].getTime();
        const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
        expect(diffDays).toBe(7);
      }
    });

    it('returns accurate week display info', () => {
      const weekStart = getStartOfWeek(new Date(2026, 9, 9));
      const info = getWeekDisplayInfo(weekStart);

      expect(info.monthName).toContain('October 2026');
      expect(info.weekNumber).toBe(1);
      expect(info.totalWeeks).toBe(4);
      expect(info.activeWeekIndex).toBe(0);
    });

    it('calculates weekly trend data for 7 calendar days', () => {
      const weekStart = getStartOfWeek(new Date(2026, 9, 9));
      const mockLogs = [
        { id: 1, injected_at: '2026-10-09T08:00:00Z' },
        { id: 2, injected_at: '2026-10-09T14:00:00Z' },
        { id: 3, injected_at: '2026-10-04T12:00:00Z' }
      ];

      const trendData = getWeeklyTrendData(mockLogs, weekStart);

      expect(trendData.days).toHaveLength(7);
      expect(trendData.days[0].dayName).toBe('Sun');
      expect(trendData.days[6].dayName).toBe('Sat');
      expect(trendData.totalWeekInjections).toBe(3);
      expect(trendData.activeDaysCount).toBe(2);
    });
  });

  describe('Rapid Injections Detector (< 3 hours)', () => {
    it('detects and flags injections logged under 3 hours apart', () => {
      const logs = [
        { id: 2, injected_at: '2026-10-09T12:30:00Z' },
        { id: 1, injected_at: '2026-10-09T11:00:00Z' } // 1.5h diff
      ];

      const { rapidList, rapidIds } = getRapidInjections(logs);

      expect(rapidList).toHaveLength(1);
      expect(rapidIds.has(2)).toBe(true);
      expect(rapidList[0].diffMinutes).toBe(90);
      expect(rapidList[0].intervalStr).toBe('1h 30m');
    });

    it('does not flag injections separated by 3 or more hours', () => {
      const logs = [
        { id: 2, injected_at: '2026-10-09T15:00:00Z' },
        { id: 1, injected_at: '2026-10-09T11:00:00Z' } // 4h diff
      ];

      const { rapidList, rapidIds } = getRapidInjections(logs);

      expect(rapidList).toHaveLength(0);
      expect(rapidIds.size).toBe(0);
    });
  });
});
