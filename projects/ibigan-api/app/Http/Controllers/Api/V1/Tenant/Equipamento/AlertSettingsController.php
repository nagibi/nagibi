<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant\Equipamento;

use App\Http\Controllers\Controller;
use App\Services\EquipamentoAlertSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AlertSettingsController extends Controller
{
    /**
     * Chave => tipo. Usado para validar o payload e definir o cast correto.
     * Labels/descrições não são responsabilidade do backend — o frontend
     * já conhece o catálogo visual desses campos.
     */
    private const KEYS = [
        'equipment_idle_days' => 'int',
        'equipment_unused_since_registration_days' => 'int',
        'equipment_minimum_stock' => 'int',
        'maintenance_overdue_days' => 'int',
        'maintenance_frequency_threshold' => 'int',
        'maintenance_frequency_months' => 'int',
        'maintenance_cost_threshold' => 'float',
        'site_idle_equipment_threshold' => 'int',
        'site_overdue_equipment_threshold' => 'int',
        'site_high_cost_threshold' => 'float',
        'employee_overload_multiplier' => 'float',
        'employee_long_possession_days' => 'int',
        'max_renovacoes_recomendadas' => 'int',
        'loan_due_soon_days' => 'int',
    ];

    public function __construct(
        private readonly EquipamentoAlertSettingsService $settings,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 200,
            'result' => $this->currentState(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $rules = [];
        foreach (self::KEYS as $key => $type) {
            $rules[$key] = ['nullable', $type === 'float' ? 'numeric' : 'integer', 'min:0'];
        }

        $validated = $request->validate($rules);

        foreach ($validated as $key => $value) {
            if (! array_key_exists($key, self::KEYS)) {
                continue;
            }

            if ($value === null) {
                $this->settings->forget($key);
                continue;
            }

            $this->settings->set($key, $value);
        }

        return response()->json([
            'status' => 200,
            'result' => $this->currentState(),
        ]);
    }

    public function destroy(string $key): JsonResponse
    {
        if (! array_key_exists($key, self::KEYS)) {
            return response()->json(['status' => 422, 'message' => 'Chave inválida.'], 422);
        }

        $this->settings->forget($key);

        return response()->json([
            'status' => 200,
            'result' => $this->currentState(),
        ]);
    }

    /**
     * @return array<string, array{value: int|float, default: int|float, is_override: bool}>
     */
    private function currentState(): array
    {
        $overrides = $this->settings->allOverrides();

        $data = [];
        foreach (self::KEYS as $key => $type) {
            $default = config("equipamento.alerts.{$key}");
            $value = $overrides[$key] ?? $default;

            $data[$key] = [
                'value' => $type === 'float' ? (float) $value : (int) $value,
                'default' => $type === 'float' ? (float) $default : (int) $default,
                'is_override' => array_key_exists($key, $overrides),
            ];
        }

        return $data;
    }
}
