import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import UpdateBanner from '../UpdateBanner';
import { LanguageProvider } from '../i18n';
import * as pwaModule from '../pwa';

function renderWithProviders(ui) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('UpdateBanner Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('does not render on Web even when update is available', () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(false);
    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.1.0'
    };
    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb(mockUpdate);
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(mockUpdate);

    const { container } = renderWithProviders(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render on Android when no update is available', () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(true);
    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb({ updateAvailable: false });
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(null);

    const { container } = renderWithProviders(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders centered update modal with title, version, changelog, and centered buttons on Android', () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(true);
    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.2.0',
      versionsBehind: 1,
      isMandatory: false,
      changes: {
        en: [
          'Native Android APK live in-app updates',
          'Interactive update notification with changelog'
        ]
      }
    };

    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb(mockUpdate);
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(mockUpdate);

    renderWithProviders(<UpdateBanner />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('New Update Available')).toBeInTheDocument();
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
    expect(screen.getByText("What's new:")).toBeInTheDocument();
    expect(screen.getByText('Native Android APK live in-app updates')).toBeInTheDocument();
    expect(screen.getByText('Interactive update notification with changelog')).toBeInTheDocument();

    const updateBtn = screen.getByRole('button', { name: /Update Now/i });
    const laterBtn = screen.getByRole('button', { name: /Later/i });
    expect(updateBtn).toBeInTheDocument();
    expect(laterBtn).toBeInTheDocument();

    // Verify action container has centered styling class
    const actionsContainer = updateBtn.closest('.update-modal-actions');
    expect(actionsContainer).toBeInTheDocument();
  });

  it('dismisses modal to sessionStorage when Later button is clicked and does NOT pop up again in the same session', () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(true);
    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.2.0',
      versionsBehind: 1,
      isMandatory: false,
      changes: {
        en: ['Speed improvements']
      }
    };

    let pushCallback = null;
    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      pushCallback = cb;
      cb(mockUpdate);
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(mockUpdate);

    const { rerender } = renderWithProviders(<UpdateBanner />);
    expect(screen.getByText('New Update Available')).toBeInTheDocument();

    const laterBtn = screen.getByRole('button', { name: /Later/i });
    fireEvent.click(laterBtn);

    // Modal is now dismissed
    expect(screen.queryByText('New Update Available')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('insuminder_update_dismissed_version')).toBe('1.2.0');

    // Simulate tab visibility change / backgrounding and re-polling in same session
    if (pushCallback) {
      act(() => {
        pushCallback(mockUpdate);
      });
    }
    rerender(
      <LanguageProvider>
        <UpdateBanner />
      </LanguageProvider>
    );

    // Must NOT reappear while in same session (not killed / no re-login)
    expect(screen.queryByText('New Update Available')).not.toBeInTheDocument();
  });

  it('re-opens dismissed update modal after new/re-login event is fired', async () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(true);
    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.2.0',
      versionsBehind: 1,
      isMandatory: false,
      changes: {
        en: ['Speed improvements']
      }
    };

    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb(mockUpdate);
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(mockUpdate);

    renderWithProviders(<UpdateBanner />);
    expect(screen.getByText('New Update Available')).toBeInTheDocument();

    const laterBtn = screen.getByRole('button', { name: /Later/i });
    fireEvent.click(laterBtn);
    expect(screen.queryByText('New Update Available')).not.toBeInTheDocument();

    // Trigger re-login event
    sessionStorage.removeItem('insuminder_update_dismissed_version');
    act(() => {
      window.dispatchEvent(new CustomEvent('insuminder_update_reset_dismiss'));
    });

    await waitFor(() => {
      expect(screen.getByText('New Update Available')).toBeInTheDocument();
    });
  });

  it('invokes applyAppUpdate with progress callback when Update Now button is clicked and shows progress bar', async () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(true);
    const applySpy = vi.spyOn(pwaModule, 'applyAppUpdate').mockImplementation(async (version, onProgress) => {
      onProgress?.({ percent: 50, stage: 'downloading' });
      // keep it pending to inspect progress state
      await new Promise(() => {});
    });

    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.2.0',
      versionsBehind: 1,
      isMandatory: false,
      changes: {
        en: ['Speed improvements']
      }
    };

    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb(mockUpdate);
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(mockUpdate);

    renderWithProviders(<UpdateBanner />);

    // Verify scroll lock
    expect(document.body.classList.contains('modal-open')).toBe(true);

    const updateBtn = screen.getByRole('button', { name: /Update Now/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith('1.2.0', expect.any(Function));
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Downloading update...')).toBeInTheDocument();
    });
  });

  it('displays error container and allows retrying when applyAppUpdate fails', async () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(true);
    let attempt = 0;
    const applySpy = vi.spyOn(pwaModule, 'applyAppUpdate').mockImplementation(async () => {
      attempt++;
      if (attempt === 1) {
        throw new Error('Network timeout during download.');
      }
      return undefined;
    });

    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.2.0',
      versionsBehind: 1,
      isMandatory: false,
      changes: {
        en: ['Speed improvements']
      }
    };

    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb(mockUpdate);
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(mockUpdate);

    renderWithProviders(<UpdateBanner />);

    const updateBtn = screen.getByRole('button', { name: /Update Now/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Update Failed')).toBeInTheDocument();
      expect(screen.getByText('Network timeout during download.')).toBeInTheDocument();
    });

    // Tap retry button
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledTimes(2);
    });
  });

  it('renders mandatory blocking modal without dismiss or Later button when update is >= 3 updates behind', () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(true);
    const mandatoryUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.3.0',
      versionsBehind: 3,
      isMandatory: true,
      changes: {
        en: ['Mandatory security fix']
      }
    };

    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb(mandatoryUpdate);
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(mandatoryUpdate);

    renderWithProviders(<UpdateBanner />);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Update Required to Continue')).toBeInTheDocument();
    expect(screen.getByText(/Your Android app is 3 updates behind/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Later/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dismiss/i })).not.toBeInTheDocument();

    const updateBtn = screen.getByRole('button', { name: /Update Now/i });
    expect(updateBtn).toBeInTheDocument();

    // Verify clicking backdrop does not dismiss
    const overlay = screen.getByRole('alertdialog');
    fireEvent.click(overlay);
    expect(screen.getByText('Update Required to Continue')).toBeInTheDocument();
  });

  it('triggers update with progress bar when insuminder_trigger_update_flow event is dispatched', async () => {
    vi.spyOn(pwaModule, 'isAndroidApp').mockReturnValue(true);
    const applySpy = vi.spyOn(pwaModule, 'applyAppUpdate').mockImplementation(async (version, onProgress) => {
      onProgress?.({ percent: 75, stage: 'activating' });
      await new Promise(() => {});
    });

    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.4.0',
      newVersion: '1.5.0',
      versionsBehind: 1,
      isMandatory: false,
      changes: {
        en: ['Speed improvements']
      }
    };

    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb(mockUpdate);
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(mockUpdate);

    renderWithProviders(<UpdateBanner />);

    // Dismiss initial voluntary modal
    const laterBtn = screen.getByRole('button', { name: /Later/i });
    fireEvent.click(laterBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Dispatch trigger event from Settings
    window.dispatchEvent(new CustomEvent('insuminder_trigger_update_flow', { detail: { version: '1.5.0' } }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(applySpy).toHaveBeenCalledWith('1.5.0', expect.any(Function));
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Activating new version...')).toBeInTheDocument();
    });
  });
});
