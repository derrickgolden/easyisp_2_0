<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class EasyIspApi
{
    protected string $baseUrl;
    protected string $token;

    public function __construct()
    {
        $this->baseUrl = rtrim(
            config('services.easyisp.url'),
            '/'
        );

        $this->token = config('services.easyisp.token');

        if (!$this->baseUrl) {
            throw new RuntimeException('EASYISP_API_URL is not configured.');
        }
    }

    protected function client()
    {
        return Http::baseUrl($this->baseUrl)
            ->acceptJson()
            ->asJson()
            ->timeout(10)
            ->connectTimeout(5)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $this->token,
                'X-Client' => 'customer-portal',
            ]);
    }

    public function customerByIp(string $ip): array
    {
        $response = $this->client()
            ->get('/api/customer/resolve-portal', [
                'client_ip' => $ip,
                'nas_ip' => '10.20.20.10',
            ]);

        $this->throwIfFailed($response);

        return $this->decodeResponseJson($response);
    }

    public function customer(int $customerId): array
    {
        $response = $this->client()
            ->get("/api/customer/{$customerId}");

        $this->throwIfFailed($response);

        return $this->decodeResponseJson($response);
    }

    public function packages(?int $siteId = null): array
    {
        $query = [];

        if ($siteId !== null) {
            $query['site_id'] = $siteId;
        }

        $response = $this->client()
            ->get('/api/customer/packages', $query);

        $this->throwIfFailed($response);

        return $this->decodeResponseJson($response);
    }

    public function initiatePayment(
        int $customerId,
        int $packageId,
        string $phone
    ): array {
        $response = $this->client()
            ->post('/api/customer/payments/initiate', [
                'customer_id' => $customerId,
                'package_id' => $packageId,
                'phone' => $phone,
            ]);

        $this->throwIfFailed($response);

        return $this->decodeResponseJson($response);
    }

    protected function throwIfFailed(Response $response): void
    {
        if ($response->successful()) {
            return;
        }

        logger()->error('EasyISP API error', [
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        throw new RuntimeException(
            'EasyISP API request failed with status ' .
            $response->status()
        );
    }

    protected function decodeResponseJson(Response $response): array
    {
        $payload = $response->json();

        if (!is_array($payload)) {
            logger()->error('EasyISP API invalid JSON response', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new RuntimeException('EasyISP API returned invalid JSON.');
        }

        return $payload;
    }
}