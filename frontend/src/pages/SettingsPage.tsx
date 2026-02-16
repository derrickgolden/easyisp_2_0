import React, { useState, useRef, useEffect } from 'react';
import { Card, Modal, Badge } from '../components/UI';
import { organizationApi, paymentsApi } from '../services/apiService';
import ChangePasswordCard from '../components/cards/settingsCards/ChangePasswordCard';
import { useLocation } from 'react-router-dom';

interface LicenceTier {
  id: string;
  name: string;
  price: number;
  capacity: string;
  features: string[];
  color: string;
}

interface SettingsPageProps {
  onSave: (msg: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({  onSave }) => {
  const location = useLocation();

  // --- FORM STATE ---
  const formRef = useRef<HTMLFormElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- GENERAL SETTINGS ---
  const [generalForm, setGeneralForm] = useState({
    isp_legal_name: 'EasyTech Network Solutions',
    acronym: '',
    support_hotline: '+254 700 000 000',
    business_address: 'EasyTech Plaza, 4th Floor, Wing B, Nairobi, Kenya',
    trial_duration: 30,
    trial_unit: 'minutes'
  });

  // --- PAYMENT GATEWAY ---
  const [paymentForm, setPaymentForm] = useState({
    paybill: '174379',
    consumer_key: '',
    consumer_secret: '',
    passkey: '',
    environment: 'Production',
    confirmation_url: '',
    validation_url: ''
  });

  // --- SMS GATEWAY ---
  const [smsForm, setSmsForm] = useState({
    provider: "Africa's Talking",
    sender_id: 'EASYTECH',
    api_key: '',
    api_username: 'easytech_admin'
  });

  // --- EMAIL GATEWAY ---
  const [emailForm, setEmailForm] = useState({
    mail_server: 'smtp.gmail.com',
    server_port: '587',
    auth_username: 'billing@easytech.com',
    auth_password: '',
    encryption: 'TLS (Recommended)',
    from_address: 'no-reply@easytech.com'
  });

  

  // --- LICENCE STATE ---
  const [licenceStatus, setLicenceStatus] = useState<'Active' | 'Trial' | 'Expired'>('Trial');
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<LicenceTier | null>(null);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'processing' | 'success'>('idle');
  const [phoneNumber, setPhoneNumber] = useState('2547');
  const [mode, setMode] = useState('');

  const tiers: LicenceTier[] = [
    { id: 'lite', name: 'Lite', price: 5000, capacity: 'Up to 100 Subs', features: ['Basic Billing', 'Core CRM', 'Standard Reports'], color: 'slate' },
    { id: 'pro', name: 'Professional', price: 12000, capacity: 'Up to 500 Subs', features: ['Advanced IPAM', 'Ticketing System', 'SMS Gateway Integration', 'API Access'], color: 'blue' },
    { id: 'ent', name: 'Enterprise', price: 25000, capacity: 'Unlimited Subs', features: ['White Labeling', 'Priority Support', 'Custom Integrations', 'Multi-Admin Roles'], color: 'indigo' },
  ];
  
    useEffect(() => {
      // Pathname looks like "/management/sites"
      const pathParts = location.pathname.split('/').filter(Boolean); // filter(Boolean) removes empty strings
      
      if (pathParts[1]) {
        setMode(pathParts[1]);
      } else {
        setMode('');
      }
    }, [location.pathname]);
  
  // Collect form data based on current mode
  const collectFormData = () => {
    switch (mode) {
      case 'general':
        return generalForm;
      case 'payment-gateway':
        return paymentForm;
      case 'sms-gateway':
        return smsForm;
      case 'email-gateway':
        return emailForm;
      default:
        return {};
    }
  };

  // Fetch settings from database on component mount or mode change
React.useEffect(() => {
  const fetchSettings = async () => {
    try {
      const response = await organizationApi.get();
      const orgSettings = response?.settings || {};

      // Load settings based on current mode
      if (mode === 'general' && orgSettings.general) {
        setGeneralForm(prev => ({
          ...prev,
          ...orgSettings.general,
          // Load acronym from top-level organization field
          acronym: response?.acronym || prev.acronym
        }));
      } else if (mode === 'payment-gateway' && orgSettings['payment-gateway']) {
        setPaymentForm(prev => ({
          ...prev,
          ...orgSettings['payment-gateway']
        }));
      } else if (mode === 'sms-gateway' && orgSettings['sms-gateway']) {
        setSmsForm(prev => ({
          ...prev,
          ...orgSettings['sms-gateway']
        }));
      } else if (mode === 'email-gateway' && orgSettings['email-gateway']) {
        setEmailForm(prev => ({
          ...prev,
          ...orgSettings['email-gateway']
        }));
      }

      // Load licence info
      if (orgSettings.subscription_tier) {
        setActiveTier(
          orgSettings.subscription_tier.charAt(0).toUpperCase() +
          orgSettings.subscription_tier.slice(1)
        );
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      // Silently fail - use defaults
    }
  };

  fetchSettings();
}, [mode]);

  // Save settings to database
  const handleGlobalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const formData = collectFormData();
      
      // Prepare settings payload
      const settingsPayload: any = {
        settings: {
          [mode]: formData,
        }
      };

      // If we're in general mode and acronym is provided, add it as a top-level field
      if (mode === 'general' && 'acronym' in formData) {
        settingsPayload.acronym = (formData as any).acronym;
      }

      // Call API to update organization settings
      await organizationApi.update(settingsPayload);

      // Success notification
      onSave(`Settings for ${mode.replace('-', ' ')} updated successfully`);

    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save settings';
      setError(errorMsg);
      onSave(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterC2BUrls = async () => {
    setError(null);
    setIsRegistering(true);

    try {
      if (!paymentForm.paybill?.trim() || !paymentForm.consumer_key?.trim() || !paymentForm.consumer_secret?.trim()) {
        const message = 'Paybill, consumer key, and consumer secret are required.';
        setError(message);
        onSave(`Error: ${message}`);
        return;
      }

      await paymentsApi.registerC2BUrls({
        paybill: paymentForm.paybill,
        consumer_key: paymentForm.consumer_key,
        consumer_secret: paymentForm.consumer_secret,
        environment: paymentForm.environment,
        ...(paymentForm.confirmation_url && { confirmation_url: paymentForm.confirmation_url }),
        ...(paymentForm.validation_url && { validation_url: paymentForm.validation_url }),
      });

      onSave('C2B confirmation and validation URLs registered successfully');
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to register C2B URLs';
      setError(errorMsg);
      onSave(`Error: ${errorMsg}`);
    } finally {
      setIsRegistering(false);
    }
  };

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
      onSave(`Licence for ${selectedTier?.name} activated successfully!`);
      setTimeout(() => {
        setIsPaymentModalOpen(false);
        setPaymentStep('idle');
      }, 2000);
    }, 3000);
  };

  const renderContent = () => {
    switch (mode) {
      case 'general':
        return (
          <div className="space-y-6">
            <Card title="Business Identity">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">ISP Legal Name</label>
                  <input 
                    type="text" 
                    value={generalForm.isp_legal_name}
                    required
                    onChange={e => setGeneralForm({ ...generalForm, isp_legal_name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Company Acronym</label>
                  <input 
                    type="text" 
                    value={generalForm.acronym}
                    required
                    onChange={e => setGeneralForm({ ...generalForm, acronym: e.target.value.toUpperCase() })}
                    placeholder="e.g., ET, ISP, NET"
                    maxLength={5}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold uppercase" 
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">Unique prefix for RADIUS usernames (max 5 chars)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Support Hotline</label>
                  <input 
                    type="tel" 
                    value={generalForm.support_hotline}
                    onChange={e => setGeneralForm({ ...generalForm, support_hotline: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                    Trial Period
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      min="0"
                      value={generalForm.trial_duration || ''}
                      onChange={e => setGeneralForm({ ...generalForm, trial_duration: Number(e.target.value) })}
                      placeholder="Duration"
                      className="w-2/3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                    />
                    <select 
                      value={generalForm.trial_unit || 'days'}
                      onChange={e => setGeneralForm({ ...generalForm, trial_unit: e.target.value })}
                      className="w-1/3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold cursor-pointer"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">Default grace period for new connections</p>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Business Office Address</label>
                  <textarea 
                    rows={2} 
                    value={generalForm.business_address}
                    onChange={e => setGeneralForm({ ...generalForm, business_address: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm" 
                  />
                </div>
              </div>
            </Card>
          </div>
        );

      case 'licence':
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
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
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Next Renewal</p>
                  <p className="text-2xl font-black text-white">Dec 31, 2025</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            </div>
          </div>
        );

      case 'payment-gateway':
        return (
          <div className="space-y-6">
            <Card title="M-Pesa Integration (Daraja API)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Paybill / Shortcode</label>
                  <input 
                    type="text" 
                    value={paymentForm.paybill}
                    onChange={e => setPaymentForm({ ...paymentForm, paybill: e.target.value })}
                    placeholder="e.g. 174379" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Consumer Key</label>
                  <input 
                    type="password" 
                    value={paymentForm.consumer_key}
                    onChange={e => setPaymentForm({ ...paymentForm, consumer_key: e.target.value })}
                    placeholder="••••••••••••••••" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Consumer Secret</label>
                  <input 
                    type="password" 
                    value={paymentForm.consumer_secret}
                    onChange={e => setPaymentForm({ ...paymentForm, consumer_secret: e.target.value })}
                    placeholder="••••••••••••••••" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Passkey</label>
                  <input 
                    type="password" 
                    value={paymentForm.passkey}
                    onChange={e => setPaymentForm({ ...paymentForm, passkey: e.target.value })}
                    placeholder="••••••••••••••••" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Environment</label>
                  <select 
                    value={paymentForm.environment}
                    onChange={e => setPaymentForm({ ...paymentForm, environment: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold">
                    <option>Production</option>
                    <option>Sandbox (Testing)</option>
                  </select>
                </div>
              </div>
            </Card>
            
            <Card title="Custom C2B Callback URLs (Optional - For Testing)">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Confirmation URL</label>
                  <input 
                    type="url" 
                    value={paymentForm.confirmation_url}
                    onChange={e => setPaymentForm({ ...paymentForm, confirmation_url: e.target.value })}
                    placeholder="https://your-ngrok-url.ngrok.io/api/payments/c2b/confirmation" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono text-sm" 
                  />
                  <p className="text-[9px] text-gray-400 italic">Leave empty to use default server URL. Use ngrok/localtunnel for local testing.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Validation URL</label>
                  <input 
                    type="url" 
                    value={paymentForm.validation_url}
                    onChange={e => setPaymentForm({ ...paymentForm, validation_url: e.target.value })}
                    placeholder="https://your-ngrok-url.ngrok.io/api/payments/c2b/validation" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono text-sm" 
                  />
                  <p className="text-[9px] text-gray-400 italic">Leave empty to use default server URL. Use ngrok/localtunnel for local testing.</p>
                </div>
              </div>
            </Card>
            
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="text-xs text-blue-700 dark:text-blue-300 font-medium space-y-1">
                <p>Register your C2B confirmation and validation URLs with Daraja. M-Pesa requires publicly accessible HTTPS URLs.</p>
                <p className="text-[10px] mt-1"><strong>For local testing:</strong> Use ngrok (ngrok http 8000) to expose your server with HTTPS.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRegisterC2BUrls}
                disabled={isRegistering}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2 active:scale-95"
              >
                {isRegistering ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14" /></svg>
                    <span>Register C2B URLs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 'sms-gateway':
        return (
          <div className="space-y-6">
            <Card title="SMS Provider Configuration">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Provider Service</label>
                  <select 
                    value={smsForm.provider}
                    onChange={e => setSmsForm({ ...smsForm, provider: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 appearance-none text-gray-900 dark:text-white font-bold">
                    <option>Africa's Talking</option>
                    <option>Twilio</option>
                    <option>Infobip</option>
                    <option>BulkSMS.com</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Sender ID / Alphanumeric</label>
                  <input 
                    type="text" 
                    value={smsForm.sender_id}
                    onChange={e => setSmsForm({ ...smsForm, sender_id: e.target.value })}
                    placeholder="e.g. EASYTECH" 
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">API Key / Access Token</label>
                  <input 
                    type="password" 
                    value={smsForm.api_key}
                    onChange={e => setSmsForm({ ...smsForm, api_key: e.target.value })}
                    placeholder="••••••••••••••••" 
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                  />
                  <p className="text-[9px] text-gray-400 italic mt-1">
                    <span className="font-bold">Africa's Talking:</span> Use format "username:api_key" or just the API key
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">API Username (if applicable)</label>
                  <input 
                    type="text" 
                    value={smsForm.api_username}
                    onChange={e => setSmsForm({ ...smsForm, api_username: e.target.value })}
                    placeholder="e.g. easytech_admin" 
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
              </div>
            </Card>

            <Card title="Meta WhatsApp Cloud API">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Permanent Access Token</label>
                  <input type="password" placeholder="EAABw..." className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Phone Number ID</label>
                  <input type="text" placeholder="e.g. 1092..." className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Business Account ID</label>
                  <input type="text" placeholder="e.g. 1045..." className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" />
                </div>
                <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Meta Webhook Configuration</p>
                  </div>
                   <div className="space-y-3">
                    <div>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Callback URL</p>
                      <code className="text-[10px] font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded select-all block mt-1">https://api.easytech.com/webhooks/whatsapp</code>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Webhook Verify Token</label>
                      <input type="text" placeholder="Set custom token for Meta verification" className="w-full bg-white dark:bg-slate-900 border-none rounded-lg p-2 mt-1 focus:ring-1 focus:ring-blue-500 text-xs font-bold" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="text-xs text-blue-700 dark:text-blue-300 font-medium space-y-1">
                <p>Auto-notifications for expiry and payment confirmation require a valid SMS configuration.</p>
                <p className="text-[10px] mt-1"><strong>Testing Tips:</strong> Verify your API credentials in your provider dashboard</p>
              </div>
            </div>
          </div>
        );
      case 'email-gateway':
        return (
          <div className="space-y-6">
            <Card title="SMTP Relay Settings">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Mail Server Host</label>
                  <input 
                    type="text" 
                    value={emailForm.mail_server}
                    onChange={e => setEmailForm({ ...emailForm, mail_server: e.target.value })}
                    placeholder="smtp.gmail.com" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Server Port</label>
                  <input 
                    type="text" 
                    value={emailForm.server_port}
                    onChange={e => setEmailForm({ ...emailForm, server_port: e.target.value })}
                    placeholder="587" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Auth Username</label>
                  <input 
                    type="email" 
                    value={emailForm.auth_username}
                    onChange={e => setEmailForm({ ...emailForm, auth_username: e.target.value })}
                    placeholder="billing@easytech.com" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Auth Password</label>
                  <input 
                    type="password" 
                    value={emailForm.auth_password}
                    onChange={e => setEmailForm({ ...emailForm, auth_password: e.target.value })}
                    placeholder="••••••••••••••••" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Encryption Protocol</label>
                  <select 
                    value={emailForm.encryption}
                    onChange={e => setEmailForm({ ...emailForm, encryption: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold">
                    <option>TLS (Recommended)</option>
                    <option>SSL</option>
                    <option>None (Unsecured)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Sender 'From' Address</label>
                  <input 
                    type="email" 
                    value={emailForm.from_address}
                    onChange={e => setEmailForm({ ...emailForm, from_address: e.target.value })}
                    placeholder="no-reply@easytech.com" 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                  />
                </div>
              </div>
            </Card>
          </div>
        );

      case 'change-password':
        return (
          <ChangePasswordCard />
        );

      default:
        return (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center">
            <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <p className="font-bold">Module Under Maintenance</p>
            <p className="text-xs italic mt-1">This specific configuration is being synced with the cloud.</p>
          </div>
        );
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500">
      <form ref={formRef} onSubmit={handleGlobalSave}>
        {renderContent()}

        {/* Error Alert */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {mode !== 'licence' && mode !== 'change-password' && (
          <div className="mt-8 flex justify-end">
            <button 
              type="submit" 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2 active:scale-95"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Apply Changes</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>

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