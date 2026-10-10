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
  getReminderStatus
} from './utils';
import AuthModal from './AuthModal';
import Profile from './Profile';
import { authService } from './authService';

function LiveClock() {
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
      title="Current Local Time"
      aria-label={`Current time ${time.hours}:${time.minutes}:${time.seconds}.${time.hundredths}`}
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
          <div className="eligibility-title">Ready to Inject</div>
          <p className="eligibility-message">
            You can inject now. No previous injections have been recorded.
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
          <div className="eligibility-title">Ready to Inject</div>
          <p className="eligibility-message">
            You can inject now. More than 3 hours have passed since your last injection.
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
    ? `${remHours}h ${remMin}m ${remSeconds}s remaining`
    : remMin > 0
      ? `${remMin}m ${remSeconds}s remaining`
      : `${remSeconds}s remaining`;

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
          <span className="eligibility-title">Wait Before Injecting</span>
          <span className="eligibility-countdown">{countdownText}</span>
        </div>
        <p className="eligibility-message">
          You cannot inject yet. Please wait until at least 3 hours have passed since your last injection.
        </p>
        <div className="eligibility-time-note">
          Next injection available at <strong>{formatTimeOnly(latestLog.notify_3h_at)}</strong>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [logs, setLogs] = useState([]);
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
  }, [isAuthModalOpen, removeMemberModalData, leaveGroupModalData, viewingExplanationModal]);

  // Settings State
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('insuminder_language') || 'en';
  });
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

  const latestLog = logs.length > 0 ? logs[0] : null;
  const isTelegramConfigured = telegramConfigs.length > 0
    ? telegramConfigs.some(c => c.isDefault)
    : Boolean(
        localStorage.getItem('insuminder_telegram_configured') === 'true' ||
        (localStorage.getItem('insuminder_telegram_bot_token') && localStorage.getItem('insuminder_telegram_chat_id')) ||
        (telegramBotToken.trim() && telegramChatId.trim())
      );
  const latest10m = getReminderStatus(latestLog, '10m', isTelegramConfigured);
  const latest2h = getReminderStatus(latestLog, '2h', isTelegramConfigured);
  const latest3h = getReminderStatus(latestLog, '3h', isTelegramConfigured);

  const handleOpenReminderModal = (log, type) => {
    if (!log) return;
    const statusInfo = getReminderStatus(log, type, isTelegramConfigured);
    const title = type === '10m'
      ? '10-Minute Meal Reminder'
      : type === '2h'
      ? '2-Hour Reminder'
      : '3-Hour Reminder';
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
        if (data.success && Array.isArray(data.logs)) {
          setLogs(data.logs);
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
          fetchShareStatus();
        } else {
          setUser(null);
          setIsLoggedIn(false);
          setLogs([]);
          setTelegramConfigs([]);
        }
      });
    }
  }, []);

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
        message: `Connected to shared account (${joinedGroup.ownerName || joinedGroup.ownerEmail})! Switched to shared data view.`
      });
    } else {
      setNotification({
        type: 'success',
        message: `Signed in successfully as ${authUser.email}!`
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
    setTelegramConfigs([]);
    setIsNavOpen(false);
    setNotification({
      type: 'success',
      message: 'You have been signed out.'
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
        ? 'Switched to caregiver view for shared data.'
        : 'Switched to personal data view.'
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
          message: res.message || `Invitation sent to ${shareInviteEmail}!`
        });
        setShareInviteEmail('');
        fetchShareStatus();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to send invite.'
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error sending invitation.' });
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
          message: res.message || 'Connected to shared account!'
        });
        setShareJoinCode('');
        if (res.owner && res.owner.ownerId) {
          handleSwitchContext('shared', res.owner.ownerId);
        }
        fetchShareStatus();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to connect using share code.'
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error joining shared group.' });
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
        setNotification({ type: 'success', message: `Member "${member.name || member.email}" removed from shared group.` });
        setRemoveMemberModalData(null);
        fetchShareStatus();
      } else {
        setNotification({ type: 'error', message: res.error || 'Failed to remove member.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error removing member.' });
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
        setNotification({ type: 'success', message: 'You have left the shared group.' });
        if (activeContext === 'shared' && activeOwnerId === group.ownerId) {
          handleSwitchContext('personal');
        }
        setLeaveGroupModalData(null);
        fetchShareStatus();
      } else {
        setNotification({ type: 'error', message: res.error || 'Failed to leave shared group.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error leaving shared group.' });
    }
  };

  // Keyboard navigation: Close modals or nav drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isAuthModalOpen) {
          setIsAuthModalOpen(false);
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
  }, [isNavOpen, deleteModalConfig, reminderModalData, isAuthModalOpen, removeMemberModalData, leaveGroupModalData, viewingExplanationModal]);

  // Auto-dismiss notification after 4.5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleLogInjection = () => {
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
        message: 'An injection has already been recorded this minute. You can only log once per minute.'
      });
      return;
    }

    fetch('/api/injections', {
      method: 'POST',
      headers: authService.getAuthHeaders(),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const injectedTime = formatTimeOnly(now.toISOString());
        setNotification({
          type: 'success',
          message: `Insulin injection logged successfully at ${injectedTime}!`
        });
        fetchLogs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || 'An injection has already been recorded this minute. You can only log once per minute.'
        });
      }
    })
    .catch(error => {
      console.error('Error logging injection:', error);
      setNotification({
        type: 'warning',
        message: 'Failed to log injection. Please check your connection.'
      });
    });
  };

  const handleSelectLanguage = (langCode) => {
    setLanguage(langCode);
    localStorage.setItem('insuminder_language', langCode);
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
        message: 'Please provide both Bot Token and Chat ID.'
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
          message: 'Telegram configuration saved and set as default!'
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
          message: data.error || 'Failed to save configuration.'
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: 'Failed to reach server to save configuration.'
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
          message: 'Default notification destination updated!'
        });
        fetchTelegramConfigs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || 'Failed to update default configuration.'
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: 'Failed to reach server to update default configuration.'
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
          message: `Configuration "${deleteModalConfig.name}" deleted successfully.`
        });
        setDeleteModalConfig(null);
        fetchTelegramConfigs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || 'Failed to delete configuration.'
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: 'Failed to reach server to delete configuration.'
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
        message: 'Please enter both Bot Token and Chat ID before sending a test notification.'
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
          telegramChatId: cleanChatId
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: 'Test notification sent! Check your Telegram chat.'
        });
      } else {
        setNotification({
          type: 'warning',
          message: `Telegram test failed: ${data.error || 'Could not send message'}`
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: 'Failed to reach server to test Telegram notification.'
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
    const info = getWeekDisplayInfo(selectedWeekStart);
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
    const info = getWeekDisplayInfo(selectedWeekStart);
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
  const weekInfo = getWeekDisplayInfo(selectedWeekStart);
  const weeklyData = getWeeklyTrendData(logs, selectedWeekStart);
  const rapidInjections = getRapidInjections(logs, todayDateKey);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'logs':
        return 'Injection Logs';
      case 'profile':
        return 'Profile';
      case 'settings':
        return 'Settings';
      case 'home':
      default:
        return 'InsuMinder';
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
            aria-label="Open navigation menu"
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
              aria-label="Back to Home"
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
        aria-label="Main Navigation"
        aria-hidden={!isNavOpen}
      >
        <div className="nav-header">
          <h2 className="nav-brand">InsuMinder</h2>
          <button
            type="button"
            className="close-btn"
            onClick={() => setIsNavOpen(false)}
            aria-label="Close navigation menu"
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
            <span className="nav-label">Home</span>
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
            <span className="nav-label">Injection Logs</span>
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
            <span className="nav-label">Profile</span>
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
            <span className="nav-label">Settings</span>
          </button>
        </nav>

        {/* Bottom of sidebar: Log In / Sign Out button */}
        <div className="nav-footer">
          {isLoggedIn && user ? (
            <div
              className="nav-user-badge"
              onClick={() => {
                setActiveTab('profile');
                setIsNavOpen(false);
              }}
              role="button"
              tabIndex={0}
              title="View Profile"
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
              {isLoggedIn ? 'Sign Out' : 'Log In'}
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
            aria-label="Dismiss message"
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
                    <div className="auth-hero-title">Sign In or Sign Up</div>
                    <p className="auth-hero-subtitle">
                      Sign in or create an account to record your injections and manage your reminders.
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
                    Sign In
                  </button>
                  <button
                    type="button"
                    className="auth-hero-btn signup-btn"
                    onClick={() => {
                      setAuthModalMode('register');
                      setIsAuthModalOpen(true);
                    }}
                  >
                    Sign Up
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
                  <span className="telegram-alert-text">Telegram not configured.</span>
                  <span className="telegram-alert-action">Go to Settings to set it up.</span>
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
                    <span>My Data</span>
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
                      Shared Data
                      {shareStatus.sharedGroups[0] ? ` (${shareStatus.sharedGroups[0].ownerName || shareStatus.sharedGroups[0].ownerEmail})` : ''}
                    </span>
                  </button>
                </div>
                {activeContext === 'shared' && (
                  <div className="shared-context-notice">
                    <span className="shared-context-dot" />
                    <span>
                      Viewing shared records for{' '}
                      <strong>
                        {shareStatus.sharedGroups.find(g => g.ownerId === activeOwnerId)?.ownerName ||
                         shareStatus.sharedGroups.find(g => g.ownerId === activeOwnerId)?.ownerEmail ||
                         shareStatus.sharedGroups[0]?.ownerName ||
                         shareStatus.sharedGroups[0]?.ownerEmail ||
                         'Caregiver Account'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Big Action Button: Log Injection */}
            <button
              type="button"
              className="log-injection-btn"
              disabled={!isLoggedIn}
              onClick={handleLogInjection}
              title={!isLoggedIn ? 'Sign in or sign up to log injections' : 'Record the current time as your injection time'}
            >
              <span className="log-injection-plus">+</span>
              <span className="log-injection-title">Log Injection</span>
              <span className="log-injection-subtitle">
                {!isLoggedIn
                  ? 'Sign in or sign up to record injections'
                  : 'Record the current time as your injection time'}
              </span>
            </button>

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
                title="View daily logs"
              >
                <div className="stat-card-header">
                  <span className="stat-icon-wrapper stat-pulse-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </span>
                </div>
                <div className="stat-label">Daily Injections</div>
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
                title="View injection details"
              >
                <div className="stat-card-header">
                  <span className="stat-icon-wrapper stat-clock-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                </div>
                <div className="stat-label">Last Injection</div>
                {latestLog ? (
                  <div className="stat-datetime-group">
                    <div className="stat-datetime">{formatDateTime(latestLog.injected_at)}</div>
                    <div className="stat-relative">{formatRelativeTime(latestLog.injected_at)}</div>
                  </div>
                ) : (
                  <div className="stat-datetime-group">
                    <div className="stat-datetime empty">None</div>
                    <div className="stat-relative">No injections yet</div>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications Scheduled Section */}
            <div className="notifications-section">
              <h2 className="section-title">Notifications Scheduled</h2>

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
                      <span className="reminder-title">10-Minute Meal Reminder</span>
                      {latestLog && (
                        <button
                          type="button"
                          className={`reminder-badge reminder-badge-btn ${latest10m.badgeClass}`}
                          onClick={() => handleOpenReminderModal(latestLog, '10m')}
                          title={latest10m.title}
                          aria-label={`10-Minute Meal Reminder: ${latest10m.label}. Click to view details.`}
                        >
                          {latest10m.label}
                        </button>
                      )}
                    </div>
                    {latestLog ? (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp">{formatDateTime(latest10m.targetTime)}</span>
                        <span className="reminder-relative">({formatRelativeTime(latest10m.targetTime)})</span>
                      </div>
                    ) : (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp empty">—</span>
                        <span className="reminder-relative">(No injections logged yet)</span>
                      </div>
                    )}
                    <p className="reminder-description">
                      You will be reminded 10 minutes after injection that you can start your meal
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
                      <span className="reminder-title">2-Hour Reminder</span>
                      {latestLog && (
                        <button
                          type="button"
                          className={`reminder-badge reminder-badge-btn ${latest2h.badgeClass}`}
                          onClick={() => handleOpenReminderModal(latestLog, '2h')}
                          title={latest2h.title}
                          aria-label={`2-Hour Reminder: ${latest2h.label}. Click to view details.`}
                        >
                          {latest2h.label}
                        </button>
                      )}
                    </div>
                    {latestLog ? (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp">{formatDateTime(latestLog.notify_2h_at)}</span>
                        <span className="reminder-relative">({formatRelativeTime(latestLog.notify_2h_at)})</span>
                      </div>
                    ) : (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp empty">—</span>
                        <span className="reminder-relative">(No injections logged yet)</span>
                      </div>
                    )}
                    <p className="reminder-description">
                      You will be reminded 2 hours after injection
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
                      <span className="reminder-title">3-Hour Reminder</span>
                      {latestLog && (
                        <button
                          type="button"
                          className={`reminder-badge reminder-badge-btn ${latest3h.badgeClass}`}
                          onClick={() => handleOpenReminderModal(latestLog, '3h')}
                          title={latest3h.title}
                          aria-label={`3-Hour Reminder: ${latest3h.label}. Click to view details.`}
                        >
                          {latest3h.label}
                        </button>
                      )}
                    </div>
                    {latestLog ? (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp">{formatDateTime(latestLog.notify_3h_at)}</span>
                        <span className="reminder-relative">({formatRelativeTime(latestLog.notify_3h_at)})</span>
                      </div>
                    ) : (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp empty">—</span>
                        <span className="reminder-relative">(No injections logged yet)</span>
                      </div>
                    )}
                    <p className="reminder-description">
                      You will be reminded 3 hours after injection
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Injection Eligibility Status (Below Notifications Scheduled) */}
            <InjectionEligibility latestLog={latestLog} />
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
            <h3 className="auth-locked-title">Account Required</h3>
            <p className="no-logs">Please sign in or create an account to view your injection history, daily logs, and weekly trends.</p>
            <button
              type="button"
              className="primary-btn auth-locked-btn"
              onClick={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
            >
              Sign In
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-logs-container">
            <p className="no-logs">No injections logged yet.</p>
            <button
              type="button"
              className="primary-btn"
              onClick={() => setActiveTab('home')}
            >
              Go to Home to Log
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
                      <div className="latest-log-icon-wrapper" title="Latest Injection">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m18 2 4 4" />
                          <path d="m17 7 3-3" />
                          <path d="M19 9 8.7 19.3c-.4.4-1 .6-1.6.6H3v-4.1c0-.6.2-1.2.6-1.6L14 3.9" />
                          <path d="m9 14 5 5" />
                          <path d="m5 18-3 3" />
                        </svg>
                      </div>

                      <div className="latest-log-meta">
                        <div className="latest-log-timestamp">{formatDateTime(latestLog.injected_at)}</div>
                        <div className="latest-log-relative">{formatRelativeTime(latestLog.injected_at)}</div>
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
                        aria-label={`10-Minute Meal Reminder: ${latest10m.pillLabel}. Click to view details.`}
                      >
                        <span className="pill-icon">{latest10m.icon}</span>
                        <span className="pill-text">10m Meal Reminder: {latest10m.pillLabel}</span>
                      </button>

                      <button
                        type="button"
                        className={`latest-reminder-pill latest-reminder-pill-btn ${latest2h.pillClass}`}
                        onClick={() => handleOpenReminderModal(latestLog, '2h')}
                        title={latest2h.title}
                        aria-label={`2-Hour Reminder: ${latest2h.pillLabel}. Click to view details.`}
                      >
                        <span className="pill-icon">{latest2h.icon}</span>
                        <span className="pill-text">2-Hour Reminder: {latest2h.pillLabel}</span>
                      </button>

                      <button
                        type="button"
                        className={`latest-reminder-pill latest-reminder-pill-btn ${latest3h.pillClass}`}
                        onClick={() => handleOpenReminderModal(latestLog, '3h')}
                        title={latest3h.title}
                        aria-label={`3-Hour Reminder: ${latest3h.pillLabel}. Click to view details.`}
                      >
                        <span className="pill-icon">{latest3h.icon}</span>
                        <span className="pill-text">3-Hour Reminder: {latest3h.pillLabel}</span>
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isLatestExpanded && (
                      <div className="latest-expanded-panel">
                        <div className="expanded-row">
                          <span className="expanded-label">Injected At:</span>
                          <span className="expanded-value">{formatDateTime(latestLog.injected_at)}</span>
                        </div>
                        <div className="expanded-row">
                          <span className="expanded-label">10m Meal Target:</span>
                          <span className="expanded-value">{formatDateTime(latest10m.targetTime)}</span>
                        </div>
                        <div className="expanded-row">
                          <span className="expanded-label">2h Target Time:</span>
                          <span className="expanded-value">{formatDateTime(latestLog.notify_2h_at)}</span>
                        </div>
                        <div className="expanded-row">
                          <span className="expanded-label">3h Target Time:</span>
                          <span className="expanded-value">{formatDateTime(latestLog.notify_3h_at)}</span>
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
                      <h3 className="chart-title">Weekly Injections</h3>
                      <span className="chart-subtitle">Daily count for selected week</span>
                    </div>
                    <div className="chart-stats-badge">
                      <span className="chart-stat-number">{weeklyData.totalWeekInjections}</span>
                      <span className="chart-stat-label">week total</span>
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
                        aria-label="Previous Month"
                        title="Go to previous month"
                      >
                        ‹
                      </button>
                      <span className="chart-month-label">{weekInfo.monthName}</span>
                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-month-btn"
                        onClick={handleNextMonth}
                        aria-label="Next Month"
                        title="Go to next month"
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
                        aria-label="Previous Week"
                        title="Go to previous week (or swipe right)"
                      >
                        ←
                      </button>

                      <div className="chart-week-info">
                        <span className="chart-week-title">Week {weekInfo.weekNumber}</span>
                        <span className="chart-week-dates">({weeklyData.weekRangeStr})</span>
                      </div>

                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-week-btn"
                        onClick={handleNextWeek}
                        aria-label="Next Week"
                        title="Go to next week (or swipe left)"
                      >
                        →
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
                          title={`Week ${idx + 1}`}
                        >
                          W{idx + 1}
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
                          title="Jump back to current week"
                        >
                          ↺ Jump to Current Week
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="chart-metrics-row">
                    <div className="metric-chip">
                      <span className="metric-chip-label">Daily Avg:</span>
                      <span className="metric-chip-value">{weeklyData.dailyAvg} / day</span>
                    </div>
                    <div className="metric-chip">
                      <span className="metric-chip-label">Active Days:</span>
                      <span className="metric-chip-value">{weeklyData.activeDaysCount} of 7</span>
                    </div>
                  </div>

                  {/* 7-Day Bar Chart */}
                  <div className="bars-container">
                    {weeklyData.days.map((day, idx) => {
                      const heightPercent = weeklyData.maxCount > 0
                        ? Math.round((day.count / weeklyData.maxCount) * 100)
                        : 0;

                      return (
                        <div
                          key={idx}
                          className={`bar-col ${day.isToday ? 'is-today' : ''} ${day.isOtherMonth ? 'is-other-month' : ''}`}
                        >
                          <div className="bar-count-label">{day.count > 0 ? day.count : ''}</div>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${day.count > 0 ? 'has-data' : 'empty-data'}`}
                              style={{ height: `${Math.max(6, heightPercent)}%` }}
                              title={`${day.dateStr}: ${day.count} injections`}
                            />
                          </div>
                          <div className="bar-day-name">{day.dayName}</div>
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
                      <h3 className="rapid-title">Rapid Injection Trend</h3>
                      <span className="rapid-subtitle">Intervals under the recommended 3-hour spacing</span>
                    </div>
                  </div>

                  {rapidInjections.rapidList.length > 0 ? (
                    <div className="rapid-content">
                      <p className="rapid-guidance">
                        ⚠️ <strong>{rapidInjections.rapidList.length} dose{rapidInjections.rapidList.length === 1 ? '' : 's'}</strong> recorded today less than 3 hours after a prior injection. If logged by mistake, take note; if intentional correction, monitor blood glucose closely.
                      </p>
                      <div className="rapid-incidents-list">
                        {rapidInjections.rapidList.map((item, idx) => (
                          <div key={idx} className="rapid-incident-item">
                            <div className="incident-time-row">
                              <span className="incident-time">{formatDateTime(item.currentInjectedAt)}</span>
                              <span className="incident-interval-badge">+{item.intervalStr} after prior dose</span>
                            </div>
                            <div className="incident-prior-info">
                              Prior injection was at {formatTimeOnly(item.previousInjectedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rapid-clear-content">
                      <span className="rapid-clear-text">
                        All recorded injections today have maintained the recommended 3+ hour spacing. No premature doses detected.
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Today's Injection Logs (Daily View) */}
                <div className="daily-logs-section">
                  <div className="daily-logs-header">
                    <div className="daily-logs-title-group">
                      <h3 className="daily-logs-title">Today's Injections</h3>
                      <span className="daily-logs-subtitle">{todayDateKey}</span>
                    </div>
                    <span className="daily-count-badge">
                      {todayLogs.length} {todayLogs.length === 1 ? 'injection' : 'injections'}
                    </span>
                  </div>

                  {todayLogs.length === 0 ? (
                    <div className="daily-empty-card">
                      <span className="daily-empty-text">No injections recorded today yet.</span>
                    </div>
                  ) : (
                    <ul className="logs-list">
                      {todayLogs.map(log => {
                        const isRapid = rapidInjections.rapidIds.has(log.id);

                        return (
                          <li key={log.id} className={`log-item ${isRapid ? 'rapid-log-item' : ''}`}>
                            <div className="log-field">
                              <span className="log-label">Injected:</span>
                              <div className="log-value-group">
                                <span className="log-value">{formatTimeOnly(log.injected_at)}</span>
                                {isRapid && (
                                  <span className="log-rapid-pill" title="Logged under 3h after prior dose">
                                    ⚠️ &lt; 3h
                                  </span>
                                )}
                              </div>
                            </div>
                            {(() => {
                              const logRem10m = getReminderStatus(log, '10m', isTelegramConfigured);
                              const logRem2h = getReminderStatus(log, '2h', isTelegramConfigured);
                              const logRem3h = getReminderStatus(log, '3h', isTelegramConfigured);
                              return (
                                <>
                                  <div className="log-field">
                                    <span className="log-label">10m Meal:</span>
                                    <div className="log-value-row">
                                      <span className="log-value">{formatTimeOnly(logRem10m.targetTime)}</span>
                                      <button
                                        type="button"
                                        className={`log-status-pill log-status-pill-btn ${logRem10m.pillClass}`}
                                        onClick={() => handleOpenReminderModal(log, '10m')}
                                        title={logRem10m.title}
                                        aria-label={`10-Minute Meal Reminder: ${logRem10m.label}. Click to view details.`}
                                      >
                                        {logRem10m.icon} {logRem10m.label}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="log-field">
                                    <span className="log-label">2h Reminder:</span>
                                    <div className="log-value-row">
                                      <span className="log-value">{formatTimeOnly(log.notify_2h_at)}</span>
                                      <button
                                        type="button"
                                        className={`log-status-pill log-status-pill-btn ${logRem2h.pillClass}`}
                                        onClick={() => handleOpenReminderModal(log, '2h')}
                                        title={logRem2h.title}
                                        aria-label={`2-Hour Reminder: ${logRem2h.label}. Click to view details.`}
                                      >
                                        {logRem2h.icon} {logRem2h.label}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="log-field">
                                    <span className="log-label">3h Reminder:</span>
                                    <div className="log-value-row">
                                      <span className="log-value">{formatTimeOnly(log.notify_3h_at)}</span>
                                      <button
                                        type="button"
                                        className={`log-status-pill log-status-pill-btn ${logRem3h.pillClass}`}
                                        onClick={() => handleOpenReminderModal(log, '3h')}
                                        title={logRem3h.title}
                                        aria-label={`3-Hour Reminder: ${logRem3h.label}. Click to view details.`}
                                      >
                                        {logRem3h.icon} {logRem3h.label}
                                      </button>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </li>
                        );
                      })}
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
          }}
          isLoggedIn={isLoggedIn}
          onOpenLogin={() => {
            setAuthModalMode('login');
            setIsAuthModalOpen(true);
          }}
        />
      )}

      {/* VIEW 3: SETTINGS (Language & Telegram) */}
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
                <h2 className="card-title">Language</h2>
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

            {/* 2. Telegram Notifications Card */}
            <div className="settings-card">
              <div className="card-header">
                <div className="card-icon-wrapper telegram-icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
                <div className="card-header-text">
                  <h2 className="card-title">Telegram Notifications</h2>
                  <p className="card-subtitle">Configure your Telegram bot to receive injection reminders</p>
                </div>
              </div>

              {!isLoggedIn ? (
                <div className="auth-locked-settings-notice">
                  <p className="auth-locked-text">
                    Please sign in or create an account to configure Telegram notification destinations and manage your reminder bots.
                  </p>
                  <button
                    type="button"
                    className="primary-btn auth-locked-btn"
                    onClick={() => {
                      setAuthModalMode('login');
                      setIsAuthModalOpen(true);
                    }}
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <>
                  {/* 1. Add Configuration Form */}
                  <form onSubmit={handleSaveTelegramSettings} className="settings-form">
                <div className="form-group">
                  <label htmlFor="config-label" className="form-label">
                    Configuration Name <span className="label-optional">(Optional)</span>
                  </label>
                  <input
                    id="config-label"
                    type="text"
                    className="form-input"
                    placeholder="e.g. My Phone, Channel"
                    value={telegramLabel}
                    onChange={(e) => setTelegramLabel(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bot-token" className="form-label">Bot Token</label>
                  <input
                    id="bot-token"
                    type="text"
                    className="form-input"
                    placeholder="Enter your Telegram bot token"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="chat-id" className="form-label">Chat ID</label>
                  <div className="input-prefix-group">
                    <span className="input-prefix" aria-hidden="true">-</span>
                    <input
                      id="chat-id"
                      type="text"
                      className="form-input with-prefix"
                      placeholder="e.g. 4304245048 or 1004304245048"
                      value={telegramChatId.replace(/^-+/, '')}
                      onChange={(e) => setTelegramChatId(e.target.value.replace(/^-+/, ''))}
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>

                <p className="settings-note">
                  Notifications are sent 10 minutes, 2 hours, and 3 hours after each injection via Telegram. Newly saved destinations are automatically marked as default.
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
                    {isSavingSettings ? 'Saving...' : 'Save & Set as Default'}
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
                    {isTestingTelegram ? 'Sending Test...' : 'Send Test Notification'}
                  </button>
                </div>
              </form>

              {/* 2. Saved Configurations List with Default Radio Button & Delete */}
              <div className="configs-section">
                <div className="configs-header">
                  <h3 className="configs-title">Saved Configurations</h3>
                  <span className="configs-count-badge">
                    {telegramConfigs.length} {telegramConfigs.length === 1 ? 'destination' : 'destinations'}
                  </span>
                </div>

                {telegramConfigs.length === 0 ? (
                  <div className="configs-empty-card">
                    <span className="configs-empty-text">No configurations saved yet. Enter details above to add one.</span>
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
                                  </div>
                                  <div className="config-details">
                                    <span className="config-detail-item">
                                      <span className="config-chat-group">
                                        <strong>Chat:</strong> {cfg.chatId}
                                        {cfg.isDefault && (
                                          <span className="default-pill">DEFAULT</span>
                                        )}
                                      </span>
                                    </span>
                                    <span className="config-detail-item">
                                      <strong>Token:</strong> {maskBotToken(cfg.botToken)}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="config-title-row">
                                    <span className="config-chat-group config-chat-title">
                                      <strong className="config-chat-prefix">Chat:</strong>
                                      <span className="config-chat-id-text">{cfg.chatId}</span>
                                      {cfg.isDefault && (
                                        <span className="default-pill">DEFAULT</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="config-details">
                                    <span className="config-detail-item">
                                      <strong>Token:</strong> {maskBotToken(cfg.botToken)}
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
                              Test
                            </button>
                            <button
                              type="button"
                              className="config-row-delete-btn"
                              title={hasCustom ? `Delete ${cfg.name}` : `Delete configuration for ${cfg.chatId}`}
                              onClick={() => handleOpenDeleteModal(cfg)}
                              aria-label={hasCustom ? `Delete ${cfg.name}` : `Delete configuration for ${cfg.chatId}`}
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
              <h2 className="card-title">Shared Access (Family & Party)</h2>
              <p className="card-subtitle">
                Share your injection logs and reminders with family or partners, or connect to another user&apos;s account.
              </p>
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="auth-locked-settings-notice">
              <p className="auth-locked-text">
                Please sign in or create an account to share your records with family members or connect as a caregiver.
              </p>
              <button
                type="button"
                className="primary-btn auth-locked-btn"
                onClick={() => {
                  setAuthModalMode('login');
                  setIsAuthModalOpen(true);
                }}
              >
                Sign In
              </button>
            </div>
          ) : (
            <div className="shared-access-content">
              {/* A. Personal Share Code Card */}
              <div className="share-code-box">
                <div className="share-code-header">
                  <span className="share-code-title">Your Share Code</span>
                  <span className="share-role-badge">Group Admin</span>
                </div>
                <div className="share-code-display-row">
                  <code className="share-code-value">{shareStatus.shareCode || 'Generating...'}</code>
                  <div className="share-btn-group">
                    <button
                      type="button"
                      className="copy-code-btn"
                      onClick={handleCopyShareCode}
                      title="Copy Share Code"
                    >
                      {copiedCode ? '✓ Copied' : 'Copy Code'}
                    </button>
                    <button
                      type="button"
                      className="copy-link-btn"
                      onClick={handleCopyInviteLink}
                      title="Copy Invite Link"
                    >
                      {copiedLink ? '✓ Copied Link' : 'Copy Invite Link'}
                    </button>
                  </div>
                </div>
                <p className="share-code-hint">
                  Share this code or link with someone you trust. They will be able to view your doses, trends, and reminders.
                </p>
              </div>

              {/* B. Invite Caregiver by Email */}
              <form onSubmit={handleSendInviteEmail} className="share-invite-form">
                <h3 className="share-sub-title">Invite Caregiver via Email</h3>
                <div className="share-input-row">
                  <input
                    type="email"
                    className="form-input share-email-input"
                    placeholder="caregiver@example.com"
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
                    {isSendingInvite ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>

              {/* C. Connected Members List (I am Admin) */}
              <div className="shared-members-section">
                <div className="share-section-header">
                  <h3 className="share-sub-title">Connected Members</h3>
                  <span className="configs-count-badge">
                    {shareStatus.members.length} {shareStatus.members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>

                {shareStatus.members.length === 0 ? (
                  <div className="configs-empty-card">
                    <span className="configs-empty-text">No caregivers connected to your account yet.</span>
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
                          title={`Remove member ${member.name || member.email}`}
                          aria-label={`Remove member ${member.name || member.email}`}
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
                <h3 className="share-sub-title">Connect to Another Account</h3>
                <p className="settings-note">
                  Enter a Share Code provided by another user to view and manage their reminders and logs.
                </p>
                <div className="share-input-row">
                  <input
                    type="text"
                    className="form-input share-join-input"
                    placeholder="e.g. INSU-A8B9C2"
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
                    {isJoiningShare ? 'Connecting...' : 'Connect Account'}
                  </button>
                </div>
              </form>

              {/* E. Accounts Shared With Me */}
              {shareStatus.sharedGroups.length > 0 && (
                <div className="shared-groups-section">
                  <h3 className="share-sub-title">Accounts Shared With You</h3>
                  <ul className="shared-members-list">
                    {shareStatus.sharedGroups.map((group) => (
                      <li key={group.ownerId} className="shared-member-item">
                        <div className="member-avatar group-avatar">
                          {(group.ownerName || group.ownerEmail || 'O')[0].toUpperCase()}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{group.ownerName || group.ownerEmail.split('@')[0]}</span>
                          <span className="member-email">{group.ownerEmail}</span>
                        </div>
                        <div className="group-actions">
                          <button
                            type="button"
                            className={`group-view-btn ${activeContext === 'shared' && activeOwnerId === group.ownerId ? 'active' : ''}`}
                            onClick={() => {
                              if (activeContext === 'shared' && activeOwnerId === group.ownerId) {
                                setViewingExplanationModal(group);
                              } else {
                                handleSwitchContext('shared', group.ownerId);
                              }
                            }}
                            title={
                              activeContext === 'shared' && activeOwnerId === group.ownerId
                                ? 'Currently active: click to learn what Viewing means'
                                : `Switch to view ${group.ownerName || group.ownerEmail}'s records`
                            }
                          >
                            {activeContext === 'shared' && activeOwnerId === group.ownerId ? 'Viewing' : 'Switch to View'}
                          </button>
                          <button
                            type="button"
                            className="group-leave-btn"
                            onClick={() => handleOpenLeaveGroupModal(group)}
                            title="Leave shared account"
                          >
                            Leave
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* F. Note regarding future multiple shared data */}
              <div className="share-future-note">
                <span className="future-note-icon">💡</span>
                <span className="future-note-text">
                  Currently supporting <strong>1 shared account + personal data switching</strong>. Support for multiple concurrent shared accounts will be available in a future update.
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
              <h3 id="delete-modal-title" className="modal-title">Delete Telegram Configuration?</h3>
            </div>
            <div className="modal-body">
              <p className="delete-modal-text">
                {isCustomConfigName(deleteModalConfig.name, deleteModalConfig.chatId) ? (
                  <>Are you sure you want to delete <strong>{deleteModalConfig.name}</strong> ({deleteModalConfig.chatId})?</>
                ) : (
                  <>Are you sure you want to delete configuration for chat <strong>{deleteModalConfig.chatId}</strong>?</>
                )}
              </p>
              {deleteModalConfig.isDefault && (
                <p className="delete-modal-warning">
                  This is currently the default destination. If deleted, another saved destination will automatically become active.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseDeleteModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn confirm-delete-btn"
                onClick={handleConfirmDelete}
              >
                Delete Configuration
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
              <h3 id="remove-member-modal-title" className="modal-title">Remove Connected Member?</h3>
            </div>
            <div className="modal-body">
              <p className="delete-modal-text">
                Are you sure you want to remove <strong>{removeMemberModalData.name || removeMemberModalData.email}</strong> from your shared group?
              </p>
              <p className="delete-modal-warning">
                They will immediately lose access to view your doses, history, and notifications.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseRemoveMemberModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn confirm-delete-btn"
                onClick={handleConfirmRemoveMember}
              >
                Remove Member
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
              <h3 id="leave-group-modal-title" className="modal-title">Leave Shared Account?</h3>
            </div>
            <div className="modal-body">
              <p className="delete-modal-text">
                Are you sure you want to leave the shared account belonging to <strong>{leaveGroupModalData.ownerName || leaveGroupModalData.ownerEmail}</strong>?
              </p>
              <p className="delete-modal-warning">
                You will no longer be able to view their logs or manage reminders.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseLeaveGroupModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn confirm-delete-btn"
                onClick={handleConfirmLeaveGroup}
              >
                Leave Account
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
              <h3 id="viewing-explanation-modal-title" className="modal-title">What does &ldquo;Viewing&rdquo; mean?</h3>
            </div>
            <div className="modal-body">
              <p className="modal-explanation-intro">
                You are currently viewing active records for <strong>{viewingExplanationModal.ownerName || viewingExplanationModal.ownerEmail}</strong>.
              </p>
              <div className="modal-explanation-box">
                <div className="modal-explanation-item">
                  <span className="explanation-bullet">💉</span>
                  <div>
                    <strong>Injection History &amp; Logs:</strong> All doses, times, insulin units, and weekly trends shown on the Home and Injection Logs tabs belong to this account.
                  </div>
                </div>
                <div className="modal-explanation-item">
                  <span className="explanation-bullet">⏰</span>
                  <div>
                    <strong>Scheduled Reminders:</strong> The 10m meal delivery, 2h check, and 3h eligibility countdowns reflect this patient&apos;s schedule.
                  </div>
                </div>
                <div className="modal-explanation-item">
                  <span className="explanation-bullet">🔄</span>
                  <div>
                    <strong>Switching Views:</strong> You can switch back to your own personal data anytime using the <strong>👤 My Data</strong> pill on Home or below.
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
                Switch to My Data
              </button>
              <button
                type="button"
                className="primary-btn modal-btn"
                onClick={() => setViewingExplanationModal(null)}
              >
                Got it
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
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body reminder-modal-body">
              <div className="reminder-modal-row">
                <span className="reminder-modal-label">Status:</span>
                <span className={`reminder-modal-badge ${reminderModalData.badgeClass}`}>
                  {reminderModalData.label}
                </span>
              </div>

              <div className="reminder-modal-row">
                <span className="reminder-modal-label">
                  {reminderModalData.status === 'sent' ? 'Sent Date & Time:' : 'Attempt / Target Time:'}
                </span>
                <span className="reminder-modal-value">
                  {reminderModalData.formattedTime || '—'}
                </span>
              </div>

              <div className="reminder-modal-message-box">
                {reminderModalData.status === 'sent' ? (
                  <p className="reminder-modal-success-text">
                    Sent successfully to your configured Telegram destination.
                  </p>
                ) : reminderModalData.status === 'failed' ? (
                  <div className="reminder-modal-error-content">
                    <p className="reminder-modal-error-category">
                      {reminderModalData.friendlyError?.category || 'Delivery Issue'}
                    </p>
                    <p className="reminder-modal-error-text">
                      {reminderModalData.friendlyError?.message || 'The reminder could not be delivered to Telegram.'}
                    </p>
                    {reminderModalData.rawError &&
                     reminderModalData.rawError !== reminderModalData.friendlyError?.message && (
                      <p className="reminder-modal-error-raw">
                        Details: {reminderModalData.rawError}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="reminder-modal-upcoming-text">
                    This reminder is scheduled for {reminderModalData.formattedTime}.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseReminderModal}
              >
                Close
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

export default App;
