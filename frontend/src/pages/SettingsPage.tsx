import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../components/UI';
import { organizationApi, paymentsApi } from '../services/apiService';
import ChangePasswordCard from '../components/cards/settingsCards/ChangePasswordCard';
import { useLocation } from 'react-router-dom';
import LicenceCard from '../components/cards/settingsCards/LicenceCard';

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
  const [orgSettings, setOrgSettings] = useState<any>({});

  // --- GENERAL SETTINGS ---
  const [generalForm, setGeneralForm] = useState({
    isp_legal_name: '',
    acronym: '',
    support_hotline: '',
    business_address: '',
    trial_duration: 30,
    trial_unit: 'minutes',
    business_logo: ''
  });

  // --- PAYMENT GATEWAY ---
  const [paymentForm, setPaymentForm] = useState({
    paybill: '',
    consumer_key: '',
    consumer_secret: '',
    passkey: '',
    environment: 'Production',
    confirmation_url: '',
    validation_url: ''
  });

  // --- SMS GATEWAY ---
  const [smsForm, setSmsForm] = useState({
    provider: '',
    sender_id: '',
    api_key: '',
    api_username: ''
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
  const [mode, setMode] = useState('');
  
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
        const generalSettings = orgSettings.general || {};
        const paymentSettings = orgSettings['payment-gateway'] || {};
        const smsSettings = orgSettings['sms-gateway'] || {};
        const emailSettings = orgSettings['email-gateway'] || {};

        setOrgSettings(response || {});

        // Load settings for all forms; if a value is missing from backend, keep current form value
        setGeneralForm(prev => ({
          ...prev,
          ...generalSettings,
          acronym: response?.acronym || generalSettings.acronym || prev.acronym
        }));

        setPaymentForm(prev => ({
          ...prev,
          ...paymentSettings
        }));

        setSmsForm(prev => ({
          ...prev,
          ...smsSettings
        }));

        setEmailForm(prev => ({
          ...prev,
          ...emailSettings
        }));

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

  const renderContent = () => {
    switch (mode) {
      case 'general':
        return (
          <div className="space-y-6">
            <Card title="Business Identity">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Business Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                      {generalForm.business_logo ? (
                        <img src={generalForm.business_logo} alt="Business Logo" className="w-full h-full object-contain" />
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M3 19h18M5 5v14M19 5v14" /></svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setGeneralForm({
                              ...generalForm,
                              business_logo: typeof reader.result === 'string' ? reader.result : ''
                            });
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">PNG/JPG recommended. Stored in settings.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">ISP Legal Name</label>
                  <input 
                    type="text" 
                    value={generalForm.isp_legal_name}
                    required
                    onChange={e => setGeneralForm({ ...generalForm, isp_legal_name: e.target.value })}
                    placeholder="e.g. EasyTech Network Solutions"
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
                    placeholder="e.g. +254 700 000 000"
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
                    placeholder="e.g. EasyTech Plaza, 4th Floor, Wing B, Nairobi, Kenya"
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm" 
                  />
                </div>
              </div>
            </Card>
          </div>
        );

      case 'licence': return ( <LicenceCard orgSettings={orgSettings} /> );

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
                    <option value="" disabled>Select provider</option>
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

      case 'change-password': return ( <ChangePasswordCard /> );

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
    </div>
  );
};