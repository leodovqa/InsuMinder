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
    window.history.replaceState({ page: tab }, '', newRelativePathQuery);
  }
};

export const DATE_FORMATS = Object.freeze({
  DD_MM_YYYY: 'DD/MM/YYYY',
  MM_DD_YYYY: 'MM/DD/YYYY',
  YYYY_MM_DD: 'YYYY-MM-DD'
});

export const getSavedDateFormat = () => {
  if (typeof window === 'undefined') return 'DD/MM/YYYY';
  try {
    return localStorage.getItem('insuminder_date_format') || 'DD/MM/YYYY';
  } catch {
    return 'DD/MM/YYYY';
  }
};

export const setSavedDateFormat = (format) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('insuminder_date_format', format);
  } catch (err) {
    console.error('Failed to save date format:', err);
  }
};

export const formatDisplayDate = (value, customFormat) => {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const format = customFormat || getSavedDateFormat();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const d = parts.find(p => p.type === 'day')?.value || '01';
  const m = parts.find(p => p.type === 'month')?.value || '01';
  const y = parts.find(p => p.type === 'year')?.value || '1970';

  if (format === 'MM/DD/YYYY') {
    return `${m}/${d}/${y}`;
  }
  if (format === 'YYYY-MM-DD') {
    return `${y}-${m}-${d}`;
  }
  return `${d}/${m}/${y}`;
};

