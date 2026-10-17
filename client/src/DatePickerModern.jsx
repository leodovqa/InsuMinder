import { useState, useRef, useEffect } from 'react';
import { useTranslation } from './i18n';

/**
 * Modern DatePicker Component (Reusable across InsuMinder)
 *
 * Mandatory Standard:
 * - User-facing display and input format: DD/MM/YYYY (Day/Month/Year)
 * - Internal canonical serialization: YYYY-MM-DD (ISO 8601 standard)
 * - Popover calendar dialog styled with InsuMinder modern theme (Dark & Light)
 * - Full localization support (en, he, ru) for month names and weekday abbreviations
 * - Enforced min / max date bounds (e.g. past 1 month, no future dates)
 * - Quick "Today" jump and select button
 * - Click-outside and Escape key dismissal
 */

function formatIsoToDisplayDate(str) {
  if (!str) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return str;
}

function parseDisplayDateToIso(str) {
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const match = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3];
    return `${y}-${m}-${d}`;
  }
  return str;
}

export default function DatePickerModern({
  value = '',
  onChange,
  id = 'modern-date-picker',
  name,
  min,
  max,
  placeholder = 'DD/MM/YYYY',
  required = false,
  className = ''
}) {
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse YYYY-MM-DD or DD/MM/YYYY safely
  const parseDate = (str) => {
    if (!str) {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate()
      };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-').map(n => parseInt(n, 10));
      return { year: y, month: m - 1, day: d };
    }
    const match = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (match) {
      const [, d, m, y] = match.map(n => parseInt(n, 10));
      return { year: y, month: m - 1, day: d };
    }
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate()
    };
  };

  const parsedValue = parseDate(value);

  // User navigation override (null by default to track value's month & year)
  const [navOffset, setNavOffset] = useState({ year: null, month: null });

  const viewYear = navOffset.year !== null ? navOffset.year : parsedValue.year;
  const viewMonth = navOffset.month !== null ? navOffset.month : parsedValue.month;

  // Local text input state for seamless DD/MM/YYYY typing
  const [prevValue, setPrevValue] = useState(value);
  const [displayInput, setDisplayInput] = useState(() => formatIsoToDisplayDate(value));

  if (value !== prevValue) {
    setPrevValue(value);
    setDisplayInput(formatIsoToDisplayDate(value));
  }

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setNavOffset({ year: null, month: null });
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setNavOffset({ year: null, month: null });
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Navigate months
  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setNavOffset({ year: viewYear - 1, month: 11 });
    } else {
      setNavOffset({ year: viewYear, month: viewMonth - 1 });
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setNavOffset({ year: viewYear + 1, month: 0 });
    } else {
      setNavOffset({ year: viewYear, month: viewMonth + 1 });
    }
  };

  // Format month and year label localized
  const getMonthYearLabel = () => {
    try {
      const date = new Date(viewYear, viewMonth, 1);
      return new Intl.DateTimeFormat(language || 'en', {
        month: 'long',
        year: 'numeric'
      }).format(date);
    } catch {
      return `${viewYear}-${viewMonth + 1}`;
    }
  };

  // Localized weekdays (Su, Mo, Tu, We, Th, Fr, Sa)
  const getWeekdayLabels = () => {
    const labels = [];
    const baseSunday = new Date(2023, 0, 1); // Jan 1, 2023 was a Sunday
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseSunday);
      d.setDate(baseSunday.getDate() + i);
      try {
        labels.push(
          new Intl.DateTimeFormat(language || 'en', { weekday: 'short' }).format(d)
        );
      } catch {
        labels.push(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][i]);
      }
    }
    return labels;
  };

  // Days in current view month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun

  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  const handleSelectDay = (day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (min && dateStr < min) return;
    if (max && dateStr > max) return;
    if (onChange) {
      onChange(dateStr);
    }
    setDisplayInput(formatIsoToDisplayDate(dateStr));
    setIsOpen(false);
    setNavOffset({ year: null, month: null });
  };

  const handleTodayClick = () => {
    if (min && todayStr < min) return;
    if (max && todayStr > max) return;
    setNavOffset({ year: null, month: null });
    if (onChange) {
      onChange(todayStr);
    }
    setDisplayInput(formatIsoToDisplayDate(todayStr));
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const rawVal = e.target.value;
    setDisplayInput(rawVal);
    const isoVal = parseDisplayDateToIso(rawVal);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoVal)) {
      if (onChange) onChange(isoVal);
    } else if (rawVal === '') {
      if (onChange) onChange('');
    }
  };

  const handleInputBlur = () => {
    if (value) {
      setDisplayInput(formatIsoToDisplayDate(value));
    }
  };

  // Can we navigate back/forward?
  const isPrevDisabled = (() => {
    if (!min) return false;
    const prevMonthEnd = new Date(viewYear, viewMonth, 0); // last day of prev month
    const prevMonthEndStr = `${prevMonthEnd.getFullYear()}-${String(prevMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(prevMonthEnd.getDate()).padStart(2, '0')}`;
    return prevMonthEndStr < min;
  })();

  const isNextDisabled = (() => {
    if (!max) return false;
    const nextMonthStart = new Date(viewYear, viewMonth + 1, 1); // 1st day of next month
    const nextMonthStartStr = `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
    return nextMonthStartStr > max;
  })();

  return (
    <div className={`modern-datepicker-container ${className}`} ref={containerRef}>
      {/* Unified Input Trigger */}
      <div className={`datepicker-input-group ${isOpen ? 'is-focused' : ''}`}>
        <button
          type="button"
          className="datepicker-icon-btn"
          onClick={() => setIsOpen(prev => !prev)}
          aria-label="Open calendar"
          title="Open calendar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>

        <input
          id={id}
          name={name}
          type="text"
          className="form-input datepicker-text-input"
          value={displayInput}
          placeholder={placeholder}
          maxLength={10}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onClick={() => setIsOpen(true)}
          required={required}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          autoComplete="off"
        />

        <button
          type="button"
          className="datepicker-chevron-btn"
          onClick={() => setIsOpen(prev => !prev)}
          aria-label="Toggle calendar dropdown"
        >
          <span className="expand-arrow" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Popover Calendar Dialog */}
      {isOpen && (
        <div
          className="modern-datepicker-popover"
          role="dialog"
          aria-modal="true"
          aria-label="Choose date"
        >
          {/* Calendar Header */}
          <div className="datepicker-popover-header">
            <button
              type="button"
              className="datepicker-nav-btn prev-btn"
              onClick={goToPrevMonth}
              disabled={isPrevDisabled}
              aria-label="Previous month"
            >
              ◀
            </button>
            <div className="datepicker-month-year-label">
              {getMonthYearLabel()}
            </div>
            <button
              type="button"
              className="datepicker-nav-btn next-btn"
              onClick={goToNextMonth}
              disabled={isNextDisabled}
              aria-label="Next month"
            >
              ▶
            </button>
          </div>

          {/* Weekday Row */}
          <div className="datepicker-weekdays-row">
            {getWeekdayLabels().map((dayLabel, idx) => (
              <span key={idx} className="datepicker-weekday-cell">
                {dayLabel}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="datepicker-days-grid">
            {/* Empty prefix slots */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <span key={`empty-${idx}`} className="datepicker-day-cell empty" />
            ))}

            {/* Days of the Month */}
            {Array.from({ length: daysInMonth }, (_, idx) => {
              const day = idx + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = value === dateStr;
              const isToday = dateStr === todayStr;
              const isDisabled = (min && dateStr < min) || (max && dateStr > max);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  className={`datepicker-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(day)}
                  aria-label={dateStr}
                  aria-selected={isSelected}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts & Close */}
          <div className="datepicker-popover-footer">
            <button
              type="button"
              className="datepicker-footer-today-btn"
              onClick={handleTodayClick}
              disabled={(min && todayStr < min) || (max && todayStr > max)}
            >
              {t('time.today') || 'Today'}
            </button>
            <button
              type="button"
              className="datepicker-footer-close-btn"
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
