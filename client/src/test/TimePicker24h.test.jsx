import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimePicker24h from '../TimePicker24h';

describe('TimePicker24h Component (Strictly 24-Hour, No AM/PM)', () => {
  it('renders initial 24-hour time formatted as HH:MM', () => {
    render(<TimePicker24h value="20:00" onChange={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /20:00/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('20:00');
    // Ensure no AM or PM text exists anywhere
    expect(screen.queryByText(/AM/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PM/i)).not.toBeInTheDocument();
  });

  it('opens 24-hour selection popover on trigger click', () => {
    render(<TimePicker24h value="21:30" onChange={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /21:30/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: /Choose 24-hour time/i })).toBeInTheDocument();
    expect(screen.getByText('HH (00-23)')).toBeInTheDocument();
    expect(screen.getByText('MM (00-59)')).toBeInTheDocument();

    // Verify 24-hour headers and items exist without AM/PM
    expect(screen.queryByText(/AM/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PM/i)).not.toBeInTheDocument();
  });

  it('adjusts hour and minute via steppers in 24-hour format', () => {
    const handleChange = vi.fn();
    render(<TimePicker24h value="20:00" onChange={handleChange} />);

    const trigger = screen.getByRole('button', { name: /20:00/i });
    fireEvent.click(trigger);

    const increaseHourBtn = screen.getByRole('button', { name: /Increase hour/i });
    fireEvent.click(increaseHourBtn);
    expect(handleChange).toHaveBeenCalledWith('21:00');

    const increaseMinuteBtn = screen.getByRole('button', { name: /Increase minute/i });
    fireEvent.click(increaseMinuteBtn);
    expect(handleChange).toHaveBeenCalledWith('20:05');
  });

  it('allows selecting preset times for evening basal injection', () => {
    const handleChange = vi.fn();
    render(<TimePicker24h value="20:00" onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button', { name: /20:00/i }));

    const preset22 = screen.getByRole('button', { name: '22:00' });
    fireEvent.click(preset22);

    expect(handleChange).toHaveBeenCalledWith('22:00');
  });

  it('allows clicking an hour in the 24-hour list (00-23)', () => {
    const handleChange = vi.fn();
    render(<TimePicker24h value="20:00" onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button', { name: /20:00/i }));

    // Find hour button '22' in the column
    const hourBtns = screen.getAllByRole('button', { name: '22' });
    expect(hourBtns.length).toBeGreaterThan(0);
    fireEvent.click(hourBtns[0]);

    expect(handleChange).toHaveBeenCalledWith('22:00');
  });

  it('closes popover on OK button click or Escape key', () => {
    render(<TimePicker24h value="20:00" onChange={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /20:00/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: /✓ OK/i });
    fireEvent.click(okBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reopen and close with Escape
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aligns the active number as the first of 4 in line for 20:00 and 21:14', () => {
    const { unmount } = render(<TimePicker24h value="20:00" onChange={vi.fn()} />);

    // Open for 20:00
    fireEvent.click(screen.getByRole('button', { name: /20:00/i }));

    const lists = document.querySelectorAll('.clock-col-list');
    expect(lists.length).toBe(2);

    // 48 + 20 = 68th index * 34 = 2312
    expect(lists[0].scrollTop).toBe((48 + 20) * 34);
    // 120 + 0 = 120th index * 34 = 4080
    expect(lists[1].scrollTop).toBe((120 + 0) * 34);

    unmount();

    // Now test with 21:14
    render(<TimePicker24h value="21:14" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /21:14/i }));

    const newLists = document.querySelectorAll('.clock-col-list');
    // 48 + 21 = 69th index * 34 = 2346
    expect(newLists[0].scrollTop).toBe((48 + 21) * 34);
    // 120 + 14 = 134th index * 34 = 4556
    expect(newLists[1].scrollTop).toBe((120 + 14) * 34);
  });

  it('supports triggerType="input" with unified text input and icon trigger', () => {
    const handleChange = vi.fn();
    render(
      <TimePicker24h
        id="custom-time-input"
        triggerType="input"
        value="10:34"
        onChange={handleChange}
        quickPresets={['09:34', '08:34', '07:34', '06:34']}
      />
    );

    // Verify input element is rendered
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('10:34');

    // Click icon to open popover
    const toggleBtn = screen.getByRole('button', { name: /Toggle 24-hour time picker/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByRole('dialog', { name: /Choose 24-hour time/i })).toBeInTheDocument();

    // Verify relative presets are rendered
    expect(screen.getByRole('button', { name: '09:34' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '08:34' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '07:34' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '06:34' })).toBeInTheDocument();

    // Select relative preset
    fireEvent.click(screen.getByRole('button', { name: '09:34' }));
    expect(handleChange).toHaveBeenCalledWith('09:34');
  });
});

