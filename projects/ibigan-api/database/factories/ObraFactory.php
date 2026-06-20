<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Obra;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Obra> */
class ObraFactory extends Factory
{
    protected $model = Obra::class;

    public function definition(): array
    {
        return [
            'codigo' => $this->uniqueCodigo(),
            'nome' => fake()->company(),
            'endereco' => fake()->streetAddress(),
            'responsavel' => fake()->name(),
            'is_ativa' => true,
        ];
    }

    private function uniqueCodigo(): string
    {
        do {
            $codigo = fake()->numerify('######');
        } while (Obra::query()->where('codigo', $codigo)->exists());

        return $codigo;
    }
}
