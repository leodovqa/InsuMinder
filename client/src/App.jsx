import { useState, useEffect } from 'react';
import './App.css';
import {
  pad2,
  getTabFromUrl,
  updateUrlForTab,
  formatDateOnly,
  formatTimeOnly,
  formatDateTime,
  formatRelativeTime,
  getStartOfWeek,
  getWeeksBelongingToMonth,
  getWeekDisplayInfo,
  getWeeklyTrendData,
  getRapidInjections,
  maskBotToken,
  isCustomConfigName,
  getReminderStatus,
  getBasalReminderStatus,
  getEffectiveNotificationPreferences
} from './utils';
import AuthModal from './AuthModal';
import Profile from './Profile';
import NotificationSettings from './NotificationSettings';
import TimePicker24h from './TimePicker24h';
import { authService } from './authService';
import { LanguageProvider, useTranslation } from './i18n';
import { ThemeProvider, useTheme } from './theme/ThemeContext';

const isLocalEnv = Boolean(
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.endsWith('.local') ||
   import.meta.env.DEV)
);

function LiveClock() {
  const { t } = useTranslation();
  const [time, setTime] = useState(() => {
    const now = new Date();
    return {
      hours: pad2(now.getHours()),
      minutes: pad2(now.getMinutes()),
      seconds: pad2(now.getSeconds()),
      hundredths: pad2(Math.floor(now.getMilliseconds() / 10))
    };
  });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime({
        hours: pad2(now.getHours()),
        minutes: pad2(now.getMinutes()),
        seconds: pad2(now.getSeconds()),
        hundredths: pad2(Math.floor(now.getMilliseconds() / 10))
      });
    };

    updateClock();
    const timer = setInterval(updateClock, 40);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="live-clock"
      dir="ltr"
      title={t('home.liveClockTitle')}
      aria-label={`${t('home.liveClockTitle')} ${time.hours}:${time.minutes}:${time.seconds}.${time.hundredths}`}
    >
      <span className="clock-digits">{time.hours}</span>
      <span className="clock-colon">:</span>
      <span className="clock-digits">{time.minutes}</span>
      <span className="clock-colon">:</span>
      <span className="clock-digits">{time.seconds}</span>
      <span className="clock-millis">.{time.hundredths}</span>
    </div>
  );
}

