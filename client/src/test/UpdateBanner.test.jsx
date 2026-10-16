import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  });

  it('does not render when no update is available', () => {
    vi.spyOn(pwaModule, 'subscribeToAppUpdates').mockImplementation((cb) => {
      cb({ updateAvailable: false });
      return () => {};
    });
    vi.spyOn(pwaModule, 'checkForAppUpdate').mockResolvedValue(null);

    const { container } = renderWithProviders(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders update title, version, and what changed list when update is available', () => {
    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.1.0',
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

    expect(screen.getByText('New Update Available')).toBeInTheDocument();
    expect(screen.getByText('v1.1.0')).toBeInTheDocument();
    expect(screen.getByText("What's new:")).toBeInTheDocument();
    expect(screen.getByText('Native Android APK live in-app updates')).toBeInTheDocument();
    expect(screen.getByText('Interactive update notification with changelog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Later/i })).toBeInTheDocument();
  });

  it('dismisses banner when Later or Close button is clicked', () => {
    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.1.0',
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
  });

  it('invokes applyAppUpdate when Update Now button is clicked', async () => {
    const applySpy = vi.spyOn(pwaModule, 'applyAppUpdate').mockResolvedValue(undefined);

    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      newVersion: '1.1.0',
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
      expect(applySpy).toHaveBeenCalledWith('1.1.0');
    });
  });

  it('renders blocking overlay without dismiss or Later button when update is mandatory (>= 3 updates behind on Android)', () => {
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
  });
});

