import { useState, useRef, useEffect } from 'react';

/**
 * Modern 24-Hour Clock Picker (Strictly 24-Hour, Zero AM/PM)
 *
 * Supports:
 * - 24-Hour display format HH:MM (00:00 - 23:59)
 * - Interactive step buttons (▲ / ▼) for hour and minute
 * - Two-column scrollable selector for hours (00-23) and minutes (00-59)
 * - Quick preset buttons (20:00, 21:00, 22:00, 23:00)
 * - Click-outside and Escape key dismissal
 */
const ITEM_HEIGHT = 34; // Exact height per item (4 items = 136px)

export default function TimePicker24h({ value = '20:00', onChange, id = 'basal-time-picker' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const hoursListRef = useRef(null);
  const minutesListRef = useRef(null);
  const prevOpenRef = useRef(false);

  // Normalize initial value
  const parseTime = (timeStr) => {
    if (!timeStr || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
      return { hour: 20, minute: 0 };
    }
    const [h, m] = timeStr.split(':').map(n => parseInt(n, 10));
    return { hour: h, minute: m };
  };

  const { hour: currentHour, minute: currentMinute } = parseTime(value);

  const format2Digits = (n) => String(n).padStart(2, '0');

  const updateTime = (newH, newM) => {
    const safeH = Math.max(0, Math.min(23, newH));
    const safeM = Math.max(0, Math.min(59, newM));
    const formatted = `${format2Digits(safeH)}:${format2Digits(safeM)}`;
    if (onChange) {
      onChange(formatted);
    }
  };

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const scrollColumnTo = (listEl, targetTop, smooth = false) => {
    if (!listEl) return;
    if (smooth && typeof listEl.scrollTo === 'function') {
      try {
        listEl.scrollTo({ top: targetTop, behavior: 'smooth' });
        return;
      } catch {
        // fallback
      }
    }
    listEl.scrollTop = targetTop;
  };

  // Scroll so active item is the FIRST of 4 visible items in line
  useEffect(() => {
    if (isOpen) {
      const isInitial = !prevOpenRef.current;
      prevOpenRef.current = true;

      // 5 cycles: Cycle 2 is center cycle (starts at 48 for hours, 120 for minutes)
      const targetH = (48 + currentHour) * ITEM_HEIGHT;
      const targetM = (120 + currentMinute) * ITEM_HEIGHT;

      scrollColumnTo(hoursListRef.current, targetH, !isInitial);
      scrollColumnTo(minutesListRef.current, targetM, !isInitial);

      let rafId;
      if (isInitial) {
        rafId = requestAnimationFrame(() => {
          scrollColumnTo(hoursListRef.current, targetH, false);
          scrollColumnTo(minutesListRef.current, targetM, false);
        });
      }

      return () => {
        if (rafId) cancelAnimationFrame(rafId);
      };
    } else {
      prevOpenRef.current = false;
    }
  }, [isOpen, currentHour, currentMinute]);

  // Seamless infinite loop scroll bounds for hours
  const handleHoursScroll = () => {
    if (!hoursListRef.current) return;
    const st = hoursListRef.current.scrollTop;
    const cycleHeight = 24 * ITEM_HEIGHT; // 816px
    if (st < cycleHeight) {
      hoursListRef.current.scrollTop = st + cycleHeight * 2;
    } else if (st > cycleHeight * 3) {
      hoursListRef.current.scrollTop = st - cycleHeight * 2;
    }
  };

  // Seamless infinite loop scroll bounds for minutes
  const handleMinutesScroll = () => {
    if (!minutesListRef.current) return;
    const st = minutesListRef.current.scrollTop;
    const cycleHeight = 60 * ITEM_HEIGHT; // 2040px
    if (st < cycleHeight) {
      minutesListRef.current.scrollTop = st + cycleHeight * 2;
    } else if (st > cycleHeight * 3) {
      minutesListRef.current.scrollTop = st - cycleHeight * 2;
    }
  };

  // 5 cycles (120 items for hours, 300 items for minutes) to provide seamless cyclic scrolling
  const hoursArray = Array.from({ length: 120 }, (_, i) => i % 24);
  const minutesArray = Array.from({ length: 300 }, (_, i) => i % 60);

  const quickPresets = ['20:00', '21:00', '22:00', '23:00'];

  return (
    <div className="clock-picker-container" ref={containerRef}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        className={`clock-picker-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Time: ${value} (24-hour)`}
        title="Click to select 24-hour time"
      >
        <span className="clock-trigger-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <span className="clock-trigger-value" dir="ltr">
          {format2Digits(currentHour)}:{format2Digits(currentMinute)}
        </span>
        <span className="clock-trigger-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="clock-picker-popover" role="dialog" aria-modal="true" aria-label="Choose 24-hour time">
          {/* Top Display & Steppers */}
          <div className="clock-steppers-row" dir="ltr">
            {/* Hour Block */}
            <div className="clock-stepper-unit">
              <button
                type="button"
                className="clock-stepper-btn"
                onClick={() => updateTime((currentHour + 1) % 24, currentMinute)}
                aria-label="Increase hour"
              >
                ▲
              </button>
              <div className="clock-display-digit">{format2Digits(currentHour)}</div>
              <button
                type="button"
                className="clock-stepper-btn"
                onClick={() => updateTime((currentHour - 1 + 24) % 24, currentMinute)}
                aria-label="Decrease hour"
              >
                ▼
              </button>
            </div>

            <div className="clock-colon">:</div>

            {/* Minute Block */}
            <div className="clock-stepper-unit">
              <button
                type="button"
                className="clock-stepper-btn"
                onClick={() => updateTime(currentHour, (currentMinute + 5) % 60)}
                aria-label="Increase minute"
              >
                ▲
              </button>
              <div className="clock-display-digit">{format2Digits(currentMinute)}</div>
              <button
                type="button"
                className="clock-stepper-btn"
                onClick={() => updateTime(currentHour, (currentMinute - 5 + 60) % 60)}
                aria-label="Decrease minute"
              >
                ▼
              </button>
            </div>
          </div>

          {/* Dual Scroll Columns: Hours & Minutes (4 visible items per column) */}
          <div className="clock-columns-wrapper" dir="ltr">
            {/* Hours Column */}
            <div className="clock-col">
              <div className="clock-col-header">HH (00-23)</div>
              <div
                className="clock-col-list"
                ref={hoursListRef}
                onScroll={handleHoursScroll}
              >
                {hoursArray.map((h, i) => (
                  <button
                    key={`h-${i}`}
                    type="button"
                    className={`clock-col-item ${h === currentHour ? 'active' : ''}`}
                    onClick={() => updateTime(h, currentMinute)}
                  >
                    {format2Digits(h)}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Column */}
            <div className="clock-col">
              <div className="clock-col-header">MM (00-59)</div>
              <div
                className="clock-col-list"
                ref={minutesListRef}
                onScroll={handleMinutesScroll}
              >
                {minutesArray.map((m, i) => (
                  <button
                    key={`m-${i}`}
                    type="button"
                    className={`clock-col-item ${m === currentMinute ? 'active' : ''}`}
                    onClick={() => updateTime(currentHour, m)}
                  >
                    {format2Digits(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Presets for Evening/Night Basal Injections */}
          <div className="clock-presets-row" dir="ltr">
            {quickPresets.map(preset => (
              <button
                key={preset}
                type="button"
                className={`clock-preset-btn ${value === preset ? 'active' : ''}`}
                onClick={() => {
                  const { hour: ph, minute: pm } = parseTime(preset);
                  updateTime(ph, pm);
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Close button */}
          <div className="clock-popover-footer">
            <button
              type="button"
              className="clock-done-btn"
              onClick={() => setIsOpen(false)}
            >
              ✓ OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

