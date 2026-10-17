import { translate } from './i18n';

export const pad2 = (num) => String(num).padStart(2, '0');

export const getTabFromUrl = (search = typeof window !== 'undefined' ? window.location.search : '') => {
  const params = new URLSearchParams(search);
  const page = params.get('page') || params.get('tab');
  if (page === 'logs' || page === 'settings' || page === 'profile' || page === 'notifications' || page === 'about') {
    return page;
  }
  return 'home';
};

export const updateUrlForTab = (tab) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (tab === 'logs' || tab === 'settings' || tab === 'profile' || tab === 'notifications' || tab === 'about') {
    url.searchParams.set('page', tab);
  } else {
    url.searchParams.delete('page');
    url.searchParams.delete('tab');
  }
  const searchStr = url.searchParams.toString();
  const newRelativePathQuery = url.pathname + (searchStr ? `?${searchStr}` : '') + url.hash;
  const currentSearchStr = new URLSearchParams(window.location.search).toString();

  if (searchStr !== currentSearchStr) {
    window.history.pushState({ page: tab }, '', newRelativePathQuery);
  }
};

export const formatDateOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const formatTimeOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleTimeString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const datePart = date.toLocaleDateString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const timePart = date.toLocaleTimeString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return `${datePart}, ${timePart}`;
};

export const formatRelativeTime = (value, lang = 'en') => {
  if (!value) return '';
  const now = Date.now();
  const time = new Date(value).getTime();
  const diffMs = now - time;

  if (diffMs < 0) {
    const futureMs = -diffMs;
    const futureSec = Math.floor(futureMs / 1000);
    const futureMin = Math.floor(futureSec / 60);
    const futureHours = Math.floor(futureMin / 60);
    const remMin = futureMin % 60;

    if (futureHours > 0) {
      return translate('time.inHours', { hours: futureHours, mins: remMin }, lang);
    }
    if (futureMin > 0) {
      return translate('time.inMinutes', { mins: futureMin }, lang);
    }
    return translate('time.inLessThanMin', {}, lang);
  }

  const pastSec = Math.floor(diffMs / 1000);
  const pastMin = Math.floor(pastSec / 60);
  const pastHours = Math.floor(pastMin / 60);
  const pastDays = Math.floor(pastHours / 24);

  if (pastSec < 60) return translate('time.justNow', {}, lang);
  if (pastMin < 60) {
    return pastMin === 1
      ? translate('time.minuteAgo', { count: pastMin }, lang)
      : translate('time.minutesAgo', { count: pastMin }, lang);
  }
  if (pastHours < 24) {
    return pastHours === 1
      ? translate('time.hourAgo', { count: pastHours }, lang)
      : translate('time.hoursAgo', { count: pastHours }, lang);
  }
  if (pastDays === 1) return translate('time.yesterday', {}, lang);
  return translate('time.daysAgo', { count: pastDays }, lang);
};

export const isPast = (value) => {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
};

export const getStartOfWeek = (d) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday (Israel calendar: Sun to Sat)
  date.setDate(date.getDate() - day);
  return date;
};

export const getWeeksBelongingToMonth = (year, monthIndex) => {
  // In Sunday-to-Saturday weeks, Wednesday (4th day, +3) defines the anchor month
  const weeks = [];
  const firstOfMonth = new Date(year, monthIndex, 1);
  let cur = getStartOfWeek(firstOfMonth);

  for (let i = 0; i < 6; i++) {
    const wednesday = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 3);
    if (wednesday.getMonth() === monthIndex && wednesday.getFullYear() === year) {
      weeks.push(new Date(cur));
    }
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
};

export const getWeekDisplayInfo = (selectedWeekStart, lang = 'en') => {
  const wednesday = new Date(
    selectedWeekStart.getFullYear(),
    selectedWeekStart.getMonth(),
    selectedWeekStart.getDate() + 3
  );
  const anchorYear = wednesday.getFullYear();
  const anchorMonth = wednesday.getMonth();

  const monthWeeks = getWeeksBelongingToMonth(anchorYear, anchorMonth);
  const startIso = selectedWeekStart.toISOString().slice(0, 10);
  let activeWeekIndex = monthWeeks.findIndex(w => w.toISOString().slice(0, 10) === startIso);
  if (activeWeekIndex === -1) {
    activeWeekIndex = 0;
  }

  const locale = lang === 'he' ? 'he-IL' : (lang === 'ru' ? 'ru-RU' : 'en-US');
  let monthName = wednesday.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric'
  });
  if (lang === 'ru' && monthName) {
    monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  }

  return {
    anchorYear,
    anchorMonth,
    monthName,
    activeWeekIndex,
    weekNumber: activeWeekIndex + 1,
    totalWeeks: monthWeeks.length,
    monthWeeks
  };
};

