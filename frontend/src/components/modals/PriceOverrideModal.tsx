import React, { useEffect, useState } from 'react';
import { Modal } from '../UI';
import { customersApi } from '../../services/apiService';
import { toast } from 'sonner';

interface PriceOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  currentEffectivePrice: number;
  defaultPackagePrice: number;
  initialCustomPrice?: number | null;
  onSuccess?: () => void;
}

export const PriceOverrideModal: React.FC<PriceOverrideModalProps> = ({
  isOpen,
  onClose,
  customerId,
  currentEffectivePrice,
  defaultPackagePrice,
  initialCustomPrice,
  onSuccess,
}) => {
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setCustomPriceInput(initialCustomPrice != null ? String(initialCustomPrice) : '');
  }, [initialCustomPrice, isOpen]);

  const handleSave = async () => {
    const customPrice = customPriceInput.trim() === '' ? null : Number(customPriceInput);

    if (customPrice !== null && (Number.isNaN(customPrice) || customPrice < 0)) {
      toast.error('Enter a valid custom price (0 or greater) or clear to use default package price.');
      return;
    }

    try {
      setIsSaving(true);
      await customersApi.update(customerId, {
        custom_package_price: customPrice,
      });

      toast.success(customPrice === null
        ? 'Custom price cleared. Package default price will be used.'
        : 'Custom package price saved successfully.');

      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save custom package price.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Override Customer Package Price"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          This customer will keep package speeds and validity, but activation billing will use this custom price.
          Leave blank to fall back to default package price.
        </p>

        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Current Effective Price</p>
          <p className="text-lg font-black text-blue-600">KSH {currentEffectivePrice.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 mt-1">
            Default package price: KSH {defaultPackagePrice.toLocaleString()}
          </p>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Custom Price (KSH)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={customPriceInput}
            onChange={(e) => setCustomPriceInput(e.target.value)}
            placeholder="Leave empty to use package default"
            className="w-full bg-gray-50 dark:bg-slate-800 p-3 rounded-xl font-bold border-none mt-1 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-[10px] font-black uppercase rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Price'}
          </button>
        </div>
      </div>
    </Modal>
  );
};