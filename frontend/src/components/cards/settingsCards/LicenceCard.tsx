import { useEffect, useState } from "react";
import { Badge, Modal } from "../../UI";
import { organizationApi, paymentsApi } from "../../../services/apiService";
import { toast } from "sonner";

const LicenceCard: React.FC<{ orgSettings: any }> = ({orgSettings}) => {
    const [licenceStatus, setLicenceStatus] = useState<'Active' | 'Trial' | 'Expired'>('Trial');
    const [activeTier, setActiveTier] = useState<string | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentStep, setPaymentStep] = useState<'idle' | 'processing' | 'success'>('idle');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [billingSummary, setBillingSummary] = useState<any>(null);
    const currentBillStatus = billingSummary?.current?.status;
    const walletBalance = Number(orgSettings?.balance || 0);
    
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

    const initiatePayment = () => {
        setPaymentStep('idle');
        setIsPaymentModalOpen(true);
    };

    const applyOrganizationState = (organization: any) => {
      if (organization?.subscription_tier) {
        setActiveTier(
          organization.subscription_tier.charAt(0).toUpperCase() +
          organization.subscription_tier.slice(1)
        );
      }

      if (organization?.status === 'active') {
        setLicenceStatus('Active');
      } else if (organization?.status === 'suspended') {
        setLicenceStatus('Expired');
      } else {
        setLicenceStatus('Trial');
      }
    };

    const pollForPaymentConfirmation = async (maxAttempts = 15, intervalMs = 4000) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const latest = await organizationApi.getLicenseBilling();
          setBillingSummary(latest || null);

          if (latest?.current?.status === 'paid') {
            return true;
          }
        } catch (error) {
          console.error('Failed to refresh billing summary while checking payment status:', error);
        }

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      return false;
    };

   const handleStkPush = async () => {

      const enteredPhone = phoneNumber.trim();
      if (!enteredPhone) {
        toast.error('Enter a valid phone number');
        return;
      }

      const amount = Math.max(1, Number(billingSummary?.current?.total_amount || 0));
      setPaymentStep('processing');

      try {
        await paymentsApi.stkPushPayhero({
          phone: enteredPhone,
          amount,
        });

        toast.success('STK push initiated. Enter PIN.');

        const paymentConfirmed = await pollForPaymentConfirmation();

        if (paymentConfirmed) {
          try {
            const latestOrganization = await organizationApi.get();
            applyOrganizationState(latestOrganization);
          } catch (error) {
            console.error('Failed to refresh organization status after payment confirmation:', error);
          }

          setPaymentStep('success');
          toast.success('Payment confirmed successfully.');
          return;
        }

        setPaymentStep('idle');
        toast.error('Payment not confirmed yet. Please complete STK PIN and try checking again.');
      } catch (err: any) {
        setPaymentStep('idle');
        toast.error(err?.message || 'Failed to initiate STK push');
      }
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
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Wallet Balance</p>
                      <p className="text-2xl font-black text-emerald-300">KSH {walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Current Month Bill</p>
                      <p className="text-2xl font-black text-white">
                        {billingSummary?.current?.total_amount ? `KSH ${Number(billingSummary.current.total_amount).toLocaleString()}` : 'KSH 0'}
                      </p>
                      <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${currentBillStatus === 'paid' ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {currentBillStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </p>
                      {currentBillStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={initiatePayment}
                          className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-600"
                        >
                          Pay
                        </button>
                      )}
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
                <div className="bg-slate-900 backdrop-blur-md border border-white/10 rounded-2xl p-4 max-w-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Billing Schedule</p>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    Billed on the <span className="text-blue-300">28th</span>. Please settle by the <span className="text-blue-300">5th</span> to maintain access.
                  </p>
                </div>
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Renew System License">
                {paymentStep === 'idle' && (
                <div className="space-y-6">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center pb-4 border-b dark:border-slate-600">
                  <span className="text-xs font-bold text-gray-500 uppercase">Amount Due</span>
                  <span className="text-xl font-black text-gray-900 dark:text-white">
                    KSH {Math.max(1, Number(billingSummary?.current?.total_amount || 0)).toLocaleString()}
                  </span>
                    </div>
                    <div className="mt-4">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block mb-1">M-Pesa Number</label>
                  <input
                    required
                    type="tel"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="2547XXXXXXXX"
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-4 text-center text-xl font-black tracking-widest focus:ring-2 focus:ring-emerald-500"
                  />
                    </div>
                    </div>
                    <button type="button" onClick={handleStkPush} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95">Authorize STK Push</button>
                </div>
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