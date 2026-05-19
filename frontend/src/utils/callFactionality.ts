// Utility to detect mobile device
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Format phone to 0700000000
  function formatPhone(phone?: string): string {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254')) {
      digits = '0' + digits.slice(3);
    } else if (digits.startsWith('7') && digits.length === 9) {
      digits = '0' + digits;
    } else if (digits.startsWith('1') && digits.length === 9) {
      digits = '0' + digits;
    }
    return digits.slice(0, 10);
  }

  export { isMobileDevice, formatPhone };