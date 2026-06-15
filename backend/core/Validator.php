<?php
/**
 * Tiny rule-based validator.
 * Rules: required | email | numeric | min:n | max:n | in:a,b,c
 */
class Validator
{
    private array $data;
    private array $errors = [];

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    public function validate(array $rules): bool
    {
        foreach ($rules as $field => $ruleString) {
            $value = $this->data[$field] ?? null;
            foreach (explode('|', $ruleString) as $rule) {
                [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
                $this->applyRule($field, $value, $name, $param);
            }
        }
        return empty($this->errors);
    }

    private function applyRule(string $field, $value, string $rule, ?string $param): void
    {
        $isEmpty = $value === null || $value === '';
        switch ($rule) {
            case 'required':
                if ($isEmpty) $this->add($field, "$field is required");
                break;
            case 'email':
                if (!$isEmpty && !filter_var($value, FILTER_VALIDATE_EMAIL))
                    $this->add($field, "$field must be a valid email");
                break;
            case 'numeric':
                if (!$isEmpty && !is_numeric($value))
                    $this->add($field, "$field must be numeric");
                break;
            case 'min':
                if (!$isEmpty && is_numeric($value) && $value < (float) $param)
                    $this->add($field, "$field must be at least $param");
                elseif (!$isEmpty && !is_numeric($value) && mb_strlen((string) $value) < (int) $param)
                    $this->add($field, "$field must be at least $param characters");
                break;
            case 'max':
                if (!$isEmpty && is_numeric($value) && $value > (float) $param)
                    $this->add($field, "$field must not exceed $param");
                elseif (!$isEmpty && !is_numeric($value) && mb_strlen((string) $value) > (int) $param)
                    $this->add($field, "$field must not exceed $param characters");
                break;
            case 'in':
                $opts = explode(',', (string) $param);
                if (!$isEmpty && !in_array($value, $opts, true))
                    $this->add($field, "$field must be one of: $param");
                break;
        }
    }

    private function add(string $field, string $msg): void
    {
        $this->errors[$field][] = $msg;
    }

    public function errors(): array
    {
        return $this->errors;
    }
}
