<?php

namespace App\Services;

use RouterOS\Client;
use RouterOS\Query;

class MikrotikService
{
    protected $client;

    public function __construct()
    {
        $this->client = new Client([
            'host' => config('mikrotik.host'),
            'user' => config('mikrotik.username'),
            'pass' => config('mikrotik.password'),
            'port' => (int) config('mikrotik.port'),
        ]);
    }

    public function getOnlineUsers()
    {
        $query = new Query('/ppp/active/print');

        return $this->client->query($query)->read();
    }
}