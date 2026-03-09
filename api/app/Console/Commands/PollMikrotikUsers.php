<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\MikrotikService;
use App\Events\OnlineUsersUpdated;

class PollMikrotikUsers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'mikrotik:poll-users';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Polls Mikrotik for online users and broadcasts the update';

    /**
     * Execute the console command.
     */
    public function handle(MikrotikService $mikrotik)
    {
        $users = $mikrotik->getOnlineUsers();

        broadcast(new OnlineUsersUpdated($users));
    }
}
