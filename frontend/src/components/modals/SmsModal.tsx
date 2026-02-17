import React, { useEffect } from "react";
import { Modal } from "../UI";
import { toast } from "sonner";
import { organizationApi, smsApi } from "@/src/services/apiService";
import { Customer, Template } from "@/src/types";

const SmsModal = ({ state, actions, customer }: any) => {
    const [smsText, setSmsText] = React.useState('');
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
        if (!state.isSmsModalOpen) {
            setSelectedTemplate('custom');
            setSmsText('');
        }
    }, [state.isSmsModalOpen]);

    // Handle template selection
    const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateId = e.target.value;
        setSelectedTemplate(templateId);
        
        if (templateId === 'custom') {
            return;
        }
        
        const template = templates.find(t => t.id === templateId);
        if (template && customer) {
            // Personalize the template for this customer
            const personalizedMessage = personalizeMessage(template.content, customer);
            setSmsText(personalizedMessage);
        }
    };

    // Function to personalize message for the customer
    const personalizeMessage = (template: string, customer: Customer): string => {
        return template
            .replace(/{FirstName}/gi, customer.firstName || '')
            .replace(/{LastName}/gi, customer.lastName || '')
            .replace(/{Isp}/gi, (customer as any).organization?.name || 'ISP')
            .replace(/{Expiry}/gi, customer.expiryDate || '')
            .replace(/{PackageName}/gi, customer.package?.name || '')
            .replace(/{PaidAmount}/gi, (customer as any).lastPayment?.amount?.toString() || '0')
            .replace(/{PackageAmount}/gi, customer.package?.price?.toString() || '0')
            .replace(/{PhoneNumber}/gi, customer.phone || '');
    };

    const handleSendSms = async (customer: Customer) => {
      if (!smsText.trim()) {
          alert('Please enter a message');
          return;
      }
  
      try {
          actions.setIsSmsModalOpen(false);
          const originalText = personalizeMessage(smsText, customer);
          
          // Clear text or show loading
          setSmsText(''); 

          const response = await smsApi.send(customer.phone, originalText, customer.id);
          toast.success(`SMS sent successfully!`);
          
      } catch (err: any) {
          console.error('SMS send error:', err);
  
          // 1. Extract the specific error from the Laravel JSON response
          // This targets the 'error' or 'message' keys you defined in PHP
          const serverError = err.response?.data?.error || err.response?.data?.message;
          const fallbackError = err.message || 'Unknown error';
          
          // 2. Display the specific reason (e.g., "InvalidPhoneNumber")
          toast.error(`Failed: ${serverError || fallbackError}`);
          
          // 3. Restore the text so the user doesn't lose their draft
          setSmsText(smsText); 
          actions.setIsSmsModalOpen(true); // Re-open modal so they can fix the number/text
      }
    };
    return (
        <Modal isOpen={state.isSmsModalOpen} onClose={() => actions.setIsSmsModalOpen(false)} title={`Compose Transmission to ${customer.firstName}`}>
                 <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-3">
                       <div className="p-2 bg-emerald-600 rounded-lg text-white">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest leading-none mb-1">Destination Phone</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{customer.phone}</p>
                       </div>
                    </div>
                    
                    {/* Message Template Variables */}
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
                                setSmsText(prev => prev + ' ' + item.tag);
                                if (selectedTemplate !== 'custom') {
                                   setSelectedTemplate('custom');
                                }
                             }}
                             className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-md hover:bg-emerald-600 hover:text-white transition-colors"
                          >
                             {item.label}
                          </button>
                          ))}
                       </div>
                    </div>

                    <div>
                       <div className="flex justify-between items-end mb-2">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Message Body</label>
                          <select 
                             value={selectedTemplate}
                             onChange={handleTemplateChange}
                             className="text-[10px] font-bold bg-transparent border-none text-emerald-600 p-0 focus:ring-0 cursor-pointer"
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
                       <textarea 
                          value={smsText}
                          onChange={e => {
                             setSmsText(e.target.value);
                             if (selectedTemplate !== 'custom') {
                                setSelectedTemplate('custom');
                             }
                          }}
                          rows={4}
                          placeholder="Enter SMS content or select a template..."
                          className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                       />
                       <p className="text-[10px] text-right text-gray-400 font-bold mt-1 uppercase tracking-tighter">{smsText.length} Characters</p>
                    </div>
        
                    <div className="grid grid-cols-2 gap-3 pt-2">
                       <button 
                          onClick={() => actions.setIsSmsModalOpen(false)}
                          className="py-3 bg-gray-100 dark:bg-slate-800 text-gray-500 text-[10px] font-black uppercase rounded-xl"
                       >
                          Discard
                       </button>
                       <button 
                          onClick={() => handleSendSms(customer) }
                          className="py-3 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95"
                       >
                          Transmit SMS
                       </button>
                    </div>
                 </div>
        </Modal>
    );
};

export default SmsModal;