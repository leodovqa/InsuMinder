import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AndroidInstallModal from '../AndroidInstallModal';
import { LanguageProvider } from '../i18n';
import * as pwa from '../pwa';

describe('AndroidInstallModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <LanguageProvider>
        <AndroidInstallModal isOpen={false} onClose={() => {}} />
      </LanguageProvider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, badge, 3 installation steps, and guarantee when isOpen is true', () => {
    render(
      <LanguageProvider>
        <AndroidInstallModal isOpen={true} onClose={() => {}} />
      </LanguageProvider>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /InsuMinder for Android \(\.APK\)/i })).toBeInTheDocument();
    expect(screen.getByText(/Verified & Clean Android Package/i)).toBeInTheDocument();
    expect(screen.getByText(/Download Started/i)).toBeInTheDocument();

    expect(screen.getByText(/Download the APK/i)).toBeInTheDocument();
    expect(screen.getByText(/Open and Tap Install/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: /Allow Installation/i })).toBeInTheDocument();

    // Guarantee
    expect(screen.getByText(/Genuine, Safe & Automatic In-App Updates/i)).toBeInTheDocument();
  });

  it('toggles security and checksum verification details when clicking verify button', () => {
    render(
      <LanguageProvider>
        <AndroidInstallModal isOpen={true} onClose={() => {}} />
      </LanguageProvider>
    );

    const toggleBtn = screen.getByRole('button', { name: /Verify Integrity & Checksum/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.queryByText(/Cryptographic Signature: Android Scheme v2\/v3 Verified/i)).not.toBeInTheDocument();

    // Expand
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Cryptographic Signature: Android Scheme v2\/v3 Verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Audited Permissions: Internet Access Only/i)).toBeInTheDocument();
    expect(screen.getByText(/SHA-256 Checksum: Published on GitHub Release/i)).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggleBtn);
    expect(screen.queryByText(/Cryptographic Signature: Android Scheme v2\/v3 Verified/i)).not.toBeInTheDocument();
  });

  it('calls onClose when clicking close button or Got It button', () => {
    const onClose = vi.fn();

    render(
      <LanguageProvider>
        <AndroidInstallModal isOpen={true} onClose={onClose} />
      </LanguageProvider>
    );

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const gotItBtn = screen.getByRole('button', { name: 'Got It' });
    fireEvent.click(gotItBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();

    render(
      <LanguageProvider>
        <AndroidInstallModal isOpen={true} onClose={onClose} />
      </LanguageProvider>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers downloadAndroidApk when clicking download links/buttons inside modal', () => {
    const downloadSpy = vi.spyOn(pwa, 'downloadAndroidApk').mockImplementation(() => {});

    render(
      <LanguageProvider>
        <AndroidInstallModal isOpen={true} onClose={() => {}} />
      </LanguageProvider>
    );

    const manualLink = screen.getByText(/If your download did not start automatically/i);
    fireEvent.click(manualLink);
    expect(downloadSpy).toHaveBeenCalledTimes(1);

    const directBtn = screen.getByText(/Download InsuMinder\.apk/i);
    fireEvent.click(directBtn);
    expect(downloadSpy).toHaveBeenCalledTimes(2);
  });
});

