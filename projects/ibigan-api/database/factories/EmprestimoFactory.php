<?php

declare(strict_types=1);

namespace Database\Factories;

use Database\Factories\Concerns\PicsumImage;
use App\Models\Emprestimo;
use App\Models\Equipamento;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Emprestimo> */
class EmprestimoFactory extends Factory
{
    protected $model = Emprestimo::class;

    public function definition(): array
    {
        return [
            'equipamento_id' => Equipamento::factory(),
            'obra_id' => Obra::factory(),
            'colaborador_nome' => fake()->name(),
            'colaborador_matricula' => fake()->numerify('######'),
            'colaborador_whatsapp' => fake()->numerify('119########'),
            'data_retirada' => now()->subDays(5)->toDateString(),
            'data_devolucao' => null,
            'prazo_dias' => 15,
            'foto_cracha_path' => PicsumImage::url(),
            'foto_equipamento_retirada_path' => PicsumImage::url(),
            'foto_assinatura_path' => PicsumImage::url(),
            'autorizado_por' => User::factory(),
            'observacoes' => null,
        ];
    }

    public function encerrado(): static
    {
        return $this->state([
            'data_devolucao' => now()->toDateString(),
        ]);
    }
}
