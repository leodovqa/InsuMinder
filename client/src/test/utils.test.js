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
  getRapidInjections,
  maskBotToken,
  isCustomConfigName,
  getReminderStatus,
  getFriendlyReminderError
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

    it('returns "profile" when page=profile or tab=profile is present', () => {
      expect(getTabFromUrl('?page=profile')).toBe('profile');
      expect(getTabFromUrl('?tab=profile')).toBe('profile');
    });

    it('falls back to "home" for unknown page values', () => {
      expect(getTabFromUrl('?page=unknown')).toBe('home');
      expect(getTabFromUrl('?page=billing')).toBe('home');
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

    it('updates URL search params to ?page=profile for profile tab', () => {
      updateUrlForTab('profile');
      expect(window.location.search).toContain('page=profile');
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

    it('scopes rapid injection detection to the specified targetDateKey', () => {
      const logs = [
        // Dose today
        { id: 3, injected_at: '2026-10-10T14:00:00Z' },
        // Rapid doses yesterday (1.5h apart)
        { id: 2, injected_at: '2026-10-09T12:30:00Z' },
        { id: 1, injected_at: '2026-10-09T11:00:00Z' }
      ];

      const todayDateKey = formatDateOnly('2026-10-10T14:00:00Z');
      const yesterdayDateKey = formatDateOnly('2026-10-09T12:30:00Z');

      // Scoped to today: no rapid doses occurred today
      const todayResult = getRapidInjections(logs, todayDateKey);
      expect(todayResult.rapidList).toHaveLength(0);
      expect(todayResult.rapidIds.size).toBe(0);

      // Scoped to yesterday: flags id 2
      const yesterdayResult = getRapidInjections(logs, yesterdayDateKey);
      expect(yesterdayResult.rapidList).toHaveLength(1);
      expect(yesterdayResult.rapidIds.has(2)).toBe(true);

      // Unscoped: returns all historical rapid doses across all days
      const unscopedResult = getRapidInjections(logs);
      expect(unscopedResult.rapidList).toHaveLength(1);
      expect(unscopedResult.rapidIds.has(2)).toBe(true);
    });
  });

  describe('maskBotToken', () => {
    it('returns empty string for null, undefined, or empty token', () => {
      expect(maskBotToken(null)).toBe('');
      expect(maskBotToken(undefined)).toBe('');
      expect(maskBotToken('')).toBe('');
    });

    it('masks short tokens with bullets', () => {
      expect(maskBotToken('short')).toBe('••••••••');
    });

    it('masks long bot tokens showing first 5 and last 4 characters', () => {
      const token = '123456789:ABC-DEF-GHIJKLMNOP';
      expect(maskBotToken(token)).toBe('12345••••MNOP');
    });
  });

  describe('isCustomConfigName', () => {
    it('returns false for null, undefined, or empty names', () => {
      expect(isCustomConfigName(null, '-4304245048')).toBe(false);
      expect(isCustomConfigName(undefined, '-4304245048')).toBe(false);
      expect(isCustomConfigName('', '-4304245048')).toBe(false);
      expect(isCustomConfigName('   ', '-4304245048')).toBe(false);
    });

    it('returns false when name equals the chatId', () => {
      expect(isCustomConfigName('-4304245048', '-4304245048')).toBe(false);
      expect(isCustomConfigName('12345678', '12345678')).toBe(false);
    });

    it('returns false when name matches default generated Chat (chatId) pattern', () => {
      expect(isCustomConfigName('Chat (-4304245048)', '-4304245048')).toBe(false);
      expect(isCustomConfigName('Chat (-4304245048)', '-1004304245048')).toBe(false);
      expect(isCustomConfigName('Chat (98765)', '98765')).toBe(false);
    });

    it('returns true when a custom user-defined label is provided', () => {
      expect(isCustomConfigName('Personal Bot', '-4304245048')).toBe(true);
      expect(isCustomConfigName('Family Channel', '-1004304245048')).toBe(true);
      expect(isCustomConfigName('Office Alerts', '12345678')).toBe(true);
    });
  });

  describe('getReminderStatus', () => {
    it('returns none status for null or empty log', () => {
      const res = getReminderStatus(null, '2h');
      expect(res.status).toBe('none');
      expect(res.label).toBe('—');
    });

    it('returns "Sent" status when status_2h_sent is 1', () => {
      const log = {
        id: 1,
        injected_at: '2026-10-09T10:00:00Z',
        notify_2h_at: '2026-10-09T12:00:00Z',
        notify_3h_at: '2026-10-09T13:00:00Z',
        status_2h_sent: 1,
        error_2h: null
      };

      const res = getReminderStatus(log, '2h');
      expect(res.status).toBe('sent');
      expect(res.label).toBe('Sent');
      expect(res.pillLabel).toBe('Sent');
      expect(res.icon).toBe('✅');
      expect(res.badgeClass).toBe('badge-sent');
      expect(res.pillClass).toBe('sent');
      expect(res.title).toBe('Reminder delivered to Telegram.');
    });

    it('returns "Not Sent" with custom error tooltip when delivery failed', () => {
      const log = {
        id: 2,
        injected_at: '2026-10-09T10:00:00Z',
        notify_2h_at: '2026-10-09T12:00:00Z',
        notify_3h_at: '2026-10-09T13:00:00Z',
        status_2h_sent: 0,
        error_2h: 'Bad Request: chat not found'
      };

      const res = getReminderStatus(log, '2h');
      expect(res.status).toBe('failed');
      expect(res.label).toBe('Not Sent');
      expect(res.pillLabel).toBe('Not Sent');
      expect(res.icon).toBe('⚠️');
      expect(res.badgeClass).toBe('badge-failed');
      expect(res.pillClass).toBe('failed');
      expect(res.title).toContain('bot token or chat ID');
      expect(res.rawError).toBe('Bad Request: chat not found');
      expect(res.friendlyError.category).toBe('Telegram Configuration Issue');
    });

    it('returns "Not Sent" pointing to unconfigured Telegram when not configured', () => {
      const log = {
        id: 3,
        injected_at: '2026-10-09T10:00:00Z',
        notify_3h_at: '2026-10-09T13:00:00Z',
        status_3h_sent: 0,
        error_3h: null
      };

      const res = getReminderStatus(log, '3h', false);
      expect(res.status).toBe('failed');
      expect(res.label).toBe('Not Sent');
      expect(res.icon).toBe('⚠️');
      expect(res.title).toContain('Telegram is not configured');
    });

    it('returns "Upcoming" status when reminder time is in the future', () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const log = {
        id: 4,
        injected_at: new Date().toISOString(),
        notify_2h_at: futureTime,
        status_2h_sent: 0,
        error_2h: null
      };

      const res = getReminderStatus(log, '2h');
      expect(res.status).toBe('upcoming');
      expect(res.label).toBe('Upcoming');
      expect(res.pillLabel).toBe('Pending');
      expect(res.icon).toBe('⏳');
      expect(res.badgeClass).toBe('badge-upcoming');
      expect(res.pillClass).toBe('pending');
      expect(res.title).toContain('Scheduled for');
    });

    it('correctly calculates 10m meal reminder status and falls back to injected_at + 10m when notify_10m_at is missing', () => {
      const pastInjection = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const logWithout10m = {
        id: 5,
        injected_at: pastInjection,
        notify_2h_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        notify_3h_at: new Date(Date.now() + 150 * 60 * 1000).toISOString(),
        status_10m_sent: 0,
        error_10m: 'Network error reaching Telegram API.'
      };

      const res = getReminderStatus(logWithout10m, '10m');
      expect(res.status).toBe('failed');
      expect(res.label).toBe('Not Sent');
      expect(res.pillLabel).toBe('Not Sent');
      expect(res.friendlyError.category).toBe('Network Connection Error');
      // Target time should be pastInjection + 10 minutes
      const expectedTime = new Date(new Date(pastInjection).getTime() + 10 * 60 * 1000).toISOString();
      expect(res.targetTime).toBe(expectedTime);

      // When sent:
      const sentLog = {
        ...logWithout10m,
        status_10m_sent: 1,
        error_10m: null
      };
      const sentRes = getReminderStatus(sentLog, '10m');
      expect(sentRes.status).toBe('sent');
      expect(sentRes.label).toBe('Sent');
      expect(sentRes.icon).toBe('✅');
    });
  });

  describe('getFriendlyReminderError', () => {
    it('returns Telegram configuration category when Telegram is unconfigured', () => {
      const res = getFriendlyReminderError(null, false);
      expect(res.category).toBe('Telegram Configuration Issue');
      expect(res.message).toContain('Telegram is not configured');
    });

    it('identifies network and connection failures', () => {
      const res1 = getFriendlyReminderError('Network error reaching Telegram API.');
      expect(res1.category).toBe('Network Connection Error');
      expect(res1.message).toContain('internet connection');

      const res2 = getFriendlyReminderError('fetch failed: timeout');
      expect(res2.category).toBe('Network Connection Error');
    });

    it('identifies Telegram configuration errors such as chat not found or unauthorized', () => {
      const res1 = getFriendlyReminderError('Bad Request: chat not found');
      expect(res1.category).toBe('Telegram Configuration Issue');
      expect(res1.message).toContain('bot token or chat ID');

      const res2 = getFriendlyReminderError('Unauthorized: 401 invalid token');
      expect(res2.category).toBe('Telegram Configuration Issue');
    });

    it('identifies Telegram environment and server issues', () => {
      const res1 = getFriendlyReminderError('Telegram API error (502)');
      expect(res1.category).toBe('Telegram Service Issue');
      expect(res1.message).toContain('service issue');

      const res2 = getFriendlyReminderError('Too Many Requests: rate limit exceeded');
      expect(res2.category).toBe('Telegram Service Issue');
    });

    it('identifies expired notifications', () => {
      const res = getFriendlyReminderError('Notification expired without delivery.');
      expect(res.category).toBe('Reminder Expired');
      expect(res.message).toContain('24 hours');
    });
  });
});
