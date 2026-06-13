<?php

namespace App\Services;

class PhoneNumberService
{
    /**
     * Normalize Kenyan phone input to 254XXXXXXXXX format.
     *
     * Supported inputs:
     * - 0712345678
     * - 712345678
     * - 254712345678
     * - +254712345678
     *
     * @param string $phone
     * @return string|null
     */
    public static function normalizeToE164(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone);

        if (!$digits) {
            return null;
        }

        if (str_starts_with($digits, '0') && strlen($digits) === 10) {
            return '254' . substr($digits, 1);
        }

        if (strlen($digits) === 9 && (str_starts_with($digits, '7') || str_starts_with($digits, '1'))) {
            return '254' . $digits;
        }

        if (preg_match('/^254(7|1)\d{8}$/', $digits)) {
            return $digits;
        }

        return null;
    }

    /**
     * Normalize Kenyan 254XXXXXXXXX format to local 0XXXXXXXXX format.
     *
     * Supported input:
     * - 254712345678
     * - +254712345678
     *
     * @param string $phone
     * @return string|null
     */
    public static function normalizeToLocal(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone);

        if (!$digits) {
            return null;
        }

        if (preg_match('/^254(7|1)\d{8}$/', $digits)) {
            return '0' . substr($digits, 3);
        }

        if (str_starts_with($digits, '0') && strlen($digits) === 10 && (str_starts_with($digits, '07') || str_starts_with($digits, '01'))) {
            return $digits;
        }

        return null;
    }
}