export const getWeeklyTrendData = (logsList, selectedWeekStart, lang = 'en') => {
  const days = [];
  const todayStr = formatDateOnly(new Date().toISOString());
  const anchorWednesday = new Date(
    selectedWeekStart.getFullYear(),
    selectedWeekStart.getMonth(),
    selectedWeekStart.getDate() + 3
  );
  const anchorMonth = anchorWednesday.getMonth();
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(
      selectedWeekStart.getFullYear(),
      selectedWeekStart.getMonth(),
      selectedWeekStart.getDate() + i,
      12,
      0,
      0
    );
    const dateStr = formatDateOnly(d.toISOString());
    const dayKey = dayKeys[d.getDay()];
    const dayName = translate(`daysShort.${dayKey}`, {}, lang);
    const fullDayName = translate(`daysFull.${dayKey}`, {}, lang);
    const dayNum = d.getDate();
    const monthNum = d.getMonth() + 1;
    const isToday = dateStr === todayStr;
    const isOtherMonth = d.getMonth() !== anchorMonth;

    const dayLogs = logsList.filter(log => formatDateOnly(log.injected_at) === dateStr);
    const bolusCount = dayLogs.filter(log => !log.type || log.type === 'bolus').length;
    const basalCount = dayLogs.filter(log => log.type === 'basal').length;
    const count = bolusCount + basalCount;

    days.push({
      date: d,
      dateStr,
      dayName,
      fullDayName,
      shortDate: `${dayNum}/${monthNum}`,
      count,
      bolusCount,
      basalCount,
      isToday,
      isOtherMonth
    });
  }

  const totalBolusInjections = days.reduce((sum, d) => sum + d.bolusCount, 0);
  const totalBasalInjections = days.reduce((sum, d) => sum + d.basalCount, 0);
  const totalWeekInjections = totalBolusInjections + totalBasalInjections;
  const maxCount = Math.max(3, ...days.map(d => d.count));
  const activeDaysCount = days.filter(d => d.count > 0).length;
  const dailyAvg = (totalWeekInjections / 7).toFixed(1);

  const startDay = days[0].date;
  const endDay = days[6].date;
  const startDayMonth = `${startDay.getDate()}/${startDay.getMonth() + 1}`;
  const endDayMonth = `${endDay.getDate()}/${endDay.getMonth() + 1}`;
  const weekRangeStr = `${startDayMonth} – ${endDayMonth}`;

  const todayWeekStart = getStartOfWeek(new Date());
  const isCurrentWeek =
    selectedWeekStart.getFullYear() === todayWeekStart.getFullYear() &&
    selectedWeekStart.getMonth() === todayWeekStart.getMonth() &&
    selectedWeekStart.getDate() === todayWeekStart.getDate();

  return {
    days,
    totalWeekInjections,
    totalBolusInjections,
    totalBasalInjections,
    maxCount,
    activeDaysCount,
    dailyAvg,
    weekRangeStr,
    isCurrentWeek
  };
};

export const getRapidInjections = (logsList, targetDateKey = null) => {
  const rapidList = [];
  const rapidIds = new Set();
  const bolusLogs = (logsList || []).filter(log => !log.type || log.type === 'bolus');

  for (let i = 0; i < bolusLogs.length - 1; i++) {
    const current = bolusLogs[i];
    const previous = bolusLogs[i + 1];
    const currentMs = new Date(current.injected_at).getTime();
    const prevMs = new Date(previous.injected_at).getTime();
    const diffMs = currentMs - prevMs;
    const threeHoursMs = 3 * 60 * 60 * 1000;

    if (diffMs > 0 && diffMs < threeHoursMs) {
      if (targetDateKey && formatDateOnly(current.injected_at) !== targetDateKey) {
        continue;
      }

      const diffMinutes = Math.round(diffMs / (60 * 1000));
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      const intervalStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      rapidList.push({
        currentId: current.id,
        currentInjectedAt: current.injected_at,
        previousInjectedAt: previous.injected_at,
        intervalStr,
        diffMinutes
      });
      rapidIds.add(current.id);
    }
  }

  return { rapidList, rapidIds };
};

