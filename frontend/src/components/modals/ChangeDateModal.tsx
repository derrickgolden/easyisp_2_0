import { Modal } from "../UI";
import { useEffect, useState } from "react";
import { customersApi } from "../../services/apiService";
import { toast } from "sonner";
import { Customer } from "../../types";

interface ChangeDateModalProps {
  isChangeDateModalOpen: {open: boolean, type: string};
  setIsChangeDateModalOpen: ({open, type}) => void;
  customer?: Customer | null;
  onSuccess?: () => void;
}

export const ChangeDateModal: React.FC<ChangeDateModalProps> = ({
  isChangeDateModalOpen,
  setIsChangeDateModalOpen,
  customer,
  onSuccess,
}) => {
  const [newDate, setNewDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() =>{
    if(!isChangeDateModalOpen.type) setIsChangeDateModalOpen({open: false, type: ''})
  }, []);

  const handleDateChange = async () => {
    if (!customer?.id || !newDate) {
      toast.error("Please select a date");
      return;
    }

    setIsLoading(true);
    try {
      const payload =
        isChangeDateModalOpen.type === "expiry"
          ? { expiry_date: newDate }
          : { extension_date: newDate };

        console.log({payload})

      await customersApi.update(String(customer.id), payload);

      toast.success(
        isChangeDateModalOpen.type === "expiry"
          ? "Expiry date updated successfully!"
          : "Extension date updated successfully!"
      );

      setNewDate("");
      setIsChangeDateModalOpen({open: false, type: ''});
      onSuccess?.();
    } catch (error: any) {
      toast.error(
        error.message || "Failed to update date. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNewDate("");
    setIsChangeDateModalOpen({open: false, type: ''});
  };

  return (
    <Modal
      isOpen={isChangeDateModalOpen.open}
      onClose={handleClose}
      title={ isChangeDateModalOpen.type === 'expiry'? "Change expiry date" : 'Extend subscription'}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            {isChangeDateModalOpen.type === "expiry" ? "New Expiry Date" : "Extension Date"}
          </label>
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 p-4 rounded-xl font-bold border border-gray-200 dark:border-slate-700 mb-4"
          />
          {customer && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {isChangeDateModalOpen.type === "expiry"
                ? `Current expiry: ${new Date(customer.expiryDate).toLocaleString()}`
                : `Current extension: ${
                    customer.extensionDate
                      ? new Date(customer.extensionDate).toLocaleString()
                      : "Not set"
                  }`}
            </p>
          )}
        </div>

        <button
          onClick={handleDateChange}
          disabled={isLoading || !newDate}
          className={`w-full py-4 rounded-xl font-black shadow-lg transition-all ${
            isLoading || !newDate
              ? "bg-gray-400 text-gray-600 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20"
          }`}
        >
          {isLoading ? "Updating..." : "Commit Renewal"}
        </button>
      </div>
    </Modal>
  );
};