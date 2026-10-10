import { useState, useEffect, useRef, useCallback } from 'react';
import { isValidPhoneNumber, getExampleNumber } from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/examples.mobile.json';
import { authService } from './authService';
import { detectCountry } from './countryCallingCodes';

export default function AuthModal({ isOpen, initialMode = 'login', shareCode = null, onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'verify' | 'profile'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [pendingJoinedGroup, setPendingJoinedGroup] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devCode, setDevCode] = useState(null);

  // 10-minute (600s) countdown timer
  const [secondsRemaining, setSecondsRemaining] = useState(600);
  const [isCodeExpired, setIsCodeExpired] = useState(false);

  const resetAllInputs = () => {
    setEmail('');
    setPassword('');
    setCode('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPendingJoinedGroup(null);
    setDevCode(null);
    setError(null);
    setIsSubmitting(false);
    setIsCodeExpired(false);
    setSecondsRemaining(600);
  };

  const [prevOpenState, setPrevOpenState] = useState({ isOpen, initialMode });
  if (prevOpenState.isOpen !== isOpen || prevOpenState.initialMode !== initialMode) {
    setPrevOpenState({ isOpen, initialMode });
    setMode(initialMode);
    resetAllInputs();
  }

  // Clear inputs on browser back/forward navigation, bfcache restore, or before page unload/refresh
  useEffect(() => {
    const handleClearNavigation = () => {
      resetAllInputs();
    };

    window.addEventListener('popstate', handleClearNavigation);
    window.addEventListener('pageshow', handleClearNavigation);
    window.addEventListener('beforeunload', handleClearNavigation);

    return () => {
      window.removeEventListener('popstate', handleClearNavigation);
      window.removeEventListener('pageshow', handleClearNavigation);
      window.removeEventListener('beforeunload', handleClearNavigation);
    };
  }, []);

  // Countdown timer for 6-digit verification code
  useEffect(() => {
    if (mode !== 'verify') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsCodeExpired(true);
          setError('Verification code has expired. Please enter your email and password to start a new verification process.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode]);

  // Google Identity Services (GIS) integration hooks (must be unconditionally declared)
  const googleBtnRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [gisAvailable, setGisAvailable] = useState(Boolean(typeof window !== 'undefined' && window.google?.accounts?.id));

  // Poll briefly for GIS library if loading asynchronously
  useEffect(() => {
    if (gisAvailable) return;
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        setGisAvailable(true);
        clearInterval(interval);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [gisAvailable]);

  const handleGoogleCredentialResponse = useCallback(async (response) => {
    if (!response || !response.credential) {
      setError('Failed to receive authentication credential from Google.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await authService.loginWithGoogle({ credential: response.credential }, shareCode);
      if (res.success) {
        if (res.joinedGroup) {
          onSuccess(res.user, res.joinedGroup);
        } else {
          onSuccess(res.user);
        }
        resetAllInputs();
        onClose();
      } else {
        setError(res.error || 'Google authentication failed.');
      }
    } catch {
      setError('Failed to connect to Google authentication.');
    } finally {
      setIsSubmitting(false);
    }
  }, [shareCode, onSuccess, onClose]);

  // Render Google Identity Services button if available & configured
  useEffect(() => {
    if (!isOpen || (mode !== 'login' && mode !== 'register')) return;
    if (typeof window !== 'undefined' && window.google?.accounts?.id && googleClientId && googleBtnRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      } catch (err) {
        console.warn('Failed to render Google Sign-In button:', err);
      }
    }
  }, [isOpen, mode, googleClientId, gisAvailable, handleGoogleCredentialResponse]);

  if (!isOpen) return null;

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleBackToCredentials = () => {
    setMode('register');
    setError(null);
    setCode('');
    // email and password remain filled in as requested
  };

  const handleStartOver = () => {
    handleBackToCredentials();
  };

  const handleTabSwitch = (newMode) => {
    setMode(newMode);
    resetAllInputs();
  };

  const handleCloseModal = () => {
    resetAllInputs();
    onClose();
  };

  // 1. Handle Registration (Step 1: Email + Password)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await authService.register(email, password);
      if (res.success) {
        setMode('verify');
        setSecondsRemaining(600);
        setIsCodeExpired(false);
        if (res.devCode) {
          setDevCode(res.devCode);
        }
      } else {
        setError(res.error || 'Failed to send verification email. Please check your email and try again.');
      }
    } catch {
      setError('Network error connecting to authentication server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Handle Verification (Step 2: 6-digit Code)
  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (isCodeExpired) {
      setError('Verification code has expired. Please enter your email and password to start a new verification process.');
      return;
    }

    if (!code || code.trim().length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await authService.verifyCode(email, code);
      if (res.success) {
        setError(null);
        setMode('profile');
      } else {
        if (res.expired) {
          setIsCodeExpired(true);
        }
        setError(res.error || 'Invalid verification code.');
      }
    } catch {
      setError('Network error verifying code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneChange = (e) => {
    // Only allow numeric digits [0-9], stripping all letters, symbols, spaces, and '+'
    const numericOnly = e.target.value.replace(/\D/g, '');
    setPhone(numericOnly);
  };

  const detectedCountry = detectCountry(phone);
  const isPhoneValid = !phone || isValidPhoneNumber('+' + phone);
  const isPhoneError = phone.length > 0 && !isPhoneValid;

  const phonePlaceholder = detectedCountry
    ? getExampleNumber(detectedCountry, examples)?.format('E.164').replace(/^\+/, '') || '13405550123'
    : '13405550123';

  // 3. Handle Profile Setup (Step 3: First Name, Last Name, Phone)
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const rawPhoneDigits = phone.replace(/\D/g, '');
    const cleanPhone = rawPhoneDigits ? `+${rawPhoneDigits}` : '';

    if (!cleanFirst || !cleanLast) {
      setError('First name and last name are required.');
      return;
    }

    if (rawPhoneDigits && !isValidPhoneNumber(`+${rawPhoneDigits}`)) {
      setError('Please enter a valid phone number.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await authService.completeRegistration({
        email,
        code,
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone,
        shareCode
      });

      if (res.success && res.user) {
        if (res.joinedGroup || pendingJoinedGroup) {
          onSuccess(res.user, res.joinedGroup || pendingJoinedGroup);
        } else {
          onSuccess(res.user);
        }
        resetAllInputs();
        onClose();
      } else {
        setError(res.error || 'Failed to complete registration profile.');
      }
    } catch {
      setError('Network error completing registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Handle Sign In (Email + Password)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await authService.login(email, password, shareCode);
      if (res.success) {
        if (res.joinedGroup) {
          onSuccess(res.user, res.joinedGroup);
        } else {
          onSuccess(res.user);
        }
        resetAllInputs();
        onClose();
      } else {
        setError(res.error ? res.error.replace(/\.$/, '') : 'Invalid email or password');
      }
    } catch {
      setError('Network error during login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Handle Google Sign-In Click
  const handleGoogleSignIn = async () => {
    setError(null);

    // If Google Identity Services is available and Client ID is configured, trigger Google prompt
    if (typeof window !== 'undefined' && window.google?.accounts?.id && googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.prompt();
        return;
      } catch (err) {
        console.warn('Google prompt error:', err);
      }
    }

    // In local dev or test environments, allow dev bypass for testing
    if (import.meta.env.DEV) {
      setIsSubmitting(true);
      try {
        const payload = {
          dev: true,
          email: email && email.includes('@') ? email : 'google.user@insuminder.app',
          name: 'Google User'
        };
        const res = await authService.loginWithGoogle(payload, shareCode);
        if (res.success) {
          if (res.joinedGroup) {
            onSuccess(res.user, res.joinedGroup);
          } else {
            onSuccess(res.user);
          }
          resetAllInputs();
          onClose();
        } else {
          setError(res.error || 'Google authentication failed.');
        }
      } catch {
        setError('Failed to connect to Google authentication.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // In production without Client ID:
    setError('Google Sign-In is not configured. Please sign up with email or configure VITE_GOOGLE_CLIENT_ID.');
  };

  return (
    <div className="modal-backdrop auth-modal-backdrop" role="presentation">
      <div
        className="modal-container auth-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {(mode === 'verify' || mode === 'profile') && (
          <button
            type="button"
            className="modal-back-btn auth-back-btn"
            onClick={handleBackToCredentials}
            aria-label="Back to email and password"
            title="Back to email and password"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
        )}

        <button
          type="button"
          className="modal-close-btn auth-close-btn"
          onClick={handleCloseModal}
          aria-label="Close authentication modal"
        >
          &times;
        </button>

        {/* Modal Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <h2 id="auth-modal-title" className="auth-title">
            {mode === 'profile'
              ? 'Complete Your Profile'
              : mode === 'verify'
              ? 'Verify Email'
              : mode === 'register'
              ? 'Create InsuMinder Account'
              : 'Sign In to InsuMinder'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'profile'
              ? 'Enter your name to complete your registration'
              : mode === 'verify'
              ? `Enter the 6-digit code sent to ${email}`
              : mode === 'register'
              ? 'Register with email or Google to log insulin and track doses'
              : 'Sign in to access your doses, trends, and scheduled reminders'}
          </p>
        </div>

        {/* Share Invitation Banner */}
        {shareCode && (
          <div className="auth-share-banner">
            <span className="auth-share-icon">🔗</span>
            <span>You are connecting via Share Code: <strong>{shareCode}</strong></span>
          </div>
        )}

        {/* Mode Switch Tabs (Login vs Register) */}
        {mode !== 'verify' && mode !== 'profile' && (
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('login')}
              role="tab"
              aria-selected={mode === 'login'}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('register')}
              role="tab"
              aria-selected={mode === 'register'}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div className="auth-error-banner" role="alert">
            <span className="auth-error-icon" aria-hidden="true">⚠️</span>
            <span className="auth-error-text">
              {/invalid email or password/i.test(error) ? error.replace(/\.$/, '') : error}
            </span>
          </div>
        )}

        {/* MODE 1: COMPLETE PROFILE (Step 3: First Name, Last Name, Phone) */}
        {mode === 'profile' ? (
          <form onSubmit={handleProfileSubmit} className="auth-form" autoComplete="off">
            <div className="form-group">
              <label htmlFor="auth-first-name-input" className="form-label">
                First Name <span className="auth-required-star">*</span>
              </label>
              <input
                id="auth-first-name-input"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value.replace(/[^\p{L}\s'-]/gu, ''))}
                placeholder="e.g. Test Name"
                className="auth-input"
                required
                disabled={isSubmitting}
                autoFocus
                autoComplete="given-name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="auth-last-name-input" className="form-label">
                Last Name <span className="auth-required-star">*</span>
              </label>
              <input
                id="auth-last-name-input"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value.replace(/[^\p{L}\s'-]/gu, ''))}
                placeholder="e.g. Test Last Name"
                className="auth-input"
                required
                disabled={isSubmitting}
                autoComplete="family-name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="auth-phone-input" className="form-label">
                Phone Number <span className="auth-optional-tag">(Optional)</span>
              </label>
              <div className={`phone-input-container ${isPhoneError ? 'phone-error' : ''}`}>
                <div className="phone-prefix-addon" aria-hidden="true">
                  {detectedCountry ? (
                    <img
                      src={`/flags/${detectedCountry}.svg`}
                      alt=""
                      className="phone-flag-icon"
                    />
                  ) : (
                    <span className="phone-globe-icon">🌐</span>
                  )}
                  <span className="phone-plus-sign">+</span>
                </div>
                <input
                  id="auth-phone-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={phonePlaceholder}
                  className={`auth-input phone-input ${isPhoneError ? 'phone-input-invalid' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="tel"
                />
              </div>
              {isPhoneError && (
                <div className="phone-validation-error" role="alert">
                  Invalid phone number
                </div>
              )}
            </div>

            <div className="auth-modal-actions">
              <button
                type="submit"
                className="primary-btn auth-submit-btn"
                disabled={isSubmitting || !firstName.trim() || !lastName.trim() || isPhoneError}
              >
                {isSubmitting ? 'Completing Registration...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        ) : mode === 'verify' ? (
          /* MODE 2: VERIFY 6-DIGIT CODE */
          <form onSubmit={handleVerifySubmit} className="auth-form" autoComplete="off">
            <div className={`verification-timer-banner ${isCodeExpired ? 'timer-expired' : ''}`}>
              <svg
                className="timer-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2" />
                <path d="M10 2h4" />
                <path d="M12 2v3" />
              </svg>
              <span className="timer-text">
                {isCodeExpired ? (
                  <strong className="timer-expired-text">Expired</strong>
                ) : (
                  <>
                    Code expires in: <strong>{formatTimer(secondsRemaining)}</strong>
                  </>
                )}
              </span>
            </div>

            {devCode && (
              <div className="dev-code-hint">
                <span className="dev-hint-label">Dev Test Code:</span>
                <button
                  type="button"
                  className="dev-code-btn"
                  onClick={() => setCode(devCode)}
                  title="Click to auto-fill code"
                >
                  {devCode} (Click to fill)
                </button>
              </div>
            )}

            <div className="form-group code-input-group">
              <label htmlFor="verify-code-input" className="form-label">
                6-Digit Verification Code
              </label>
              <input
                id="verify-code-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="auth-input code-input"
                disabled={isCodeExpired || isSubmitting}
                autoFocus
                required
                autoComplete="one-time-code"
              />
            </div>

            <div className="auth-modal-actions">
              {isCodeExpired ? (
                <button
                  type="button"
                  className="primary-btn auth-submit-btn"
                  onClick={handleStartOver}
                >
                  Start New Process
                </button>
              ) : (
                <button
                  type="submit"
                  className="primary-btn auth-submit-btn"
                  disabled={isSubmitting || code.length !== 6}
                >
                  {isSubmitting ? 'Verifying...' : 'Verify Code & Continue'}
                </button>
              )}
            </div>

            <div className="auth-switch-row">
              <button
                type="button"
                className="auth-link-btn"
                onClick={handleStartOver}
              >
                &larr; Back to Email / Change Address
              </button>
            </div>
          </form>
        ) : (
          /* MODES 2 & 3: LOGIN OR REGISTER */
          <div className="auth-form-container">
            {/* Google Authentication Section */}
            <div className="google-auth-section">
              {googleClientId && gisAvailable ? (
                <div ref={googleBtnRef} className="google-gis-btn-container" />
              ) : (
                <button
                  type="button"
                  className="google-signin-btn"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                >
                  <svg className="google-icon-svg" width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              )}
            </div>

            <div className="auth-divider">
              <span className="auth-divider-line"></span>
              <span className="auth-divider-text">or continue with email</span>
              <span className="auth-divider-line"></span>
            </div>

            <form
              onSubmit={mode === 'register' ? handleRegisterSubmit : handleLoginSubmit}
              className="auth-form"
              autoComplete="off"
            >
              <div className="form-group">
                <label htmlFor="auth-email-input" className="form-label">
                  Email Address
                </label>
                <input
                  id="auth-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="auth-input"
                  required
                  disabled={isSubmitting}
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-password-input" className="form-label">
                  Password
                </label>
                <input
                  id="auth-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                  className="auth-input"
                  minLength={6}
                  required
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-modal-actions">
                <button
                  type="submit"
                  className="primary-btn auth-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Please wait...'
                    : mode === 'register'
                    ? 'Continue & Send Code'
                    : 'Sign In'}
                </button>
              </div>

              <div className="auth-switch-row">
                {mode === 'login' ? (
                  <p className="auth-switch-text">
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => {
                        setMode('register');
                        setError(null);
                      }}
                    >
                      Sign Up
                    </button>
                  </p>
                ) : (
                  <p className="auth-switch-text">
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

