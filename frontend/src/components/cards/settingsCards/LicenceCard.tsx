import { useEffect, useState } from "react";
import { Badge, Modal } from "../../UI";
import { organizationApi } from "../../../services/apiService";

interface LicenceTier {
  id: string;
  name: string;
  price: number;
  capacity: string;
  features: string[];
  color: string;
}
const tiers = [
    { id: 'lite', name: 'Lite', price: 5000, capacity: 'Up to 100 Subs', features: ['Basic Billing', 'Core CRM', 'Standard Reports'], color: 'slate' },
    { id: 'pro', name: 'Professional', price: 12000, capacity: 'Up to 500 Subs', features: ['Advanced IPAM', 'Ticketing System', 'SMS Gateway Integration', 'API Access'], color: 'blue' },
    { id: 'ent', name: 'Enterprise', price: 25000, capacity: 'Unlimited Subs', features: ['White Labeling', 'Priority Support', 'Custom Integrations', 'Multi-Admin Roles'], color: 'indigo' },
];
const LicenceCard = ({orgSettings}) => {
    const [licenceStatus, setLicenceStatus] = useState<'Active' | 'Trial' | 'Expired'>('Trial');
    const [activeTier, setActiveTier] = useState<string | null>(null);
    const [selectedTier, setSelectedTier] = useState<LicenceTier | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentStep, setPaymentStep] = useState<'idle' | 'processing' | 'success'>('idle');
    const [phoneNumber, setPhoneNumber] = useState('2547');
    const [billingSummary, setBillingSummary] = useState<any>(null);
    const currentBillStatus = billingSummary?.current?.status;
    
    useEffect(() => {
        // Load licence info
        if (orgSettings.subscription_tier) {
            setActiveTier(
                orgSettings.subscription_tier.charAt(0).toUpperCase() +
                orgSettings.subscription_tier.slice(1)
            );
        }

        if (orgSettings?.status === 'active') {
            setLicenceStatus('Active');
        } else if (orgSettings?.status === 'suspended') {
            setLicenceStatus('Expired');
        } else {
            setLicenceStatus('Trial');
        }
    }, [orgSettings?.subscription_tier, orgSettings?.status]);

    useEffect(() => {
        const fetchLicenseBilling = async () => {
            try {
                const response = await organizationApi.getLicenseBilling();
                setBillingSummary(response || null);
            } catch (error) {
                console.error('Failed to fetch license billing summary:', error);
            }
        };

        fetchLicenseBilling();
    }, []);

    const initiatePayment = (tier: LicenceTier) => {
        setSelectedTier(tier);
        setIsPaymentModalOpen(true);
        setPaymentStep('idle');
    };

    const handleSTKPush = (e: React.FormEvent) => {
        e.preventDefault();
        setPaymentStep('processing');
        setTimeout(() => {
            setPaymentStep('success');
            setLicenceStatus('Active');
            setActiveTier(selectedTier?.name || null);
            // onSave(`Licence for ${selectedTier?.name} activated successfully!`);
            setTimeout(() => {
                setIsPaymentModalOpen(false);
                setPaymentStep('idle');
            }, 2000);
        }, 3000);
    };
      
    return (
        <div className="space-y-8 animate-in fade-in duration-500 mb-10">
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl ${licenceStatus === 'Active' ? 'bg-green-500' : 'bg-amber-500'} shadow-emerald-500/20`}>
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-3xl font-black">{licenceStatus === 'Trial' ? 'Free Trial' : (activeTier || 'Enterprise')}</h3>
                          <Badge variant={licenceStatus.toLowerCase()}>{licenceStatus.toUpperCase()}</Badge>
                        </div>
                        <p className="text-slate-400 font-medium font-mono text-sm uppercase">ET-CLOUD-8821-X991-A122</p>
                      </div>
                    </div>
                    <div className="text-center md:text-right">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Current Month Bill</p>
                      <p className="text-2xl font-black text-white">
                        {billingSummary?.current?.total_amount ? `KSH ${Number(billingSummary.current.total_amount).toLocaleString()}` : 'KSH 0'}
                      </p>
                      <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${currentBillStatus === 'paid' ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {currentBillStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Snapshot Month</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-1">
                        {billingSummary?.current?.snapshot_month ? new Date(billingSummary.current.snapshot_month).toDateString() : 'Not generated'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Active Users</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{billingSummary?.current?.active_users_count ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Rate</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-1">KSH 15 / active user</p>
                  </div>
                </div>
                {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {tiers.map(tier => (
                    <div key={tier.id} className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col group hover:shadow-xl transition-all relative overflow-hidden">
                      {activeTier === tier.name && (
                        <div className="absolute top-0 right-0 px-4 py-1 bg-blue-600 text-white text-[10px] font-black uppercase rounded-bl-xl tracking-widest z-10">Current Plan</div>
                      )}
                      <div className="mb-6">
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-${tier.color}-500`}>{tier.name} System</p>
                        <h4 className="text-4xl font-black text-gray-900 dark:text-white">
                          <span className="text-sm font-medium mr-1 uppercase">KSH</span>
                          {tier.price.toLocaleString()}
                        </h4>
                        <p className="text-xs text-gray-500 mt-2 font-bold">{tier.capacity}</p>
                      </div>
                      <div className="space-y-3 flex-1">
                        {tier.features.map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {f}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={activeTier === tier.name}
                        onClick={() => initiatePayment(tier)}
                        className={`mt-8 w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTier === tier.name ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-500'
                          }`}
                      >
                        {activeTier === tier.name ? 'Active' : 'Upgrade Now'}
                      </button>
                    </div>
                  ))}
                </div> */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Renew System License">
                {paymentStep === 'idle' && (
                <form onSubmit={handleSTKPush} className="space-y-6">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-gray-500 uppercase">Selected Plan</span>
                        <span className="text-sm font-black text-blue-600 uppercase tracking-widest">{selectedTier?.name} Tier</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b dark:border-slate-600">
                        <span className="text-xs font-bold text-gray-500 uppercase">Billing Amount</span>
                        <span className="text-xl font-black text-gray-900 dark:text-white">KSH {selectedTier?.price.toLocaleString()}</span>
                    </div>
                    <div className="mt-4">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block mb-1">M-Pesa Number</label>
                        <input required type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-4 text-center text-xl font-black tracking-widest focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95">Authorize STK Push</button>
                </form>
                )}
                {paymentStep === 'processing' && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <h4 className="text-lg font-black">Syncing with M-Pesa Gateway...</h4>
                </div>
                )}
                {paymentStep === 'success' && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h4 className="text-xl font-black">Payment Captured!</h4>
                </div>
                )}
            </Modal>
        </div>
    );
};

export default LicenceCard;