export const maskBotToken = (token) => {
  if (!token || typeof token !== 'string') return '';
  const trimmed = token.trim();
  if (trimmed.length <= 10) return '••••••••';
  return `${trimmed.slice(0, 5)}••••${trimmed.slice(-4)}`;
};

export const isCustomConfigName = (name, chatId) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const cleanChatId = chatId ? String(chatId).trim() : '';
  if (cleanChatId && (trimmed === cleanChatId || trimmed === `Chat (${cleanChatId})`)) {
    return false;
  }
  if (/^Chat \(-?\d+\)$/i.test(trimmed)) {
    return false;
  }
  return true;
};

export const getFriendlyReminderError = (rawError, isTelegramConfigured = true, lang = 'en') => {
  if (isTelegramConfigured === false) {
    return {
      category: translate('errors.telegramConfigIssue', {}, lang),
      message: translate('errors.telegramNotConfiguredMsg', {}, lang)
    };
  }

  const err = (rawError && String(rawError).trim()) || '';

  if (!err) {
    return {
      category: translate('errors.deliveryFailed', {}, lang),
      message: translate('errors.deliveryFailedMsg', {}, lang)
    };
  }

  if (/expired/i.test(err)) {
    return {
      category: translate('errors.reminderExpired', {}, lang),
      message: translate('errors.reminderExpiredMsg', {}, lang)
    };
  }

  if (/network|econnrefused|enotfound|timeout|aborted|fetch failed|no connection/i.test(err)) {
    return {
      category: translate('errors.networkConnError', {}, lang),
      message: translate('errors.networkConnErrorMsg', {}, lang)
    };
  }

  if (/not configured/i.test(err)) {
    return {
      category: translate('errors.telegramConfigIssue', {}, lang),
      message: translate('errors.telegramNotConfiguredMsg', {}, lang)
    };
  }

  if (/chat not found|unauthorized|invalid token|bot token|chat_id|401|404/i.test(err)) {
    return {
      category: translate('errors.telegramConfigIssue', {}, lang),
      message: translate('errors.telegramInvalidTokenMsg', {}, lang)
    };
  }

  if (/disabled in/i.test(err)) {
    return {
      category: translate('status.disabledInSettings', {}, lang),
      message: translate('status.disabledInSettingsDesc', {}, lang)
    };
  }

  if (/too many requests|rate limit|429|500|502|503|504|internal|service/i.test(err)) {
    return {
      category: translate('errors.telegramServiceIssue', {}, lang),
      message: translate('errors.telegramServiceIssueMsg', {}, lang)
    };
  }

  return {
    category: translate('errors.deliveryFailed', {}, lang),
    message: err
  };
};

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  personal: {
    rem10m: true,
    rem2h: true,
    rem3h: true,
    basal: true,
    telegram: true
  },
  shared: {
    rem10m: true,
    rem2h: true,
    rem3h: true,
    basal: true
  }
};

