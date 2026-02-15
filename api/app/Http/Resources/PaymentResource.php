<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $senderName = trim($this->sender_name ?? '');
        $firstName = '';
        $lastName = '';

        if ($senderName !== '') {
            $parts = preg_split('/\s+/', $senderName) ?: [];
            $firstName = (string) array_shift($parts);
            $lastName = trim(implode(' ', $parts));
        }

        return [
            'id' => (string) $this->id,
            'subscriberId' => $this->customer_id ? (string) $this->customer_id : '',
            'mpesaCode' => $this->mpesa_code,
            'amount' => (float) $this->amount,
            'billRef' => $this->bill_ref,
            'phone' => $this->phone,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'timestamp' => $this->created_at?->toISOString(),
            'status' => $this->status,
        ];
    }
}
