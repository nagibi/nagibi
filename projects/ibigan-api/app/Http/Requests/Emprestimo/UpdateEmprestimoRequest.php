<?php

declare(strict_types=1);

namespace App\Http\Requests\Emprestimo;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateEmprestimoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'obra_id' => ['required', 'integer', Rule::exists('obras', 'id')],
            'colaborador_nome' => ['required', 'string', 'max:150'],
            'colaborador_matricula' => ['required', 'string', 'max:30'],
            'colaborador_whatsapp' => ['nullable', 'string', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'colaborador_nome.required' => 'Informe o nome do colaborador.',
            'colaborador_matricula.required' => 'Informe a matrícula do colaborador.',
        ];
    }
}
