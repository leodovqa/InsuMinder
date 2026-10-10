import { useState } from 'react';
import { isValidPhoneNumber, getExampleNumber } from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/examples.mobile.json';
import { authService } from './authService';
import { detectCountry } from './countryCallingCodes';

export default function Profile({ user, onUpdateUser, isLoggedIn, onOpenLogin }) {
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(() => user?.firstName || '');
  const [lastName, setLastName] = useState(() => user?.lastName || '');
  const [phone, setPhone] = useState(() => user?.phone || '');
  const [firstNameError, setFirstNameError] = useState(null);
  const [lastNameError, setLastNameError] = useState(null);
  const [phoneError, setPhoneError] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync inputs when user prop changes without useEffect cascading renders
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    if (!isEditing) {
      setFirstName(user?.firstName || '');
      setLastName(user?.lastName || '');
      setPhone(user?.phone || '');
    }
  }

  // Logged-out state display
  if (!isLoggedIn || !user) {
    return (
      <section className="tab-view profile-view">
        <div className="profile-container">
          <div className="empty-logs-container auth-locked-card">
            <div className="auth-locked-icon-wrapper">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="auth-locked-title">Account Required</h3>
            <p className="no-logs">
              Please sign in or create an account to view and edit your profile.
            </p>
            <button
              type="button"
              className="primary-btn auth-locked-btn"
              onClick={onOpenLogin}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>
    );
  }

  // International phone detection & dynamic placeholder
  const detectedCountry = detectCountry(phone);
  const phonePlaceholder = detectedCountry
    ? (getExampleNumber(detectedCountry, examples)?.formatNational() || 'Phone number')
    : 'e.g. 1 340 555 0123';

  const handleFirstNameChange = (e) => {
    // Only allow letters, spaces, hyphens, and apostrophes (no numbers or unrelated symbols)
    const val = e.target.value.replace(/[^\p{L}\s'-]/gu, '');
    setFirstName(val);
    const letters = val.replace(/[^\p{L}]/gu, '');
    if (firstNameError && letters.length >= 2) {
      setFirstNameError(null);
    }
    if (error) setError(null);
  };

  const handleLastNameChange = (e) => {
    // Only allow letters, spaces, hyphens, and apostrophes (no numbers or unrelated symbols)
    const val = e.target.value.replace(/[^\p{L}\s'-]/gu, '');
    setLastName(val);
    const letters = val.replace(/[^\p{L}]/gu, '');
    if (lastNameError && letters.length >= 2) {
      setLastNameError(null);
    }
    if (error) setError(null);
  };

  const handlePhoneChange = (e) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    setPhone(rawDigits);
    if (phoneError) {
      if (!rawDigits.trim() || isValidPhoneNumber('+' + rawDigits.trim())) {
        setPhoneError(null);
      }
    }
    if (error) setError(null);
  };

  const handleStartEdit = () => {
    setError(null);
    setFirstNameError(null);
    setLastNameError(null);
    setPhoneError(null);
    setSuccessMessage(null);
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setPhone(user.phone || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setError(null);
    setFirstNameError(null);
    setLastNameError(null);
    setPhoneError(null);
    setSuccessMessage(null);
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setPhone(user.phone || '');
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanPhone = phone.trim();

    let hasValidationError = false;

    const firstLetters = cleanFirst.replace(/[^\p{L}]/gu, '');
    const lastLetters = cleanLast.replace(/[^\p{L}]/gu, '');

    if (firstLetters.length < 2) {
      setFirstNameError('First name must be at least 2 characters');
      hasValidationError = true;
    } else {
      setFirstNameError(null);
    }

    if (lastLetters.length < 2) {
      setLastNameError('Last name must be at least 2 characters');
      hasValidationError = true;
    } else {
      setLastNameError(null);
    }

    // Phone is optional: only validate if non-empty
    if (cleanPhone && !isValidPhoneNumber('+' + cleanPhone)) {
      setPhoneError('Invalid phone number');
      hasValidationError = true;
    } else {
      setPhoneError(null);
    }

    if (hasValidationError) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await authService.updateProfile({
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone
      });

      if (!res.success) {
        setError(res.error || 'Failed to update profile.');
        setIsSaving(false);
        return;
      }

      if (res.user && onUpdateUser) {
        onUpdateUser(res.user);
      }

      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="tab-view profile-view">
      <div className="profile-container">
        <div className="profile-card">
          <div className="card-header profile-card-header">
            <div className="card-icon-wrapper profile-icon-wrapper">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="card-header-text">
              <h2 className="card-title">User Profile</h2>
              <p className="card-subtitle">Manage your personal details and contact number</p>
            </div>
          </div>

          {error && (
            <div className="auth-error-banner profile-status-banner" role="alert">
              <span className="auth-error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="profile-success-banner" role="status">
              <span className="profile-success-icon">✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          <div className="profile-account-info">
            <div className="profile-info-item">
              <span className="profile-info-label">Account Email</span>
              <span className="profile-info-value">{user.email}</span>
            </div>
            {user.shareCode && (
              <div className="profile-info-item">
                <span className="profile-info-label">Share Code</span>
                <span className="profile-info-value profile-code-pill">{user.shareCode}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="profile-form" noValidate>
            <div className="form-group">
              <label htmlFor="profile-first-name-input" className="form-label">
                First Name <span className="auth-required-star">*</span>
              </label>
              <input
                id="profile-first-name-input"
                type="text"
                value={firstName}
                onChange={handleFirstNameChange}
                placeholder="e.g. Test Name"
                className={`auth-input profile-input ${
                  isEditing && firstNameError ? 'input-invalid' : ''
                }`}
                disabled={!isEditing || isSaving}
                autoComplete="given-name"
              />
              {isEditing && firstNameError && (
                <div className="input-validation-error" role="alert">
                  {firstNameError}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="profile-last-name-input" className="form-label">
                Last Name <span className="auth-required-star">*</span>
              </label>
              <input
                id="profile-last-name-input"
                type="text"
                value={lastName}
                onChange={handleLastNameChange}
                placeholder="e.g. Test Last Name"
                className={`auth-input profile-input ${
                  isEditing && lastNameError ? 'input-invalid' : ''
                }`}
                disabled={!isEditing || isSaving}
                autoComplete="family-name"
              />
              {isEditing && lastNameError && (
                <div className="input-validation-error" role="alert">
                  {lastNameError}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="profile-phone-input" className="form-label">
                Phone Number <span className="auth-optional-tag">(Optional)</span>
              </label>
              <div
                className={`phone-input-container ${
                  isEditing && phoneError ? 'phone-error' : ''
                } ${!isEditing ? 'phone-container-disabled' : ''}`}
              >
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
                  id="profile-phone-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={phonePlaceholder}
                  className={`auth-input phone-input profile-input ${
                    isEditing && phoneError ? 'phone-input-invalid' : ''
                  }`}
                  disabled={!isEditing || isSaving}
                  autoComplete="tel"
                />
              </div>
              {isEditing && phoneError && (
                <div className="phone-validation-error" role="alert">
                  {phoneError}
                </div>
              )}
            </div>

            <div className="profile-actions">
              {!isEditing ? (
                <button
                  type="button"
                  className="primary-btn profile-btn profile-edit-btn"
                  onClick={handleStartEdit}
                >
                  Edit
                </button>
              ) : (
                <div className="profile-edit-btn-group">
                  <button
                    type="submit"
                    className="primary-btn profile-btn profile-save-btn"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn profile-btn profile-cancel-btn"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
