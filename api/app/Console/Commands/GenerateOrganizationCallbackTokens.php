<?php

namespace App\Console\Commands;

use App\Models\Organization;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class GenerateOrganizationCallbackTokens extends Command
{
    protected $signature = 'org:generate-callback-tokens
                            {organizationAcronym : Generate token for a single organization acronym (if missing)}
                            {--length=20 : Token length (minimum 12)}';

    protected $description = 'Generate unique M-Pesa callback tokens for organizations';

    public function handle(): int
    {
        $length = (int) $this->option('length');
        if ($length < 12) {
            $this->error('Token length must be at least 12.');
            return self::FAILURE;
        }

        $organizationAcronym = trim((string) $this->argument('organizationAcronym'));
        $organizations = Organization::whereRaw('LOWER(acronym) = ?', [strtolower($organizationAcronym)])->get();

        if ($organizations->isEmpty()) {
            $this->error("Organization with acronym '{$organizationAcronym}' not found.");
            return self::FAILURE;
        }

        if ($organizations->count() > 1) {
            $this->error("Multiple organizations found with acronym '{$organizationAcronym}'.");
            $this->line('Please make organization acronyms unique before using acronym-based generation.');
            return self::FAILURE;
        }

        $organization = $organizations->first();

        if (!empty($organization->mpesa_callback_token)) {
            $this->warn("Organization {$organization->id} already has a callback token. No changes made.");
            return self::SUCCESS;
        }

        $token = $this->generateUniqueToken($length);
        $organization->mpesa_callback_token = $token;
        $organization->save();

        $this->info("Generated token for organization {$organization->id} ({$organization->name}).");
        $this->line("Callback URL: /payments/c2b/{$token}/validation");
        $this->line("Callback URL: /payments/c2b/{$token}/confirmation");
        $this->line("Callback URL: /payments/payhero/{$token}/stk/callback");
        $this->line("Callback URL: /payments/daraja/{$token}/stk/callback");

        return self::SUCCESS;
    }

    private function generateUniqueToken(int $length): string
    {
        do {
            $token = Str::random($length);
        } while (Organization::where('mpesa_callback_token', $token)->exists());

        return $token;
    }
}
