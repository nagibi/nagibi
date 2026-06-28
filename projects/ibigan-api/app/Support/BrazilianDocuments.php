<?php

declare(strict_types=1);

namespace App\Support;

final class BrazilianDocuments
{
    public static function digitsOnly(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $value);

        return $digits === '' ? null : $digits;
    }

    public static function isValidCpf(string $cpf): bool
    {
        if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf)) {
            return false;
        }

        for ($position = 9; $position < 11; $position++) {
            $sum = 0;

            for ($index = 0; $index < $position; $index++) {
                $sum += (int) $cpf[$index] * (($position + 1) - $index);
            }

            $digit = ((10 * $sum) % 11) % 10;

            if ((int) $cpf[$position] !== $digit) {
                return false;
            }
        }

        return true;
    }

    public static function isValidCnpj(string $cnpj): bool
    {
        if (strlen($cnpj) !== 14 || preg_match('/^(\d)\1{13}$/', $cnpj)) {
            return false;
        }

        $weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        $weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

        $sum = 0;
        for ($index = 0; $index < 12; $index++) {
            $sum += (int) $cnpj[$index] * $weightsFirst[$index];
        }

        $remainder = $sum % 11;
        $firstDigit = $remainder < 2 ? 0 : 11 - $remainder;

        if ((int) $cnpj[12] !== $firstDigit) {
            return false;
        }

        $sum = 0;
        for ($index = 0; $index < 13; $index++) {
            $sum += (int) $cnpj[$index] * $weightsSecond[$index];
        }

        $remainder = $sum % 11;
        $secondDigit = $remainder < 2 ? 0 : 11 - $remainder;

        return (int) $cnpj[13] === $secondDigit;
    }

    public static function sqlDigitsOnlyColumn(string $column): string
    {
        return "REPLACE(REPLACE(REPLACE(REPLACE({$column}, '.', ''), '/', ''), '-', ''), ' ', '')";
    }
}
