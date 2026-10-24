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
  getBasalReminderStatus,
  getFriendlyReminderError,
  getEffectiveNotificationPreferences,
  getSavedDateFormat,
  setSavedDateFormat,
  DATE_FORMATS,
  formatDisplayDate,
  getBasalTimeDiffMinutes
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

    it('returns "notifications" when page=notifications or tab=notifications is present', () => {
      expect(getTabFromUrl('?page=notifications')).toBe('notifications');
      expect(getTabFromUrl('?tab=notifications')).toBe('notifications');
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

    it('updates URL search params to ?page=notifications for notifications tab', () => {
      updateUrlForTab('notifications');
      expect(window.location.search).toContain('page=notifications');
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

    it('formats date only and date time with alternative formats', () => {
      const d = new Date(2026, 9, 9, 14, 30);
      expect(formatDateOnly(d, DATE_FORMATS.DD_MM_YYYY)).toBe('09/10/2026');
      expect(formatDateOnly(d, DATE_FORMATS.MM_DD_YYYY)).toBe('10/09/2026');
      expect(formatDateOnly(d, DATE_FORMATS.YYYY_MM_DD)).toBe('2026-10-09');

      expect(formatDateTime(d, DATE_FORMATS.DD_MM_YYYY)).toBe('09/10/2026, 14:30');
      expect(formatDateTime(d, DATE_FORMATS.MM_DD_YYYY)).toBe('10/09/2026, 14:30');
      expect(formatDateTime(d, DATE_FORMATS.YYYY_MM_DD)).toBe('2026-10-09, 14:30');
    });

    it('persists and retrieves saved date format preference in localStorage', () => {
      localStorage.clear();
      expect(getSavedDateFormat()).toBe(DATE_FORMATS.DD_MM_YYYY);

      setSavedDateFormat(DATE_FORMATS.MM_DD_YYYY);
      expect(getSavedDateFormat()).toBe(DATE_FORMATS.MM_DD_YYYY);

      setSavedDateFormat(DATE_FORMATS.YYYY_MM_DD);
      expect(getSavedDateFormat()).toBe(DATE_FORMATS.YYYY_MM_DD);

      setSavedDateFormat(DATE_FORMATS.DD_MM_YYYY);
    });

    it('formats display date correctly using formatDisplayDate', () => {
      const d = new Date(2026, 0, 5);
      expect(formatDisplayDate(d, DATE_FORMATS.DD_MM_YYYY)).toBe('05/01/2026');
      expect(formatDisplayDate(d, DATE_FORMATS.MM_DD_YYYY)).toBe('01/05/2026');
      expect(formatDisplayDate(d, DATE_FORMATS.YYYY_MM_DD)).toBe('2026-01-05');
      expect(formatDisplayDate(null)).toBe('');
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

    it('returns accurate week display info in English and Hebrew', () => {
      const weekStart = getStartOfWeek(new Date(2026, 9, 9));
      const infoEn = getWeekDisplayInfo(weekStart, 'en');

      expect(infoEn.monthName).toContain('October 2026');
      expect(infoEn.weekNumber).toBe(1);
      expect(infoEn.totalWeeks).toBe(4);
      expect(infoEn.activeWeekIndex).toBe(0);

      const infoHe = getWeekDisplayInfo(weekStart, 'he');
      expect(infoHe.monthName).toContain('אוקטובר 2026');

      const infoRu = getWeekDisplayInfo(weekStart, 'ru');
      expect(infoRu.monthName).toContain('Октябрь 2026');
    });

    it('calculates weekly trend data for 7 calendar days with localization', () => {
      const weekStart = getStartOfWeek(new Date(2026, 9, 9));
      const mockLogs = [
        { id: 1, injected_at: '2026-10-09T08:00:00Z' },
        { id: 2, injected_at: '2026-10-09T14:00:00Z' },
        { id: 3, injected_at: '2026-10-04T12:00:00Z' }
      ];

      // English
      const trendDataEn = getWeeklyTrendData(mockLogs, weekStart, 'en');
      expect(trendDataEn.days).toHaveLength(7);
      expect(trendDataEn.days[0].dayName).toBe('Sun');
      expect(trendDataEn.days[0].fullDayName).toBe('Sunday');
      expect(trendDataEn.days[6].dayName).toBe('Sat');
      expect(trendDataEn.days[6].fullDayName).toBe('Saturday');
      expect(trendDataEn.totalWeekInjections).toBe(3);
      expect(trendDataEn.activeDaysCount).toBe(2);

      // Hebrew
      const trendDataHe = getWeeklyTrendData(mockLogs, weekStart, 'he');
      expect(trendDataHe.days).toHaveLength(7);
      expect(trendDataHe.days[0].dayName).toBe('א');
      expect(trendDataHe.days[0].fullDayName).toBe('יום ראשון');
      expect(trendDataHe.days[1].dayName).toBe('ב');
      expect(trendDataHe.days[2].dayName).toBe('ג');
      expect(trendDataHe.days[3].dayName).toBe('ד');
      expect(trendDataHe.days[4].dayName).toBe('ה');
      expect(trendDataHe.days[5].dayName).toBe('ו');
      expect(trendDataHe.days[6].dayName).toBe('ש');
      expect(trendDataHe.days[6].fullDayName).toBe('יום שבת');

      // Russian
      const trendDataRu = getWeeklyTrendData(mockLogs, weekStart, 'ru');
      expect(trendDataRu.days).toHaveLength(7);
      expect(trendDataRu.days[0].dayName).toBe('Вс');
      expect(trendDataRu.days[0].fullDayName).toBe('Воскресенье');
      expect(trendDataRu.days[1].dayName).toBe('Пн');
      expect(trendDataRu.days[1].fullDayName).toBe('Понедельник');
      expect(trendDataRu.days[2].dayName).toBe('Вт');
      expect(trendDataRu.days[3].dayName).toBe('Ср');
      expect(trendDataRu.days[4].dayName).toBe('Чт');
      expect(trendDataRu.days[5].dayName).toBe('Пт');
      expect(trendDataRu.days[6].dayName).toBe('Сб');
      expect(trendDataRu.days[6].fullDayName).toBe('Суббота');
    });

    it('accurately tallies bolus and basal injections for days and weekly totals', () => {
      const weekStart = new Date(2026, 9, 4); // Sunday Oct 4, 2026
      const mockLogs = [
        // Sunday: 3 bolus, 1 basal
        { id: 1, injected_at: '2026-10-04T08:00:00Z', type: 'bolus' },
        { id: 2, injected_at: '2026-10-04T12:00:00Z', type: 'bolus' },
        { id: 3, injected_at: '2026-10-04T14:00:00Z', type: 'bolus' },
        { id: 4, injected_at: '2026-10-04T17:00:00Z', type: 'basal' },
        // Monday: 2 bolus, 1 basal
        { id: 5, injected_at: '2026-10-05T08:00:00Z', type: 'bolus' },
        { id: 6, injected_at: '2026-10-05T12:00:00Z', type: 'bolus' },
        { id: 7, injected_at: '2026-10-05T17:00:00Z', type: 'basal' },
        // Wednesday: 1 legacy log (no type field, should default to bolus)
        { id: 8, injected_at: '2026-10-07T12:00:00Z' }
      ];

      const data = getWeeklyTrendData(mockLogs, weekStart, 'en');
      expect(data.totalWeekInjections).toBe(8);
      expect(data.totalBolusInjections).toBe(6);
      expect(data.totalBasalInjections).toBe(2);

      // Sunday checks (index 0)
      expect(data.days[0].count).toBe(4);
      expect(data.days[0].bolusCount).toBe(3);
      expect(data.days[0].basalCount).toBe(1);

      // Monday checks (index 1)
      expect(data.days[1].count).toBe(3);
      expect(data.days[1].bolusCount).toBe(2);
      expect(data.days[1].basalCount).toBe(1);

      // Wednesday checks (index 3)
      expect(data.days[3].count).toBe(1);
      expect(data.days[3].bolusCount).toBe(1);
      expect(data.days[3].basalCount).toBe(0);
    });

    it('formats shortDate and weekRangeStr according to date format settings', () => {
      const weekStart = new Date(2026, 9, 4); // Sunday Oct 4, 2026
      const mockLogs = [];

      // DD/MM/YYYY (default)
      const dataDD = getWeeklyTrendData(mockLogs, weekStart, 'en', DATE_FORMATS.DD_MM_YYYY);
      expect(dataDD.days[0].shortDate).toBe('4/10');
      expect(dataDD.weekRangeStr).toBe('4/10 – 10/10');

      // MM/DD/YYYY
      const dataMM = getWeeklyTrendData(mockLogs, weekStart, 'en', DATE_FORMATS.MM_DD_YYYY);
      expect(dataMM.days[0].shortDate).toBe('10/4');
      expect(dataMM.weekRangeStr).toBe('10/4 – 10/10');

      // YYYY-MM-DD
      const dataISO = getWeeklyTrendData(mockLogs, weekStart, 'en', DATE_FORMATS.YYYY_MM_DD);
      expect(dataISO.days[0].shortDate).toBe('10-04');
      expect(dataISO.weekRangeStr).toBe('10-04 – 10-10');
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

    it('ignores basal injections so nighttime background dose close to bolus does not trigger rapid alert', () => {
      const logs = [
        // Basal dose at 20:30 (1 hour after 19:30 dinner bolus)
        { id: 2, injected_at: '2026-10-09T20:30:00Z', type: 'basal' },
        // Dinner bolus dose at 19:30
        { id: 1, injected_at: '2026-10-09T19:30:00Z', type: 'bolus' }
      ];

      const { rapidList, rapidIds } = getRapidInjections(logs);
      expect(rapidList).toHaveLength(0);
      expect(rapidIds.size).toBe(0);
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
      expect(res.title).toBe('Delivered successfully across all active notification channels.');
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

  describe('getBasalReminderStatus', () => {
    it('returns sent status when status_sent is 1', () => {
      const res = getBasalReminderStatus({
        status_sent: 1,
        sent_at: '2026-10-13T20:00:00Z',
        scheduled_time: '20:00'
      }, '20:00', true, 'en');

      expect(res.status).toBe('sent');
      expect(res.pillClass).toBe('sent');
      expect(res.icon).toBe('✅');
      expect(res.label).toBe('Sent');
    });

    it('returns localized sent status in Hebrew and Russian', () => {
      const resHe = getBasalReminderStatus({ status_sent: 1 }, '20:00', true, 'he');
      expect(resHe.label).toBe('נשלח');

      const resRu = getBasalReminderStatus({ status_sent: 1 }, '20:00', true, 'ru');
      expect(resRu.label).toBe('Отправлено');
    });

    it('returns failed status when delivery error is recorded', () => {
      const res = getBasalReminderStatus({
        status_sent: 0,
        error: 'Bad Request: chat not found',
        scheduled_time: '20:00'
      }, '20:00', true, 'en');

      expect(res.status).toBe('failed');
      expect(res.pillClass).toBe('failed');
      expect(res.icon).toBe('⚠️');
      expect(res.label).toBe('Not Sent');
      expect(res.friendlyError.category).toBe('Telegram Configuration Issue');
    });

    it('returns upcoming status for future scheduled time', () => {
      // Future time 23:59
      const res = getBasalReminderStatus(null, '23:59', true, 'en');
      expect(res.status).toBe('upcoming');
      expect(res.pillClass).toBe('pending');
      expect(res.icon).toBe('⏳');
      expect(res.label).toBe('Upcoming');
      expect(res.pillLabel).toBe('Pending');
    });

    it('returns disabled status when basal is disabled in preferences or recorded as disabled', () => {
      const disabledPrefs = {
        personal: { rem10m: true, rem2h: true, rem3h: true, basal: false },
        shared: { rem10m: true, rem2h: true, rem3h: true, basal: true }
      };

      const res = getBasalReminderStatus(null, '20:00', true, 'en', false, disabledPrefs, 'personal');
      expect(res.status).toBe('disabled');
      expect(res.pillClass).toBe('disabled');
      expect(res.badgeClass).toBe('badge-disabled');
      expect(res.icon).toBe('🔕');
      expect(res.label).toBe('Disabled');
      expect(res.isDisabled).toBe(true);

      // In shared context where basal is enabled
      const resShared = getBasalReminderStatus(null, '23:59', true, 'en', false, disabledPrefs, 'shared');
      expect(resShared.status).toBe('upcoming');
      expect(resShared.isDisabled).toBe(false);

      // When rawError is explicitly 'Disabled in notification settings.'
      const resExplicit = getBasalReminderStatus({
        status_sent: 0,
        error: 'Disabled in notification settings.'
      }, '20:00', true, 'en');
      expect(resExplicit.status).toBe('disabled');
      expect(resExplicit.isDisabled).toBe(true);
    });
  });

  describe('getEffectiveNotificationPreferences', () => {
    it('returns all true defaults when input is null or empty', () => {
      const prefs = getEffectiveNotificationPreferences(null);
      expect(prefs).toEqual({
        personal: { rem10m: true, rem2h: true, rem3h: true, basal: true, telegram: true },
        shared: { rem10m: true, rem2h: true, rem3h: true, basal: true }
      });
    });

    it('parses JSON string correctly', () => {
      const jsonStr = JSON.stringify({
        personal: { rem10m: false, rem2h: true, rem3h: false, basal: true },
        shared: { rem10m: true, rem2h: false, rem3h: true, basal: false }
      });
      const prefs = getEffectiveNotificationPreferences(jsonStr);
      expect(prefs.personal.rem10m).toBe(false);
      expect(prefs.personal.rem3h).toBe(false);
      expect(prefs.shared.rem2h).toBe(false);
      expect(prefs.shared.basal).toBe(false);
    });

    it('fills in missing keys with default true', () => {
      const partial = {
        personal: { rem10m: false }
      };
      const prefs = getEffectiveNotificationPreferences(partial);
      expect(prefs.personal.rem10m).toBe(false);
      expect(prefs.personal.rem2h).toBe(true);
      expect(prefs.personal.rem3h).toBe(true);
      expect(prefs.personal.basal).toBe(true);
      expect(prefs.shared.rem10m).toBe(true);
    });
  });

  describe('getReminderStatus with notification preferences', () => {
    it('returns disabled status when reminder type is turned off in preferences', () => {
      const log = {
        id: 1,
        injected_at: new Date().toISOString(),
        notify_10m_at: new Date(Date.now() + 600000).toISOString(),
        notify_2h_at: new Date(Date.now() + 7200000).toISOString(),
        notify_3h_at: new Date(Date.now() + 10800000).toISOString()
      };
      const prefs = {
        personal: { rem10m: false, rem2h: true, rem3h: false, basal: true },
        shared: { rem10m: true, rem2h: true, rem3h: true, basal: true }
      };

      const rem10m = getReminderStatus(log, '10m', true, 'en', prefs, 'personal');
      expect(rem10m.status).toBe('disabled');
      expect(rem10m.icon).toBe('🔕');
      expect(rem10m.pillClass).toBe('disabled');
      expect(rem10m.badgeClass).toBe('badge-disabled');
      expect(rem10m.label).toBe('Disabled');
      expect(rem10m.isDisabled).toBe(true);

      const rem2h = getReminderStatus(log, '2h', true, 'en', prefs, 'personal');
      expect(rem2h.status).toBe('upcoming');
      expect(rem2h.isDisabled).toBe(false);

      const rem3h = getReminderStatus(log, '3h', true, 'en', prefs, 'personal');
      expect(rem3h.status).toBe('disabled');
      expect(rem3h.isDisabled).toBe(true);

      // In shared context, rem10m is enabled
      const shared10m = getReminderStatus(log, '10m', true, 'en', prefs, 'shared');
      expect(shared10m.status).toBe('upcoming');
      expect(shared10m.isDisabled).toBe(false);
    });

    it('returns sent status even if preference is disabled if status_sent was already 1', () => {
      const log = {
        id: 1,
        status_10m: 1,
        notify_10m_at: new Date().toISOString()
      };
      const prefs = {
        personal: { rem10m: false, rem2h: true, rem3h: true, basal: true },
        shared: { rem10m: true, rem2h: true, rem3h: true, basal: true }
      };

      const rem10m = getReminderStatus(log, '10m', true, 'en', prefs, 'personal');
      expect(rem10m.status).toBe('sent');
      expect(rem10m.icon).toBe('✅');
      expect(rem10m.isDisabled).toBe(false);
    });
  });

  describe('getBasalTimeDiffMinutes', () => {
    it('calculates negative minutes when current time is earlier than scheduled time', () => {
      const now = new Date(2026, 9, 20, 19, 50); // 19:50
      expect(getBasalTimeDiffMinutes(now, '20:00')).toBe(-10);
    });

    it('calculates negative minutes within the 5-minute pre-window', () => {
      const now = new Date(2026, 9, 20, 19, 56); // 19:56
      expect(getBasalTimeDiffMinutes(now, '20:00')).toBe(-4);
    });

    it('calculates positive minutes when current time is past scheduled time', () => {
      const now = new Date(2026, 9, 20, 20, 30); // 20:30
      expect(getBasalTimeDiffMinutes(now, '20:00')).toBe(30);
    });

    it('handles circular time across midnight (pre-midnight with early morning basal)', () => {
      const now = new Date(2026, 9, 20, 23, 55); // 23:55
      expect(getBasalTimeDiffMinutes(now, '00:30')).toBe(-35);
    });

    it('handles circular time across midnight (post-midnight with late night basal)', () => {
      const now = new Date(2026, 9, 21, 0, 15); // 00:15
      expect(getBasalTimeDiffMinutes(now, '23:45')).toBe(30);
    });

    it('returns 0 for missing or invalid basal time string', () => {
      const now = new Date(2026, 9, 20, 19, 50);
      expect(getBasalTimeDiffMinutes(now, null)).toBe(0);
      expect(getBasalTimeDiffMinutes(now, '')).toBe(0);
      expect(getBasalTimeDiffMinutes(now, 'invalid')).toBe(0);
    });
  });
});