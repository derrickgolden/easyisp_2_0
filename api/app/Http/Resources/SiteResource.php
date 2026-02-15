<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SiteResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'location' => $this->location,
            'routers_count' => 1,
            'status' => $this->is_online ? 'online' : 'offline',
            'ip_address' => $this->ip_address,
            'notify_on_down' => (bool) $this->notify_on_down,
            'last_seen' => $this->last_seen
                ? (is_string($this->last_seen)
                    ? \Illuminate\Support\Carbon::parse($this->last_seen)->toISOString()
                    : $this->last_seen->toISOString())
                : null,
        ];
    }
}