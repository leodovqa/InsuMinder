import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from './i18n';
import { authService } from './authService';

const LOCAL_STORAGE_SAVED_FOODS_KEY = 'insuminder_saved_foods';

export default function CarbCalculator({ onNotify }) {
  const { t } = useTranslation();

  // Calculator inputs
  const [carbsPer100g, setCarbsPer100g] = useState('');
  const [portionWeight, setPortionWeight] = useState('');
  const [activeItem, setActiveItem] = useState(null);

  // Save food form
  const [foodName, setFoodName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Saved foods list & search
  const [savedFoods, setSavedFoods] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SAVED_FOODS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [foodToDelete, setFoodToDelete] = useState(null);

  const portionInputRef = useRef(null);
  const calcTopRef = useRef(null);

  // Fetch saved foods from server if authenticated
  useEffect(() => {
    let isMounted = true;
    const token = authService.getToken();

    if (token) {
      fetch('/api/foods?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data && Array.isArray(data.foods)) {
            setSavedFoods(data.foods);
            try {
              localStorage.setItem(LOCAL_STORAGE_SAVED_FOODS_KEY, JSON.stringify(data.foods));
            } catch {
              // ignore
            }
          }
        })
        .catch((err) => {
          console.warn('[CarbCalculator] Error fetching saved foods:', err);
        })
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync to localStorage
  const updateSavedFoodsState = (newList) => {
    setSavedFoods(newList);
    try {
      localStorage.setItem(LOCAL_STORAGE_SAVED_FOODS_KEY, JSON.stringify(newList));
    } catch {
      // ignore
    }
  };

  // Calculation Logic
  const parsedCarbs = parseFloat(carbsPer100g);
  const parsedPortion = parseFloat(portionWeight);
  const hasValidInputs = !isNaN(parsedCarbs) && parsedCarbs >= 0 && !isNaN(parsedPortion) && parsedPortion > 0;

  const totalCarbs = useMemo(() => {
    if (!hasValidInputs) return null;
    const result = (parsedCarbs * parsedPortion) / 100;
    // Format to 1 decimal place, e.g. 35 or 8.8
    return Math.round(result * 10) / 10;
  }, [hasValidInputs, parsedCarbs, parsedPortion]);

  // Handle preset quick portion buttons
  const handleQuickPortion = (grams) => {
    setPortionWeight(String(grams));
  };

  // Clear inputs
  const handleClear = () => {
    setCarbsPer100g('');
    setPortionWeight('');
    setActiveItem(null);
  };

  // Select a saved food
  const handleSelectFood = (food) => {
    setActiveItem(food);
    setCarbsPer100g(String(food.carbs_per_100g));
    if (portionInputRef.current && typeof portionInputRef.current.focus === 'function') {
      portionInputRef.current.focus();
    }
    // Scroll smoothly to calculator card
    if (calcTopRef.current && typeof calcTopRef.current.scrollIntoView === 'function') {
      calcTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleDeselectFood = () => {
    setActiveItem(null);
  };

  // Save food handler
  const handleSaveFood = async (e) => {
    if (e) e.preventDefault();
    const trimmed = foodName.trim();
    const carbsVal = parseFloat(carbsPer100g);

    if (!trimmed) {
      if (typeof onNotify === 'function') {
        onNotify({ type: 'warning', message: `${t('calculator.foodNameLabel')} is required` });
      }
      return;
    }
    if (isNaN(carbsVal) || carbsVal < 0) {
      if (typeof onNotify === 'function') {
        onNotify({ type: 'warning', message: `${t('calculator.carbsPer100gLabel')} must be a valid number` });
      }
      return;
    }

    setIsSaving(true);

    const token = authService.getToken();

    if (token) {
      try {
        const res = await fetch('/api/foods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ name: trimmed, carbsPer100g: carbsVal })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.food) {
          const updated = [data.food, ...savedFoods.filter((f) => f.id !== data.food.id)];
          updateSavedFoodsState(updated);
          setActiveItem(data.food);
          setFoodName('');
          if (typeof onNotify === 'function') {
            onNotify({ type: 'success', message: t('calculator.savedSuccess') });
          }
        } else {
          if (typeof onNotify === 'function') {
            onNotify({ type: 'warning', message: data.error || 'Failed to save item.' });
          }
        }
      } catch (err) {
        if (typeof onNotify === 'function') {
          onNotify({ type: 'warning', message: err.message || 'Network error saving item.' });
        }
      } finally {
        setIsSaving(false);
      }
    } else {
      // Offline / guest save to localStorage
      const newFood = {
        id: Date.now(),
        name: trimmed,
        carbs_per_100g: carbsVal,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const updated = [newFood, ...savedFoods];
      updateSavedFoodsState(updated);
      setActiveItem(newFood);
      setFoodName('');
      if (typeof onNotify === 'function') {
        onNotify({ type: 'success', message: t('calculator.savedSuccess') });
      }
      setIsSaving(false);
    }
  };

  // Delete food handler
  const handleConfirmDelete = async () => {
    if (!foodToDelete) return;
    const foodId = foodToDelete.id;
    const token = authService.getToken();

    if (token && typeof foodId === 'number' && foodId < 1000000000000) {
      try {
        await fetch(`/api/foods/${foodId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.warn('[CarbCalculator] Delete error:', err);
      }
    }

    const updated = savedFoods.filter((f) => f.id !== foodId);
    updateSavedFoodsState(updated);
    if (activeItem && activeItem.id === foodId) {
      setActiveItem(null);
    }
    setFoodToDelete(null);
    if (typeof onNotify === 'function') {
      onNotify({ type: 'success', message: t('calculator.deletedSuccess') });
    }
  };

  // Filtered & displayed saved foods
  const filteredFoods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      // Max 20 latest items when not searching
      return savedFoods.slice(0, 20);
    }
    return savedFoods.filter((f) => f.name && f.name.toLowerCase().includes(q));
  }, [savedFoods, searchQuery]);

  const quickPortionChips = [50, 75, 100, 125, 150, 200, 250, 300];

  return (
    <section className="tab-view carb-calculator-view" aria-label={t('calculator.title')}>
      <div className="carb-calc-container" ref={calcTopRef}>
        {/* Header / Subtitle */}
        <div className="carb-calc-header">
          <div className="carb-calc-header-icon-wrapper" aria-hidden="true">
            <span className="carb-calc-header-icon">🧮</span>
          </div>
          <div className="carb-calc-header-text">
            <h2 className="carb-calc-title">{t('calculator.title')}</h2>
            <p className="carb-calc-subtitle">{t('calculator.subtitle')}</p>
          </div>
        </div>

        {/* 1. Main Calculation Card */}
        <div className="carb-calc-card">
          <div className="calc-card-header">
            <div className="calc-card-title-row">
              <span className="calc-card-icon" aria-hidden="true">⚖️</span>
              <h3 className="calc-card-title">{t('calculator.calculatorCardTitle')}</h3>
            </div>
            {(carbsPer100g || portionWeight) && (
              <button
                type="button"
                className="calc-clear-btn"
                onClick={handleClear}
                title={t('calculator.clearBtn')}
              >
                {t('calculator.clearBtn')}
              </button>
            )}
          </div>

          {/* Active Selected Food Badge */}
          {activeItem && (
            <div className="calc-active-food-banner">
              <span className="active-food-icon" aria-hidden="true">🏷️</span>
              <span className="active-food-text">
                {t('calculator.activeItemBadge', {
                  name: activeItem.name,
                  carbs: activeItem.carbs_per_100g
                })}
              </span>
              <button
                type="button"
                className="active-food-deselect-btn"
                onClick={handleDeselectFood}
                title={t('calculator.clearSelection')}
                aria-label={t('calculator.clearSelection')}
              >
                ✕
              </button>
            </div>
          )}

          {/* Inputs Row */}
          <div className="calc-inputs-grid">
            {/* Input 1: Carbs per 100g */}
            <div className="calc-input-group">
              <label htmlFor="input-carbs-100g" className="calc-input-label">
                {t('calculator.carbsPer100gLabel')}
              </label>
              <div className="calc-input-wrapper">
                <input
                  id="input-carbs-100g"
                  type="number"
                  step="any"
                  min="0"
                  max="1000"
                  inputMode="decimal"
                  className="calc-input"
                  placeholder={t('calculator.carbsPer100gPlaceholder')}
                  value={carbsPer100g}
                  onChange={(e) => {
                    setCarbsPer100g(e.target.value);
                    if (activeItem && String(activeItem.carbs_per_100g) !== e.target.value) {
                      setActiveItem(null);
                    }
                  }}
                />
                <span className="calc-input-badge">g / 100g</span>
              </div>
            </div>

            {/* Input 2: Meal Portion Weight */}
            <div className="calc-input-group">
              <label htmlFor="input-portion-weight" className="calc-input-label">
                {t('calculator.portionWeightLabel')}
              </label>
              <div className="calc-input-wrapper">
                <input
                  id="input-portion-weight"
                  ref={portionInputRef}
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  className="calc-input"
                  placeholder={t('calculator.portionWeightPlaceholder')}
                  value={portionWeight}
                  onChange={(e) => setPortionWeight(e.target.value)}
                />
                <span className="calc-input-badge">{t('calculator.gramsUnit')}</span>
              </div>
            </div>
          </div>

          {/* Quick Portion Chips */}
          <div className="calc-quick-chips-wrapper">
            <span className="quick-chips-label">{t('calculator.quickPortions')}:</span>
            <div className="calc-quick-chips">
              {quickPortionChips.map((grams) => (
                <button
                  key={grams}
                  type="button"
                  className={`calc-chip-btn ${portionWeight === String(grams) ? 'active' : ''}`}
                  onClick={() => handleQuickPortion(grams)}
                >
                  {grams}g
                </button>
              ))}
            </div>
          </div>

          {/* Calculated Result Hero Box */}
          <div className={`calc-result-hero ${hasValidInputs ? 'has-result' : 'empty'}`}>
            {hasValidInputs ? (
              <div className="result-hero-content">
                <div className="result-hero-top">
                  <span className="result-hero-label">{t('calculator.totalCarbsResult')}</span>
                  <div className="result-hero-digits-row">
                    <span className="result-hero-value">{totalCarbs}</span>
                    <span className="result-hero-unit">g carbs</span>
                  </div>
                </div>
                <div className="result-hero-formula" dir="ltr">
                  {t('calculator.formulaBreakdown', {
                    carbs: parsedCarbs,
                    weight: parsedPortion,
                    total: totalCarbs
                  })}
                </div>
              </div>
            ) : (
              <div className="result-hero-placeholder">
                <span className="placeholder-icon" aria-hidden="true">💡</span>
                <span className="placeholder-text">
                  {carbsPer100g && !portionWeight
                    ? 'Enter portion weight in grams above to see total carbs'
                    : 'Enter carbs per 100g and your meal weight in grams'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Save Food to Database Card */}
        <div className="carb-save-card">
          <div className="carb-save-header">
            <span className="carb-save-icon" aria-hidden="true">💾</span>
            <div className="carb-save-text">
              <h3 className="carb-save-title">{t('calculator.saveFoodTitle')}</h3>
              <p className="carb-save-subtitle">{t('calculator.saveFoodSubtitle')}</p>
            </div>
          </div>

          <form className="carb-save-form" onSubmit={handleSaveFood}>
            <div className="carb-save-inputs-row">
              <div className="carb-save-name-group">
                <label htmlFor="food-name-input" className="calc-input-label">
                  {t('calculator.foodNameLabel')}
                </label>
                <input
                  id="food-name-input"
                  type="text"
                  maxLength={100}
                  className="calc-input"
                  placeholder={t('calculator.foodNamePlaceholder')}
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                />
              </div>

              <div className="carb-save-carbs-group">
                <label className="calc-input-label">{t('calculator.carbsPer100gLabel')}</label>
                <div className="calc-input-wrapper">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="1000"
                    inputMode="decimal"
                    className="calc-input"
                    placeholder="e.g. 25"
                    value={carbsPer100g}
                    onChange={(e) => setCarbsPer100g(e.target.value)}
                  />
                  <span className="calc-input-badge">g</span>
                </div>
              </div>
            </div>



            <div className="carb-save-action-row">
              <button
                type="submit"
                className="push-action-btn btn-primary carb-save-submit-btn"
                disabled={isSaving || !foodName.trim() || !carbsPer100g}
                onClick={handleSaveFood}
              >
                {isSaving ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>{t('calculator.savingFood')}</span>
                  </span>
                ) : (
                  <span className="btn-icon-label-group">
                    <svg
                      className="btn-icon-svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="btn-text-label">{t('calculator.saveFoodBtn')}</span>
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 3. Saved Foods List & Search Card */}
        <div className="saved-foods-card">
          <div className="saved-foods-header">
            <div className="saved-foods-title-row">
              <div className="saved-foods-title-wrapper">
                <span className="saved-foods-icon" aria-hidden="true">🥗</span>
                <h3 className="saved-foods-title">{t('calculator.savedFoodsTitle')}</h3>
              </div>
              <span className="saved-foods-badge">
                {savedFoods.length} {savedFoods.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="saved-foods-subtitle">{t('calculator.savedFoodsSubtitle')}</p>
          </div>

          {/* Search Bar */}
          {savedFoods.length > 0 && (
            <div className="saved-foods-search-bar">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="text"
                className="saved-foods-search-input"
                placeholder={t('calculator.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Search status caption */}
          {savedFoods.length > 0 && (
            <div className="saved-foods-caption">
              {searchQuery.trim()
                ? t('calculator.searchResultsCount', { count: filteredFoods.length })
                : savedFoods.length > 20
                ? t('calculator.showingRecent', { count: Math.min(savedFoods.length, 20) })
                : null}
            </div>
          )}

          {/* Foods List */}
          {filteredFoods.length > 0 ? (
            <div className="saved-foods-grid" role="list">
              {filteredFoods.map((food) => {
                const isSelected = activeItem && activeItem.id === food.id;
                return (
                  <div
                    key={food.id}
                    className={`saved-food-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectFood(food)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectFood(food);
                      }
                    }}
                  >
                    <div className="saved-food-item-content">
                      <span className="saved-food-name">{food.name}</span>
                      <span className="saved-food-carbs-badge">
                        {food.carbs_per_100g} g / 100g
                      </span>
                    </div>

                    <div className="saved-food-item-actions">
                      <button
                        type="button"
                        className="saved-food-delete-btn"
                        title={t('calculator.deleteBtn')}
                        aria-label={`${t('calculator.deleteBtn')} ${food.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFoodToDelete(food);
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : savedFoods.length > 0 && searchQuery.trim() ? (
            <div className="saved-foods-empty">
              <span className="empty-icon" aria-hidden="true">🔍</span>
              <p>{t('calculator.noSearchResults', { query: searchQuery })}</p>
            </div>
          ) : (
            <div className="saved-foods-empty">
              <span className="empty-icon" aria-hidden="true">🥗</span>
              <p>{t('calculator.noSavedFoods')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {foodToDelete && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-food-title"
          onClick={() => setFoodToDelete(null)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="delete-food-title" className="modal-title">
                {t('calculator.deleteFoodTitle')}
              </h3>
              <button
                type="button"
                className="modal-close-x-btn"
                onClick={() => setFoodToDelete(null)}
                aria-label={t('common.closeModal')}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-warning-text">
                {t('calculator.deleteFoodConfirm', { name: foodToDelete.name })}
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={() => setFoodToDelete(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="modal-btn delete-btn confirm-delete-btn"
                onClick={handleConfirmDelete}
              >
                {t('calculator.deleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

