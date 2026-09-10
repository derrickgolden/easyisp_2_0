import { useState } from "react";
import { PPPoETransactionsPage } from "./PPPoETransactionsPage";
import { HotspotTransactionsPage } from "./HotspotTransactionsPage";

export const TransactionsPage: React.FC = () => {
    const [showTransactionsType, setShowTransactionsType] = useState(() => localStorage.getItem('easy-tech-connectionType') || 'pppoe');

    return (
        <div className=" animate-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* PPPoe  or Hotspot */}
            <div className="mb-3 inline-flex gap-2 rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
                <button
                type="button"
                onClick={() => {setShowTransactionsType('pppoe'); localStorage.setItem('easy-tech-connectionType', 'pppoe')}}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    showTransactionsType === 'pppoe'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                PPPoE Transactions
                </button>
                <button
                type="button"
                onClick={() => {setShowTransactionsType('hotspot'); localStorage.setItem('easy-tech-connectionType', 'hotspot')}}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    showTransactionsType === 'hotspot'
                    ? 'bg-yellow-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                Hotspot Transactions
                </button>
            </div>
            {/* Customer List */}
                {showTransactionsType === 'pppoe' && <PPPoETransactionsPage />}
                {showTransactionsType === 'hotspot' && < HotspotTransactionsPage/>}
            
        </div>
    );
}   