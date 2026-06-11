import { useState } from "react";
import { HotspotCustomersPage } from "./HotspotCustomerPage";
import { PPPoECustomersPage } from "./PPPoECustomersPage";

export const CustomersPage = () => {
    const [showCustomerList, setShowCustomerList] = useState<'pppoe' | 'hotspot'>('pppoe');

    return (
        <div className=" animate-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* PPPoe  or Hotspot */}
            <div className="mb-3 inline-flex gap-2 rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
                <button
                type="button"
                onClick={() => setShowCustomerList('pppoe')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    showCustomerList === 'pppoe'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                PPPoE Customers
                </button>
                <button
                type="button"
                onClick={() => setShowCustomerList('hotspot')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    showCustomerList === 'hotspot'
                    ? 'bg-yellow-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                Hotspot Customers
                </button>
            </div>
            {/* Customer List */}
                {showCustomerList === 'pppoe' && <PPPoECustomersPage />}
                {showCustomerList === 'hotspot' && <HotspotCustomersPage />}
            
        </div>
    );
}   