export const getEffectiveNotificationPreferences = (userPrefs) => {
  let parsed = userPrefs;
  if (typeof userPrefs === 'string') {
    try {
      parsed = JSON.parse(userPrefs);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
  return {
    personal: {
      rem10m: parsed.personal?.rem10m !== false,
      rem2h: parsed.personal?.rem2h !== false,
      rem3h: parsed.personal?.rem3h !== false,
      basal: parsed.personal?.basal !== false,
      telegram: parsed.personal?.telegram !== false
    },
    shared: {
      rem10m: parsed.shared?.rem10m !== false,
      rem2h: parsed.shared?.rem2h !== false,
      rem3h: parsed.shared?.rem3h !== false,
      basal: parsed.shared?.basal !== false
    }
  };
};

export const getReminderStatus = (log, type = '2h', isTelegramConfigured = true, lang = 'en', notificationPreferences = null, activeContext = 'personal') => {
  if (!log) {
    return {
      type,
      status: 'none',
      label: '—',
      pillLabel: '—',
      icon: '',
      badgeClass: 'badge-upcoming',
      pillClass: 'pending',
      title: 'No reminder scheduled',
      targetTime: null,
      friendlyError: null,
      rawError: null,
      isDisabled: false
    };
  }

  let targetTime;
  let isSent;
  let rawError;

  if (type === '10m') {
    targetTime = log.notify_10m_at || (log.injected_at ? new Date(new Date(log.injected_at).getTime() + 10 * 60 * 1000).toISOString() : null);
    isSent = Boolean(
      log.status_10m_sent === 1 || log.status_10m_sent === true || log.status_10m_sent === '1' ||
      log.status_10m === 1 || log.status_10m === true || log.status_10m === '1'
    );
    rawError = log.error_10m;
  } else if (type === '3h') {
    targetTime = log.notify_3h_at;
    isSent = Boolean(
      log.status_3h_sent === 1 || log.status_3h_sent === true || log.status_3h_sent === '1' ||
      log.status_3h === 1 || log.status_3h === true || log.status_3h === '1'
    );
    rawError = log.error_3h;
  } else {
    targetTime = log.notify_2h_at;
    isSent = Boolean(
      log.status_2h_sent === 1 || log.status_2h_sent === true || log.status_2h_sent === '1' ||
      log.status_2h === 1 || log.status_2h === true || log.status_2h === '1'
    );
    rawError = log.error_2h;
  }

  if (isSent) {
    return {
      type,
      status: 'sent',
      label: translate('status.sent', {}, lang),
      pillLabel: translate('status.sent', {}, lang),
      icon: '✅',
      badgeClass: 'badge-sent',
      pillClass: 'sent',
      title: 'Reminder delivered to Telegram.',
      targetTime,
      friendlyError: null,
      rawError: null,
      isDisabled: false
    };
  }

  const effectivePrefs = getEffectiveNotificationPreferences(notificationPreferences);
  const scope = activeContext === 'shared' ? 'shared' : 'personal';
  const prefKey = type === '10m' ? 'rem10m' : (type === '3h' ? 'rem3h' : 'rem2h');
  const isEnabled = effectivePrefs[scope]?.[prefKey] !== false;
  const isExplicitlyDisabled = rawError === 'Disabled in notification settings.' || !isEnabled;

  if (isExplicitlyDisabled) {
    return {
      type,
      status: 'disabled',
      label: translate('status.disabled', {}, lang),
      pillLabel: translate('status.disabled', {}, lang),
      icon: '🔕',
      badgeClass: 'badge-disabled',
      pillClass: 'disabled',
      title: translate('status.disabledInSettingsDesc', {}, lang),
      targetTime,
      friendlyError: {
        category: translate('status.disabledInSettings', {}, lang),
        message: translate('status.disabledInSettingsDesc', {}, lang)
      },
      rawError: rawError ? String(rawError).trim() : null,
      isDisabled: true
    };
  }

  const targetDate = new Date(targetTime);
  const isDueOrPast = !isNaN(targetDate.getTime()) && targetDate.getTime() <= Date.now();

  if (isDueOrPast) {
    const friendly = getFriendlyReminderError(rawError, isTelegramConfigured, lang);
    return {
      type,
      status: 'failed',
      label: translate('status.notSent', {}, lang),
      pillLabel: translate('status.notSent', {}, lang),
      icon: '⚠️',
      badgeClass: 'badge-failed',
      pillClass: 'failed',
      title: friendly.message,
      targetTime,
      friendlyError: friendly,
      rawError: rawError ? String(rawError).trim() : null,
      isDisabled: false
    };
  }

  return {
    type,
    status: 'upcoming',
    label: translate('status.upcoming', {}, lang),
    pillLabel: translate('status.pending', {}, lang),
    icon: '⏳',
    badgeClass: 'badge-upcoming',
    pillClass: 'pending',
    title: targetTime ? `Scheduled for ${formatDateTime(targetTime)}` : 'Scheduled',
    targetTime,
    friendlyError: null,
    rawError: null,
    isDisabled: false
  };
};

export const getBasalReminderStatus = (
  basalReminder,
  basalTime = '20:00',
  isTelegramConfigured = true,
  lang = 'en',
  hasLoggedBasalTodayOrPrefs = false,
  notificationPreferences = null,
  activeContext = 'personal'
) => {
  let effectivePrefs = notificationPreferences;
  let effectiveContext = activeContext;

  if (typeof hasLoggedBasalTodayOrPrefs === 'object' && hasLoggedBasalTodayOrPrefs !== null) {
    effectivePrefs = hasLoggedBasalTodayOrPrefs;
    effectiveContext = typeof notificationPreferences === 'string' ? notificationPreferences : 'personal';
  }

  const scheduledTime = basalReminder?.scheduled_time || basalTime || '20:00';
  const isSent = Boolean(basalReminder?.status_sent === 1 || basalReminder?.status_sent === true || basalReminder?.status_sent === '1');
  const rawError = basalReminder?.error || null;

  if (isSent) {
    return {
      type: 'basal',
      status: 'sent',
      label: translate('status.sent', {}, lang),
      pillLabel: translate('status.sent', {}, lang),
      icon: '✅',
      badgeClass: 'badge-sent',
      pillClass: 'sent',
      title: 'Reminder delivered to Telegram.',
      targetTime: basalReminder?.sent_at || null,
      scheduledTime,
      friendlyError: null,
      rawError: null,
      isDisabled: false
    };
  }

  const effectivePreferencesObj = getEffectiveNotificationPreferences(effectivePrefs);
  const scope = effectiveContext === 'shared' ? 'shared' : 'personal';
  const isEnabled = effectivePreferencesObj[scope]?.basal !== false;
  const isExplicitlyDisabled = rawError === 'Disabled in notification settings.' || !isEnabled;

  if (isExplicitlyDisabled) {
    return {
      type: 'basal',
      status: 'disabled',
      label: translate('status.disabled', {}, lang),
      pillLabel: translate('status.disabled', {}, lang),
      icon: '🔕',
      badgeClass: 'badge-disabled',
      pillClass: 'disabled',
      title: translate('status.disabledInSettingsDesc', {}, lang),
      targetTime: null,
      scheduledTime,
      friendlyError: {
        category: translate('status.disabledInSettings', {}, lang),
        message: translate('status.disabledInSettingsDesc', {}, lang)
      },
      rawError: rawError ? String(rawError).trim() : null,
      isDisabled: true
    };
  }

  // Check whether current time is past scheduled basal time
  const now = new Date();
  const [bHour, bMin] = scheduledTime.split(':').map(n => parseInt(n, 10));
  const curHour = now.getHours();
  const curMin = now.getMinutes();
  const isDueOrPast = (curHour > bHour) || (curHour === bHour && curMin >= bMin);

  // If there's an explicit delivery error recorded (other than 'Already injected')
  if (rawError && rawError !== 'Already injected') {
    const friendly = getFriendlyReminderError(rawError, isTelegramConfigured, lang);
    return {
      type: 'basal',
      status: 'failed',
      label: translate('status.notSent', {}, lang),
      pillLabel: translate('status.notSent', {}, lang),
      icon: '⚠️',
      badgeClass: 'badge-failed',
      pillClass: 'failed',
      title: friendly.message,
      targetTime: null,
      scheduledTime,
      friendlyError: friendly,
      rawError: String(rawError).trim(),
      isDisabled: false
    };
  }

  if (isDueOrPast) {
    if (!isTelegramConfigured) {
      const friendly = getFriendlyReminderError('', false, lang);
      return {
        type: 'basal',
        status: 'failed',
        label: translate('status.notSent', {}, lang),
        pillLabel: translate('status.notSent', {}, lang),
        icon: '⚠️',
        badgeClass: 'badge-failed',
        pillClass: 'failed',
        title: friendly.message,
        targetTime: null,
        scheduledTime,
        friendlyError: friendly,
        rawError: rawError ? String(rawError).trim() : null,
        isDisabled: false
      };
    }
  }

  return {
    type: 'basal',
    status: 'upcoming',
    label: translate('status.upcoming', {}, lang),
    pillLabel: translate('status.pending', {}, lang),
    icon: '⏳',
    badgeClass: 'badge-upcoming',
    pillClass: 'pending',
    title: `Scheduled for ${scheduledTime}`,
    targetTime: null,
    scheduledTime,
    friendlyError: null,
    rawError: null,
    isDisabled: false
  };
};