function InjectionEligibility({ latestLog }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!latestLog) {
    return (
      <div className="eligibility-card eligible">
        <div className="eligibility-icon-wrapper">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="eligibility-content">
          <div className="eligibility-title">{t('eligibility.readyTitle')}</div>
          <p className="eligibility-message">
            {t('eligibility.readyNoPrior')}
          </p>
        </div>
      </div>
    );
  }

  const target3hMs = new Date(latestLog.notify_3h_at).getTime();
  const diffMs = target3hMs - now;
  const canInject = diffMs < 0;

  if (canInject) {
    return (
      <div className="eligibility-card eligible">
        <div className="eligibility-icon-wrapper">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="eligibility-content">
          <div className="eligibility-title">{t('eligibility.readyTitle')}</div>
          <p className="eligibility-message">
            {t('eligibility.readyPast3h')}
          </p>
        </div>
      </div>
    );
  }

  const remSec = Math.max(0, Math.floor(diffMs / 1000));
  const remHours = Math.floor(remSec / 3600);
  const remMin = Math.floor((remSec % 3600) / 60);
  const remSeconds = remSec % 60;

  const countdownText = remHours > 0
    ? `${remHours}${t('eligibility.hoursShort')} ${remMin}${t('eligibility.minutesShort')} ${remSeconds}${t('eligibility.secondsShort')} ${t('eligibility.remaining')}`
    : remMin > 0
      ? `${remMin}${t('eligibility.minutesShort')} ${remSeconds}${t('eligibility.secondsShort')} ${t('eligibility.remaining')}`
      : `${remSeconds}${t('eligibility.secondsShort')} ${t('eligibility.remaining')}`;

  return (
    <div className="eligibility-card locked">
      <div className="eligibility-icon-wrapper">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="eligibility-content">
        <div className="eligibility-title-row">
          <span className="eligibility-title">{t('eligibility.waitTitle')}</span>
          <span className="eligibility-countdown" dir="ltr">{countdownText}</span>
        </div>
        <p className="eligibility-message">
          {t('eligibility.waitMessage')}
        </p>
        <div className="eligibility-time-note">
          {t('eligibility.nextAvailable')} <strong dir="ltr">{formatTimeOnly(latestLog.notify_3h_at)}</strong>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { t, language, setLanguage, isRTL } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [logs, setLogs] = useState([]);
  const [basalReminder, setBasalReminder] = useState(null);
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl()); // 'home' | 'logs' | 'settings'
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isLatestExpanded, setIsLatestExpanded] = useState(false);
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(authService.getToken()));
  // Shared Access & Caregiver Context State
  const [urlShareCode, setUrlShareCode] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('shareCode') || params.get('invite') || null;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const hasShare = Boolean(params.get('shareCode') || params.get('invite'));
    const hasToken = Boolean(authService.getToken());
    return hasShare && !hasToken;
  });
  const [authModalMode, setAuthModalMode] = useState(() => {
    if (typeof window === 'undefined') return 'login';
    const params = new URLSearchParams(window.location.search);
    return (params.get('shareCode') || params.get('invite')) ? 'register' : 'login';
  }); // 'login' | 'register'
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);

  const [activeContext, setActiveContext] = useState(() => authService.getActiveContext());
  const [activeOwnerId, setActiveOwnerId] = useState(() => authService.getActiveOwnerId());
  const [shareStatus, setShareStatus] = useState({ shareCode: '', members: [], sharedGroups: [] });
  const [shareInviteEmail, setShareInviteEmail] = useState('');
  const [shareJoinCode, setShareJoinCode] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isJoiningShare, setIsJoiningShare] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [deleteModalConfig, setDeleteModalConfig] = useState(null);
  const [reminderModalData, setReminderModalData] = useState(null);
  const [removeMemberModalData, setRemoveMemberModalData] = useState(null);
  const [leaveGroupModalData, setLeaveGroupModalData] = useState(null);
  const [viewingExplanationModal, setViewingExplanationModal] = useState(null);
  const [isEarlyBolusModalOpen, setIsEarlyBolusModalOpen] = useState(false);
  const [isClearingQueue, setIsClearingQueue] = useState(false);

  // Granular Notification Preferences State
  const [notificationPreferences, setNotificationPreferences] = useState(() => {
    if (user?.notificationPreferences) {
      return getEffectiveNotificationPreferences(user.notificationPreferences);
    }
    try {
      const cached = localStorage.getItem('insuminder_notification_prefs');
      return getEffectiveNotificationPreferences(cached ? JSON.parse(cached) : null);
    } catch {
      return getEffectiveNotificationPreferences(null);
    }
  });

  const [prevUserForPrefs, setPrevUserForPrefs] = useState(user);
  if (user !== prevUserForPrefs) {
    setPrevUserForPrefs(user);
    if (user?.notificationPreferences) {
      setNotificationPreferences(getEffectiveNotificationPreferences(user.notificationPreferences));
    } else {
      try {
        const cached = localStorage.getItem('insuminder_notification_prefs');
        setNotificationPreferences(getEffectiveNotificationPreferences(cached ? JSON.parse(cached) : null));
      } catch {
        setNotificationPreferences(getEffectiveNotificationPreferences(null));
      }
    }
  }

  const handleUpdateNotificationPreferences = async (newPrefs) => {
    const effective = getEffectiveNotificationPreferences(newPrefs);
    setNotificationPreferences(effective);
    try {
      localStorage.setItem('insuminder_notification_prefs', JSON.stringify(effective));
    } catch {
      // ignore
    }
    if (isLoggedIn) {
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            ...authService.getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notificationPreferences: effective })
        });
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error('Failed to save notification preferences to server:', err);
      }
    }
    setNotification({
      type: 'success',
      message: t('notificationSettings.savedSuccess')
    });
  };

  // Synchronize URL search params with activeTab
  useEffect(() => {
    updateUrlForTab(activeTab);
  }, [activeTab]);

  // Handle browser Back / Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromUrl());
      if (isAuthModalOpen) {
        setIsAuthModalOpen(false);
      }
      if (isEarlyBolusModalOpen) {
        setIsEarlyBolusModalOpen(false);
      }
      if (removeMemberModalData) {
        setRemoveMemberModalData(null);
      }
      if (leaveGroupModalData) {
        setLeaveGroupModalData(null);
      }
      if (viewingExplanationModal) {
        setViewingExplanationModal(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthModalOpen, isEarlyBolusModalOpen, removeMemberModalData, leaveGroupModalData, viewingExplanationModal]);

  // Telegram Configuration State
  const [telegramConfigs, setTelegramConfigs] = useState(() => {
    try {
      const cached = localStorage.getItem('insuminder_telegram_configs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [telegramLabel, setTelegramLabel] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [basalTime, setBasalTime] = useState(() => {
    const userStored = authService.getCurrentUser()?.basalTime;
    if (userStored) return userStored;
    try {
      return localStorage.getItem('insuminder_basal_time') || '20:00';
    } catch {
      return '20:00';
    }
  });
  const [basalTimeInput, setBasalTimeInput] = useState(basalTime);

  const handleSaveBasalTime = async (newTime) => {
    if (!newTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) return;
    setBasalTime(newTime);
    try {
      localStorage.setItem('insuminder_basal_time', newTime);
    } catch {
      // ignore
    }
    if (isLoggedIn) {
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            ...authService.getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ basalTime: newTime })
        });
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          authService.setSession(authService.getToken(), data.user);
        }
      } catch (err) {
        console.error('Failed to sync basal time to server:', err);
      }
    }
    setNotification({
      type: 'success',
      message: t('settings.basalTimeSaved')
    });
  };

  const latestLog = logs.length > 0 ? logs[0] : null;
  const latestBolusLog = logs.find(log => !log.type || log.type === 'bolus') || null;
  const isBolusEligible = !latestBolusLog || (new Date(latestBolusLog.notify_3h_at).getTime() <= currentTime.getTime());

  const handleBolusClick = () => {
    if (!isLoggedIn) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    if (!isBolusEligible) {
      setIsEarlyBolusModalOpen(true);
      return;
    }
    handleLogInjection('bolus');
  };

  const handleConfirmEarlyInjection = () => {
    setIsEarlyBolusModalOpen(false);
    handleLogInjection('bolus');
  };

  const handleCloseEarlyModal = () => {
    setIsEarlyBolusModalOpen(false);
  };
  const isTelegramConfigured = telegramConfigs.length > 0
    ? telegramConfigs.some(c => c.isDefault)
    : Boolean(
        localStorage.getItem('insuminder_telegram_configured') === 'true' ||
        (localStorage.getItem('insuminder_telegram_bot_token') && localStorage.getItem('insuminder_telegram_chat_id')) ||
        (telegramBotToken.trim() && telegramChatId.trim())
      );
  const latest10m = getReminderStatus(latestBolusLog, '10m', isTelegramConfigured, language, notificationPreferences, activeContext);
  const latest2h = getReminderStatus(latestBolusLog, '2h', isTelegramConfigured, language, notificationPreferences, activeContext);
  const latest3h = getReminderStatus(latestBolusLog, '3h', isTelegramConfigured, language, notificationPreferences, activeContext);

  const handleOpenReminderModal = (log, type) => {
    if (!log) return;
    if (type === 'basal') {
      const hasLoggedBasalToday = logs.some(l => l.type === 'basal' && formatDateOnly(l.injected_at) === todayDateKey);
      const statusInfo = getBasalReminderStatus(basalReminder, basalTime, isTelegramConfigured, language, hasLoggedBasalToday, notificationPreferences, activeContext);
      setReminderModalData({
        ...statusInfo,
        title: t('modals.basalReminderTitle'),
        formattedTime: statusInfo.targetTime ? formatDateTime(statusInfo.targetTime) : (basalTime || '20:00')
      });
      return;
    }
    const statusInfo = getReminderStatus(log, type, isTelegramConfigured, language, notificationPreferences, activeContext);
    const title = type === '10m'
      ? t('home.rem10mTitle')
      : type === '2h'
      ? t('home.rem2hTitle')
      : t('home.rem3hTitle');
    setReminderModalData({
      ...statusInfo,
      logId: log.id,
      title,
      formattedTime: statusInfo.targetTime ? formatDateTime(statusInfo.targetTime) : ''
    });
  };

  const handleCloseReminderModal = () => {
    setReminderModalData(null);
  };

  const fetchTelegramConfigs = () => {
    fetch('/api/telegram-configs', {
      headers: authService.getAuthHeaders()
    })
      .then(response => response.json())
      .then(data => {
        if (data.success && Array.isArray(data.configs)) {
          setTelegramConfigs(data.configs);
          if (data.configs.length > 0) {
            try {
              localStorage.setItem('insuminder_telegram_configs', JSON.stringify(data.configs));
            } catch {
              // ignore storage errors
            }
            const hasDefault = data.configs.some(c => c.isDefault);
            if (hasDefault) {
              localStorage.setItem('insuminder_telegram_configured', 'true');
            } else {
              localStorage.removeItem('insuminder_telegram_configured');
            }
            localStorage.removeItem('insuminder_telegram_bot_token');
            localStorage.removeItem('insuminder_telegram_chat_id');
          } else {
            localStorage.removeItem('insuminder_telegram_configs');
            localStorage.removeItem('insuminder_telegram_configured');
          }
        }
      })
      .catch(error => console.error('Error fetching telegram configs:', error));
  };

  const fetchLogs = () => {
    fetch('/api/logs', {
      headers: authService.getAuthHeaders()
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          if (Array.isArray(data.logs)) {
            setLogs(data.logs);
          }
          setBasalReminder(data.basalReminder || null);
        }
      })
      .catch(error => console.error('Error fetching logs:', error));
  };

  // Fetch Caregiver / Family Share Status
  const fetchShareStatus = async () => {
    if (!authService.getToken()) return;
    try {
      const res = await authService.getShareStatus();
      if (res && res.success) {
        setShareStatus({
          shareCode: res.shareCode || '',
          members: res.members || [],
          sharedGroups: res.sharedGroups || []
        });
        const currentCtx = authService.getActiveContext();
        const currentOwner = authService.getActiveOwnerId();
        if (currentCtx === 'shared' && currentOwner) {
          const match = (res.sharedGroups || []).some(g => g.ownerId === currentOwner);
          if (!match && res.sharedGroups && res.sharedGroups.length > 0) {
            authService.setActiveContext('shared', res.sharedGroups[0].ownerId);
            setActiveContext('shared');
            setActiveOwnerId(res.sharedGroups[0].ownerId);
          } else if (!match) {
            authService.setActiveContext('personal');
            setActiveContext('personal');
            setActiveOwnerId(null);
          }
        }
      }
    } catch {
      // ignore network errors
    }
  };

  // Verify session with server on mount if token exists
  useEffect(() => {
    const token = authService.getToken();
    if (token) {
      authService.fetchMe().then(currUser => {
        if (currUser) {
          setUser(currUser);
          setIsLoggedIn(true);
          if (currUser.basalTime) {
            setBasalTime(currUser.basalTime);
            setBasalTimeInput(currUser.basalTime);
            try {
              localStorage.setItem('insuminder_basal_time', currUser.basalTime);
            } catch {
              // ignore
            }
          }
          if (currUser.language && ['en', 'he', 'ru'].includes(currUser.language)) {
            setLanguage(currUser.language);
          }
          if (currUser.theme && ['dark', 'light'].includes(currUser.theme)) {
            setTheme(currUser.theme);
          }
          fetchShareStatus();
        } else {
          setUser(null);
          setIsLoggedIn(false);
          setLogs([]);
          setTelegramConfigs([]);
        }
      });
    }
  }, [setLanguage, setTheme]);

  // Fetch configs and logs on mount
  useEffect(() => {
    fetchTelegramConfigs();
    fetchLogs();
  }, []);

  const handleAuthSuccess = (authUser, joinedGroup = null) => {
    setUser(authUser);
    setIsLoggedIn(true);
    setIsAuthModalOpen(false);
    setUrlShareCode(null);

    if (authUser && authUser.basalTime) {
      setBasalTime(authUser.basalTime);
      setBasalTimeInput(authUser.basalTime);
      try {
        localStorage.setItem('insuminder_basal_time', authUser.basalTime);
      } catch {
        // ignore
      }
    }

    if (authUser && authUser.language && ['en', 'he', 'ru'].includes(authUser.language)) {
      setLanguage(authUser.language);
    }

    if (authUser && authUser.theme && ['dark', 'light'].includes(authUser.theme)) {
      setTheme(authUser.theme);
    }

    // Security: Clear referral / share code from URL so it cannot be reused
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('shareCode');
      url.searchParams.delete('invite');
      window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash);
    }

    if (joinedGroup && joinedGroup.ownerId) {
      authService.setActiveContext('shared', joinedGroup.ownerId);
      setActiveContext('shared');
      setActiveOwnerId(joinedGroup.ownerId);
      setNotification({
        type: 'success',
        message: t('notifications.connectedToShared', { name: joinedGroup.ownerName || joinedGroup.ownerEmail })
      });
    } else {
      setNotification({
        type: 'success',
        message: t('notifications.signedInAs', { email: authUser.email })
      });
    }

    fetchTelegramConfigs();
    fetchLogs();
    fetchShareStatus();
  };

  const handleSignOut = async () => {
    await authService.logout();
    setUser(null);
    setIsLoggedIn(false);
    setActiveContext('personal');
    setActiveOwnerId(null);
    setShareStatus({ shareCode: '', members: [], sharedGroups: [] });
    setLogs([]);
    setBasalReminder(null);
    setTelegramConfigs([]);
    setIsNavOpen(false);
    setNotification({
      type: 'success',
      message: t('notifications.signedOut')
    });
  };

  const handleSwitchContext = (newCtx, ownerId = null) => {
    authService.setActiveContext(newCtx, ownerId);
    setActiveContext(newCtx);
    setActiveOwnerId(ownerId);
    fetchLogs();
    fetchTelegramConfigs();
    setNotification({
      type: 'success',
      message: newCtx === 'shared'
        ? t('notifications.switchedToShared')
        : t('notifications.switchedToPersonal')
    });
  };

  const handleCopyShareCode = () => {
    if (!shareStatus.shareCode) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareStatus.shareCode);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyInviteLink = () => {
    if (!shareStatus.shareCode) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/?shareCode=${shareStatus.shareCode}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendInviteEmail = async (e) => {
    e.preventDefault();
    if (!shareInviteEmail.trim()) return;
    setIsSendingInvite(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const inviteUrl = `${origin}/?shareCode=${shareStatus.shareCode}`;
      const res = await authService.inviteMember(shareInviteEmail.trim(), inviteUrl);
      if (res.success) {
        setNotification({
          type: 'success',
          message: res.message || t('notifications.invitationSent', { email: shareInviteEmail.trim() })
        });
        setShareInviteEmail('');
        fetchShareStatus();
      } else {
        setNotification({
          type: 'error',
          message: res.error || t('notifications.failedToSendInvite')
        });
      }
    } catch {
      setNotification({ type: 'error', message: t('notifications.networkErrorInvite') });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleJoinSharedGroup = async (e) => {
    e.preventDefault();
    if (!shareJoinCode.trim()) return;
    setIsJoiningShare(true);
    try {
      const res = await authService.joinShare(shareJoinCode.trim());
      if (res.success) {
        setNotification({
          type: 'success',
          message: res.message || t('notifications.connectedToSharedAccount')
        });
        setShareJoinCode('');
        if (res.owner && res.owner.ownerId) {
          handleSwitchContext('shared', res.owner.ownerId);
        }
        fetchShareStatus();
      } else {
        setNotification({
          type: 'error',
          message: res.error || t('notifications.failedToConnectShareCode')
        });
      }
    } catch {
      setNotification({ type: 'error', message: t('notifications.networkErrorJoining') });
    } finally {
      setIsJoiningShare(false);
    }
  };

  const handleOpenRemoveMemberModal = (member) => {
    setRemoveMemberModalData(member);
  };

  const handleCloseRemoveMemberModal = () => {
    setRemoveMemberModalData(null);
  };

  const handleConfirmRemoveMember = async () => {
    if (!removeMemberModalData) return;
    const member = removeMemberModalData;
    try {
      const res = await authService.removeMember(member.id);
      if (res.success) {
        setNotification({ type: 'success', message: t('notifications.memberRemoved', { name: member.name || member.email }) });
        setRemoveMemberModalData(null);
        fetchShareStatus();
      } else {
        setNotification({ type: 'error', message: res.error || t('notifications.failedToRemoveMember') });
      }
    } catch {
      setNotification({ type: 'error', message: t('notifications.networkErrorRemoving') });
    }
  };

  const handleOpenLeaveGroupModal = (group) => {
    setLeaveGroupModalData(group);
  };

  const handleCloseLeaveGroupModal = () => {
    setLeaveGroupModalData(null);
  };

  const handleConfirmLeaveGroup = async () => {
    if (!leaveGroupModalData) return;
    const group = leaveGroupModalData;
    try {
      const res = await authService.leaveShareGroup(group.ownerId);
      if (res.success) {
        setNotification({ type: 'success', message: t('notifications.leftSharedGroup') });
        if (activeContext === 'shared' && activeOwnerId === group.ownerId) {
          handleSwitchContext('personal');
        }
        setLeaveGroupModalData(null);
        fetchShareStatus();
      } else {
        setNotification({ type: 'error', message: res.error || t('notifications.failedToLeaveGroup') });
      }
    } catch {
      setNotification({ type: 'error', message: t('notifications.networkErrorLeaving') });
    }
  };

  // Keyboard navigation: Close modals or nav drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isAuthModalOpen) {
          setIsAuthModalOpen(false);
        } else if (isEarlyBolusModalOpen) {
          setIsEarlyBolusModalOpen(false);
        } else if (reminderModalData) {
          setReminderModalData(null);
        } else if (deleteModalConfig) {
          setDeleteModalConfig(null);
        } else if (removeMemberModalData) {
          setRemoveMemberModalData(null);
        } else if (leaveGroupModalData) {
          setLeaveGroupModalData(null);
        } else if (viewingExplanationModal) {
          setViewingExplanationModal(null);
        } else if (isNavOpen) {
          setIsNavOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen, deleteModalConfig, reminderModalData, isAuthModalOpen, isEarlyBolusModalOpen, removeMemberModalData, leaveGroupModalData, viewingExplanationModal]);

  // Auto-dismiss notification after 4.5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleLogInjection = (type = 'bolus') => {
    if (!isLoggedIn) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    const now = new Date();
    const currentMinute = now.toISOString().slice(0, 16);

    // Immediate client-side check to prevent multiple logs in the same minute
    if (logs.length > 0 && logs[0].injected_at && logs[0].injected_at.slice(0, 16) === currentMinute) {
      setNotification({
        type: 'warning',
        message: t('notifications.rateLimitOnePerMinute')
      });
      return;
    }

    const cleanType = type === 'basal' ? 'basal' : 'bolus';

    fetch('/api/injections', {
      method: 'POST',
      headers: {
        ...authService.getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: cleanType })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const injectedTime = formatTimeOnly(now.toISOString());
        const successMsg = cleanType === 'basal'
          ? t('notifications.basalLoggedSuccess', { time: injectedTime })
          : t('notifications.injectionLoggedSuccess', { time: injectedTime });
        setNotification({
          type: 'success',
          message: successMsg
        });
        const newLog = {
          id: data.id || Date.now(),
          user_id: user?.id,
          injected_at: now.toISOString(),
          type: cleanType,
          notify_10m_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
          notify_2h_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          notify_3h_at: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
          status_10m_sent: cleanType === 'basal' ? 1 : 0,
          status_2h_sent: cleanType === 'basal' ? 1 : 0,
          status_3h_sent: cleanType === 'basal' ? 1 : 0
        };
        setLogs(prev => [newLog, ...prev.filter(l => l.id !== newLog.id)]);
        fetchLogs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || t('notifications.rateLimitOnePerMinute')
        });
      }
    })
    .catch(error => {
      console.error('Error logging injection:', error);
      setNotification({
        type: 'warning',
        message: t('notifications.failedToLogInjection')
      });
    });
  };

  const handleClearNotificationQueue = async () => {
    if (isClearingQueue) return;
    setIsClearingQueue(true);
    try {
      const res = await fetch('/api/dev/clear-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: t('notifications.queueCleared')
        });
        fetchLogs();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Failed to clear notification queue.'
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'Network error while attempting to clear notification queue.'
      });
    } finally {
      setIsClearingQueue(false);
    }
  };

  const handleSelectLanguage = (langCode) => {
    setLanguage(langCode);
    if (isLoggedIn) {
      authService.updateLanguage(langCode).catch((err) => {
        console.error('Failed to sync language to profile:', err);
      });
    }
  };

  const handleSaveTelegramSettings = async (e) => {
    e.preventDefault();
    const cleanToken = telegramBotToken.trim();
    const rawChatId = telegramChatId.trim().replace(/^-+/, '');
    const cleanChatId = rawChatId ? `-${rawChatId}` : '';
    const cleanLabel = telegramLabel.trim();

    if (!cleanToken || !cleanChatId) {
      setNotification({
        type: 'warning',
        message: t('notifications.provideBotTokenAndChatId')
      });
      return;
    }

    setIsSavingSettings(true);
    try {
      const response = await fetch('/api/telegram-configs', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          name: cleanLabel,
          botToken: cleanToken,
          chatId: cleanChatId
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: t('notifications.telegramSavedAndDefault')
        });
        setTelegramLabel('');
        setTelegramBotToken('');
        setTelegramChatId('');
        localStorage.removeItem('insuminder_telegram_bot_token');
        localStorage.removeItem('insuminder_telegram_chat_id');
        fetchTelegramConfigs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || t('notifications.failedToSaveConfig')
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: t('notifications.failedToReachServerSave')
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSetDefaultConfig = async (configId) => {
    try {
      const response = await fetch(`/api/telegram-configs/${configId}/default`, {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: t('notifications.defaultConfigUpdated')
        });
        fetchTelegramConfigs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || t('notifications.failedToUpdateDefault')
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: t('notifications.failedToReachServerDefault')
      });
    }
  };

  const handleOpenDeleteModal = (config) => {
    setDeleteModalConfig(config);
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalConfig(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalConfig) return;
    try {
      const response = await fetch(`/api/telegram-configs/${deleteModalConfig.id}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: t('notifications.configDeleted', { name: deleteModalConfig.name })
        });
        setDeleteModalConfig(null);
        fetchTelegramConfigs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || t('notifications.failedToDeleteConfig')
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: t('notifications.failedToReachServerDelete')
      });
    }
  };

  const handleTestTelegramNotification = async (overrideToken, overrideChatId) => {
    const cleanToken = (overrideToken !== undefined ? overrideToken : telegramBotToken).trim();
    const rawChatId = (overrideChatId !== undefined ? overrideChatId : telegramChatId).trim().replace(/^-+/, '');
    const cleanChatId = rawChatId ? `-${rawChatId}` : '';

    if (!cleanToken || !cleanChatId) {
      setNotification({
        type: 'warning',
        message: t('notifications.enterBothBeforeTest')
      });
      return;
    }

    setIsTestingTelegram(true);
    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          telegramBotToken: cleanToken,
          telegramChatId: cleanChatId,
          language
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: t('notifications.testSentCheckTelegram')
        });
      } else {
        setNotification({
          type: 'warning',
          message: t('notifications.telegramTestFailed', { error: data.error || 'Could not send message' })
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: t('notifications.failedToReachServerTest')
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handlePrevWeek = () => {
    setSelectedWeekStart(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7, 12, 0, 0);
      return getStartOfWeek(next);
    });
  };

  const handleNextWeek = () => {
    setSelectedWeekStart(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7, 12, 0, 0);
      return getStartOfWeek(next);
    });
  };

  const handleSelectWeek = (targetStart) => {
    setSelectedWeekStart(targetStart);
  };

  const handlePrevMonth = () => {
    const info = getWeekDisplayInfo(selectedWeekStart, language);
    let targetYear = info.anchorYear;
    let targetMonth = info.anchorMonth - 1;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear--;
    }
    const prevWeeks = getWeeksBelongingToMonth(targetYear, targetMonth);
    const targetIdx = Math.min(info.activeWeekIndex, prevWeeks.length - 1);
    setSelectedWeekStart(prevWeeks[targetIdx]);
  };

  const handleNextMonth = () => {
    const info = getWeekDisplayInfo(selectedWeekStart, language);
    let targetYear = info.anchorYear;
    let targetMonth = info.anchorMonth + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }
    const nextWeeks = getWeeksBelongingToMonth(targetYear, targetMonth);
    const targetIdx = Math.min(info.activeWeekIndex, nextWeeks.length - 1);
    setSelectedWeekStart(nextWeeks[targetIdx]);
  };

  const handleResetToCurrentWeek = () => {
    setSelectedWeekStart(getStartOfWeek(new Date()));
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null || touchStartY === null || !e.changedTouches || !e.changedTouches[0]) {
      return;
    }
    const diffX = touchStartX - e.changedTouches[0].clientX;
    const diffY = touchStartY - e.changedTouches[0].clientY;

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        handleNextWeek();
      } else {
        handlePrevWeek();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const todayDateKey = formatDateOnly(new Date().toISOString());
  const todayLogs = logs.filter(log => formatDateOnly(log.injected_at) === todayDateKey);
  const weekInfo = getWeekDisplayInfo(selectedWeekStart, language);
  const weeklyData = getWeeklyTrendData(logs, selectedWeekStart, language);
  const rapidInjections = getRapidInjections(logs, todayDateKey);

  const [basalHour, basalMin] = (basalTime || '20:00').split(':').map(n => parseInt(n, 10));
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const isAfterBasalTime = (currentHour > basalHour) || (currentHour === basalHour && currentMinute >= basalMin);
  const hasLoggedBasalToday = todayLogs.some(log => log.type === 'basal');
  const showSplitButton = isLoggedIn && isAfterBasalTime && !hasLoggedBasalToday;

  const getPageTitle = () => {
    switch (activeTab) {
      case 'logs':
        return t('nav.logs');
      case 'profile':
        return t('nav.profile');
      case 'notifications':
        return t('nav.notifications');
      case 'settings':
        return t('nav.settings');
      case 'home':
      default:
        return t('nav.brand');
    }
  };

  return (
    <div className="App">
      {/* Generic Top Header: 1. Hamburger (Left), 2. Title (Center), 3. Back Button (Right, subpages only) */}
      <header className="app-header">
        <div className="header-left">
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setIsNavOpen(true)}
            aria-label={t('nav.openMenu')}
            aria-expanded={isNavOpen}
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>

        <div className="header-center">
          <h1 className="header-title">{getPageTitle()}</h1>
        </div>

        <div className="header-right">
          {activeTab !== 'home' ? (
            <button
              type="button"
              className="back-btn"
              onClick={() => setActiveTab('home')}
              aria-label={t('nav.backToHome')}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="back-arrow-svg"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          ) : isLocalEnv ? (
            <button
              type="button"
              className="dev-clear-queue-btn"
              onClick={handleClearNotificationQueue}
              disabled={isClearingQueue}
              title={t('nav.clearQueue')}
              aria-label={t('nav.clearQueue')}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </button>
          ) : (
            <div className="header-spacer" />
          )}
        </div>
      </header>

      {/* Title Divider Line */}
      <hr className="title-divider" />

      {/* Navigation Drawer Backdrop */}
      <div
        className={`nav-backdrop ${isNavOpen ? 'open' : ''}`}
        onClick={() => setIsNavOpen(false)}
        aria-hidden={!isNavOpen}
      />

      {/* Navigation Drawer */}
      <aside
        className={`nav-drawer ${isNavOpen ? 'open' : ''}`}
        role="navigation"
        aria-label={t('nav.brand')}
        aria-hidden={!isNavOpen}
      >
        <div className="nav-header">
          <h2 className="nav-brand">{t('nav.brand')}</h2>
          <button
            type="button"
            className="close-btn"
            onClick={() => setIsNavOpen(false)}
            aria-label={t('nav.closeMenu')}
          >
            &times;
          </button>
        </div>

        <nav className="nav-menu">
          <button
            type="button"
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('home');
              setIsNavOpen(false);
            }}
          >
            <span className="nav-icon" role="img" aria-label="home">🏠</span>
            <span className="nav-label">{t('nav.home')}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('logs');
              setIsNavOpen(false);
            }}
          >
            <span className="nav-icon" role="img" aria-label="logs">📋</span>
            <span className="nav-label">{t('nav.logs')}</span>
            {todayLogs.length > 0 && <span className="badge">{todayLogs.length}</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('profile');
              setIsNavOpen(false);
            }}
          >
            <span className="nav-icon" role="img" aria-label="profile">👤</span>
            <span className="nav-label">{t('nav.profile')}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('notifications');
              setIsNavOpen(false);
            }}
          >
            <span className="nav-icon" role="img" aria-label="notifications">🔔</span>
            <span className="nav-label">{t('nav.notifications')}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('settings');
              setIsNavOpen(false);
            }}
          >
            <span className="nav-icon" role="img" aria-label="settings">⚙️</span>
            <span className="nav-label">{t('nav.settings')}</span>
          </button>
        </nav>

        {/* Bottom of sidebar: Log In / Sign Out button */}
        <div className="nav-footer">
          {/* Theme Selector: Dark / Light Mode */}
          <div className="nav-theme-toggle-row">
            <div className="nav-theme-toggle-pill" role="radiogroup" aria-label={t('nav.themeToggleLabel')}>
              <button
                type="button"
                className={`nav-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
                role="radio"
                aria-checked={theme === 'dark'}
                title={t('nav.darkTheme')}
              >
                <span className="nav-theme-icon" aria-hidden="true">🌙</span>
                <span className="nav-theme-text">{t('nav.darkTheme')}</span>
              </button>
              <button
                type="button"
                className={`nav-theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
                role="radio"
                aria-checked={theme === 'light'}
                title={t('nav.lightTheme')}
              >
                <span className="nav-theme-icon" aria-hidden="true">☀️</span>
                <span className="nav-theme-text">{t('nav.lightTheme')}</span>
              </button>
            </div>
          </div>

          {isLoggedIn && user ? (
            <div
              className="nav-user-badge"
              onClick={() => {
                setActiveTab('profile');
                setIsNavOpen(false);
              }}
              role="button"
              tabIndex={0}
              title={t('nav.viewProfile')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setActiveTab('profile');
                  setIsNavOpen(false);
                }
              }}
            >
              <div className="nav-user-avatar">
                {(([user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email || 'U')[0]).toUpperCase()}
              </div>
              <div className="nav-user-details">
                <span className="nav-user-name">
                  {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email.split('@')[0]}
                </span>
                <span className="nav-user-email" title={user.email}>{user.email}</span>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="nav-auth-btn"
            onClick={() => {
              if (isLoggedIn) {
                handleSignOut();
              } else {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
                setIsNavOpen(false);
              }
            }}
          >
            <span className="nav-icon" role="img" aria-label="auth">
              {isLoggedIn ? '🚪' : '🔐'}
            </span>
            <span className="nav-label">
              {isLoggedIn ? t('nav.signOut') : t('nav.logIn')}
            </span>
          </button>
        </div>
      </aside>

      {/* Common Notification Banner */}
      {notification && (
        <div
          className={`alert-banner alert-${
            typeof notification === 'object' ? notification.type : 'info'
          }`}
          role="alert"
        >
          <span className="alert-icon">
            {typeof notification === 'object' && notification.type === 'success'
              ? '✅'
              : typeof notification === 'object' && notification.type === 'error'
              ? '❌'
              : '⚠️'}
          </span>
          <span className="alert-text">
            {typeof notification === 'object' ? notification.message : notification}
          </span>
          <button
            type="button"
            className="alert-close-btn"
            onClick={() => setNotification(null)}
            aria-label={t('common.dismiss')}
          >
            &times;
          </button>
        </div>
      )}

      {/* VIEW 1: HOME */}
      {activeTab === 'home' && (
        <section className="tab-view home-view">
          <div className="home-container">
            {/* Real-time Digital Clock */}
            <LiveClock />

            {/* Modern Auth Hero Banner when logged out */}
            {!isLoggedIn && (
              <div className="auth-hero-banner auth-required-banner">
                <div className="auth-hero-glow" />
                <div className="auth-hero-content">
                  <div className="auth-hero-icon-container">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="auth-hero-lock-icon"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div className="auth-hero-text">
                    <div className="auth-hero-title">{t('home.heroTitle')}</div>
                    <p className="auth-hero-subtitle">
                      {t('home.heroSubtitle')}
                    </p>
                  </div>
                </div>
                <div className="auth-hero-actions">
                  <button
                    type="button"
                    className="auth-hero-btn signin-btn"
                    onClick={() => {
                      setAuthModalMode('login');
                      setIsAuthModalOpen(true);
                    }}
                  >
                    {t('home.signIn')}
                  </button>
                  <button
                    type="button"
                    className="auth-hero-btn signup-btn"
                    onClick={() => {
                      setAuthModalMode('register');
                      setIsAuthModalOpen(true);
                    }}
                  >
                    {t('home.signUp')}
                  </button>
                </div>
              </div>
            )}

            {/* Telegram Configuration Notice Banner (Only when logged in) */}
            {isLoggedIn && !isTelegramConfigured && (
              <div
                className="telegram-alert-card"
                onClick={() => setActiveTab('settings')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('settings');
                  }
                }}
              >
                <span className="telegram-alert-icon">⚠️</span>
                <div className="telegram-alert-content">
                  <span className="telegram-alert-text">{t('home.telegramAlertText')}</span>
                  <span className="telegram-alert-action">{t('home.telegramAlertAction')}</span>
                </div>
              </div>
            )}

            {/* Context Switcher: Personal vs Shared Caregiver Data */}
            {isLoggedIn && (shareStatus.sharedGroups.length > 0 || activeContext === 'shared') && (
              <div className="context-switcher-container">
                <div className="context-switcher-pill" role="radiogroup" aria-label="Data Context">
                  <button
                    type="button"
                    className={`context-switch-btn ${activeContext === 'personal' ? 'active' : ''}`}
                    onClick={() => handleSwitchContext('personal')}
                    aria-checked={activeContext === 'personal'}
                    role="radio"
                  >
                    <span className="context-icon">👤</span>
                    <span>{t('home.myData')}</span>
                  </button>
                  <button
                    type="button"
                    className={`context-switch-btn ${activeContext === 'shared' ? 'active' : ''}`}
                    onClick={() => {
                      const targetOwner = shareStatus.sharedGroups[0];
                      if (targetOwner) {
                        handleSwitchContext('shared', targetOwner.ownerId);
                      }
                    }}
                    aria-checked={activeContext === 'shared'}
                    role="radio"
                  >
                    <span className="context-icon">👥</span>
                    <span>
                      {t('home.sharedData')}
                      {shareStatus.sharedGroups[0] ? ` (${shareStatus.sharedGroups[0].ownerName || shareStatus.sharedGroups[0].ownerEmail})` : ''}
                    </span>
                  </button>
                </div>
                {activeContext === 'shared' && (
                  <div className="shared-context-notice">
                    <span className="shared-context-dot" />
                    <span>
                      {t('home.viewingSharedFor')}{' '}
                      <strong>
                        {shareStatus.sharedGroups.find(g => g.ownerId === activeOwnerId)?.ownerName ||
                         shareStatus.sharedGroups.find(g => g.ownerId === activeOwnerId)?.ownerEmail ||
                         shareStatus.sharedGroups[0]?.ownerName ||
                         shareStatus.sharedGroups[0]?.ownerEmail ||
                         t('home.caregiverAccount')}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Big Action Button: Log Injection (Split into Bolus & Basal if after basal time and not logged today) */}
            {showSplitButton ? (
              <div className="log-injection-split-group">
                <button
                  type="button"
                  className={`log-injection-btn split-btn btn-bolus ${isLoggedIn && !isBolusEligible ? 'btn-gray' : ''}`}
                  disabled={!isLoggedIn}
                  onClick={handleBolusClick}
                  title={t('home.logBolusSubtitle')}
                >
                  <span className="log-injection-plus">+</span>
                  <span className="log-injection-title">{t('home.logBolus')}</span>
                  <span className="log-injection-subtitle">{t('home.logBolusSubtitle')}</span>
                </button>
                <button
                  type="button"
                  className="log-injection-btn split-btn btn-basal"
                  disabled={!isLoggedIn}
                  onClick={() => handleLogInjection('basal')}
                  title={t('home.logBasalSubtitle')}
                >
                  <span className="log-injection-plus">+</span>
                  <span className="log-injection-title">{t('home.logBasal')}</span>
                  <span className="log-injection-subtitle">{t('home.logBasalSubtitle')}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`log-injection-btn ${isLoggedIn && !isBolusEligible ? 'btn-gray' : ''}`}
                disabled={!isLoggedIn}
                onClick={handleBolusClick}
                title={!isLoggedIn ? t('home.logInjectionSubtitleLoggedOut') : t('home.logInjectionSubtitleLoggedIn')}
              >
                <span className="log-injection-plus">+</span>
                <span className="log-injection-title">{t('home.logInjection')}</span>
                <span className="log-injection-subtitle">
                  {!isLoggedIn
                    ? t('home.logInjectionSubtitleLoggedOut')
                    : t('home.logInjectionSubtitleLoggedIn')}
                </span>
              </button>
            )}

            {/* Show personal injection data, notifications and eligibility ONLY when logged in */}
            {isLoggedIn && (
              <>
                {/* Dashboard Tiles Grid: Daily Injections & Last Injection */}
                <div className="stats-grid">
              {/* Tile 1: Daily Injections */}
              <div
                className="stat-card"
                onClick={() => setActiveTab('logs')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('logs');
                  }
                }}
                title={t('home.viewDailyLogs')}
              >
                <div className="stat-card-header">
                  <span className="stat-icon-wrapper stat-pulse-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </span>
                </div>
                <div className="stat-label">{t('home.dailyInjections')}</div>
                <div className="stat-value">{todayLogs.length}</div>
              </div>

              {/* Tile 2: Last Injection */}
              <div
                className="stat-card"
                onClick={() => setActiveTab('logs')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('logs');
                  }
                }}
                title={t('home.viewInjectionDetails')}
              >
                <div className="stat-card-header">
                  <span className="stat-icon-wrapper stat-clock-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                </div>
                <div className="stat-label">{t('home.lastInjection')}</div>
                {latestLog ? (
                  <div className="stat-datetime-group">
                    <div className="stat-datetime"><span dir="ltr">{formatDateTime(latestLog.injected_at)}</span></div>
                    <div className="stat-relative">{formatRelativeTime(latestLog.injected_at, language)}</div>
                  </div>
                ) : (
                  <div className="stat-datetime-group">
                    <div className="stat-datetime empty">{t('common.none')}</div>
                    <div className="stat-relative">{t('home.noInjectionsYet')}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications Scheduled Section */}
            <div className="notifications-section">
              <h2 className="section-title">{t('home.notificationsScheduled')}</h2>

              <div className="reminder-cards-list">
                {/* 10-Minute Meal Reminder */}
                <div className="reminder-card">
                  <div className="reminder-icon-wrapper meal-icon-wrapper">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                      <path d="M7 2v20" />
                      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                    </svg>
                  </div>
                  <div className="reminder-details">
                    <div className="reminder-title-row">
                      <span className="reminder-title">{t('home.rem10mTitle')}</span>
                      {latestBolusLog && (
                        <button
                          type="button"
                          className={`reminder-badge reminder-badge-btn ${latest10m.badgeClass}`}
                          onClick={() => handleOpenReminderModal(latestBolusLog, '10m')}
                          title={latest10m.title}
                          aria-label={`${t('home.rem10mTitle')}: ${latest10m.label}.`}
                        >
                          {latest10m.label}
                        </button>
                      )}
                    </div>
                    {latestBolusLog ? (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp" dir="ltr">{formatDateTime(latest10m.targetTime)}</span>
                        <span className="reminder-relative">({formatRelativeTime(latest10m.targetTime, language)})</span>
                      </div>
                    ) : (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp empty">—</span>
                        <span className="reminder-relative">({t('home.noInjectionsLoggedYet')})</span>
                      </div>
                    )}
                    <p className="reminder-description">
                      {t('home.rem10mDesc')}
                    </p>
                  </div>
                </div>

                {/* 2-Hour Reminder */}
                <div className="reminder-card">
                  <div className="reminder-icon-wrapper">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div className="reminder-details">
                    <div className="reminder-title-row">
                      <span className="reminder-title">{t('home.rem2hTitle')}</span>
                      {latestBolusLog && (
                        <button
                          type="button"
                          className={`reminder-badge reminder-badge-btn ${latest2h.badgeClass}`}
                          onClick={() => handleOpenReminderModal(latestBolusLog, '2h')}
                          title={latest2h.title}
                          aria-label={`${t('home.rem2hTitle')}: ${latest2h.label}.`}
                        >
                          {latest2h.label}
                        </button>
                      )}
                    </div>
                    {latestBolusLog ? (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp" dir="ltr">{formatDateTime(latestBolusLog.notify_2h_at)}</span>
                        <span className="reminder-relative">({formatRelativeTime(latestBolusLog.notify_2h_at, language)})</span>
                      </div>
                    ) : (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp empty">—</span>
                        <span className="reminder-relative">({t('home.noInjectionsLoggedYet')})</span>
                      </div>
                    )}
                    <p className="reminder-description">
                      {t('home.rem2hDesc')}
                    </p>
                  </div>
                </div>

                {/* 3-Hour Reminder */}
                <div className="reminder-card">
                  <div className="reminder-icon-wrapper">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div className="reminder-details">
                    <div className="reminder-title-row">
                      <span className="reminder-title">{t('home.rem3hTitle')}</span>
                      {latestBolusLog && (
                        <button
                          type="button"
                          className={`reminder-badge reminder-badge-btn ${latest3h.badgeClass}`}
                          onClick={() => handleOpenReminderModal(latestBolusLog, '3h')}
                          title={latest3h.title}
                          aria-label={`${t('home.rem3hTitle')}: ${latest3h.label}.`}
                        >
                          {latest3h.label}
                        </button>
                      )}
                    </div>
                    {latestBolusLog ? (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp" dir="ltr">{formatDateTime(latestBolusLog.notify_3h_at)}</span>
                        <span className="reminder-relative">({formatRelativeTime(latestBolusLog.notify_3h_at, language)})</span>
                      </div>
                    ) : (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp empty">—</span>
                        <span className="reminder-relative">({t('home.noInjectionsLoggedYet')})</span>
                      </div>
                    )}
                    <p className="reminder-description">
                      {t('home.rem3hDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Injection Eligibility Status (Below Notifications Scheduled) */}
            <InjectionEligibility latestLog={latestBolusLog} />
          </>
        )}
      </div>
    </section>
  )}

  {/* VIEW 2: INJECTION LOGS & TRENDS (Dedicated Page) */}
  {activeTab === 'logs' && (
    <section className="tab-view logs-view">
      <div className="page-content-wrapper">
        {!isLoggedIn ? (
          <div className="empty-logs-container auth-locked-card">
            <div className="auth-locked-icon-wrapper">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="auth-locked-title">{t('logs.accountRequired')}</h3>
            <p className="no-logs">{t('logs.accountRequiredDesc')}</p>
            <button
              type="button"
              className="primary-btn auth-locked-btn"
              onClick={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
            >
              {t('home.signIn')}
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-logs-container">
            <p className="no-logs">{t('logs.noLogsYet')}</p>
            <button
              type="button"
              className="primary-btn"
              onClick={() => setActiveTab('home')}
            >
              {t('logs.goToHomeToLog')}
            </button>
          </div>
        ) : (
              <>
                {/* 1. Latest Injection Tile (Matching Reference Card) */}
                {latestLog && (
                  <div className="latest-log-card">
                    <div
                      className="latest-log-header"
                      onClick={() => setIsLatestExpanded(!isLatestExpanded)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setIsLatestExpanded(!isLatestExpanded);
                        }
                      }}
                      aria-expanded={isLatestExpanded}
                    >
                      <div className="latest-log-icon-wrapper" title={t('logs.latestInjection')}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m18 2 4 4" />
                          <path d="m17 7 3-3" />
                          <path d="M19 9 8.7 19.3c-.4.4-1 .6-1.6.6H3v-4.1c0-.6.2-1.2.6-1.6L14 3.9" />
                          <path d="m9 14 5 5" />
                          <path d="m5 18-3 3" />
                        </svg>
                      </div>

                      <div className="latest-log-meta">
                        <div className="latest-log-timestamp"><span dir="ltr">{formatDateTime(latestLog.injected_at)}</span></div>
                        <div className="latest-log-relative">{formatRelativeTime(latestLog.injected_at, language)}</div>
                      </div>

                      <div className={`latest-chevron ${isLatestExpanded ? 'open' : ''}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>

                    {/* Reminder Status Badges */}
                    <div className="latest-reminders-list">
                      <button
                        type="button"
                        className={`latest-reminder-pill latest-reminder-pill-btn ${latest10m.pillClass}`}
                        onClick={() => handleOpenReminderModal(latestLog, '10m')}
                        title={latest10m.title}
                        aria-label={`${t('home.rem10mTitle')}: ${latest10m.pillLabel}.`}
                      >
                        <span className="pill-icon">{latest10m.icon}</span>
                        <span className="pill-text">{t('logs.mealReminderPill')} {latest10m.pillLabel}</span>
                      </button>

                      <button
                        type="button"
                        className={`latest-reminder-pill latest-reminder-pill-btn ${latest2h.pillClass}`}
                        onClick={() => handleOpenReminderModal(latestLog, '2h')}
                        title={latest2h.title}
                        aria-label={`${t('home.rem2hTitle')}: ${latest2h.pillLabel}.`}
                      >
                        <span className="pill-icon">{latest2h.icon}</span>
                        <span className="pill-text">{t('logs.reminder2hPill')} {latest2h.pillLabel}</span>
                      </button>

                      <button
                        type="button"
                        className={`latest-reminder-pill latest-reminder-pill-btn ${latest3h.pillClass}`}
                        onClick={() => handleOpenReminderModal(latestLog, '3h')}
                        title={latest3h.title}
                        aria-label={`${t('home.rem3hTitle')}: ${latest3h.pillLabel}.`}
                      >
                        <span className="pill-icon">{latest3h.icon}</span>
                        <span className="pill-text">{t('logs.reminder3hPill')} {latest3h.pillLabel}</span>
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isLatestExpanded && (
                      <div className="latest-expanded-panel">
                        <div className="expanded-row">
                          <span className="expanded-label">{t('logs.injectedAt')}</span>
                          <span className="expanded-value" dir="ltr">{formatDateTime(latestLog.injected_at)}</span>
                        </div>
                        <div className="expanded-row">
                          <span className="expanded-label">{t('logs.mealTarget10m')}</span>
                          <span className="expanded-value" dir="ltr">{formatDateTime(latest10m.targetTime)}</span>
                        </div>
                        <div className="expanded-row">
                          <span className="expanded-label">{t('logs.targetTime2h')}</span>
                          <span className="expanded-value" dir="ltr">{formatDateTime(latestLog.notify_2h_at)}</span>
                        </div>
                        <div className="expanded-row">
                          <span className="expanded-label">{t('logs.targetTime3h')}</span>
                          <span className="expanded-value" dir="ltr">{formatDateTime(latestLog.notify_3h_at)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Weekly Trends Chart Card (Month Scoped with Weekly Navigation & Swipe) */}
                <div
                  className="trends-chart-card"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="chart-card-header">
                    <div className="chart-title-group">
                      <h3 className="chart-title">{t('logs.weeklyInjections')}</h3>
                      <span className="chart-subtitle">{t('logs.dailyCountForWeek')}</span>
                    </div>
                    <div className="chart-stats-badge">
                      <span className="chart-stat-number">{weeklyData.totalWeekInjections}</span>
                      <span className="chart-stat-label">{t('logs.weekTotal')}</span>
                    </div>
                  </div>

                  {/* Month Navigation & Week Pagination */}
                  <div className="chart-nav-bar">
                    {/* Month Row */}
                    <div className="chart-month-row">
                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-month-btn"
                        onClick={handlePrevMonth}
                        aria-label={t('logs.prevMonth')}
                        title={t('logs.prevMonth')}
                      >
                        ‹
                      </button>
                      <span className="chart-month-label">{weekInfo.monthName}</span>
                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-month-btn"
                        onClick={handleNextMonth}
                        aria-label={t('logs.nextMonth')}
                        title={t('logs.nextMonth')}
                      >
                        ›
                      </button>
                    </div>

                    {/* Week Row */}
                    <div className="chart-week-row">
                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-week-btn"
                        onClick={handlePrevWeek}
                        aria-label={t('logs.prevWeek')}
                        title={t('logs.prevWeek')}
                      >
                        {isRTL ? '→' : '←'}
                      </button>

                      <div className="chart-week-info">
                        <span className="chart-week-title">{t('logs.week')} {weekInfo.weekNumber}</span>
                        <span className="chart-week-dates" dir="ltr">({weeklyData.weekRangeStr})</span>
                      </div>

                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-week-btn"
                        onClick={handleNextWeek}
                        aria-label={t('logs.nextWeek')}
                        title={t('logs.nextWeek')}
                      >
                        {isRTL ? '←' : '→'}
                      </button>
                    </div>

                    {/* Week Pills for Current Month */}
                    <div className="chart-week-pills" role="tablist" aria-label="Weeks of the month">
                      {weekInfo.monthWeeks.map((wDate, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`week-pill-btn ${idx === weekInfo.activeWeekIndex ? 'active' : ''}`}
                          onClick={() => handleSelectWeek(wDate)}
                          role="tab"
                          aria-selected={idx === weekInfo.activeWeekIndex}
                          title={`${t('logs.week')} ${idx + 1}`}
                        >
                          {t('logs.weekPill', { num: idx + 1 })}
                        </button>
                      ))}
                    </div>

                    {/* Jump back to Current Week if browsing other weeks */}
                    {!weeklyData.isCurrentWeek && (
                      <div className="chart-today-reset-row">
                        <button
                          type="button"
                          className="chart-reset-today-btn"
                          onClick={handleResetToCurrentWeek}
                          title={t('logs.jumpToCurrentWeek')}
                        >
                          {t('logs.jumpToCurrentWeek')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="chart-metrics-row">
                    <div className="metric-chip">
                      <span className="metric-chip-label">{t('logs.activeDays')}</span>
                      <span className="metric-chip-value">{weeklyData.activeDaysCount} {t('logs.of7')}</span>
                    </div>
                    <div className="metric-chip metric-chip-bolus">
                      <span className="metric-chip-label">{t('logs.bolusThisWeek')}</span>
                      <span className="metric-chip-value">{weeklyData.totalBolusInjections || 0}</span>
                    </div>
                    <div className="metric-chip metric-chip-basal">
                      <span className="metric-chip-label">{t('logs.basalThisWeek')}</span>
                      <span className="metric-chip-value">{weeklyData.totalBasalInjections || 0}</span>
                    </div>
                  </div>

                  {/* 7-Day Bar Chart */}
                  <div className="bars-container">
                    {weeklyData.days.map((day, idx) => {
                      const heightPercent = weeklyData.maxCount > 0
                        ? Math.round((day.count / weeklyData.maxCount) * 100)
                        : 0;
                      const basalPercent = day.count > 0 ? (day.basalCount / day.count) * 100 : 0;
                      const bolusPercent = day.count > 0 ? (day.bolusCount / day.count) * 100 : 0;

                      return (
                        <div
                          key={idx}
                          className={`bar-col ${day.isToday ? 'is-today' : ''} ${day.isOtherMonth ? 'is-other-month' : ''}`}
                        >
                          <div className="bar-count-label">{day.count > 0 ? day.count : ''}</div>
                          <div className="bar-track">
                            {day.count > 0 ? (
                              <div
                                className="bar-stack bar-fill has-data"
                                style={{ height: `${Math.max(6, heightPercent)}%` }}
                                title={`${day.dateStr}: ${day.count} (${day.bolusCount} ${t('logs.typeBolus')}, ${day.basalCount} ${t('logs.typeBasal')})`}
                              >
                                {day.basalCount > 0 && (
                                  <div
                                    className="bar-segment bar-segment-basal"
                                    style={{ height: `${basalPercent}%` }}
                                  />
                                )}
                                {day.bolusCount > 0 && (
                                  <div
                                    className="bar-segment bar-segment-bolus"
                                    style={{ height: `${bolusPercent}%` }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div
                                className="bar-fill empty-data"
                                style={{ height: '6%' }}
                                title={`${day.dateStr}: 0`}
                              />
                            )}
                          </div>
                          <div
                            className="bar-day-name"
                            title={day.fullDayName ? `${day.fullDayName}, ${day.shortDate}` : day.dayName}
                          >
                            {day.dayName}
                          </div>
                          <div className="bar-short-date">{day.shortDate}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Rapid Injection Trend Warning (< 3h) */}
                <div className="rapid-trend-card">
                  <div className="rapid-card-header">
                    <div className={`rapid-icon-wrapper ${rapidInjections.rapidList.length > 0 ? 'warning' : 'safe'}`}>
                      {rapidInjections.rapidList.length > 0 ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="rapid-header-text">
                      <h3 className="rapid-title">{t('logs.rapidTrendTitle')}</h3>
                      <span className="rapid-subtitle">{t('logs.rapidTrendSubtitle')}</span>
                    </div>
                  </div>

                  {rapidInjections.rapidList.length > 0 ? (
                    <div className="rapid-content">
                      <p className="rapid-guidance">
                        ⚠️ <strong>{rapidInjections.rapidList.length} {rapidInjections.rapidList.length === 1 ? t('logs.rapidDoseSingle') : t('logs.rapidDosesPlural')}</strong> {t('logs.rapidWarningText')}
                      </p>
                      <div className="rapid-incidents-list">
                        {rapidInjections.rapidList.map((item, idx) => (
                          <div key={idx} className="rapid-incident-item">
                            <div className="incident-time-row">
                              <span className="incident-time" dir="ltr">{formatDateTime(item.currentInjectedAt)}</span>
                              <span className="incident-interval-badge">+{item.intervalStr} {t('logs.afterPriorDose')}</span>
                            </div>
                            <div className="incident-prior-info">
                              {t('logs.priorInjectionWasAt')} <strong dir="ltr">{formatTimeOnly(item.previousInjectedAt)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rapid-clear-content">
                      <span className="rapid-clear-text">
                        {t('logs.rapidClearText')}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Today's Injection Logs (Daily View) */}
                <div className="daily-logs-section">
                  <div className="daily-logs-header">
                    <div className="daily-logs-title-group">
                      <h3 className="daily-logs-title">{t('logs.todaysInjections')}</h3>
                      <span className="daily-logs-subtitle">{todayDateKey}</span>
                    </div>
                    <span className="daily-count-badge">
                      {todayLogs.length} {todayLogs.length === 1 ? t('logs.injectionSingle') : t('logs.injectionsPlural')}
                    </span>
                  </div>

                  {todayLogs.length === 0 && hasLoggedBasalToday ? (
                    <div className="daily-empty-card">
                      <span className="daily-empty-text">{t('logs.noInjectionsToday')}</span>
                    </div>
                  ) : (
                    <ul className="logs-list">
                      {todayLogs.map(log => {
                        const isRapid = rapidInjections.rapidIds.has(log.id);

                        return (
                          <li key={log.id} className={`log-item ${log.type === 'basal' ? 'basal-log-item' : ''} ${isRapid ? 'rapid-log-item' : ''}`}>
                            <div className="log-field">
                              <span className="log-label">{t('logs.injectedLabel')}</span>
                              <div className="log-value-group">
                                <span className="log-value" dir="ltr">{formatTimeOnly(log.injected_at)}</span>
                                <span className={`log-type-badge ${log.type === 'basal' ? 'badge-basal' : 'badge-bolus'}`}>
                                  {log.type === 'basal' ? t('logs.typeBasal') : t('logs.typeBolus')}
                                </span>
                                {isRapid && (
                                  <span className="log-rapid-pill" title="Logged under 3h after prior dose">
                                    {t('logs.rapidPillBadge')}
                                  </span>
                                )}
                              </div>
                            </div>
                            {log.type === 'basal' ? (
                              (() => {
                                const basalStatus = getBasalReminderStatus(basalReminder, basalTime, isTelegramConfigured, language, true, notificationPreferences, activeContext);
                                return (
                                  <div className="log-field">
                                    <span className="log-label">{t('logs.basalReminderLabel')}</span>
                                    <div className="log-value-row">
                                      <span className="log-value" dir="ltr">{basalTime || '20:00'}</span>
                                      <button
                                        type="button"
                                        className={`log-status-pill log-status-pill-btn ${basalStatus.pillClass}`}
                                        onClick={() => handleOpenReminderModal(basalReminder || {}, 'basal')}
                                        title={basalStatus.title}
                                        aria-label={`${t('modals.basalReminderTitle')}: ${basalStatus.label}.`}
                                      >
                                        {basalStatus.icon} {basalStatus.label}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              (() => {
                                const logRem10m = getReminderStatus(log, '10m', isTelegramConfigured, language, notificationPreferences, activeContext);
                                const logRem2h = getReminderStatus(log, '2h', isTelegramConfigured, language, notificationPreferences, activeContext);
                                const logRem3h = getReminderStatus(log, '3h', isTelegramConfigured, language, notificationPreferences, activeContext);
                                return (
                                  <>
                                    <div className="log-field">
                                      <span className="log-label">{t('logs.mealLabel10m')}</span>
                                      <div className="log-value-row">
                                        <span className="log-value" dir="ltr">{formatTimeOnly(logRem10m.targetTime)}</span>
                                        <button
                                          type="button"
                                          className={`log-status-pill log-status-pill-btn ${logRem10m.pillClass}`}
                                          onClick={() => handleOpenReminderModal(log, '10m')}
                                          title={logRem10m.title}
                                          aria-label={`${t('home.rem10mTitle')}: ${logRem10m.label}.`}
                                        >
                                          {logRem10m.icon} {logRem10m.label}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="log-field">
                                      <span className="log-label">{t('logs.reminderLabel2h')}</span>
                                      <div className="log-value-row">
                                        <span className="log-value" dir="ltr">{formatTimeOnly(log.notify_2h_at)}</span>
                                        <button
                                          type="button"
                                          className={`log-status-pill log-status-pill-btn ${logRem2h.pillClass}`}
                                          onClick={() => handleOpenReminderModal(log, '2h')}
                                          title={logRem2h.title}
                                          aria-label={`${t('home.rem2hTitle')}: ${logRem2h.label}.`}
                                        >
                                          {logRem2h.icon} {logRem2h.label}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="log-field">
                                      <span className="log-label">{t('logs.reminderLabel3h')}</span>
                                      <div className="log-value-row">
                                        <span className="log-value" dir="ltr">{formatTimeOnly(log.notify_3h_at)}</span>
                                        <button
                                          type="button"
                                          className={`log-status-pill log-status-pill-btn ${logRem3h.pillClass}`}
                                          onClick={() => handleOpenReminderModal(log, '3h')}
                                          title={logRem3h.title}
                                          aria-label={`${t('home.rem3hTitle')}: ${logRem3h.label}.`}
                                        >
                                          {logRem3h.icon} {logRem3h.label}
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()
                            )}
                          </li>
                        );
                      })}
                      {!hasLoggedBasalToday && (
                        <li className="log-item basal-log-item pending-basal-log-item">
                          <div className="log-field">
                            <span className="log-label">{t('logs.injectedLabel')}</span>
                            <div className="log-value-group">
                              <span className="log-value log-value-muted">{t('logs.notInjectedYet')}</span>
                              <span className="log-type-badge badge-basal">
                                {t('logs.typeBasal')}
                              </span>
                            </div>
                          </div>
                          {(() => {
                            const basalStatus = getBasalReminderStatus(basalReminder, basalTime, isTelegramConfigured, language, false, notificationPreferences, activeContext);
                            return (
                              <div className="log-field">
                                <span className="log-label">{t('logs.basalReminderLabel')}</span>
                                <div className="log-value-row">
                                  <span className="log-value" dir="ltr">{basalTime || '20:00'}</span>
                                  <button
                                    type="button"
                                    className={`log-status-pill log-status-pill-btn ${basalStatus.pillClass}`}
                                    onClick={() => handleOpenReminderModal(basalReminder || {}, 'basal')}
                                    title={basalStatus.title}
                                    aria-label={`${t('modals.basalReminderTitle')}: ${basalStatus.label}.`}
                                  >
                                    {basalStatus.icon} {basalStatus.label}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* VIEW 2.5: PROFILE */}
      {activeTab === 'profile' && (
        <Profile
          user={user}
          onUpdateUser={(updatedUser) => {
            setUser(updatedUser);
            if (updatedUser?.basalTime) {
              setBasalTime(updatedUser.basalTime);
              setBasalTimeInput(updatedUser.basalTime);
              try {
                localStorage.setItem('insuminder_basal_time', updatedUser.basalTime);
              } catch {
                // ignore
              }
            }
          }}
          isLoggedIn={isLoggedIn}
          onOpenLogin={() => {
            setAuthModalMode('login');
            setIsAuthModalOpen(true);
          }}
        />
      )}

      {/* VIEW 3: NOTIFICATION SETTINGS */}
      {activeTab === 'notifications' && (
        <NotificationSettings
          preferences={notificationPreferences}
          onUpdatePreferences={handleUpdateNotificationPreferences}
        />
      )}

      {/* VIEW 4: SETTINGS (Language & Telegram) */}
      {activeTab === 'settings' && (
        <section className="tab-view settings-view">
          <div className="settings-container">
            {/* 1. Language Card */}
            <div className="settings-card">
              <div className="card-header">
                <div className="card-icon-wrapper globe-icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <h2 className="card-title">{t('settings.language')}</h2>
              </div>

              <div className="language-options">
                <button
                  type="button"
                  className={`language-btn ${language === 'en' ? 'active' : ''}`}
                  onClick={() => handleSelectLanguage('en')}
                >
                  <span className="language-name">English</span>
                  {language === 'en' && (
                    <span className="check-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={`language-btn ${language === 'he' ? 'active' : ''}`}
                  onClick={() => handleSelectLanguage('he')}
                >
                  <span className="language-name">עברית</span>
                  {language === 'he' && (
                    <span className="check-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={`language-btn ${language === 'ru' ? 'active' : ''}`}
                  onClick={() => handleSelectLanguage('ru')}
                >
                  <span className="language-name">Русский</span>
                  {language === 'ru' && (
                    <span className="check-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Basal Insulin Schedule Card */}
            <div className="settings-card basal-settings-card">
              <div className="card-header">
                <div className="card-icon-wrapper moon-icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                </div>
                <div className="card-header-text">
                  <h2 className="card-title">{t('settings.basalTime')}</h2>
                  <p className="card-subtitle">{t('settings.basalTimeDesc')}</p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveBasalTime(basalTimeInput);
                }}
                className="basal-time-form"
              >
                <div className="basal-time-setting-row">
                  <TimePicker24h
                    value={basalTimeInput}
                    onChange={(val) => setBasalTimeInput(val)}
                  />
                  <button
                    type="submit"
                    className="save-btn basal-save-btn"
                  >
                    {t('settings.save')}
                  </button>
                </div>
              </form>
            </div>

            {/* 3. Telegram Notifications Card */}
            <div className="settings-card">
              <div className="card-header">
                <div className="card-icon-wrapper telegram-icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
                <div className="card-header-text">
                  <h2 className="card-title">{t('settings.telegramTitle')}</h2>
                  <p className="card-subtitle">{t('settings.telegramSubtitle')}</p>
                </div>
              </div>

              {!isLoggedIn ? (
                <div className="auth-locked-settings-notice">
                  <p className="auth-locked-text">
                    {t('settings.telegramAuthNotice')}
                  </p>
                  <button
                    type="button"
                    className="primary-btn auth-locked-btn"
                    onClick={() => {
                      setAuthModalMode('login');
                      setIsAuthModalOpen(true);
                    }}
                  >
                    {t('home.signIn')}
                  </button>
                </div>
              ) : (
                <>
                  {/* 1. Add Configuration Form */}
                  <form onSubmit={handleSaveTelegramSettings} className="settings-form">
                <div className="form-group">
                  <label htmlFor="config-label" className="form-label">
                    {t('settings.configName')} <span className="label-optional">({t('common.optional')})</span>
                  </label>
                  <input
                    id="config-label"
                    type="text"
                    className="form-input"
                    placeholder={t('settings.configNamePlaceholder')}
                    value={telegramLabel}
                    onChange={(e) => setTelegramLabel(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bot-token" className="form-label">{t('settings.botToken')}</label>
                  <input
                    id="bot-token"
                    type="text"
                    className="form-input"
                    placeholder={t('settings.botTokenPlaceholder')}
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="chat-id" className="form-label">{t('settings.chatId')}</label>
                  <div className="input-prefix-group">
                    <span className="input-prefix" aria-hidden="true">-</span>
                    <input
                      id="chat-id"
                      type="text"
                      className="form-input with-prefix"
                      placeholder={t('settings.chatIdPlaceholder')}
                      value={telegramChatId.replace(/^-+/, '')}
                      onChange={(e) => setTelegramChatId(e.target.value.replace(/^-+/, ''))}
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>

                <p className="settings-note">
                  {t('settings.telegramNote')}
                </p>

                <div className="form-actions">
                  <button type="submit" className="save-btn" disabled={isSavingSettings || !telegramBotToken.trim() || !telegramChatId.trim()}>
                    <span className="btn-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                    </span>
                    {isSavingSettings ? t('common.saving') : t('settings.saveAndSetDefault')}
                  </button>

                  <button
                    type="button"
                    className="test-btn"
                    onClick={() => handleTestTelegramNotification()}
                    disabled={isTestingTelegram || !telegramBotToken.trim() || !telegramChatId.trim()}
                  >
                    <span className="btn-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </span>
                    {isTestingTelegram ? t('settings.sendingTest') : t('settings.sendTestNotification')}
                  </button>
                </div>
              </form>

              {/* 2. Saved Configurations List with Default Radio Button & Delete */}
              <div className="configs-section">
                <div className="configs-header">
                  <h3 className="configs-title">{t('settings.savedConfigs')}</h3>
                  <span className="configs-count-badge">
                    {telegramConfigs.length} {telegramConfigs.length === 1 ? t('settings.destinationSingle') : t('settings.destinationsPlural')}
                  </span>
                </div>

                {telegramConfigs.length === 0 ? (
                  <div className="configs-empty-card">
                    <span className="configs-empty-text">{t('settings.noConfigsYet')}</span>
                  </div>
                ) : (
                  <ul className="configs-list">
                    {telegramConfigs.map((cfg) => {
                      const hasCustom = isCustomConfigName(cfg.name, cfg.chatId);
                      return (
                        <li key={cfg.id} className={`config-item ${cfg.isDefault ? 'is-default' : ''}`}>
                          <label className="config-radio-label">
                            <input
                              type="radio"
                              name="default-telegram-config"
                              checked={cfg.isDefault}
                              onChange={() => handleSetDefaultConfig(cfg.id)}
                              className="config-radio"
                            />
                            <div className="config-info">
                              {hasCustom ? (
                                <>
                                  <div className="config-title-row">
                                    <span className="config-name">{cfg.name}</span>
                                    {cfg.isDefault && (
                                      <span className="default-pill">{t('settings.defaultPill')}</span>
                                    )}
                                  </div>
                                  <div className="config-details">
                                    <span className="config-detail-item">
                                      <span className="config-chat-group">
                                        <strong>{t('settings.chatPrefix')}</strong> <bdi dir="ltr">{cfg.chatId}</bdi>
                                      </span>
                                    </span>
                                    <span className="config-detail-item">
                                      <strong>{t('settings.tokenPrefix')}</strong> <bdi dir="ltr">{maskBotToken(cfg.botToken)}</bdi>
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="config-title-row">
                                    <span className="config-chat-group config-chat-title">
                                      <strong className="config-chat-prefix">{t('settings.chatPrefix')}</strong>
                                      <span className="config-chat-id-text"><bdi dir="ltr">{cfg.chatId}</bdi></span>
                                    </span>
                                    {cfg.isDefault && (
                                      <span className="default-pill">{t('settings.defaultPill')}</span>
                                    )}
                                  </div>
                                  <div className="config-details">
                                    <span className="config-detail-item">
                                      <strong>{t('settings.tokenPrefix')}</strong> <bdi dir="ltr">{maskBotToken(cfg.botToken)}</bdi>
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </label>

                          <div className="config-item-actions">
                            <button
                              type="button"
                              className="config-row-test-btn"
                              title="Test this configuration"
                              onClick={() => handleTestTelegramNotification(cfg.botToken, cfg.chatId)}
                              disabled={isTestingTelegram}
                            >
                              {t('settings.testBtn')}
                            </button>
                            <button
                              type="button"
                              className="config-row-delete-btn"
                              title={hasCustom ? t('settings.deleteConfigName', { name: cfg.name }) : t('settings.deleteConfigForChat', { chatId: cfg.chatId })}
                              onClick={() => handleOpenDeleteModal(cfg)}
                              aria-label={hasCustom ? t('settings.deleteConfigName', { name: cfg.name }) : t('settings.deleteConfigForChat', { chatId: cfg.chatId })}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* 3. Caregiver & Family Shared Access Card */}
        <div className="settings-card shared-access-card">
          <div className="card-header">
            <div className="card-icon-wrapper share-icon-wrapper">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="card-header-text">
              <h2 className="card-title">{t('settings.sharedAccessTitle')}</h2>
              <p className="card-subtitle">
                {t('settings.sharedAccessSubtitle')}
              </p>
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="auth-locked-settings-notice">
              <p className="auth-locked-text">
                {t('settings.sharedAccessAuthNotice')}
              </p>
              <button
                type="button"
                className="primary-btn auth-locked-btn"
                onClick={() => {
                  setAuthModalMode('login');
                  setIsAuthModalOpen(true);
                }}
              >
                {t('home.signIn')}
              </button>
            </div>
          ) : (
            <div className="shared-access-content">
              {/* A. Personal Share Code Card */}
              <div className="share-code-box">
                <div className="share-code-header">
                  <span className="share-code-title">{t('settings.yourShareCode')}</span>
                  <span className="share-role-badge">{t('settings.groupAdmin')}</span>
                </div>
                <div className="share-code-display-row">
                  <code className="share-code-value">{shareStatus.shareCode || 'Generating...'}</code>
                  <div className="share-btn-group">
                    <button
                      type="button"
                      className="copy-code-btn"
                      onClick={handleCopyShareCode}
                      title={t('settings.copyCode')}
                    >
                      {copiedCode ? t('settings.copiedCode') : t('settings.copyCode')}
                    </button>
                    <button
                      type="button"
                      className="copy-link-btn"
                      onClick={handleCopyInviteLink}
                      title={t('settings.copyLink')}
                    >
                      {copiedLink ? t('settings.copiedLink') : t('settings.copyLink')}
                    </button>
                  </div>
                </div>
                <p className="share-code-hint">
                  {t('settings.shareCodeHint')}
                </p>
              </div>

              {/* B. Invite Caregiver by Email */}
              <form onSubmit={handleSendInviteEmail} className="share-invite-form">
                <h3 className="share-sub-title">{t('settings.inviteCaregiverTitle')}</h3>
                <div className="share-input-row">
                  <input
                    type="email"
                    className="form-input share-email-input"
                    placeholder={t('settings.caregiverEmailPlaceholder')}
                    value={shareInviteEmail}
                    onChange={(e) => setShareInviteEmail(e.target.value)}
                    disabled={isSendingInvite}
                    required
                  />
                  <button
                    type="submit"
                    className="save-btn share-invite-btn"
                    disabled={isSendingInvite || !shareInviteEmail.trim()}
                  >
                    {isSendingInvite ? t('settings.sendingInvite') : t('settings.sendInvitation')}
                  </button>
                </div>
              </form>

              {/* C. Connected Members List (I am Admin) */}
              <div className="shared-members-section">
                <div className="share-section-header">
                  <h3 className="share-sub-title">{t('settings.connectedMembers')}</h3>
                  <span className="configs-count-badge">
                    {shareStatus.members.length} {shareStatus.members.length === 1 ? t('settings.memberSingle') : t('settings.membersPlural')}
                  </span>
                </div>

                {shareStatus.members.length === 0 ? (
                  <div className="configs-empty-card">
                    <span className="configs-empty-text">{t('settings.noMembersYet')}</span>
                  </div>
                ) : (
                  <ul className="shared-members-list">
                    {shareStatus.members.map((member) => (
                      <li key={member.id} className="shared-member-item">
                        <div className="member-avatar">
                          {(member.name || member.email || 'M')[0].toUpperCase()}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{member.name || member.email.split('@')[0]}</span>
                          <span className="member-email">{member.email}</span>
                        </div>
                        <button
                          type="button"
                          className="config-row-delete-btn member-remove-btn"
                          onClick={() => handleOpenRemoveMemberModal(member)}
                          title={t('settings.removeMemberAction', { name: member.name || member.email })}
                          aria-label={t('settings.removeMemberAction', { name: member.name || member.email })}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* D. Join Account via Share Code */}
              <form onSubmit={handleJoinSharedGroup} className="share-join-form">
                <h3 className="share-sub-title">{t('settings.connectToAnotherTitle')}</h3>
                <p className="settings-note">
                  {t('settings.connectToAnotherNote')}
                </p>
                <div className="share-input-row">
                  <input
                    type="text"
                    className="form-input share-join-input"
                    placeholder={t('settings.shareCodePlaceholder')}
                    value={shareJoinCode}
                    onChange={(e) => setShareJoinCode(e.target.value.toUpperCase())}
                    disabled={isJoiningShare}
                    required
                  />
                  <button
                    type="submit"
                    className="save-btn share-join-btn"
                    disabled={isJoiningShare || !shareJoinCode.trim()}
                  >
                    {isJoiningShare ? t('settings.connecting') : t('settings.connectAccount')}
                  </button>
                </div>
              </form>

              {/* E. Accounts Shared With Me */}
              {shareStatus.sharedGroups.length > 0 && (
                <div className="shared-groups-section">
                  <h3 className="share-sub-title">{t('settings.accountsSharedWithYou')}</h3>
                  <ul className="shared-members-list">
                    {shareStatus.sharedGroups.map((group) => {
                      const isCurrentlyActive = activeContext === 'shared' && activeOwnerId === group.ownerId;
                      const displayName = group.ownerName || group.ownerEmail.split('@')[0];
                      const displayEmail = group.ownerEmail;
                      const onCardClick = () => {
                        if (isCurrentlyActive) {
                          setViewingExplanationModal(group);
                        } else {
                          handleSwitchContext('shared', group.ownerId);
                        }
                      };

                      return (
                        <li key={group.ownerId} className={`shared-member-item shared-group-card ${isCurrentlyActive ? 'is-active-group' : ''}`}>
                          <div
                            className="shared-group-header"
                            onClick={onCardClick}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onCardClick();
                              }
                            }}
                            title={
                              isCurrentlyActive
                                ? t('settings.viewingActive')
                                : `${t('settings.switchToView')}: ${displayName} (${displayEmail})`
                            }
                          >
                            <div className="member-avatar group-avatar">
                              {(group.ownerName || group.ownerEmail || 'O')[0].toUpperCase()}
                            </div>
                            <div className="member-info">
                              <span className="member-name" title={displayName}>{displayName}</span>
                              <span className="member-email" title={displayEmail}>{displayEmail}</span>
                            </div>
                          </div>
                          <div className="group-actions">
                            <button
                              type="button"
                              className={`group-view-btn ${isCurrentlyActive ? 'active' : ''}`}
                              onClick={onCardClick}
                              title={
                                isCurrentlyActive
                                  ? 'Currently active: click to learn what Viewing means'
                                  : `Switch to view ${group.ownerName || group.ownerEmail}'s records`
                              }
                            >
                              {isCurrentlyActive ? t('settings.viewingActive') : t('settings.switchToView')}
                            </button>
                            <button
                              type="button"
                              className="group-leave-btn"
                              onClick={() => handleOpenLeaveGroupModal(group)}
                              title={t('settings.leaveGroup')}
                            >
                              {t('settings.leaveGroup')}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* F. Note regarding future multiple shared data */}
              <div className="share-future-note">
                <span className="future-note-icon">💡</span>
                <span className="future-note-text">
                  {t('settings.futureNote')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
        </section>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalConfig && (
        <div className="modal-overlay" onClick={handleCloseDeleteModal} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal-card delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-wrapper delete-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <h3 id="delete-modal-title" className="modal-title">{t('modals.deleteConfigTitle')}</h3>
            </div>
            <div className="modal-body">
              <p className="delete-modal-text">
                {isCustomConfigName(deleteModalConfig.name, deleteModalConfig.chatId) ? (
                  <>{t('modals.deleteConfigConfirmText', { name: deleteModalConfig.name, chatId: deleteModalConfig.chatId })}</>
                ) : (
                  <>{t('modals.deleteConfigConfirmSimple', { chatId: deleteModalConfig.chatId })}</>
                )}
              </p>
              {deleteModalConfig.isDefault && (
                <p className="delete-modal-warning">
                  {t('modals.deleteConfigWarning')}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseDeleteModal}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="modal-btn confirm-delete-btn"
                onClick={handleConfirmDelete}
              >
                {t('modals.deleteConfigBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {removeMemberModalData && (
        <div
          className="modal-overlay"
          onClick={handleCloseRemoveMemberModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-member-modal-title"
        >
          <div className="modal-card delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-wrapper delete-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="18" y1="8" x2="23" y2="13" />
                  <line x1="23" y1="8" x2="18" y2="13" />
                </svg>
              </div>
              <h3 id="remove-member-modal-title" className="modal-title">{t('modals.removeMemberTitle')}</h3>
            </div>
            <div className="modal-body">
              <p className="delete-modal-text">
                {t('modals.removeMemberConfirm', { name: removeMemberModalData.name || removeMemberModalData.email })}
              </p>
              <p className="delete-modal-warning">
                {t('modals.removeMemberWarning')}
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseRemoveMemberModal}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="modal-btn confirm-delete-btn"
                onClick={handleConfirmRemoveMember}
              >
                {t('modals.removeMemberBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Shared Account Confirmation Modal */}
      {leaveGroupModalData && (
        <div
          className="modal-overlay"
          onClick={handleCloseLeaveGroupModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-group-modal-title"
        >
          <div className="modal-card delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-wrapper delete-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <h3 id="leave-group-modal-title" className="modal-title">{t('modals.leaveGroupTitle')}</h3>
            </div>
            <div className="modal-body">
              <p className="delete-modal-text">
                {t('modals.leaveGroupConfirm', { name: leaveGroupModalData.ownerName || leaveGroupModalData.ownerEmail })}
              </p>
              <p className="delete-modal-warning">
                {t('modals.leaveGroupWarning')}
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseLeaveGroupModal}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="modal-btn confirm-delete-btn"
                onClick={handleConfirmLeaveGroup}
              >
                {t('modals.leaveGroupBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Explanation Modal */}
      {viewingExplanationModal && (
        <div
          className="modal-overlay"
          onClick={() => setViewingExplanationModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="viewing-explanation-modal-title"
        >
          <div className="modal-card info-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-wrapper info-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3 id="viewing-explanation-modal-title" className="modal-title">{t('modals.whatViewingMeansTitle')}</h3>
            </div>
            <div className="modal-body">
              <p className="modal-explanation-intro">
                {t('modals.viewingIntro', { name: viewingExplanationModal.ownerName || viewingExplanationModal.ownerEmail })}
              </p>
              <div className="modal-explanation-box">
                <div className="modal-explanation-item">
                  <span className="explanation-bullet">💉</span>
                  <div>
                    <strong>{t('modals.viewingHistoryTitle')}</strong> {t('modals.viewingHistoryDesc')}
                  </div>
                </div>
                <div className="modal-explanation-item">
                  <span className="explanation-bullet">⏰</span>
                  <div>
                    <strong>{t('modals.viewingRemindersTitle')}</strong> {t('modals.viewingRemindersDesc')}
                  </div>
                </div>
                <div className="modal-explanation-item">
                  <span className="explanation-bullet">🔄</span>
                  <div>
                    <strong>{t('modals.viewingSwitchTitle')}</strong> {t('modals.viewingSwitchDesc')}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={() => {
                  handleSwitchContext('personal');
                  setViewingExplanationModal(null);
                }}
              >
                {t('modals.switchToMyData')}
              </button>
              <button
                type="button"
                className="primary-btn modal-btn"
                onClick={() => setViewingExplanationModal(null)}
              >
                {t('common.gotIt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Status Details Modal */}
      {reminderModalData && (
        <div
          className="modal-overlay"
          onClick={handleCloseReminderModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reminder-modal-title"
        >
          <div className="modal-card reminder-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header reminder-modal-header">
              <div className="reminder-modal-header-left">
                <div className={`modal-icon-wrapper reminder-status-icon-wrapper ${reminderModalData.status}`}>
                  {reminderModalData.icon || 'ℹ️'}
                </div>
                <h3 id="reminder-modal-title" className="modal-title">
                  {reminderModalData.title}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-x-btn"
                onClick={handleCloseReminderModal}
                aria-label={t('common.closeModal')}
              >
                ×
              </button>
            </div>

            <div className="modal-body reminder-modal-body">
              <div className="reminder-modal-row">
                <span className="reminder-modal-label">{t('modals.reminderStatusTitle')}:</span>
                <span className={`reminder-modal-badge ${reminderModalData.badgeClass}`}>
                  {reminderModalData.label}
                </span>
              </div>

              <div className="reminder-modal-row">
                <span className="reminder-modal-label">
                  {reminderModalData.status === 'sent' ? t('modals.sentDateLabel') : t('modals.targetTimeLabel')}
                </span>
                <span className="reminder-modal-value" dir="ltr">
                  {reminderModalData.formattedTime || '—'}
                </span>
              </div>

              <div className="reminder-modal-message-box">
                {reminderModalData.status === 'sent' ? (
                  <p className="reminder-modal-success-text">
                    {t('modals.sentSuccessText')}
                  </p>
                ) : reminderModalData.status === 'disabled' ? (
                  <p className="reminder-modal-disabled-text">
                    {reminderModalData.friendlyError?.message || t('status.disabledInSettingsDesc')}
                  </p>
                ) : reminderModalData.status === 'failed' ? (
                  <div className="reminder-modal-error-content">
                    <p className="reminder-modal-error-category">
                      {reminderModalData.friendlyError?.category || 'Delivery Issue'}
                    </p>
                    <p className="reminder-modal-error-text">
                      {reminderModalData.friendlyError?.message || t('errors.deliveryFailedMsg')}
                    </p>
                    {reminderModalData.rawError &&
                     reminderModalData.rawError !== reminderModalData.friendlyError?.message &&
                     !/not configured|already injected|disabled in/i.test(reminderModalData.rawError) && (
                      <p className="reminder-modal-error-raw">
                        {t('modals.reminderDetailsLabel')} {reminderModalData.rawError}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="reminder-modal-upcoming-text">
                    {t('modals.scheduledForText', { time: reminderModalData.formattedTime })}
                  </p>
                )}
              </div>
            </div>

            <div className="modal-actions">
              {reminderModalData.status === 'disabled' && (
                <button
                  type="button"
                  className="modal-btn confirm-btn reminder-modal-settings-btn"
                  onClick={() => {
                    handleCloseReminderModal();
                    setActiveTab('notifications');
                  }}
                >
                  🔔 {t('notificationSettings.goToSettings')}
                </button>
              )}
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseReminderModal}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Early Injection Confirmation Modal */}
      {isEarlyBolusModalOpen && (
        <div
          className="modal-overlay"
          onClick={handleCloseEarlyModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="early-injection-modal-title"
        >
          <div className="modal-card early-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header early-modal-header">
              <div className="early-modal-header-left">
                <div className="modal-icon-wrapper early-icon-wrapper">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 id="early-injection-modal-title" className="modal-title">
                  {t('modals.earlyInjectionTitle')}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-x-btn"
                onClick={handleCloseEarlyModal}
                aria-label={t('common.closeModal')}
              >
                ×
              </button>
            </div>

            <div className="modal-body early-modal-body">
              <p className="early-modal-text">
                {t('modals.earlyInjectionConfirmText')}
              </p>
              <p className="early-modal-warning">
                {t('modals.earlyInjectionWarning')}
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseEarlyModal}
              >
                {t('common.no')}
              </button>
              <button
                type="button"
                className="modal-btn confirm-early-btn"
                onClick={handleConfirmEarlyInjection}
              >
                {t('common.yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal (Sign In / Sign Up / 6-Digit Code / Google) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        shareCode={urlShareCode}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Application Footer */}
      <footer className="app-footer">
        <p className="footer-copyright">
          &copy; {new Date().getFullYear()} Dovgans
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
