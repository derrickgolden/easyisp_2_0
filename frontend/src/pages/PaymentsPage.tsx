import { useState } from "react";
import { HotspotPaymentsPage } from "./HotspotPaymentsPage";
import { PPPoEPaymentsPage } from "./PPPoEPaymentsPage";

export const formatPhone = (value: string | null | undefined): string => {
  if (!value) return '_';
  // A valid phone: only digits, spaces, +, -, (), max 15 significant digits
  return /^[+\d\s\-()]{6,20}$/.test(value.trim()) ? value : '_';
};

export const PaymentsPage = () => {
    const [showPaymentList, setShowPaymentList] = useState<'pppoe' | 'hotspot'>('pppoe');

    return (
        <div className=" animate-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* PPPoe  or Hotspot */}
            <div className="mb-3 inline-flex gap-2 rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
                <button
                type="button"
                onClick={() => setShowPaymentList('pppoe')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    showPaymentList === 'pppoe'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                PPPoE Payments
                </button>
                <button
                type="button"
                onClick={() => setShowPaymentList('hotspot')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    showPaymentList === 'hotspot'
                    ? 'bg-yellow-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                Hotspot Payments
                </button>
            </div>
            {/* Payment List */}
                {showPaymentList === 'pppoe' && <PPPoEPaymentsPage />}
                {showPaymentList === 'hotspot' && <HotspotPaymentsPage />}
            
        </div>
    );
}   