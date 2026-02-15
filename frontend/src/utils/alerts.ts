// utils/alerts.ts
import Swal from 'sweetalert2';

interface ConfirmActionOptions {
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  icon?: 'warning' | 'info' | 'success' | 'error' | 'question';
}

export const confirmAction = (
  title: string,
  text: string,
  options: ConfirmActionOptions = {}
) => {
  const isDark = document.documentElement.classList.contains('dark');

  return Swal.fire({
    title,
    text,
    icon: options.icon || 'warning',
    showCancelButton: true,
    confirmButtonColor: options.confirmButtonColor || '#dc2626',
    cancelButtonColor: options.cancelButtonColor || '#64748b',
    confirmButtonText: options.confirmButtonText || 'Yes, proceed',
    cancelButtonText: options.cancelButtonText || 'Cancel',
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#0f172a',
    allowOutsideClick: () => !Swal.isLoading(),
  });
};