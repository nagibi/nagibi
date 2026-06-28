<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Tenant\Equipamento\AlertSettingsController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\BaixaController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\EmprestimoController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\EquipamentoController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\EquipamentoUserController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\EquipamentoDashboardController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\FornecedorController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\GrupoEquipamentoController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\HistoricoController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\ManutencaoController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\MedicaoController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\ObraController;
use App\Http\Controllers\Api\V1\Tenant\Equipamento\TipoEquipamentoController;
use Illuminate\Support\Facades\Route;

Route::prefix('lookups')->group(function (): void {
    Route::get('obras', [ObraController::class, 'lookup']);
    Route::get('fornecedores', [FornecedorController::class, 'lookup']);
    Route::get('grupos', [GrupoEquipamentoController::class, 'lookup']);
    Route::get('tipos', [TipoEquipamentoController::class, 'lookup']);
    Route::get('usuarios', [EquipamentoUserController::class, 'lookup']);
});

Route::apiResource('obras', ObraController::class);
Route::apiResource('fornecedores', FornecedorController::class)->parameters(['fornecedores' => 'fornecedor']);
Route::apiResource('grupos', GrupoEquipamentoController::class);
Route::apiResource('tipos', TipoEquipamentoController::class);

Route::prefix('equipamentos/alert-settings')->group(function (): void {
    Route::get('/', [AlertSettingsController::class, 'index']);
    Route::put('/', [AlertSettingsController::class, 'update']);
    Route::delete('/{key}', [AlertSettingsController::class, 'destroy']);
});


Route::apiResource('equipamentos', EquipamentoController::class);
Route::patch('equipamentos/{equipamento}/toggle-active', [EquipamentoController::class, 'toggleActive']);
Route::post('equipamentos/{equipamento}/upload', [EquipamentoController::class, 'update']);

Route::post('equipamentos/{equipamento}/emprestar', [EmprestimoController::class, 'store']);
Route::post('equipamentos/{equipamento}/manutencao', [ManutencaoController::class, 'store']);
Route::post('equipamentos/{equipamento}/baixar', [BaixaController::class, 'store']);
Route::get('equipamentos/{equipamento}/historico', [HistoricoController::class, 'index']);

Route::get('emprestimos', [EmprestimoController::class, 'index']);
Route::get('emprestimos/{emprestimo}', [EmprestimoController::class, 'show']);
Route::put('emprestimos/{emprestimo}', [EmprestimoController::class, 'update']);
Route::post('emprestimos/{emprestimo}/devolver', [EmprestimoController::class, 'devolver']);
Route::post('emprestimos/{emprestimo}/renovar', [EmprestimoController::class, 'renovar']);

Route::get('manutencoes', [ManutencaoController::class, 'index']);
Route::get('manutencoes/{manutencao}', [ManutencaoController::class, 'show']);
Route::post('manutencoes/{manutencao}/finalizar', [ManutencaoController::class, 'finalizar']);

Route::get('baixas', [BaixaController::class, 'index']);

Route::prefix('dashboard')->group(function (): void {
    Route::get('resumo', [EquipamentoDashboardController::class, 'resumo']);
    Route::get('alertas', [EquipamentoDashboardController::class, 'alertas']);
    Route::get('potencial-devolucao', [EquipamentoDashboardController::class, 'potencialDevolucao']);
    Route::get('rankings', [EquipamentoDashboardController::class, 'rankings']);
    Route::get('financeiro', [EquipamentoDashboardController::class, 'financeiro']);
    Route::get('graficos', [EquipamentoDashboardController::class, 'graficos']);
});

Route::prefix('medicao')->group(function (): void {
    Route::post('calcular', [MedicaoController::class, 'calcular']);
    Route::post('exportar', [MedicaoController::class, 'exportar']);
});
