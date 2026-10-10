import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import AuthModal from '../AuthModal';
import { authService } from '../authService';

describe('Caregiver & Family Shared Access Tests', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authService Context & Sharing Methods', () => {
    it('manages active context and owner ID in localStorage', () => {
      expect(authService.getActiveContext()).toBe('personal');
      expect(authService.getActiveOwnerId()).toBeNull();

      authService.setActiveContext('shared', 101);
      expect(authService.getActiveContext()).toBe('shared');
      expect(authService.getActiveOwnerId()).toBe(101);

      // Verify headers include X-Active-Context and X-Active-Owner-Id
      const headers = authService.getAuthHeaders();
      expect(headers['X-Active-Context']).toBe('shared');
      expect(headers['X-Active-Owner-Id']).toBe('101');

      authService.setActiveContext('personal');
      expect(authService.getActiveContext()).toBe('personal');
      expect(authService.getActiveOwnerId()).toBeNull();

      const personalHeaders = authService.getAuthHeaders();
      expect(personalHeaders['X-Active-Context']).toBeUndefined();
      expect(personalHeaders['X-Active-Owner-Id']).toBeUndefined();
    });

    it('auto-activates shared context when verify returns joinedGroup', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          token: 'token-xyz',
          user: { id: 2, email: 'caregiver@home.org' },
          joinedGroup: { ownerId: 1, ownerEmail: 'patient@home.org', ownerName: 'Patient' }
        })
      });

      const res = await authService.verify('caregiver@home.org', '123456', 'INSU-PATIENT');
      expect(res.success).toBe(true);
      expect(authService.getActiveContext()).toBe('shared');
      expect(authService.getActiveOwnerId()).toBe(1);
    });

    it('calls share status, invite, join, remove and leave APIs', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true })
      });

      await authService.getShareStatus();
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/share/status', expect.any(Object));

      await authService.inviteMember('nurse@clinic.org', 'http://localhost/?shareCode=INSU-123');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/share/invite', expect.objectContaining({
        method: 'POST'
      }));

      await authService.joinShare('INSU-ABCDEF');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/share/join', expect.objectContaining({
        method: 'POST'
      }));

      await authService.removeMember(99);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/share/members/99', expect.objectContaining({
        method: 'DELETE'
      }));

      await authService.leaveShareGroup(1);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/share/leave', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('AuthModal with Share Code Invites', () => {
    it('displays share code banner when shareCode prop is provided', () => {
      render(
        <AuthModal
          isOpen={true}
          initialMode="register"
          shareCode="INSU-XYZ999"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByText(/You are connecting via Share Code:/i)).toBeInTheDocument();
      expect(screen.getByText('INSU-XYZ999')).toBeInTheDocument();
    });
  });

  describe('App Component Shared Access UI & Context Switching', () => {
    it('displays context switcher on home screen when user belongs to a shared group', async () => {
      authService.setSession('test-token', { id: 2, email: 'caregiver@med.com' });
      authService.setActiveContext('shared', 1);

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              user: { id: 2, email: 'caregiver@med.com', name: 'Caregiver' }
            })
          });
        }
        if (url.includes('/api/share/status')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              shareCode: 'INSU-CARER',
              members: [],
              sharedGroups: [{ ownerId: 1, ownerEmail: 'patient@home.com', ownerName: 'Patient' }]
            })
          });
        }
        if (url.includes('/api/logs')) {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        }
        if (url.includes('/api/telegram-configs')) {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Shared Data/i)).toBeInTheDocument();
        expect(screen.getByText(/My Data/i)).toBeInTheDocument();
      });

      // Switch to personal data
      const myDataBtn = screen.getByRole('radio', { name: /My Data/i });
      fireEvent.click(myDataBtn);

      expect(authService.getActiveContext()).toBe('personal');
    });

    it('renders Shared Access section in Settings tab with share code and future feature note', async () => {
      authService.setSession('test-token', { id: 1, email: 'owner@med.com' });

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              user: { id: 1, email: 'owner@med.com', name: 'Owner' }
            })
          });
        }
        if (url.includes('/api/share/status')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              shareCode: 'INSU-888999',
              members: [{ id: 5, email: 'carer@med.com', name: 'Nurse Joy' }],
              sharedGroups: []
            })
          });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [], configs: [] }) });
      });

      window.history.pushState({}, '', '/?tab=settings');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Shared Access \(Family & Party\)/i)).toBeInTheDocument();
        expect(screen.getByText('INSU-888999')).toBeInTheDocument();
        expect(screen.getByText('Nurse Joy')).toBeInTheDocument();
        expect(screen.getByText(/Currently supporting/i)).toBeInTheDocument();
        expect(screen.getByText(/Multiple concurrent shared accounts will be available in a future update/i)).toBeInTheDocument();
      });
    });

    it('auto-opens AuthModal in register mode when loading with ?shareCode=...', async () => {
      window.history.pushState({}, '', '/?shareCode=INSU-INVITE123');

      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, logs: [], configs: [] })
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('INSU-INVITE123')).toBeInTheDocument();
        expect(screen.getByText(/Create InsuMinder Account/i)).toBeInTheDocument();
      });
    });
    it('shows confirmation modal before removing a connected member and cancels or confirms', async () => {
      authService.setSession('test-token', { id: 1, email: 'owner@med.com' });

      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, user: { id: 1, email: 'owner@med.com', name: 'Owner' } })
          });
        }
        if (url.includes('/api/share/status')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              shareCode: 'INSU-111222',
              members: [{ id: 42, email: 'assistant@care.com', name: 'Dr. House' }],
              sharedGroups: []
            })
          });
        }
        if (url.includes('/api/share/members/42') && opts?.method === 'DELETE') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, message: 'Member removed.' })
          });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [], configs: [] }) });
      });

      window.history.pushState({}, '', '/?tab=settings');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Dr. House')).toBeInTheDocument();
      });

      // Click remove button on connected member
      const removeBtn = screen.getByRole('button', { name: /Remove member Dr\. House/i });
      fireEvent.click(removeBtn);

      // Verify confirmation modal opens
      expect(screen.getByRole('heading', { name: /Remove Connected Member\?/i })).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();

      // Test Cancel button dismisses modal
      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('heading', { name: /Remove Connected Member\?/i })).not.toBeInTheDocument();

      // Click remove again and Confirm
      fireEvent.click(removeBtn);
      const confirmRemoveBtn = screen.getByRole('button', { name: 'Remove Member' });
      fireEvent.click(confirmRemoveBtn);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/share/members/42', expect.objectContaining({
          method: 'DELETE'
        }));
      });
    });

    it('shows confirmation modal before leaving a shared account and cancels or confirms', async () => {
      authService.setSession('test-token', { id: 2, email: 'member@med.com' });

      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, user: { id: 2, email: 'member@med.com', name: 'Member' } })
          });
        }
        if (url.includes('/api/share/status')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              shareCode: 'INSU-333444',
              members: [],
              sharedGroups: [{ ownerId: 10, ownerEmail: 'patient@home.com', ownerName: 'Alice' }]
            })
          });
        }
        if (url.includes('/api/share/leave') && opts?.method === 'POST') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, message: 'Left shared group.' })
          });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [], configs: [] }) });
      });

      window.history.pushState({}, '', '/?tab=settings');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Click Leave button
      const leaveBtn = screen.getByRole('button', { name: /Leave/i });
      fireEvent.click(leaveBtn);

      // Verify confirmation modal opens
      expect(screen.getByRole('heading', { name: /Leave Shared Account\?/i })).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to leave the shared account belonging to/i)).toBeInTheDocument();

      // Test Cancel button dismisses modal
      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('heading', { name: /Leave Shared Account\?/i })).not.toBeInTheDocument();

      // Click leave again and Confirm
      fireEvent.click(leaveBtn);
      const confirmLeaveBtn = screen.getByRole('button', { name: 'Leave Account' });
      fireEvent.click(confirmLeaveBtn);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/share/leave', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ ownerId: 10 })
        }));
      });
    });

    it('opens Viewing explanation modal when clicking active Viewing button and allows switching to personal or dismissing', async () => {
      authService.setSession('test-token', { id: 3, email: 'member@med.com' });
      authService.setActiveContext('shared', 99);

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, user: { id: 3, email: 'member@med.com', name: 'Member' } })
          });
        }
        if (url.includes('/api/share/status')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              shareCode: 'INSU-999888',
              members: [],
              sharedGroups: [{ ownerId: 99, ownerEmail: 'google.user@insuminder.app', ownerName: 'Google User' }]
            })
          });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [], configs: [] }) });
      });

      window.history.pushState({}, '', '/?tab=settings');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Google User')).toBeInTheDocument();
      });

      // Find the active 'Viewing' button
      const viewingBtn = screen.getByRole('button', { name: 'Viewing' });
      expect(viewingBtn).toHaveClass('active');

      // Click Viewing button
      fireEvent.click(viewingBtn);

      // Verify explanation modal opens
      expect(screen.getByRole('heading', { name: /What does .*Viewing.* mean\?/i })).toBeInTheDocument();
      expect(screen.getByText(/You are currently viewing active records for/i)).toBeInTheDocument();
      expect(screen.getByText(/Injection History & Logs:/i)).toBeInTheDocument();
      expect(screen.getByText(/Scheduled Reminders:/i)).toBeInTheDocument();

      // Click 'Got it' to dismiss modal
      const gotItBtn = screen.getByRole('button', { name: 'Got it' });
      fireEvent.click(gotItBtn);
      expect(screen.queryByRole('heading', { name: /What does .*Viewing.* mean\?/i })).not.toBeInTheDocument();

      // Click again and test 'Switch to My Data'
      fireEvent.click(viewingBtn);
      const switchToMyDataBtn = screen.getByRole('button', { name: 'Switch to My Data' });
      fireEvent.click(switchToMyDataBtn);

      expect(screen.queryByRole('heading', { name: /What does .*Viewing.* mean\?/i })).not.toBeInTheDocument();
      expect(authService.getActiveContext()).toBe('personal');
    });
  });
});

