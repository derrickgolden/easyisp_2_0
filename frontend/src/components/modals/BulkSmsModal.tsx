import React, { useEffect } from "react";
import { Modal } from "../UI";
import { organizationApi, smsApi } from "../../services/apiService";
import { Template } from "@/src/types";
import { toast } from "sonner";
import { confirmAction } from "../../utils/alerts";

interface BulkSmsModalProps {
    isBulkSmsOpen: boolean;
    setIsBulkSmsOpen: (isOpen: boolean) => void;
    filteredCustomers: any[];
    totalCustomers?: number;
    activeFilters?: {
        searchTerm?: string;
        siteFilter?: string;
        statusFilter?: string;
        packageFilter?: string;
        locationFilter?: string;
        apartmentFilter?: string;
        houseNoFilter?: string;
        connectivityFilter?: string;
    };
    packages?: any[];
    sites?: any[];
}

const BulkSmsModal: React.FC<BulkSmsModalProps> = ({
    isBulkSmsOpen, 
    setIsBulkSmsOpen, 
    filteredCustomers,
    totalCustomers = 0,
    activeFilters = {},
    packages = [],
    sites = []
}) => {
    const [bulkSmsMessage, setBulkSmsMessage] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [sendingProgress, setSendingProgress] = React.useState({ current: 0, total: 0 });
    const [templates, setTemplates] = React.useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = React.useState<string>('custom');

    useEffect(() => {
        const fetchTemplates = async () => {
            const response = await organizationApi.get();

            const orgSettings = response?.settings || {};
            if (orgSettings['notes-template'] && Array.isArray(orgSettings['notes-template'].templates)) {
                setTemplates(orgSettings['notes-template'].templates);
            }
        };
        fetchTemplates();
    }, []);

    // Reset state when modal closes
    useEffect(() => {
        if (!isBulkSmsOpen) {
            setSelectedTemplate('custom');
            setBulkSmsMessage('');
        }
    }, [isBulkSmsOpen]);

    // Handle template selection
    const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateId = e.target.value;
        setSelectedTemplate(templateId);
        
        if (templateId === 'custom') {
            // Don't change the message if custom is selected
            return;
        }
        
        // Find the selected template and populate the message
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setBulkSmsMessage(template.content);
        }
    };

    // Function to personalize message for each customer
    const personalizeMessage = (template: string, customer: any): string => {
        return template
            .replace(/{FirstName}/gi, customer.firstName || '')
            .replace(/{LastName}/gi, customer.lastName || '')
            .replace(/{Isp}/gi, customer.organization?.name || 'ISP')
            .replace(/{Expiry}/gi, customer.expiryDate || '')
            .replace(/{PackageName}/gi, customer.package?.name || '')
            .replace(/{PaidAmount}/gi, customer.lastPayment?.amount?.toString() || '0')
            .replace(/{PackageAmount}/gi, customer.package?.price?.toString() || '0')
            .replace(/{PhoneNumber}/gi, customer.phone || '');
    };

    const handleBulkSmsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!bulkSmsMessage.trim()) {
            toast.error('Please enter a message');
            return;
        }

        if (filteredCustomers.length === 0) {
            toast.error('No customers to send SMS to');
            return;
        }

        const result = await confirmAction(
            'Send Bulk SMS?',
            `You are about to send SMS to ${filteredCustomers.length} customer(s). This action cannot be undone.`,
            {
                confirmButtonText: 'Send SMS',
                confirmButtonColor: '#2563eb',
                cancelButtonText: 'Cancel',
                icon: 'question'
            }
        );

        if (!result.isConfirmed) return;

        setIsSending(true);
        setSendingProgress({ current: 0, total: filteredCustomers.length });

        try {
            // Prepare recipients with personalized messages
            const recipients = filteredCustomers
                .filter(customer => customer.phone) // Only customers with phone numbers
                .map(customer => ({
                    phone: customer.phone,
                    message: personalizeMessage(bulkSmsMessage, customer),
                    customer_id: customer.id,
                }));

            if (recipients.length === 0) {
                toast.error('No customers with valid phone numbers found');
                return;
            }

            setSendingProgress({ current: 0, total: recipients.length });

            // Send bulk SMS - Now processed asynchronously in background
            const response = await smsApi.sendBulk(recipients);

            // Handle async response (202 Accepted)
            const { total_recipients, jobs_dispatched, estimated_time_minutes } = response.data;

            toast.success(
                `📤 Bulk SMS Queued Successfully!\n\n` +
                `📊 ${total_recipients} messages queued in ${jobs_dispatched} batches\n` +
                `⏱️ Estimated processing time: ${estimated_time_minutes} minutes\n\n` +
                `Messages will be sent in the background.`,
                { duration: 6000 }
            );

            setBulkSmsMessage('');
            setSelectedTemplate('custom');
            setIsBulkSmsOpen(false);

        } catch (error: any) {
            console.error('Bulk SMS Error:', error);
            const errorMessage = error?.response?.data?.message || error.message || 'Unknown error occurred';
            toast.error(`❌ Error sending bulk SMS: ${errorMessage}`);
        } finally {
            setIsSending(false);
            setSendingProgress({ current: 0, total: 0 });
        }
    };

    return (
        <Modal
        isOpen={isBulkSmsOpen}
        onClose={() => setIsBulkSmsOpen(false)}
        title="Bulk SMS Composer"
        maxWidth="max-w-3xl"
        >
            <form onSubmit={handleBulkSmsSubmit} className="space-y-6">
                
                {/* 1. Targeting Filters */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest ml-1">Targeting Filters</label>
                        <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        Targeting: {filteredCustomers.length} of {totalCustomers} Customers
                        </span>
                    </div>
                    
                    {/* Instructions & Active Filters */}
                    <div className="space-y-3">
                        {/* Info Message */}
                        <div className="flex items-start gap-2 bg-blue-100/50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-[11px] text-blue-700 dark:text-blue-300">
                                <p className="font-bold">Filters Applied from Main Page</p>
                                <p className="text-blue-600 dark:text-blue-400 mt-0.5">To change targeting, close this pop up and adjust filters on the Customers page, then reopen.</p>
                            </div>
                        </div>

                        {/* Active Filters Display */}
                        {(() => {
                            const filters = [];
                            if (activeFilters.searchTerm) filters.push({ label: 'Search', value: activeFilters.searchTerm });
                            if (activeFilters.statusFilter) filters.push({ label: 'Status', value: activeFilters.statusFilter });
                            if (activeFilters.packageFilter) {
                                const pkg = packages.find(p => p.id === activeFilters.packageFilter);
                                filters.push({ label: 'Package', value: pkg?.name || activeFilters.packageFilter });
                            }
                            if (activeFilters.siteFilter) {
                                const site = sites.find(s => s.id === activeFilters.siteFilter);
                                filters.push({ label: 'Site', value: site?.name || activeFilters.siteFilter });
                            }
                            if (activeFilters.locationFilter) filters.push({ label: 'Location', value: activeFilters.locationFilter });
                            if (activeFilters.apartmentFilter) filters.push({ label: 'Apartment', value: activeFilters.apartmentFilter });
                            if (activeFilters.houseNoFilter) filters.push({ label: 'House No', value: activeFilters.houseNoFilter });
                            if (activeFilters.connectivityFilter && activeFilters.connectivityFilter !== 'all') {
                                filters.push({ label: 'Connectivity', value: activeFilters.connectivityFilter });
                            }

                            return filters.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Active Filters:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {filters.map((filter, idx) => (
                                            <div key={idx} className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">{filter.label}:</span>
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{filter.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-2">
                                    <p className="text-[10px] font-bold text-gray-400">No filters applied - targeting all customers</p>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* 2. Message Template Variables */}
                <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Personalization Tags (Click to add)</label>
                <div className="flex flex-wrap gap-1.5">
                    {[
                    { tag: '{FirstName}', label: 'First Name' },
                    { tag: '{LastName}', label: 'Last Name' },
                    { tag: '{Isp}', label: 'ISP Name' },
                    { tag: '{Expiry}', label: 'Expiry Date' },
                    { tag: '{PackageName}', label: 'Package' },
                    { tag: '{PaidAmount}', label: 'Paid Amt' },
                    { tag: '{PackageAmount}', label: 'Price' },
                    { tag: '{PhoneNumber}', label: 'Phone' },
                    ].map(item => (
                    <button
                        key={item.tag}
                        type="button"
                        onClick={() => {
                            setBulkSmsMessage(prev => prev + ' ' + item.tag);
                            // Set to custom when adding tags manually
                            if (selectedTemplate !== 'custom') {
                                setSelectedTemplate('custom');
                            }
                        }}
                        className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-md hover:bg-blue-600 hover:text-white transition-colors"
                    >
                        {item.label}
                    </button>
                    ))}
                </div>
                </div>

                {/* 3. Message Body */}
                <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Message Body</label>
                    <div className="flex gap-2">
                    <select 
                        value={selectedTemplate}
                        onChange={handleTemplateChange}
                        className="text-[10px] font-bold bg-transparent border-none text-blue-600 p-0 focus:ring-0 cursor-pointer"
                    >
                        <option value="custom">Custom Message</option>
                        {templates.filter(t => t.category === 'SMS').map(template => (
                        <option 
                            key={template.id}
                            value={template.id}
                        >
                            {template.name}
                        </option>
                        ))} 
                    </select>
                    </div>
                </div>
                <textarea
                    required
                    rows={6}
                    value={bulkSmsMessage}
                    onChange={e => {
                        setBulkSmsMessage(e.target.value);
                        // Reset to custom when user manually edits the message
                        if (selectedTemplate !== 'custom') {
                            setSelectedTemplate('custom');
                        }
                    }}
                    placeholder="Type your message here or click tags above..."
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm leading-relaxed"
                />
                <div className="flex justify-between text-[10px] font-bold text-gray-400 mt-1 px-1">
                    <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Variables will be replaced per recipient
                    </span>
                    <span className={bulkSmsMessage.length > 160 ? "text-orange-500" : ""}>
                    {bulkSmsMessage.length} / 160 Characters ({~~((bulkSmsMessage.length / 160) + 1)} SMS)
                    </span>
                </div>
                </div>

                {/* 4. Footer Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                    type="button"
                    onClick={() => setIsBulkSmsOpen(false)}
                    disabled={isSending}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Discard
                </button>
                <button
                    type="submit"
                    disabled={isSending}
                    className="px-8 py-2.5 rounded-xl text-sm font-black bg-blue-600 text-white shadow-xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isSending ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending... {sendingProgress.current > 0 && `(${sendingProgress.current}/${sendingProgress.total})`}
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            Broadcast Message
                        </>
                    )}
                </button>
                </div>
            </form>
        </Modal>
    );
};

export default BulkSmsModal;