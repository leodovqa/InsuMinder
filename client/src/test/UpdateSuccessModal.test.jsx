import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateSuccessModal from '../UpdateSuccessModal';
import { LanguageProvider } from '../i18n';
import { resetBodyScrollLock } from '../useLockBodyScroll';

function renderWithProviders(ui) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('UpdateSuccessModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetBodyScrollLock();
    document.body.className = '';
  });

  it('renders celebration modal with title, version pill, and continue button', () => {
    renderWithProviders(<UpdateSuccessModal version="1.4.1" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: /Update Successful!/i })).toBeInTheDocument();
    expect(screen.getByText('Update Successful!')).toBeInTheDocument();
    expect(screen.getByText('v1.4.1')).toBeInTheDocument();
    expect(screen.getByText(/InsuMinder has been updated to the latest version/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to App/i })).toBeInTheDocument();
  });

  it('locks body scroll when modal is open and unlocks on unmount', () => {
    const { unmount } = renderWithProviders(<UpdateSuccessModal version="1.4.1" onClose={vi.fn()} />);
    expect(document.body.classList.contains('modal-open')).toBe(true);

    unmount();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('triggers onClose when clicking Continue to App button', () => {
    const handleClose = vi.fn();
    renderWithProviders(<UpdateSuccessModal version="1.4.1" onClose={handleClose} />);

    const continueBtn = screen.getByRole('button', { name: /Continue to App/i });
    fireEvent.click(continueBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when pressing Escape key', () => {
    const handleClose = vi.fn();
    renderWithProviders(<UpdateSuccessModal version="1.4.1" onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when clicking modal backdrop', () => {
    const handleClose = vi.fn();
    renderWithProviders(<UpdateSuccessModal version="1.4.1" onClose={handleClose} />);

    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('returns null and does not lock scroll if version is missing', () => {
    const { container } = renderWithProviders(<UpdateSuccessModal version={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
});

