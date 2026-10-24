import { useState, useEffect } from 'react';
import { useTranslation } from './i18n';
import useLockBodyScroll from './useLockBodyScroll';
import {
  isAndroidApp,
  isStandaloneApp,
  isPushSupported,
  getNotificationPermission,
  downloadAndroidApk,
  getDiagnosticLogs,
  clearDiagnosticLogs,
  addDiagnosticLog,
  ANDROID_PACKAGE_INFO
} from './pwa';

export default function DiagnosticModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState(() => getDiagnosticLogs());
  const [copyStatus, setCopyStatus] = useState('');
  const [sendStatus, setSendStatus] = useState('');
  const [activeFlag, setActiveFlag] = useState(() => {
    try {
      return localStorage.getItem('insuminder_device_notifications_active') === 'true';
    } catch {
      return false;
    }
  });

  useLockBodyScroll(Boolean(isOpen));

  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(() => {
      setLogs(getDiagnosticLogs());
    }, 0);

    const interval = setInterval(() => {
      setLogs(getDiagnosticLogs());
    }, 1000);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isAndroid = isAndroidApp();
  const isStandalone = isStandaloneApp();
  const pushSupported = isPushSupported();
  const currentPerm = getNotificationPermission();
  const rawBrowserPerm = typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'not_supported';
  const bridgeExists = typeof window !== 'undefined' && Boolean(window.AndroidBridge);
  const bridgeMethods = bridgeExists
    ? Object.keys(window.AndroidBridge).filter((k) => typeof window.AndroidBridge[k] === 'function')
    : [];
  const nativeVersion = bridgeExists && typeof window.AndroidBridge.getNativeVersion === 'function'
    ? window.AndroidBridge.getNativeVersion()
    : 'N/A';
  const nativeVersionCode = bridgeExists && typeof window.AndroidBridge.getNativeVersionCode === 'function'
    ? window.AndroidBridge.getNativeVersionCode()
    : 'N/A';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

  const reportData = {
    timestamp: new Date().toISOString(),
    appVersion: ANDROID_PACKAGE_INFO.version,
    isAndroid,
    isStandalone,
    pushSupported,
    notificationPermission: currentPerm,
    rawBrowserNotificationPermission: rawBrowserPerm,
    deviceActiveFlag: activeFlag,
    bridge: {
      exists: bridgeExists,
      nativeVersion,
      nativeVersionCode,
      methods: bridgeMethods
    },
    userAgent,
    recentLogs: logs.slice(0, 15)
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus(''), 2500);
    } catch {
      setCopyStatus('failed');
      setTimeout(() => setCopyStatus(''), 2500);
    }
  };

  const handleSendToServer = async () => {
    setSendStatus('sending');
    try {
      const res = await fetch('/api/dev/device-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'diagnostic-modal',
          report: reportData
        })
      });
      if (res.ok) {
        setSendStatus('sent');
        addDiagnosticLog('info', 'Telemetry sent to server successfully');
      } else {
        setSendStatus('error');
        addDiagnosticLog('warn', 'Telemetry server returned error', { status: res.status });
      }
    } catch (err) {
      setSendStatus('error');
      addDiagnosticLog('error', 'Telemetry transmission network error', { error: err.message });
    }
    setTimeout(() => setSendStatus(''), 3000);
  };

  const handleToggleActiveFlag = () => {
    const next = !activeFlag;
    try {
      if (next) {
        localStorage.setItem('insuminder_device_notifications_active', 'true');
      } else {
        localStorage.removeItem('insuminder_device_notifications_active');
      }
      setActiveFlag(next);
      addDiagnosticLog('info', `Toggled device notification flag to: ${next}`);
    } catch (e) {
      void e;
    }
  };

  const handleTestDownload = () => {
    addDiagnosticLog('info', 'Manual test download initiated from DiagnosticModal');
    downloadAndroidApk();
  };

  const handleTestBridgeNotification = () => {
    if (bridgeExists && typeof window.AndroidBridge.postNativeNotification === 'function') {
      try {
        window.AndroidBridge.postNativeNotification('Diagnostic Test', 'Bridge notification triggered successfully', 'qa-test', '/');
        addDiagnosticLog('info', 'Native bridge notification triggered');
      } catch (err) {
        addDiagnosticLog('error', 'Failed native bridge notification', { error: err.message });
      }
    } else {
      addDiagnosticLog('warn', 'AndroidBridge.postNativeNotification is not available');
    }
  };

  const handleClearLogs = () => {
    clearDiagnosticLogs();
    setLogs([]);
  };

  return (
    <div
      className="modal-overlay diagnostic-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostic-modal-title"
    >
      <div
        className="modal-card diagnostic-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="diagnostic-modal-header">
          <div className="diagnostic-title-block">
            <div>
              <h2 id="diagnostic-modal-title" className="diagnostic-modal-title">
                {t('diagnostic.title')}
              </h2>
              <p className="diagnostic-modal-subtitle">{t('diagnostic.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            className="android-modal-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <div className="diagnostic-modal-body">
          {/* Subsystem Status Cards */}
          <div className="diagnostic-grid">
            <div className="diagnostic-card">
              <span className="diagnostic-label">Web Version</span>
              <strong className="diagnostic-val">v{ANDROID_PACKAGE_INFO.version}</strong>
            </div>

            <div className="diagnostic-card">
              <span className="diagnostic-label">Android Shell</span>
              <strong className={`diagnostic-val ${isAndroid ? 'val-good' : 'val-warn'}`}>
                {isAndroid ? 'Detected' : 'Web / Browser'}
              </strong>
            </div>

            <div className="diagnostic-card">
              <span className="diagnostic-label">Native APK Version</span>
              <strong className="diagnostic-val">{nativeVersion} ({nativeVersionCode})</strong>
            </div>

            <div className="diagnostic-card">
              <span className="diagnostic-label">Notification Permission</span>
              <strong className={`diagnostic-val ${currentPerm === 'granted' ? 'val-good' : 'val-danger'}`}>
                {currentPerm}
              </strong>
            </div>

            <div className="diagnostic-card">
              <span className="diagnostic-label">Browser Permission</span>
              <strong className="diagnostic-val">{rawBrowserPerm}</strong>
            </div>

            <div className="diagnostic-card">
              <span className="diagnostic-label">Local Active Flag</span>
              <strong className={`diagnostic-val ${activeFlag ? 'val-good' : 'val-warn'}`}>
                {activeFlag ? 'Active (true)' : 'Inactive'}
              </strong>
            </div>
          </div>

          {/* Bridge Methods Inspection */}
          <div className="diagnostic-detail-section">
            <h4 className="diagnostic-section-title">AndroidBridge Inspection</h4>
            <div className="diagnostic-pill-list">
              <span className={`diagnostic-pill ${bridgeExists ? 'pill-active' : 'pill-disabled'}`}>
                Bridge: {bridgeExists ? 'Loaded' : 'Not Loaded'}
              </span>
              <span className={`diagnostic-pill ${bridgeMethods.includes('openNotificationSettings') ? 'pill-active' : 'pill-disabled'}`}>
                openNotificationSettings
              </span>
              <span className={`diagnostic-pill ${bridgeMethods.includes('isNotificationPermissionGranted') ? 'pill-active' : 'pill-disabled'}`}>
                isNotificationPermissionGranted
              </span>
              <span className={`diagnostic-pill ${bridgeMethods.includes('downloadApk') ? 'pill-active' : 'pill-disabled'}`}>
                downloadApk
              </span>
              <span className={`diagnostic-pill ${bridgeMethods.includes('postNativeNotification') ? 'pill-active' : 'pill-disabled'}`}>
                postNativeNotification
              </span>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="diagnostic-detail-section">
            <h4 className="diagnostic-section-title">Interactive Diagnostic Controls</h4>
            <div className="diagnostic-action-btns">
              <button
                type="button"
                className="push-action-btn btn-primary"
                onClick={handleTestDownload}
              >
                📥 {t('diagnostic.triggerDownload')}
              </button>

              <button
                type="button"
                className="push-action-btn btn-secondary"
                onClick={handleTestBridgeNotification}
                disabled={!bridgeExists}
              >
                🔔 {t('diagnostic.triggerPush')}
              </button>

              <button
                type="button"
                className={`push-action-btn ${activeFlag ? 'btn-danger-outline' : 'btn-accent'}`}
                onClick={handleToggleActiveFlag}
              >
                ⚡ {t('diagnostic.forceActive')} ({activeFlag ? 'Disable' : 'Enable'})
              </button>
            </div>
          </div>

          {/* Real-time Event Stream Log */}
          <div className="diagnostic-detail-section">
            <div className="diagnostic-logs-header">
              <h4 className="diagnostic-section-title">Live Client Event Stream</h4>
              <button
                type="button"
                className="diagnostic-clear-btn"
                onClick={handleClearLogs}
              >
                Clear
              </button>
            </div>
            <div className="diagnostic-log-window">
              {logs.length === 0 ? (
                <div className="diagnostic-log-empty">No logged events yet.</div>
              ) : (
                logs.map((item, idx) => (
                  <div key={idx} className={`diagnostic-log-row log-${item.level}`}>
                    <span className="log-time">{item.timestamp.split('T')[1].replace('Z', '')}</span>
                    <span className="log-level">[{item.level.toUpperCase()}]</span>
                    <span className="log-msg">{item.message}</span>
                    {item.data && (
                      <pre className="log-data">{JSON.stringify(item.data)}</pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer diagnostic-modal-footer">
          <button
            type="button"
            className="push-action-btn btn-secondary"
            onClick={handleCopyReport}
          >
            📋 {copyStatus === 'copied' ? t('diagnostic.copied') : t('diagnostic.copy')}
          </button>

          <button
            type="button"
            className="push-action-btn btn-primary"
            onClick={handleSendToServer}
            disabled={sendStatus === 'sending'}
          >
            📤 {sendStatus === 'sent' ? t('diagnostic.sent') : t('diagnostic.sendServer')}
          </button>

          <button
            type="button"
            className="push-action-btn btn-settings"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

