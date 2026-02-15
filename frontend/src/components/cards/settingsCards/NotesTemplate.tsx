import React, { useEffect, useState } from "react";
import { Badge, Card, Modal } from "../../UI";
import { organizationApi } from "@/src/services/apiService";
import { toast } from "sonner";
import { confirmAction } from "../../../utils/alerts";

interface Template {
  id: string;
  name: string;
  content: string;
  category: 'Billing' | 'SMS' | 'Email' | 'System';
  isDefault?: boolean;
}

const NotesTemplate = () => {
    const [templates, setTemplates] = React.useState<Template[]>([]);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    useEffect(() => {
        const fetchTemplates = async () => {
            const response = await organizationApi.get();
            console.log('Organization settings response:', response);
            const orgSettings = response?.settings || {};
            if (orgSettings['notes-template'] && Array.isArray(orgSettings['notes-template'].templates)) {
                setTemplates(orgSettings['notes-template'].templates);
            }
        };
        fetchTemplates();
    }, []);

    const handleDeleteTemplate = async (id: string) => {
        const target = templates.find(t => t.id === id);
        if (!target || target.isDefault) return;

        const result = await confirmAction(
            'Delete template?',
            `This will permanently remove "${target.name}".`,
            {
                confirmButtonText: 'Delete',
            }
        );

        if (!result.isConfirmed) return;

        setIsLoading(true);
        try {
            const updatedTemplates = templates.filter(t => t.id !== id);
            await organizationApi.update({
                settings: {
                    'notes-template': {
                        templates: updatedTemplates,
                    },
                },
            });

            setTemplates(updatedTemplates);
            toast.success('Template deleted successfully!');
        } catch (error) {
            console.error('Failed to delete template', error);
            toast.error('Failed to delete template');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditTemplate = (template: Template) => {
        setEditingTemplate(template);
        setIsTemplateModalOpen(true);
    };

    const handleOpenNewTemplate = () => {
        setEditingTemplate({ name: '', content: '', category: 'SMS' });
        setIsTemplateModalOpen(true);
    };

    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTemplate?.name || !editingTemplate?.content) return;

        setIsLoading(true);
        try {
            let updatedTemplates: Template[] = [];

            if (editingTemplate.id) {
                updatedTemplates = templates.map(t =>
                    t.id === editingTemplate.id
                        ? {
                            ...t,
                            name: editingTemplate.name as string,
                            content: editingTemplate.content as string,
                            category: (editingTemplate.category as any) || t.category,
                        }
                        : t
                );
            } else {
                const template: Template = {
                    id: Date.now().toString(),
                    name: editingTemplate.name,
                    content: editingTemplate.content,
                    category: (editingTemplate.category as any) || 'SMS',
                };
                updatedTemplates = [...templates, template];
            }

            await organizationApi.update({
                settings: {
                    'notes-template': {
                        templates: updatedTemplates,
                    },
                },
            });

            toast.success('Template saved successfully!');
            setTemplates(updatedTemplates);
            setIsTemplateModalOpen(false);
            setEditingTemplate(null);
        } catch (error) {
            console.error('Failed to save template', error);
            toast.error('Failed to save template');
        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
               <div>
                  <h3 className="font-black text-xl text-gray-900 dark:text-white tracking-tight">Message Templates</h3>
                  <p className="text-xs text-gray-500 font-medium">Standard patterns for automated client notifications.</p>
               </div>
               <button 
                  onClick={handleOpenNewTemplate}
                  type="button" 
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  New Template
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {templates.map(tmpl => (
                  <div key={tmpl.id} className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-gray-100 dark:border-slate-800 shadow-sm relative group">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                           <Badge variant="active">{tmpl.category}</Badge>
                           <h4 className="mt-2 font-black text-gray-900 dark:text-white">{tmpl.name}</h4>
                        </div>
                        <div className="flex gap-1">
                           <button 
                              onClick={() => handleEditTemplate(tmpl)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                           >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                           </button>
                                                      {!tmpl.isDefault && (
                              <button 
                                 onClick={() => handleDeleteTemplate(tmpl.id)}
                                 className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                              >
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                           )}
                        </div>
                     </div>
                     <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                           {tmpl.content}
                        </p>
                     </div>
                  </div>
               ))}
            </div>

            <Modal 
                isOpen={isTemplateModalOpen} 
                onClose={() => setIsTemplateModalOpen(false)} 
                title={editingTemplate?.id ? "Edit Message Template" : "Create Message Template"}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleSaveTemplate} className="space-y-5">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 mb-2">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Placeholder Guide</p>
                    <p className="text-[9px] text-blue-500 leading-tight">
                    Use variables like <code className="bg-white dark:bg-slate-800 px-1 rounded">{"{name}"}</code>, 
                    <code className="bg-white dark:bg-slate-800 px-1 rounded">{"{expiry}"}</code>, 
                    <code className="bg-white dark:bg-slate-800 px-1 rounded">{"{price}"}</code>, and 
                    <code className="bg-white dark:bg-slate-800 px-1 rounded">{"{id}"}</code> for dynamic insertion.
                    </p>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Template Name</label>
                    <input 
                    required
                    type="text" 
                    value={editingTemplate?.name || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
                    placeholder="e.g. Payment Confirmation"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Category</label>
                <div className="relative">
                    <select 
                        value={editingTemplate?.category || 'Billing'}
                        onChange={e => setEditingTemplate({...editingTemplate, category: e.target.value as any})}
                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold appearance-none"
                    >
                        <option>Billing</option>
                        <option>SMS</option>
                        <option>Email</option>
                        <option>System</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
                </div>
                <div className="flex flex-col justify-end pb-1 pl-1">
                    <Badge variant={editingTemplate?.isDefault ? 'active' : 'suspended'}>
                    {editingTemplate?.isDefault ? 'SYSTEM PROTECTED' : 'CUSTOM TEMPLATE'}
                    </Badge>
                </div>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Content Body</label>
                    <textarea 
                    required
                    rows={5}
                    value={editingTemplate?.content || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-4 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm font-mono leading-relaxed" 
                    placeholder="Dear {name}, thank you for your payment of KSH {price}..."
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-500 transition-all active:scale-95 group flex items-center justify-center gap-2 disabled:opacity-60"
                >
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {isLoading ? "Saving..." : editingTemplate?.id ? "Apply Template Changes" : "Save New Template"}
                </button>
                </form>
            </Modal>
        </div>
    );
};

export default NotesTemplate;