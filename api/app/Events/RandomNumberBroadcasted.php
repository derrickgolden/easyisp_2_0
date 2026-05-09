<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RandomNumberBroadcasted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $number;
    public string $generatedAt;

    public function __construct(int $number)
    {
        $this->number = $number;
        $this->generatedAt = now()->toIso8601String();
    }

    public function broadcastOn(): array
    {
        return [new Channel('test.random-numbers')];
    }

    public function broadcastAs(): string
    {
        return 'test.random-number';
    }

    public function broadcastVia(): array
    {
        return ['reverb'];
    }

    public function broadcastWith(): array
    {
        return [
            'number' => $this->number,
            'generatedAt' => $this->generatedAt,
        ];
    }
}
