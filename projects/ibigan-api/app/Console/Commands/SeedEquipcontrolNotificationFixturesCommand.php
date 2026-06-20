<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Emprestimo;
use App\Models\Equipamento;
use App\Models\Manutencao;
use App\Models\Obra;
use App\Models\User;
use App\Services\EquipcontrolAlertScanner;
use App\Services\NotificationPreferenceService;
use Illuminate\Console\Command;

final class SeedEquipcontrolNotificationFixturesCommand extends Command
{
    protected $signature = 'equipcontrol:seed-notification-fixtures
                            {--scan : Dispara o scanner após criar os dados}
                            {--user= : ID do usuário para habilitar preferências (padrão: primeiro admin ativo)}';

    protected $description = 'Cria dados de teste para validar notificações do EquipControl sem colidir códigos de obra';

    public function handle(
        EquipcontrolAlertScanner $scanner,
        NotificationPreferenceService $preferences,
    ): int {
        if (! tenancy()->initialized) {
            $this->error('Execute este comando no contexto de um tenant.');

            return self::FAILURE;
        }

        $user = $this->resolveUser();

        if ($user === null) {
            $this->error('Nenhum usuário ativo com permissão notificacao-visualizar encontrado.');

            return self::FAILURE;
        }

        $this->enableFixturePreferences($preferences, $user);

        $obraA = $this->resolveObra('650');
        $obraB = $this->resolveObra('720');

        $this->seedLoanFixtures($obraA);
        $this->seedCriticalFixtures($obraA, $user);
        $this->seedMaintenanceFixtures($user, $obraA);
        $this->seedSiteFixtures($obraA);
        $this->seedEmployeeFixtures();
        $this->seedInsightFixtures($obraA, $obraB);

        $this->info("Fixtures criados para o usuário #{$user->id} ({$user->email}).");
        $this->line("Obras reutilizadas/criadas: {$obraA->codigo}, {$obraB->codigo}.");

        if ($this->option('scan')) {
            $dispatched = $scanner->scan();
            $this->info("Scanner executado. Alertas processados: {$dispatched}");
        } else {
            $this->line('Rode com --scan ou execute: php artisan equipcontrol:scan-alerts');
        }

        return self::SUCCESS;
    }

    private function resolveUser(): ?User
    {
        $userId = $this->option('user');

        if (is_string($userId) && $userId !== '') {
            $user = User::query()->where('id', $userId)->where('status', 'active')->first();

            return $user !== null && $user->can('notificacao-visualizar') ? $user : null;
        }

        return User::query()
            ->where('status', 'active')
            ->get()
            ->first(fn(User $user) => $user->can('notificacao-visualizar'));
    }

    /**
     * @param  list<string>  $events
     */
    private function enableFixturePreferences(NotificationPreferenceService $preferences, User $user): void
    {
        foreach (
            [
                'loan.overdue',
                'loan.due_soon',
                'equipment.idle',
                'critical.idle',
                'critical.overdue',
                'critical.in_maintenance',
                'maintenance.overdue',
                'digest.daily',
                'digest.weekly',
                'site.idle_equipment',
                'employee.equipment_overload',
                'insight.return',
                'insight.cost_reduction',
            ] as $event
        ) {
            $preferences->update($user, $event, 'app', true);
            $preferences->update($user, $event, 'email', true);
        }
    }

    private function resolveObra(string $preferredCodigo): Obra
    {
        $existing = Obra::query()->where('codigo', $preferredCodigo)->first();

        if ($existing !== null) {
            return $existing;
        }

        $fallback = Obra::query()->where('is_ativa', true)->first();

        if ($fallback !== null && $preferredCodigo === '650') {
            return $fallback;
        }

        return Obra::factory()->create(['codigo' => $this->uniqueObraCodigo($preferredCodigo)]);
    }

    private function uniqueObraCodigo(string $base): string
    {
        if (! Obra::query()->where('codigo', $base)->exists()) {
            return $base;
        }

        do {
            $codigo = $base . '-' . random_int(1000, 9999);
        } while (Obra::query()->where('codigo', $codigo)->exists());

        return $codigo;
    }

    private function seedLoanFixtures(Obra $obra): void
    {
        $critico = Equipamento::factory()->create([
            'obra_id' => $obra->id,
            'is_critico' => true,
            'data_entrada' => now()->subDays(60)->toDateString(),
        ]);

        Emprestimo::factory()->create([
            'equipamento_id' => $critico->id,
            'obra_id' => $obra->id,
            'data_retirada' => now()->subDays(40)->toDateString(),
            'prazo_dias' => 10,
            'data_devolucao' => null,
        ]);

        $proximo = Equipamento::factory()->create(['obra_id' => $obra->id]);
        Emprestimo::factory()->create([
            'equipamento_id' => $proximo->id,
            'obra_id' => $obra->id,
            'data_retirada' => now()->subDays(13)->toDateString(),
            'prazo_dias' => 15,
            'data_devolucao' => null,
        ]);
    }

    private function seedCriticalFixtures(Obra $obra, User $user): void
    {
        Equipamento::factory()->create([
            'obra_id' => $obra->id,
            'is_critico' => true,
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);

        $criticoManutencao = Equipamento::factory()->create(['is_critico' => true]);
        Manutencao::factory()->create([
            'equipamento_id' => $criticoManutencao->id,
            'data_entrada' => now()->subDays(5)->toDateString(),
            'data_saida' => null,
            'responsavel_user_id' => $user->id,
            'registrado_por' => $user->id,
        ]);
    }

    private function seedMaintenanceFixtures(User $user, Obra $obra): void
    {
        $equipamento = Equipamento::factory()->create(['obra_id' => $obra->id]); // precisa receber $obra como parâmetro
        Manutencao::factory()->create([
            'equipamento_id' => $equipamento->id,
            'data_entrada' => now()->subDays(20)->toDateString(),
            'data_saida' => null,
            'responsavel_user_id' => $user->id,
            'registrado_por' => $user->id,
        ]);
    }

    private function seedSiteFixtures(Obra $obra): void
    {
        foreach (range(1, 2) as $index) {
            Equipamento::factory()->create([
                'obra_id' => $obra->id,
                'data_entrada' => now()->subDays(45)->toDateString(),
            ]);
        }
    }

    private function seedEmployeeFixtures(): void
    {
        foreach (range(1, 4) as $index) {
            $equipamento = Equipamento::factory()->create();
            Emprestimo::factory()->create([
                'equipamento_id' => $equipamento->id,
                'colaborador_nome' => 'João Silva',
                'colaborador_matricula' => 'A100',
                'data_retirada' => now()->subDays(120)->toDateString(),
                'prazo_dias' => 30,
                'data_devolucao' => null,
            ]);
        }
    }

    private function seedInsightFixtures(Obra $obraA, Obra $obraB): void
    {
        foreach (range(1, 3) as $index) {
            Equipamento::factory()->create([
                'obra_id' => $obraA->id,
                'data_entrada' => now()->subDays(45)->toDateString(),
                'valor_mensal' => 2500,
            ]);
        }

        Equipamento::factory()->create([
            'obra_id' => $obraB->id,
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);
    }
}
