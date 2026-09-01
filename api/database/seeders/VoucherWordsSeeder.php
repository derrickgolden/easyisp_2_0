<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class VoucherWordsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $words = [
            // ANIMALS
            'LION', 'TIGER', 'BEAR', 'WOLF', 'FOX', 'EAGLE', 'HAWK', 'PANDA', 
            'KOALA', 'ZEBRA', 'HORSE', 'OTTER', 'LYNX', 'WHALE', 'SHARK', 
            'COBRA', 'PENGUIN', 'PEACOCK', 'DOLPHIN', 'CHEETAH',

            // NATURE
            'RIVER', 'CLOUD', 'RAIN', 'WIND', 'MOON', 'STAR', 'LAKE', 'TREE',
            'ROCK', 'FIRE', 'SNOW', 'WAVE', 'STORM', 'OCEAN', 'FOREST', 
            'MOUNTAIN', 'VALLEY', 'THUNDER', 'SUNSET', 'DAWN',

            // FOOD
            'APPLE', 'MANGO', 'PEAR', 'LEMON', 'PEACH', 'BERRY', 'GRAPE', 'MELON',
            'BREAD', 'HONEY', 'RICE', 'CAKE', 'PIZZA', 'PASTA', 'STEAK', 
            'SALAD', 'FISH', 'CHEESE', 'BUTTER', 'SUGAR',
        ];

        $data = array_map(function ($word) {
            return [
                'word' => $word,
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }, $words);

        DB::table('voucher_words')->insert($data);
    }
}