export const formatDateOnly = (value, customFormat) => {
  return formatDisplayDate(value, customFormat);
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

export const formatDateTime = (value, customFormat) => {
  if (!value) return '';
  const datePart = formatDisplayDate(value, customFormat);
  const timePart = formatTimeOnly(value);
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

export const getWeeklyTrendData = (logsList, selectedWeekStart, lang = 'en', dateFormat = null) => {
  const fmt = dateFormat || getSavedDateFormat();
  const formatDayMonth = (dObj) => {
    const day = dObj.getDate();
    const month = dObj.getMonth() + 1;
    if (fmt === DATE_FORMATS.MM_DD_YYYY) {
      return `${month}/${day}`;
    }
    if (fmt === DATE_FORMATS.YYYY_MM_DD) {
      return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return `${day}/${month}`;
  };

  const days = [];
  const todayStr = formatDateOnly(new Date().toISOString(), fmt);
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
    const dateStr = formatDateOnly(d.toISOString(), fmt);
    const dayKey = dayKeys[d.getDay()];
    const dayName = translate(`daysShort.${dayKey}`, {}, lang);
    const fullDayName = translate(`daysFull.${dayKey}`, {}, lang);
    const isToday = dateStr === todayStr;
    const isOtherMonth = d.getMonth() !== anchorMonth;

    const dayLogs = (logsList || []).filter(log => formatDateOnly(log.injected_at, fmt) === dateStr);
    const bolusCount = dayLogs.filter(log => !log.type || log.type === 'bolus').length;
    const basalCount = dayLogs.filter(log => log.type === 'basal').length;
    const count = bolusCount + basalCount;

    days.push({
      date: d,
      dateStr,
      dayName,
      fullDayName,
      shortDate: formatDayMonth(d),
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
  const startDayMonth = formatDayMonth(startDay);
  const endDayMonth = formatDayMonth(endDay);
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

export const getRapidInjections = (logsList, targetDateKey = null, dateFormat = null) => {
  const fmt = dateFormat || getSavedDateFormat();
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
      if (targetDateKey && formatDateOnly(current.injected_at, fmt) !== targetDateKey) {
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


export const extractChannelError = (rawError, channel) => {
  if (!rawError || typeof rawError !== 'string') return null;
  const clean = rawError.replace(/^PARTIAL:\s*/i, '');
  const parts = clean.split(';');
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed.toLowerCase().startsWith(channel.toLowerCase() + ':')) {
      return trimmed.slice(channel.length + 1).trim();
    }
  }
  return clean;
};

export const buildDeliveryChannelsList = ({
  isSent,
  isPartial,
  isDueOrPast,
  isEnabled,
  isTelegramEnabled,
  isDeviceEnabled,
  rawError,
  lang = 'en'
}) => {
  const channels = [];

  if (isTelegramEnabled || rawError?.includes('Telegram:')) {
    const hasTgError = rawError && rawError.includes('Telegram:');
    let status = 'upcoming';
    let label = translate('modals.channelStatusScheduled', {}, lang);
    let badgeClass = 'badge-upcoming';
    let statusIcon = '⏳';
    let error = null;

    if (isSent) {
      if (hasTgError) {
        status = 'failed';
        label = translate('modals.channelStatusFailed', {}, lang);
        badgeClass = 'badge-failed';
        statusIcon = '❌';
        error = extractChannelError(rawError, 'Telegram');
      } else {
        status = 'sent';
        label = translate('modals.channelStatusSent', {}, lang);
        badgeClass = 'badge-sent';
        statusIcon = '✅';
      }
    } else if (isDueOrPast) {
      status = 'failed';
      label = translate('modals.channelStatusFailed', {}, lang);
      badgeClass = 'badge-failed';
      statusIcon = '❌';
      error = hasTgError ? extractChannelError(rawError, 'Telegram') : (rawError || 'Failed to deliver');
    } else if (!isEnabled) {
      status = 'disabled';
      label = translate('modals.channelStatusDisabled', {}, lang);
      badgeClass = 'badge-disabled';
      statusIcon = '🔕';
    }

    channels.push({
      id: 'telegram',
      name: translate('modals.channelTelegram', {}, lang),
      icon: '📱',
      status,
      label,
      badgeClass,
      statusIcon,
      error
    });
  }

  if (isDeviceEnabled || rawError?.includes('Device:')) {
    const hasDevError = rawError && rawError.includes('Device:');
    let status = 'upcoming';
    let label = translate('modals.channelStatusScheduled', {}, lang);
    let badgeClass = 'badge-upcoming';
    let statusIcon = '⏳';
    let error = null;

    if (isSent) {
      if (hasDevError) {
        status = 'failed';
        label = translate('modals.channelStatusFailed', {}, lang);
        badgeClass = 'badge-failed';
        statusIcon = '❌';
        error = extractChannelError(rawError, 'Device');
      } else {
        status = 'sent';
        label = translate('modals.channelStatusSent', {}, lang);
        badgeClass = 'badge-sent';
        statusIcon = '✅';
      }
    } else if (isDueOrPast) {
      status = 'failed';
      label = translate('modals.channelStatusFailed', {}, lang);
      badgeClass = 'badge-failed';
      statusIcon = '❌';
      error = hasDevError ? extractChannelError(rawError, 'Device') : (rawError || 'Failed to deliver');
    } else if (!isEnabled) {
      status = 'disabled';
      label = translate('modals.channelStatusDisabled', {}, lang);
      badgeClass = 'badge-disabled';
      statusIcon = '🔕';
    }

    channels.push({
      id: 'device',
      name: translate('modals.channelNotificationCenter', {}, lang),
      icon: '🔔',
      status,
      label,
      badgeClass,
      statusIcon,
      error
    });
  }

  return channels;
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
      isDisabled: false,
      channels: []
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

  const effectivePrefs = getEffectiveNotificationPreferences(notificationPreferences);
  const scope = activeContext === 'shared' ? 'shared' : 'personal';
  const prefKey = type === '10m' ? 'rem10m' : (type === '3h' ? 'rem3h' : 'rem2h');
  const isEnabled = effectivePrefs[scope]?.[prefKey] !== false;
  const isExplicitlyDisabled = rawError === 'Disabled in notification settings.' || !isEnabled;

  const isTelegramEnabled = Boolean(isTelegramConfigured && effectivePrefs[scope]?.telegram !== false);
  const isDeviceEnabled = Boolean(
    effectivePrefs[scope]?.webPush !== false ||
    (typeof window !== 'undefined' && localStorage.getItem('insuminder_device_notifications_active') === 'true')
  );

  const isPartial = Boolean(isSent && rawError && (rawError.startsWith('PARTIAL:') || rawError.includes('Device:') || rawError.includes('Telegram:')));
  const targetDate = new Date(targetTime);
  const isDueOrPast = !isNaN(targetDate.getTime()) && targetDate.getTime() <= Date.now();

  const channels = buildDeliveryChannelsList({
    isSent,
    isPartial,
    isDueOrPast,
    isEnabled: !isExplicitlyDisabled,
    isTelegramEnabled,
    isDeviceEnabled,
    rawError,
    lang
  });

  if (isSent) {
    if (isPartial) {
      return {
        type,
        status: 'partial',
        label: translate('status.sentPartial', {}, lang),
        pillLabel: translate('status.sentPartial', {}, lang),
        icon: '❓',
        badgeClass: 'badge-partial',
        pillClass: 'partial',
        title: rawError.replace(/^PARTIAL:\s*/, ''),
        targetTime,
        friendlyError: {
          category: translate('modals.channelStatusFailed', {}, lang),
          message: rawError.replace(/^PARTIAL:\s*/, '')
        },
        rawError: rawError ? String(rawError).trim() : null,
        isDisabled: false,
        channels
      };
    }
    return {
      type,
      status: 'sent',
      label: translate('status.sent', {}, lang),
      pillLabel: translate('status.sent', {}, lang),
      icon: '✅',
      badgeClass: 'badge-sent',
      pillClass: 'sent',
      title: translate('modals.sentSuccessMulti', {}, lang),
      targetTime,
      friendlyError: null,
      rawError: null,
      isDisabled: false,
      channels
    };
  }

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
      isDisabled: true,
      channels
    };
  }

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
      isDisabled: false,
      channels
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
    isDisabled: false,
    channels
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

  const effectivePreferencesObj = getEffectiveNotificationPreferences(effectivePrefs);
  const scope = effectiveContext === 'shared' ? 'shared' : 'personal';
  const isEnabled = effectivePreferencesObj[scope]?.basal !== false;
  const isExplicitlyDisabled = rawError === 'Disabled in notification settings.' || !isEnabled;

  const isTelegramEnabled = Boolean(isTelegramConfigured && effectivePreferencesObj[scope]?.telegram !== false);
  const isDeviceEnabled = Boolean(
    effectivePreferencesObj[scope]?.webPush !== false ||
    (typeof window !== 'undefined' && localStorage.getItem('insuminder_device_notifications_active') === 'true')
  );

  const isPartial = Boolean(isSent && rawError && (rawError.startsWith('PARTIAL:') || rawError.includes('Device:') || rawError.includes('Telegram:')));
  const nowForBasal = new Date();
  const [bHourForCheck, bMinForCheck] = scheduledTime.split(':').map(n => parseInt(n, 10));
  const isDueOrPast = nowForBasal.getHours() > bHourForCheck || (nowForBasal.getHours() === bHourForCheck && nowForBasal.getMinutes() >= bMinForCheck);

  const channels = buildDeliveryChannelsList({
    isSent,
    isPartial,
    isDueOrPast,
    isEnabled: !isExplicitlyDisabled,
    isTelegramEnabled,
    isDeviceEnabled,
    rawError,
    lang
  });

  if (isSent) {
    if (isPartial) {
      return {
        type: 'basal',
        status: 'partial',
        label: translate('status.sentPartial', {}, lang),
        pillLabel: translate('status.sentPartial', {}, lang),
        icon: '❓',
        badgeClass: 'badge-partial',
        pillClass: 'partial',
        title: rawError.replace(/^PARTIAL:\s*/, ''),
        targetTime: basalReminder?.sent_at || null,
        scheduledTime,
        friendlyError: {
          category: translate('modals.channelStatusFailed', {}, lang),
          message: rawError.replace(/^PARTIAL:\s*/, '')
        },
        rawError: rawError ? String(rawError).trim() : null,
        isDisabled: false,
        channels
      };
    }
    return {
      type: 'basal',
      status: 'sent',
      label: translate('status.sent', {}, lang),
      pillLabel: translate('status.sent', {}, lang),
      icon: '✅',
      badgeClass: 'badge-sent',
      pillClass: 'sent',
      title: translate('modals.sentSuccessMulti', {}, lang),
      targetTime: basalReminder?.sent_at || null,
      scheduledTime,
      friendlyError: null,
      rawError: null,
      isDisabled: false,
      channels
    };
  }

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
      isDisabled: true,
      channels
    };
  }

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
      isDisabled: false,
      channels
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
        isDisabled: false,
        channels
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
    isDisabled: false,
    channels
  };
};



export const getBasalTimeDiffMinutes = (nowDate, basalTimeStr) => {
  if (!basalTimeStr || !/^\d{1,2}:\d{2}$/.test(basalTimeStr)) return 0;
  const [bH, bM] = basalTimeStr.split(':').map(Number);
  const now = nowDate || new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const basalMins = bH * 60 + bM;
  let diff = nowMins - basalMins;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
};
