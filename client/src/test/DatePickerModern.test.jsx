import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DatePickerModern from '../DatePickerModern';
import { LanguageProvider } from '../i18n';

function renderWithLang(ui, lang = 'en') {
  return render(
    <LanguageProvider initialLanguage={lang}>
      {ui}
    </LanguageProvider>
  );
}

describe('DatePickerModern Component', () => {
  it('renders initial date value in input field formatted as DD/MM/YYYY', () => {
    renderWithLang(<DatePickerModern value="2026-10-17" onChange={vi.fn()} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('17/10/2026');
    expect(input).toHaveAttribute('placeholder', 'DD/MM/YYYY');
  });

  it('allows user to type date in DD/MM/YYYY format and triggers onChange with ISO format', () => {
    const handleChange = vi.fn();
    renderWithLang(<DatePickerModern value="2026-10-17" onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '18/10/2026' } });

    expect(handleChange).toHaveBeenCalledWith('2026-10-18');
  });

  it('opens calendar popover when clicking calendar icon button', () => {
    renderWithLang(<DatePickerModern value="2026-10-17" onChange={vi.fn()} />);

    const openBtn = screen.getByRole('button', { name: /Open calendar/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole('dialog', { name: /Choose date/i })).toBeInTheDocument();
    expect(screen.getByText(/October 2026/i)).toBeInTheDocument();
  });

  it('allows navigating to previous and next months', () => {
    renderWithLang(<DatePickerModern value="2026-10-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Open calendar/i }));

    const prevBtn = screen.getByRole('button', { name: /Previous month/i });
    const nextBtn = screen.getByRole('button', { name: /Next month/i });

    // Navigate to September 2026
    fireEvent.click(prevBtn);
    expect(screen.getByText(/September 2026/i)).toBeInTheDocument();

    // Navigate to November 2026
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByText(/November 2026/i)).toBeInTheDocument();
  });

  it('selects a day and calls onChange with formatted date YYYY-MM-DD', () => {
    const handleChange = vi.fn();
    renderWithLang(<DatePickerModern value="2026-10-17" onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Open calendar/i }));

    const day15Btn = screen.getByRole('button', { name: '2026-10-15' });
    fireEvent.click(day15Btn);

    expect(handleChange).toHaveBeenCalledWith('2026-10-15');
    // Popover should close upon selection
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables dates outside min and max boundaries', () => {
    const handleChange = vi.fn();
    renderWithLang(
      <DatePickerModern
        value="2026-10-15"
        min="2026-10-10"
        max="2026-10-20"
        onChange={handleChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open calendar/i }));

    // Day 5 is before min (2026-10-10) -> disabled
    const day5Btn = screen.getByRole('button', { name: '2026-10-05' });
    expect(day5Btn).toBeDisabled();

    // Day 25 is after max (2026-10-20) -> disabled
    const day25Btn = screen.getByRole('button', { name: '2026-10-25' });
    expect(day25Btn).toBeDisabled();

    // Day 12 is within bounds -> enabled
    const day12Btn = screen.getByRole('button', { name: '2026-10-12' });
    expect(day12Btn).not.toBeDisabled();
    fireEvent.click(day12Btn);
    expect(handleChange).toHaveBeenCalledWith('2026-10-12');
  });

  it('closes popover on Escape key and OK button', () => {
    renderWithLang(<DatePickerModern value="2026-10-17" onChange={vi.fn()} />);

    const openBtn = screen.getByRole('button', { name: /Open calendar/i });
    fireEvent.click(openBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: /✓ OK/i });
    fireEvent.click(okBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reopen and test Escape key
    fireEvent.click(openBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders and parses dates using custom dateFormat MM/DD/YYYY', () => {
    const handleChange = vi.fn();
    renderWithLang(
      <DatePickerModern
        value="2026-10-17"
        dateFormat="MM/DD/YYYY"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('10/17/2026');
    expect(input).toHaveAttribute('placeholder', 'MM/DD/YYYY');

    fireEvent.change(input, { target: { value: '11/05/2026' } });
    expect(handleChange).toHaveBeenCalledWith('2026-11-05');
  });

  it('renders and parses dates using custom dateFormat YYYY-MM-DD', () => {
    const handleChange = vi.fn();
    renderWithLang(
      <DatePickerModern
        value="2026-10-17"
        dateFormat="YYYY-MM-DD"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('2026-10-17');
    expect(input).toHaveAttribute('placeholder', 'YYYY-MM-DD');

    fireEvent.change(input, { target: { value: '2026-12-25' } });
    expect(handleChange).toHaveBeenCalledWith('2026-12-25');
  });
});