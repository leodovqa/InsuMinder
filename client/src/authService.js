const TOKEN_STORAGE_KEY = 'insuminder_auth_token';
const USER_STORAGE_KEY = 'insuminder_auth_user';
const CONTEXT_STORAGE_KEY = 'insuminder_active_context';
const OWNER_STORAGE_KEY = 'insuminder_active_owner_id';

export const authService = {
  getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },

  getCurrentUser() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  getActiveContext() {
    if (typeof window === 'undefined') return 'personal';
    return localStorage.getItem(CONTEXT_STORAGE_KEY) || 'personal';
  },

  getActiveOwnerId() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(OWNER_STORAGE_KEY);
    return raw ? parseInt(raw, 10) : null;
  },

  setActiveContext(context, ownerId = null) {
    if (typeof window === 'undefined') return;
    if (context === 'shared' && ownerId) {
      localStorage.setItem(CONTEXT_STORAGE_KEY, 'shared');
      localStorage.setItem(OWNER_STORAGE_KEY, String(ownerId));
    } else {
      localStorage.setItem(CONTEXT_STORAGE_KEY, 'personal');
      localStorage.removeItem(OWNER_STORAGE_KEY);
    }
  },

  setSession(token, user) {
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  },

  clearSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(CONTEXT_STORAGE_KEY);
    localStorage.removeItem(OWNER_STORAGE_KEY);
  },

  getAuthHeaders() {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const activeCtx = this.getActiveContext();
    const ownerId = this.getActiveOwnerId();
    if (activeCtx === 'shared' && ownerId) {
      headers['X-Active-Context'] = 'shared';
      headers['X-Active-Owner-Id'] = String(ownerId);
    }
    return headers;
  },

  async register(email, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return await res.json();
  },

  async verify(email, code, shareCode = null) {
    const payload = { email, code };
    if (shareCode) payload.shareCode = shareCode;
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && data.token && data.user) {
      this.setSession(data.token, data.user);
      if (data.joinedGroup && data.joinedGroup.ownerId) {
        this.setActiveContext('shared', data.joinedGroup.ownerId);
      }
    }
    return data;
  },

  async login(email, password, shareCode = null) {
    const payload = { email, password };
    if (shareCode) payload.shareCode = shareCode;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && data.token && data.user) {
      this.setSession(data.token, data.user);
      if (data.joinedGroup && data.joinedGroup.ownerId) {
        this.setActiveContext('shared', data.joinedGroup.ownerId);
      }
    }
    return data;
  },

  async loginWithGoogle(basePayload = { dev: true }, shareCode = null) {
    const payload = { ...basePayload };
    if (shareCode) payload.shareCode = shareCode;
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && data.token && data.user) {
      this.setSession(data.token, data.user);
      if (data.joinedGroup && data.joinedGroup.ownerId) {
        this.setActiveContext('shared', data.joinedGroup.ownerId);
      }
    }
    return data;
  },

  async fetchMe() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.setSession(token, data.user);
        return data.user;
      }
      this.clearSession();
      return null;
    } catch {
      return null;
    }
  },

  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      this.clearSession();
    }
  },

  /* Caregiver / Family Sharing APIs */
  async getShareStatus() {
    const res = await fetch('/api/share/status', {
      headers: this.getAuthHeaders()
    });
    return await res.json();
  },

  async inviteMember(email, inviteUrl) {
    const res = await fetch('/api/share/invite', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ email, inviteUrl })
    });
    return await res.json();
  },

  async joinShare(shareCode) {
    const res = await fetch('/api/share/join', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ shareCode })
    });
    return await res.json();
  },

  async removeMember(memberId) {
    const res = await fetch(`/api/share/members/${memberId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return await res.json();
  },

  async leaveShareGroup(ownerId) {
    const res = await fetch('/api/share/leave', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ ownerId })
    });
    return await res.json();
  }
};
