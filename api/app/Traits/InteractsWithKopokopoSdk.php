<?php

namespace App\Traits;

use Illuminate\Support\Facades\Log;
use Kopokopo\SDK\K2;

trait InteractsWithKopokopoSdk
{
    public function getSdk(array $settings): ?K2
    {
        $clientId = trim((string) data_get($settings, 'client_id', ''));
        $clientSecret = trim((string) data_get($settings, 'client_secret', ''));
        $apiKey = trim((string) data_get($settings, 'api_key', ''));

        if ($clientId === '' || $clientSecret === '' || $apiKey === '') {
            return null;
        }

        return new K2([
            'clientId' => $clientId,
            'clientSecret' => $clientSecret,
            'apiKey' => $apiKey,
            'baseUrl' => $this->getBaseUrl($settings),
        ]);
    }

    public function getBaseUrl(array $settings): string
    {
        $configuredBaseUrl = trim((string) data_get($settings, 'base_url', ''));
        if ($configuredBaseUrl !== '') {
            return rtrim($configuredBaseUrl, '/');
        }

        $environment = strtolower(trim((string) data_get($settings, 'environment', 'production')));
        if (str_contains($environment, 'sandbox')) {
            return 'https://sandbox.kopokopo.com';
        }

        return 'https://api.kopokopo.com';
    }

    public function getAccessToken(array $settings): ?string
    {
        $sdk = $this->getSdk($settings);
        if (! $sdk) {
            return null;
        }

        $tokenResponse = $sdk->TokenService()->getToken();

        if (! is_array($tokenResponse) || data_get($tokenResponse, 'status') !== 'success') {
            Log::error('KopoKopo token request returned a non-success status', [
                'response' => $tokenResponse,
            ]);

            return null;
        }

        $token = data_get($tokenResponse, 'data.accessToken')
            ?? data_get($tokenResponse, 'data.access_token');

        if (! is_string($token) || trim($token) === '') {
            return null;
        }

        return trim($token);
    }
}
