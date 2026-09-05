import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../UI';
import { Package } from '../../types';

interface PCQConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  package: Partial<Package> | null;
}

export const PCQConfigModal: React.FC<PCQConfigModalProps> = ({ isOpen, onClose, package: selectedPackage }) => {
  const [copied, setCopied] = useState(false);
  const companyAcronym = useMemo(() => {
    try {
      const savedUser = localStorage.getItem('easy-tech-auth');
      return savedUser
        ? (JSON.parse(savedUser) as { companyAcronym?: string }).companyAcronym?.trim()
        : undefined;
    } catch {
      return undefined;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !companyAcronym) {
      window.alert('Company acronym is missing. Please set it in Settings before generating PCQ configuration.');
      onClose();
    }
  }, [companyAcronym, isOpen, onClose]);

  const config = useMemo(() => {
    const download = selectedPackage?.speed_down;
    const upload = selectedPackage?.speed_up;
    const packageKey = `${upload}-${download}`;
    const packageName = (selectedPackage?.name || 'unknown-package').trim().replace(/\s+/g, '-');
    const downloadQueueName = `pcq-${packageName}-${download}-download`;
    const uploadQueueName = `pcq-${packageName}-${upload}-upload`;
    return `# ${upload} upload / ${download} download package
/queue type
  add name=${downloadQueueName} \\
    kind=pcq \\
    pcq-rate=${download} \\
    pcq-classifier=dst-address

add name=${uploadQueueName} \\
    kind=pcq \\
    pcq-rate=${upload} \\
    pcq-classifier=src-address

# Packet marks
/ip firewall mangle
add chain=forward \\
  src-address-list=PCQ-${companyAcronym}-${packageName}-${packageKey} \\
    action=mark-packet \\
    new-packet-mark=pcq-${packageName}-${packageKey}-upload \\
    passthrough=yes

add chain=forward \\
  dst-address-list=PCQ-${companyAcronym}-${packageName}-${packageKey} \\
    action=mark-packet \\
    new-packet-mark=pcq-${packageName}-${packageKey}-download \\
    passthrough=yes

# Queue tree
/queue tree
add name=PCQ-${packageName}-${upload}-${download}-DOWNLOAD \\
    parent=global \\
    packet-mark=pcq-${packageName}-${packageKey}-download \\
    queue=${downloadQueueName}

add name=PCQ-${packageName}-${upload}-${download}-UPLOAD \\
    parent=global \\
    packet-mark=pcq-${packageName}-${packageKey}-upload \\
    queue=${uploadQueueName}`;
  }, [companyAcronym, selectedPackage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Unable to copy PCQ configuration:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`PCQ Configuration${selectedPackage?.name ? `: ${selectedPackage.name}` : ''}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            MikroTik RouterOS configuration for {selectedPackage?.speed_down} download and {selectedPackage?.speed_up} upload.
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            {copied ? 'Copied' : 'Copy Config'}
          </button>
        </div>
        <pre className="max-h-[55vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100 whitespace-pre-wrap">
          <code>{config}</code>
        </pre>
      </div>
    </Modal>
  );
};