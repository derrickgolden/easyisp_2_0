import React, { useState } from "react";
import { Card } from "../../UI";
import { organizationApi, paymentsApi } from "@/src/services/apiService";

const PaymentGatewayCard: React.FC<{ onSave: (message: string) => void }>  = ({ onSave }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentGatewayMode, setPaymentGatewayMode] = useState<'mpesa' | 'payhero' | 'kopokopo'>('mpesa');
    const [defaultPaymentGateway, setDefaultPaymentGateway] = useState<'mpesa' | 'payhero' | 'kopokopo' | null>(null);

    const [callApi, setCallApi] = useState(false);
    const [gateways, setGateways] = useState<any[]>([]);
    const [loadingGateways, setLoadingGateways] = useState(false);

    // --- PAYMENT GATEWAY ---
    const [payheroForm, setPayheroForm] = useState({
        id: null,
        provider: '',
        channel_id: '',
        callback_url: '',
        is_active: false,
        is_default: false,
    });
    const [kopokopoForm, setKopokopoForm] = useState({
        id: null,
        provider: '',
        api_key: '',
        callback_url: '',
        is_active: false,
        is_default: false,
    });
    const [mpesaForm, setMpesaForm] = useState({
        id: null,
        provider: '',
        paybill: '',
        consumer_key: '',
        consumer_secret: '',
        passkey: '',
        environment: 'Production',
        confirmation_url: '',
        validation_url: '',
        stk_callback_url: '',
        is_active: false,
        is_default: false,
    });

    React.useEffect(() => {
        const fetchGateways = async () => {
            setLoadingGateways(true);
            try {
                const res = await organizationApi.getPaymentGateways();
                const entries = (res && Array.isArray(res.data)) ? res.data : [];
                setGateways(entries);

                // choose default (explicit) or first
                entries.map((e: any) => {
                    if (e.is_default) {
                        setPaymentGatewayMode(e.provider);
                        setDefaultPaymentGateway(e.provider);
                    }
                    if (e.provider === 'payhero') {
                        setPayheroForm({ id: e.id, provider: 'payhero', channel_id: e.config?.channel_id || '', callback_url: e.config?.callback_url || '', is_active: e.active || false, is_default: e.is_default || false });
                    } if (e.provider === 'kopokopo') {
                        setKopokopoForm({ id: e.id, provider: 'kopokopo', api_key: e.config?.api_key || '', callback_url: e.config?.callback_url || '', is_active: e.active || false, is_default: e.is_default || false });
                    } if (e.provider === 'mpesa') {
                        setMpesaForm({ id: e.id, provider: 'mpesa', paybill: e.config?.paybill || '', consumer_key: e.config?.consumer_key || '', consumer_secret: e.config?.consumer_secret || '', passkey: e.config?.passkey || '', environment: e.config?.environment || 'Production', confirmation_url: e.config?.confirmation_url || '', validation_url: e.config?.validation_url || '', stk_callback_url: e.config?.stk_callback_url || '', is_active: e.active || false, is_default: e.is_default || false });
                    }
                });
            } catch (err) {
                console.error('Failed to fetch payment gateways:', err);
                setGateways([]);
            } finally {
                setLoadingGateways(false);
            }
        };

        fetchGateways();
    }, [callApi]);


    // Save payment gateway settings to database
    const handleSave = async () => {
        setError(null);
        setIsRegistering(true);

        try {
            // Save gateways as an array of entries where each entry has { provider, config, is_default }
            let gateways: any[] = [];

            if (paymentGatewayMode === 'mpesa') {
                if (!mpesaForm.paybill || !mpesaForm.consumer_key || !mpesaForm.consumer_secret) {
                    const message = 'Paybill, consumer key, and consumer secret are required.';
                    setError(message);
                    onSave(`Error: ${message}`);
                    return;
                }

                gateways = [{
                    provider: 'mpesa',
                    config: {
                        paybill: mpesaForm.paybill,
                        consumer_key: mpesaForm.consumer_key,
                        consumer_secret: mpesaForm.consumer_secret,
                        passkey: mpesaForm.passkey,
                        environment: mpesaForm.environment,
                        confirmation_url: mpesaForm.confirmation_url,
                        validation_url: mpesaForm.validation_url,
                        stk_callback_url: mpesaForm.stk_callback_url,
                    },
                    is_default: defaultPaymentGateway === 'mpesa',
                    active: mpesaForm.is_active || false
                }];

            } else if (paymentGatewayMode === 'payhero') {
                if (!payheroForm.channel_id || !payheroForm.callback_url) {
                    const message = 'Channel ID and callback URL are required for Payhero.';
                    setError(message);
                    onSave(`Error: ${message}`);
                    return;
                }

                gateways = [{
                    provider: 'payhero',
                    config: {
                        channel_id: payheroForm.channel_id,
                        callback_url: payheroForm.callback_url,
                    },
                    is_default: defaultPaymentGateway === 'payhero',
                    active: payheroForm.is_active || false
                }];

            } else if (paymentGatewayMode === 'kopokopo') {
                if (!kopokopoForm.api_key || !kopokopoForm.callback_url) {
                    const message = 'API key and callback URL are required for KopoKopo.';
                    setError(message);
                    onSave(`Error: ${message}`);
                    return;
                }

                gateways = [{
                    provider: 'kopokopo',
                    config: {
                        api_key: kopokopoForm.api_key,
                        callback_url: kopokopoForm.callback_url,
                    },
                    is_default: defaultPaymentGateway === 'kopokopo',
                    active: kopokopoForm.is_active || false
                }];

            } else {
                const message = 'Invalid payment gateway mode.';
                setError(message);
                onSave(`Error: ${message}`);
                return;
            }

            await organizationApi.createPaymentGateway(gateways[0]);   

            await loadGateways();

            onSave('Payment gateway settings updated successfully');

        } catch (err: any) {
            const errorMsg = err.message || 'Failed to save payment gateway settings';
            setError(errorMsg);
            onSave(`Error: ${errorMsg}`);
        } finally {
            setCallApi(prev => !prev);
            setIsRegistering(false);
        }
    };

    const handleRegisterC2BUrls = async () => {
        setError(null);
        setIsRegistering(true);
    
        try {
          const paybill = mpesaForm.paybill?.trim() || '';
          const consumerKey = mpesaForm.consumer_key?.trim() || '';
          const consumerSecret = mpesaForm.consumer_secret?.trim() || '';
          const confirmationUrl = mpesaForm.confirmation_url?.trim() || '';
          const validationUrl = mpesaForm.validation_url?.trim() || '';
    
          if (!paybill || !consumerKey || !consumerSecret) {
            const message = 'Paybill, consumer key, and consumer secret are required.';
            setError(message);
            onSave(`Error: ${message}`);
            return;
          }
    
          await paymentsApi.registerC2BUrls({
            paybill,
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            environment: mpesaForm.environment,
            ...(confirmationUrl && { confirmation_url: confirmationUrl }),
            ...(validationUrl && { validation_url: validationUrl }),
          });
    
          onSave('C2B confirmation and validation URLs registered successfully');
        } catch (err: any) {
            const errorMsg = err.message || 'Failed to register C2B URLs';
            setError(errorMsg);
            onSave(`Error: ${errorMsg}`);
        } finally {
            setCallApi(prev => !prev);
            setIsRegistering(false);
        }
    };

    const loadGateways = async () => {
        setLoadingGateways(true);
        try {
            const res = await organizationApi.getPaymentGateways();
            if (res && Array.isArray(res.data)) {
                setGateways(res.data);
            }
        } catch (e) {
            // ignore
        } finally {
            setLoadingGateways(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs font-black uppercase text-gray-500 tracking-widest">Default payment gateway</p>
                <div className="flex flex-wrap gap-3">
                    {['mpesa', 'payhero', 'kopokopo'].map((gateway) => (
                        <label key={gateway} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer">
                            <input
                                type="radio"
                                name="defaultPaymentGateway"
                                value={gateway}
                                checked={defaultPaymentGateway === gateway}
                                onChange={() => {
                                    setPaymentGatewayMode(gateway as 'mpesa' | 'payhero' | 'kopokopo');
                                    setDefaultPaymentGateway(gateway as 'mpesa' | 'payhero' | 'kopokopo');
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="capitalize">{gateway}</span>
                        </label>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isRegistering}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2 active:scale-95"
                >
                    {isRegistering ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span>Save Default Payment</span>
                        </>
                    )}
                </button>
            </div>

            <p className="text-xs font-black uppercase text-gray-500 tracking-widest mt-8">Payment gateways</p>
            <div className="mb-3 inline-flex gap-2 rounded-xl border border-gray-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
                <button
                type="button"
                onClick={() => {setPaymentGatewayMode('mpesa')}}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    paymentGatewayMode === 'mpesa'
                    ? 'bg-green-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                    Mpesa
                </button>
                <button
                type="button"
                onClick={() => {setPaymentGatewayMode('payhero')}}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    paymentGatewayMode === 'payhero'
                    ? 'bg-yellow-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                    Payhero
                </button>
                <button
                type="button"
                onClick={() => {setPaymentGatewayMode('kopokopo')}}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    paymentGatewayMode === 'kopokopo'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                >
                    KopoKopo
                </button>
            </div>
            {paymentGatewayMode === 'mpesa' && ( <>
                <Card title={`M-Pesa Integration (Daraja API) - ${mpesaForm.provider}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Paybill / Shortcode</label>
                        <input 
                            type="text" 
                            value={mpesaForm.paybill}
                            onChange={e => setMpesaForm({ ...mpesaForm, paybill: e.target.value })}
                            placeholder="e.g. 174379" 
                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                        />
                        </div>
                        <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Consumer Key</label>
                        <input 
                            type="password" 
                            value={mpesaForm.consumer_key}
                            onChange={e => setMpesaForm({ ...mpesaForm, consumer_key: e.target.value })}
                            placeholder="••••••••••••••••" 
                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                        />
                        </div>
                        <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Consumer Secret</label>
                        <input 
                            type="password" 
                            value={mpesaForm.consumer_secret}
                            onChange={e => setMpesaForm({ ...mpesaForm, consumer_secret: e.target.value })}
                            placeholder="••••••••••••••••" 
                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                        />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Passkey</label>
                            <input 
                                type="password" 
                                value={mpesaForm.passkey}
                                onChange={e => setMpesaForm({ ...mpesaForm, passkey: e.target.value })}
                                placeholder="••••••••••••••••" 
                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Environment</label>
                            <select 
                                value={mpesaForm.environment}
                                onChange={e => setMpesaForm({ ...mpesaForm, environment: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold">
                                <option>Production</option>
                                <option>Sandbox (Testing)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Is Active</label>
                            <select 
                                value={mpesaForm.is_active ? 'true' : 'false'}
                                onChange={e => setMpesaForm({ ...mpesaForm, is_active: e.target.value === 'true' })}
                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold">
                                <option value="true">Yes</option>
                                <option value="false">No</option>
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
                        value={mpesaForm.confirmation_url}
                        onChange={e => setMpesaForm({ ...mpesaForm, confirmation_url: e.target.value })}
                        placeholder="https://your-ngrok-url.ngrok.io/api/payments/c2b/confirmation" 
                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono text-sm" 
                      />
                      <p className="text-[9px] text-gray-400 italic">Leave empty to use default server URL. Use ngrok/localtunnel for local testing.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Validation URL</label>
                      <input 
                        type="url" 
                        value={mpesaForm.validation_url}
                        onChange={e => setMpesaForm({ ...mpesaForm, validation_url: e.target.value })}
                        placeholder="https://your-ngrok-url.ngrok.io/api/payments/c2b/validation" 
                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono text-sm" 
                      />
                      <p className="text-[9px] text-gray-400 italic">Leave empty to use default server URL. Use ngrok/localtunnel for local testing.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">STK Callback URL</label>
                      <input
                        type="url"
                        value={mpesaForm.stk_callback_url}
                        onChange={e => setMpesaForm({ ...mpesaForm, stk_callback_url: e.target.value })}
                        placeholder="https://your-domain.com/api/payments/daraja/{token}/stk/callback"
                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono text-sm"
                      />
                      <p className="text-[9px] text-gray-400 italic">Required for Daraja STK push in this system. Stored in organization settings under payment-gateway.stk_callback_url.</p>
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
                <div className="flex gap-4 flex-wrap justify-end">
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
                        <button 
                            onClick={handleSave}
                            disabled={isRegistering}
                            type="button"
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2 active:scale-95"
                        >
                            {isRegistering ? (
                                <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Registering...</span>
                                </>
                            ) : (
                                <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Apply Changes</span>
                                </>
                            )}
                        </button>
                </div>
            </>
            )}
            {paymentGatewayMode === 'payhero' && ( <>
              <Card title={`Payhero Integration - ${payheroForm.provider}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Channel ID</label>
                    <input
                      type="text"
                      value={payheroForm.channel_id}
                      onChange={e => setPayheroForm({ ...payheroForm, channel_id: e.target.value })}
                      placeholder="Channel identifier"
                      className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Is Active</label>
                            <select 
                                value={payheroForm.is_active ? 'true' : 'false'}
                                onChange={e => setPayheroForm({ ...payheroForm, is_active: e.target.value === 'true' })}
                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold">
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                            </select>
                    </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Callback URL</label>
                    <input
                      type="url"
                      value={payheroForm.callback_url}
                      onChange={e => setPayheroForm({ ...payheroForm, callback_url: e.target.value })}
                      placeholder="https://isp.easytech.africa/api/payments/payhero/{token}/stk/callback"
                      className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 text-gray-900 dark:text-white font-mono text-sm"
                    />
                    <p className="text-[9px] text-gray-400 italic">Payhero callback URL used for STK callbacks. Keep this publicly accessible.</p>
                  </div>
                </div>
                <div className="flex mt-4 justify-end">
                        <button 
                            onClick={handleSave}
                            disabled={isRegistering}
                            type="button"
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2 active:scale-95"
                        >
                            {isRegistering ? (
                                <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Registering...</span>
                                </>
                            ) : (
                                <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Apply Changes</span>
                                </>
                            )}
                        </button>
                </div>
              </Card>
            </>
            )}
            {paymentGatewayMode === 'kopokopo' && ( <>
                <Card title={`KopoKopo Integration - ${kopokopoForm.provider}`}>
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                        <p>KopoKopo integration is currently under development. Please check back later for updates.</p>
                    </div>
                </Card>
            </>
            )}
        </div>
    );
};

export default PaymentGatewayCard;