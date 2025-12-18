import { ReactNode, ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  error?: boolean
  helperText?: string
  children: ReactNode
}

export function FormField({ id, label, required = false, error = false, helperText, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={error ? 'text-destructive' : ''}>
        {label} {required && '*'}
      </Label>
      {children}
      {helperText && (
        <p className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  )
}

interface TextInputProps {
  id: string
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
  error?: boolean
  required?: boolean
  rows?: number
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  error = false,
  required = false,
  rows
}: TextInputProps) {
  if (type === 'textarea') {
    return (
      <Textarea
        id={id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows || 4}
        disabled={disabled}
        required={required}
        className={error ? 'border-destructive' : ''}
      />
    )
  }

  return (
    <Input
      id={id}
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={error ? 'border-destructive' : ''}
    />
  )
}

interface NumberInputProps {
  id: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  min?: number
  max?: number
  step?: string
  disabled?: boolean
  error?: boolean
  required?: boolean
}

export function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  min,
  max,
  step = '1',
  disabled = false,
  error = false,
  required = false
}: NumberInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const numValue = e.target.value === '' ? undefined : parseFloat(e.target.value)
    if (!isNaN(numValue as number)) {
      onChange(numValue)
    }
  }

  return (
    <Input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={value === undefined ? '' : value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={error ? 'border-destructive' : ''}
    />
  )
}

interface TextAreaInputProps {
  id: string
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  error?: boolean
  required?: boolean
}

export function TextAreaInput({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
  error = false,
  required = false
}: TextAreaInputProps) {
  return (
    <Textarea
      id={id}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      required={required}
      className={error ? 'border-destructive' : ''}
    />
  )
}

interface SelectInputProps {
  id: string
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  required?: boolean
  options: Array<{ value: string; label: string }>
}

export function SelectInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  error = false,
  required = false,
  options
}: SelectInputProps) {
  return (
    <Select
      value={value || ''}
      onValueChange={onChange}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger className={error ? 'border-destructive' : ''}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface DateInputProps {
  id: string
  value: Date | undefined
  onChange: (value: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  required?: boolean
}

export function DateInput({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  error = false,
  required = false
}: DateInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value ? new Date(e.target.value) : undefined
    onChange(dateValue)
  }

  return (
    <Input
      id={id}
      type="date"
      value={value ? value.toISOString().split('T')[0] : ''}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={error ? 'border-destructive' : ''}
    />
  )
}