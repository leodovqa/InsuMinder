export const pad2 = (num) => String(num).padStart(2, '0');

export const getTabFromUrl = (search = typeof window !== 'undefined' ? window.location.search : '') => {
  const params = new URLSearchParams(search);
  const page = params.get('page') || params.get('tab');
  if (page === 'logs' || page === 'settings' || page === 'profile') {
    return page;
  }
  return 'home';
};

export const updateUrlForTab = (tab) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (tab === 'logs' || tab === 'settings' || tab === 'profile') {
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

export const formatRelativeTime = (value) => {
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
      return `in ${futureHours}h ${remMin > 0 ? `${remMin}m` : ''}`.trim();
    }
    if (futureMin > 0) {
      return `in ${futureMin} min`;
    }
    return 'in less than a min';
  }

  const pastSec = Math.floor(diffMs / 1000);
  const pastMin = Math.floor(pastSec / 60);
  const pastHours = Math.floor(pastMin / 60);
  const pastDays = Math.floor(pastHours / 24);

  if (pastSec < 60) return 'Just now';
  if (pastMin < 60) return `${pastMin} ${pastMin === 1 ? 'minute' : 'minutes'} ago`;
  if (pastHours < 24) return `${pastHours} ${pastHours === 1 ? 'hour' : 'hours'} ago`;
  if (pastDays === 1) return 'Yesterday';
  return `${pastDays} days ago`;
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

export const getWeekDisplayInfo = (selectedWeekStart) => {
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

  const monthName = wednesday.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

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

export const getWeeklyTrendData = (logsList, selectedWeekStart) => {
  const days = [];
  const todayStr = formatDateOnly(new Date().toISOString());
  const anchorWednesday = new Date(
    selectedWeekStart.getFullYear(),
    selectedWeekStart.getMonth(),
    selectedWeekStart.getDate() + 3
  );
  const anchorMonth = anchorWednesday.getMonth();

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
    const dayName = d.toLocaleDateString('en-IL', { weekday: 'short' });
    const dayNum = d.getDate();
    const monthNum = d.getMonth() + 1;
    const isToday = dateStr === todayStr;
    const isOtherMonth = d.getMonth() !== anchorMonth;

    const count = logsList.filter(log => formatDateOnly(log.injected_at) === dateStr).length;

    days.push({
      date: d,
      dateStr,
      dayName,
      shortDate: `${dayNum}/${monthNum}`,
      count,
      isToday,
      isOtherMonth
    });
  }

  const totalWeekInjections = days.reduce((sum, d) => sum + d.count, 0);
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

  for (let i = 0; i < logsList.length - 1; i++) {
    const current = logsList[i];
    const previous = logsList[i + 1];
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

export const getFriendlyReminderError = (rawError, isTelegramConfigured = true) => {
  if (isTelegramConfigured === false) {
    return {
      category: 'Telegram Configuration Issue',
      message: 'Telegram is not configured. Go to Settings to set up your Telegram bot token and chat destination.'
    };
  }

  const err = (rawError && String(rawError).trim()) || '';

  if (!err) {
    return {
      category: 'Delivery Failed',
      message: 'The reminder could not be delivered to Telegram.'
    };
  }

  if (/expired/i.test(err)) {
    return {
      category: 'Reminder Expired',
      message: 'This reminder expired without delivery because more than 24 hours passed.'
    };
  }

  if (/network|econnrefused|enotfound|timeout|aborted|fetch failed|no connection/i.test(err)) {
    return {
      category: 'Network Connection Error',
      message: 'Could not connect to Telegram servers due to a network connection issue. Please check your internet connection.'
    };
  }

  if (/chat not found|unauthorized|invalid token|bot token|not configured|chat_id|401|404/i.test(err)) {
    return {
      category: 'Telegram Configuration Issue',
      message: 'The Telegram bot token or chat ID is invalid, missing, or could not be found. Please check your Telegram settings.'
    };
  }

  if (/too many requests|rate limit|429|500|502|503|504|internal|service/i.test(err)) {
    return {
      category: 'Telegram Service Issue',
      message: 'Telegram servers were temporarily unable to deliver this reminder due to a service issue on their end.'
    };
  }

  return {
    category: 'Delivery Failed',
    message: err
  };
};

export const getReminderStatus = (log, type = '2h', isTelegramConfigured = true) => {
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
      rawError: null
    };
  }

  let targetTime;
  let isSent;
  let rawError;

  if (type === '10m') {
    targetTime = log.notify_10m_at || (log.injected_at ? new Date(new Date(log.injected_at).getTime() + 10 * 60 * 1000).toISOString() : null);
    isSent = Boolean(log.status_10m_sent === 1 || log.status_10m_sent === true || log.status_10m_sent === '1');
    rawError = log.error_10m;
  } else if (type === '3h') {
    targetTime = log.notify_3h_at;
    isSent = Boolean(log.status_3h_sent === 1 || log.status_3h_sent === true || log.status_3h_sent === '1');
    rawError = log.error_3h;
  } else {
    targetTime = log.notify_2h_at;
    isSent = Boolean(log.status_2h_sent === 1 || log.status_2h_sent === true || log.status_2h_sent === '1');
    rawError = log.error_2h;
  }

  if (isSent) {
    return {
      type,
      status: 'sent',
      label: 'Sent',
      pillLabel: 'Sent',
      icon: '✅',
      badgeClass: 'badge-sent',
      pillClass: 'sent',
      title: 'Reminder delivered to Telegram.',
      targetTime,
      friendlyError: null,
      rawError: null
    };
  }

  const targetDate = new Date(targetTime);
  const isDueOrPast = !isNaN(targetDate.getTime()) && targetDate.getTime() <= Date.now();

  if (isDueOrPast) {
    const friendly = getFriendlyReminderError(rawError, isTelegramConfigured);
    return {
      type,
      status: 'failed',
      label: 'Not Sent',
      pillLabel: 'Not Sent',
      icon: '⚠️',
      badgeClass: 'badge-failed',
      pillClass: 'failed',
      title: friendly.message,
      targetTime,
      friendlyError: friendly,
      rawError: rawError ? String(rawError).trim() : null
    };
  }

  return {
    type,
    status: 'upcoming',
    label: 'Upcoming',
    pillLabel: 'Pending',
    icon: '⏳',
    badgeClass: 'badge-upcoming',
    pillClass: 'pending',
    title: targetTime ? `Scheduled for ${formatDateTime(targetTime)}` : 'Scheduled',
    targetTime,
    friendlyError: null,
    rawError: null
  };
};

