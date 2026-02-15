import { Modal } from "../UI";
import { useState, useEffect } from "react";
import { customersApi, packagesApi } from "../../services/apiService";
import { toast } from "sonner";
import { Customer, Package } from "../../types";
import { STORAGE_KEYS } from "@/src/constants/storage";

interface ChangePackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSuccess?: () => void;
}

export const ChangePackageModal: React.FC<ChangePackageModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch packages when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchPackages = async () => {
      setIsFetching(true);
      try {
        // Try to get from localStorage first
        const cached = localStorage.getItem(STORAGE_KEYS.PACKAGES);
        if (cached) {
          setPackages(JSON.parse(cached));
        }

        // Fetch fresh from API
        const res = await packagesApi.getAll();
        const packageList = res.data || [];
        setPackages(packageList);
        localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(packageList));
      } catch (error) {
        console.error("Error fetching packages:", error);
        toast.error("Failed to load packages");
      } finally {
        setIsFetching(false);
      }
    };

    fetchPackages();
  }, [isOpen]);

  const handlePackageChange = async () => {
    if (!customer?.id || !selectedPackageId) {
      toast.error("Please select a package");
      return;
    }

    if (selectedPackageId === customer.packageId) {
      toast.error("Please select a different package than the current one");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        package_id: selectedPackageId,
      };

      await customersApi.update(String(customer.id), payload);

      const selectedPkg = packages.find((p) => p.id === selectedPackageId);
      toast.success(
        `Subscription updated to ${selectedPkg?.name} successfully!`
      );

      setSelectedPackageId("");
      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast.error(
        error.message || "Failed to update subscription. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const currentPackage = packages.find((p) => p.id === customer?.packageId);
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Subscription Plan"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Current Package Info */}
        {currentPackage && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800">
            <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest mb-2">
              Current Subscription
            </p>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {currentPackage.name}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {currentPackage.speed_down} / {currentPackage.speed_up}
                </p>
              </div>
              <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                KSH {currentPackage.price.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Package Selection */}
        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block mb-3">
            Select New Package
          </label>
          {isFetching ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-gray-500">Loading packages...</span>
            </div>
          ) : packages.length === 0 ? (
            <div className="py-6 text-center text-gray-500">
              <p className="text-sm">No packages available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackageId(pkg.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedPackageId === pkg.id
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                      : pkg.id === customer?.packageId
                      ? "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 opacity-60"
                      : "border-gray-200 dark:border-slate-700 hover:border-blue-400"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-white">
                        {pkg.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        {pkg.speed_down} / {pkg.speed_up}
                      </p>
                    </div>
                    {pkg.id === customer?.packageId && (
                      <span className="text-[8px] font-black uppercase text-gray-400 bg-gray-200 dark:bg-slate-700 px-2 py-1 rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-slate-700">
                    <span className="text-[10px] text-gray-500">
                      {pkg.validity_days} days
                    </span>
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                      KSH {pkg.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Package Summary */}
        {selectedPackage && selectedPackage.id !== customer?.packageId && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800">
            <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest mb-2">
              New Package Summary
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Package Name:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {selectedPackage.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Speed:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {selectedPackage.speed_down} / {selectedPackage.speed_up}
                </span>
              </div>
              <div className="flex justify-between border-t border-emerald-200 dark:border-emerald-800 pt-2 mt-2">
                <span className="text-gray-600 dark:text-gray-400 font-bold">
                  Monthly Cost:
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  KSH {selectedPackage.price.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-[10px] font-black uppercase rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handlePackageChange}
            disabled={isLoading || !selectedPackageId || selectedPackageId === customer?.packageId}
            className={`py-3 text-[10px] font-black uppercase rounded-xl transition-all ${
              isLoading || !selectedPackageId || selectedPackageId === customer?.packageId
                ? "bg-blue-400 dark:bg-blue-800 text-white opacity-60 cursor-not-allowed"
                : "bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Updating...
              </span>
            ) : (
              "Update Plan"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
