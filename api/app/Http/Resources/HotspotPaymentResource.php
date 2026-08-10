<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HotspotPaymentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // $senderName = trim($this->sender_name ?? '');
        // $firstName = '';
        // $lastName = '';

        // if ($senderName !== '') {
        //     $parts = preg_split('/\s+/', $senderName) ?: [];
        //     $firstName = (string) array_shift($parts);
        //     $lastName = trim(implode(' ', $parts));
        // }

        return [
            'id' => (string) $this->id,
            'subscriberId' => $this->customer_id ? (string) $this->customer_id : '',
            'mpesaCode' => $this->mpesa_receipt,
            'amount' => (float) $this->amount,
            'billRef' => $this->account_reference,
            'phone' => $this->phone,
            'timestamp' => $this->created_at?->toISOString(),
            'status' => $this->status,
        ];
    }
}
