import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CarbCalculator from '../CarbCalculator';
import { LanguageProvider } from '../i18n';

function renderWithLang(ui, lang = 'en') {
  return render(
    <LanguageProvider initialLanguage={lang}>
      {ui}
    </LanguageProvider>
  );
}

describe('CarbCalculator Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders title, inputs, and placeholder state initially', () => {
    renderWithLang(<CarbCalculator />);

    expect(screen.getByText(/Meal Portion Carb Calculator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Carbs per 100g/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Meal Portion Weight/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter carbs per 100g and your meal weight in grams/i)).toBeInTheDocument();
  });

  it('calculates portion carbs correctly: 25g/100g with 140g meal = 35.0g carbs', () => {
    renderWithLang(<CarbCalculator />);

    const carbsInput = screen.getByLabelText(/Carbs per 100g/i);
    const portionInput = screen.getByLabelText(/Meal Portion Weight/i);

    fireEvent.change(carbsInput, { target: { value: '25' } });
    fireEvent.change(portionInput, { target: { value: '140' } });

    // Result hero should display 35
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('(25g × 140g) ÷ 100 = 35g carbs')).toBeInTheDocument();
  });

  it('updates portion weight when clicking quick portion chips', () => {
    renderWithLang(<CarbCalculator />);

    const carbsInput = screen.getByLabelText(/Carbs per 100g/i);
    fireEvent.change(carbsInput, { target: { value: '20' } });

    // Click 150g quick chip
    const chip150 = screen.getByRole('button', { name: '150g' });
    fireEvent.click(chip150);

    const portionInput = screen.getByLabelText(/Meal Portion Weight/i);
    expect(portionInput).toHaveValue(150);

    // 20 * 150 / 100 = 30
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('clears calculation inputs when clear button is clicked', () => {
    renderWithLang(<CarbCalculator />);

    const carbsInput = screen.getByLabelText(/Carbs per 100g/i);
    const portionInput = screen.getByLabelText(/Meal Portion Weight/i);

    fireEvent.change(carbsInput, { target: { value: '30' } });
    fireEvent.change(portionInput, { target: { value: '100' } });

    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearBtn);

    expect(carbsInput).toHaveValue(null);
    expect(portionInput).toHaveValue(null);
    expect(screen.getByText(/Enter carbs per 100g and your meal weight in grams/i)).toBeInTheDocument();
  });

  it('saves a food item and displays it in the saved foods list', async () => {
    renderWithLang(<CarbCalculator />);

    const foodNameInput = screen.getByPlaceholderText(/e\.g\. Basmati Rice/i);
    const carbsInput = screen.getByLabelText(/Carbs per 100g/i);

    fireEvent.change(foodNameInput, { target: { value: 'Basmati Rice' } });
    fireEvent.change(carbsInput, { target: { value: '28' } });

    const saveBtn = screen.getByRole('button', { name: /Save Item/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Basmati Rice')).toBeInTheDocument();
      expect(screen.getAllByText(/28\s*g \/ 100g/).length).toBeGreaterThan(0);
    });
  });

  it('clicking a saved food auto-populates ONLY carbs per 100g and shows active badge', async () => {
    // Seed initial food in localStorage
    localStorage.setItem(
      'insuminder_saved_foods',
      JSON.stringify([
        { id: 'food-1', name: 'Oatmeal', carbs_per_100g: 12.5 }
      ])
    );

    renderWithLang(<CarbCalculator />);

    expect(screen.getByText('Oatmeal')).toBeInTheDocument();

    const foodItem = screen.getByText('Oatmeal');
    fireEvent.click(foodItem);

    // Carbs per 100g input is populated
    const carbsInput = screen.getByLabelText(/Carbs per 100g/i);
    expect(carbsInput).toHaveValue(12.5);

    // Portion weight is NOT populated (empty so user enters their portion)
    const portionInput = screen.getByLabelText(/Meal Portion Weight/i);
    expect(portionInput).toHaveValue(null);

    // Active food badge is visible
    expect(screen.getByText(/Selected: Oatmeal \(12\.5g \/ 100g\)/i)).toBeInTheDocument();

    // Deselecting removes badge
    const deselectBtn = screen.getByRole('button', { name: /Deselect/i });
    fireEvent.click(deselectBtn);
    expect(screen.queryByText(/Selected: Oatmeal/i)).not.toBeInTheDocument();
  });

  it('filters saved foods with search input', () => {
    localStorage.setItem(
      'insuminder_saved_foods',
      JSON.stringify([
        { id: 'food-1', name: 'Banana', carbs_per_100g: 23 },
        { id: 'food-2', name: 'Apple', carbs_per_100g: 14 },
        { id: 'food-3', name: 'Brown Rice', carbs_per_100g: 26 }
      ])
    );

    renderWithLang(<CarbCalculator />);

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Brown Rice')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search saved items\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'rice' } });

    expect(screen.getByText('Brown Rice')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();

    // Clear search
    const clearSearchBtn = screen.getByRole('button', { name: /Clear search/i });
    fireEvent.click(clearSearchBtn);
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('deletes saved food via confirmation modal', async () => {
    localStorage.setItem(
      'insuminder_saved_foods',
      JSON.stringify([
        { id: 'food-del-1', name: 'Pasta', carbs_per_100g: 31 }
      ])
    );

    renderWithLang(<CarbCalculator />);

    expect(screen.getByText('Pasta')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /Delete Pasta/i });
    fireEvent.click(deleteBtn);

    // Modal opens
    expect(screen.getByText(/Delete Saved Item/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "Pasta"/i)).toBeInTheDocument();

    // Confirm deletion
    const confirmDeleteBtn = screen.getByRole('button', { name: /^Delete$/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.queryByText('Pasta')).not.toBeInTheDocument();
    });
  });
  it('closes delete confirmation modal when clicking the X close button', () => {
    localStorage.setItem(
      'insuminder_saved_foods',
      JSON.stringify([
        { id: 'food-del-2', name: 'Pizza', carbs_per_100g: 28 }
      ])
    );

    renderWithLang(<CarbCalculator />);

    expect(screen.getByText('Pizza')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /Delete Pizza/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText(/Delete Saved Item/i)).toBeInTheDocument();

    // Click X close button
    const closeXBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeXBtn);

    expect(screen.queryByText(/Delete Saved Item/i)).not.toBeInTheDocument();
    expect(screen.getByText('Pizza')).toBeInTheDocument();
  });

  it('calls onNotify with success when item is saved and deleted', async () => {
    const onNotify = vi.fn();
    renderWithLang(<CarbCalculator onNotify={onNotify} />);

    const foodNameInput = screen.getByPlaceholderText(/e\.g\. Basmati Rice/i);
    const carbsInput = screen.getByLabelText(/Carbs per 100g/i);

    fireEvent.change(foodNameInput, { target: { value: 'Quinoa' } });
    fireEvent.change(carbsInput, { target: { value: '21.3' } });

    const saveBtn = screen.getByRole('button', { name: /Save Item/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith({
        type: 'success',
        message: 'Item saved successfully!'
      });
    });
  });
});
