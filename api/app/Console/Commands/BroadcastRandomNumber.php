<?php

namespace App\Console\Commands;

use App\Events\RandomNumberBroadcasted;
use Illuminate\Console\Command;

class BroadcastRandomNumber extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reverb:broadcast-random {--min=1} {--max=9999}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Broadcast a random number over Reverb for testing';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $min = (int) $this->option('min');
        $max = (int) $this->option('max');

        if ($min >= $max) {
            $this->error('The min option must be less than max.');

            return self::FAILURE;
        }

        $number = random_int($min, $max);

        event(new RandomNumberBroadcasted($number));

        $this->info("Broadcasted random number: {$number}");

        return self::SUCCESS;
    }
}
