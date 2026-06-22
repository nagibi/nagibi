<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class EquipamentoAlertSetting extends Model
{
    protected $table = 'equipamento_alert_settings';

    protected $fillable = [
        'key',
        'value',
    ];
}
