/**
 * Create Trip Modal Component
 * Beautiful animated modal for creating new trips
 */
import { Calendar, ChevronDown, DollarSign, FileText, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '../config/currencies';
import type { CreateTripInput } from '../types';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (trip: CreateTripInput) => Promise<void>;
}


export default function CreateTripModal({ isOpen, onClose, onCreate }: CreateTripModalProps) {
  const [formData, setFormData] = useState<CreateTripInput>({
    name: '',
    description: '',
    base_currency: DEFAULT_CURRENCY,
    start_date: '',
    end_date: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        description: '',
        base_currency: DEFAULT_CURRENCY,
        start_date: '',
        end_date: '',
      });
      setErrors({});
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = 'Trip name is required';
    } else if (trimmedName.length > 200) {
      newErrors.name = 'Trip name must be 200 characters or less';
    }

    // Validate currency
    const trimmedCurrency = formData.base_currency.trim();
    if (trimmedCurrency.length !== 3) {
      newErrors.base_currency = 'Currency code must be exactly 3 letters (e.g., USD, EUR)';
    } else if (!/^[A-Z]{3}$/i.test(trimmedCurrency)) {
      newErrors.base_currency = 'Currency code must contain only letters';
    }

    // Validate dates
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);

      if (endDate < startDate) {
        newErrors.end_date = 'End date cannot be before start date';
      }
    }

    // Validate description length
    if (formData.description && formData.description.trim().length > 1000) {
      newErrors.description = 'Description must be 1000 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      // Remove empty optional fields and trim values
      const cleanData: CreateTripInput = {
        name: formData.name.trim(),
        base_currency: formData.base_currency.trim().toUpperCase(),
      };
      if (formData.description?.trim()) {
        cleanData.description = formData.description.trim();
      }
      if (formData.start_date) cleanData.start_date = formData.start_date;
      if (formData.end_date) cleanData.end_date = formData.end_date;

      await onCreate(cleanData);
      onClose();
    } catch (error) {
      console.error('Error creating trip:', error);

      // Extract error message from response
      let errorMessage = 'Failed to create trip. Please try again.';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { detail?: unknown } } };
        if (axiosError.response?.data?.detail) {
          if (Array.isArray(axiosError.response.data.detail)) {
            // Pydantic validation errors
            errorMessage = axiosError.response.data.detail
              .map((e: { msg?: string }) => e.msg || 'Validation error')
              .join(', ');
          } else if (typeof axiosError.response.data.detail === 'string') {
            errorMessage = axiosError.response.data.detail;
          }
        }
      }

      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time date validation
  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Clear date errors
    if (errors.end_date) {
      const newErrors = { ...errors };
      delete newErrors.end_date;
      setErrors(newErrors);
    }

    // Validate dates in real-time
    if (newFormData.start_date && newFormData.end_date) {
      const startDate = new Date(newFormData.start_date);
      const endDate = new Date(newFormData.end_date);

      if (endDate < startDate) {
        setErrors({ ...errors, end_date: 'End date cannot be before start date' });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-xl animate-slide-up sm:animate-fade-in max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Create New Trip</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Trip Name */}
          <div>
            <label htmlFor="trip-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Trip Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="trip-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full pl-11 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow ${errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Tokyo Adventure 2024"
                autoFocus
              />
            </div>
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
              Description (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full pl-11 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow resize-none"
                placeholder="Spring vacation in Japan"
                rows={3}
              />
            </div>
          </div>

          {/* Base Currency */}
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1.5">
              Base Currency
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <div className="relative">
                <select
                  id="currency"
                  value={formData.base_currency}
                  onChange={(e) => setFormData({ ...formData, base_currency: e.target.value })}
                  className="w-full pl-11 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow appearance-none bg-white"
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              The base currency is used to calculate balances and settlements.
            </p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1.5">
                Start Date
              </label>
              <div className="relative overflow-hidden">
                <Calendar className="hidden sm:block absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <input
                  id="start-date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleDateChange('start_date', e.target.value)}
                  className="w-full min-w-0 max-w-full box-border px-3 sm:pl-11 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1.5">
                End Date
              </label>
              <div className="relative overflow-hidden">
                <Calendar className="hidden sm:block absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <input
                  id="end-date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleDateChange('end_date', e.target.value)}
                  className={`w-full min-w-0 max-w-full box-border px-3 sm:pl-11 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow ${errors.end_date ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
              </div>
              {errors.end_date && <p className="mt-1 text-xs text-red-500">{errors.end_date}</p>}
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Trip'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

