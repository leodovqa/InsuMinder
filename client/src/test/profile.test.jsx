import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profile from '../Profile';
import { authService } from '../authService';

describe('Profile Component Tests', () => {
  const mockUser = {
    id: 1,
    email: 'patient@example.com',
    name: 'Test Name Test Last Name',
    firstName: 'Test Name',
    lastName: 'Test Last Name',
    phone: '972527654321',
    shareCode: 'INSU-TEST12'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pre-filled user values in disabled inputs initially', () => {
    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const phoneInput = screen.getByLabelText(/Phone Number/i);

    expect(firstNameInput).toHaveValue('Test Name');
    expect(lastNameInput).toHaveValue('Test Last Name');
    expect(phoneInput).toHaveValue('972527654321');

    // Inputs must be disabled initially
    expect(firstNameInput).toBeDisabled();
    expect(lastNameInput).toBeDisabled();
    expect(phoneInput).toBeDisabled();

    // Edit button is shown, Save button is not
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument();
  });

  it('enables inputs and shows Save/Cancel buttons when clicking Edit', () => {
    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    const editBtn = screen.getByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtn);

    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const phoneInput = screen.getByLabelText(/Phone Number/i);

    // Inputs become enabled
    expect(firstNameInput).not.toBeDisabled();
    expect(lastNameInput).not.toBeDisabled();
    expect(phoneInput).not.toBeDisabled();

    // Save button appears, Edit button disappears
    expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
  });

  it('reverts changes and disables inputs again when clicking Cancel', () => {
    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    // Click Edit
    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));

    const firstNameInput = screen.getByLabelText(/First Name/i);
    fireEvent.change(firstNameInput, { target: { value: 'Modified Name' } });
    expect(firstNameInput).toHaveValue('Modified Name');

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    // Reverts to original value and disables
    expect(firstNameInput).toHaveValue('Test Name');
    expect(firstNameInput).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument();
  });

  it('saves updated profile values and switches back to disabled view mode', async () => {
    const onUpdateUser = vi.fn();
    const updatedUser = {
      ...mockUser,
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '972501234567'
    };

    vi.spyOn(authService, 'updateProfile').mockResolvedValueOnce({
      success: true,
      user: updatedUser
    });

    render(
      <Profile
        user={mockUser}
        onUpdateUser={onUpdateUser}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    // Open edit mode
    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));

    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const phoneInput = screen.getByLabelText(/Phone Number/i);

    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(phoneInput, { target: { value: '12025550123' } });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(authService.updateProfile).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '12025550123'
      });
    });

    await waitFor(() => {
      expect(onUpdateUser).toHaveBeenCalledWith(updatedUser);
      // Switches back to disabled mode
      expect(firstNameInput).toBeDisabled();
      expect(screen.getByRole('button', { name: /^Edit$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Profile updated successfully!/i)).toBeInTheDocument();
    });
  });

  it('shows inline error below first name on Save if less than 2 characters', async () => {
    const updateSpy = vi.spyOn(authService, 'updateProfile');
    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
    const firstNameInput = screen.getByLabelText(/First Name/i);
    fireEvent.change(firstNameInput, { target: { value: 'A' } });

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    expect(screen.getByText(/First name must be at least 2 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/Last name must be at least 2 characters/i)).not.toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('shows inline error below last name on Save if less than 2 characters', async () => {
    const updateSpy = vi.spyOn(authService, 'updateProfile');
    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    fireEvent.change(lastNameInput, { target: { value: 'B' } });

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText(/Last name must be at least 2 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/First name must be at least 2 characters/i)).not.toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('shows inline errors below BOTH inputs if both have less than 2 characters', async () => {
    const updateSpy = vi.spyOn(authService, 'updateProfile');
    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: ' ' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'X' } });

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(screen.getByText(/First name must be at least 2 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/Last name must be at least 2 characters/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // Typing at least 2 characters clears the error
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Alex' } });
    expect(screen.queryByText(/First name must be at least 2 characters/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Last name must be at least 2 characters/i)).toBeInTheDocument();
  });

  it('allows saving with empty phone because phone is optional', async () => {
    const onUpdateUser = vi.fn();
    vi.spyOn(authService, 'updateProfile').mockResolvedValueOnce({
      success: true,
      user: { ...mockUser, phone: '' }
    });

    render(
      <Profile
        user={mockUser}
        onUpdateUser={onUpdateUser}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(authService.updateProfile).toHaveBeenCalledWith({
        firstName: 'Test Name',
        lastName: 'Test Last Name',
        phone: ''
      });
    });
  });

  it('validates invalid non-empty phone and shows inline error on Save', async () => {
    const updateSpy = vi.spyOn(authService, 'updateProfile');
    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
    const phoneInput = screen.getByLabelText(/Phone Number/i);
    fireEvent.change(phoneInput, { target: { value: '9721235315' } }); // invalid Israeli phone

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(screen.getByText(/Invalid phone number/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('shows error banner when backend update fails', async () => {
    vi.spyOn(authService, 'updateProfile').mockResolvedValueOnce({
      success: false,
      error: 'Database connection failed.'
    });

    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Database connection failed/i);
    });
  });

  it('strips numbers and unrelated symbols from first and last names allowing only letters and name characters', () => {
    render(
      <Profile
        user={mockUser}
        onUpdateUser={vi.fn()}
        isLoggedIn={true}
        onOpenLogin={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));

    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);

    // Try typing numbers and symbols
    fireEvent.change(firstNameInput, { target: { value: 'Jane123!@#$%' } });
    expect(firstNameInput).toHaveValue('Jane');

    // Preserves letters, spaces, hyphens, and apostrophes
    fireEvent.change(lastNameInput, { target: { value: "O'Connor-Smith 99!" } });
    expect(lastNameInput).toHaveValue("O'Connor-Smith ");
  });

  it('shows account required card when user is logged out', () => {
    const onOpenLogin = vi.fn();
    render(
      <Profile
        user={null}
        onUpdateUser={vi.fn()}
        isLoggedIn={false}
        onOpenLogin={onOpenLogin}
      />
    );

    expect(screen.getByText(/Account Required/i)).toBeInTheDocument();
    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(signInBtn);
    expect(onOpenLogin).toHaveBeenCalled();
  });
});
