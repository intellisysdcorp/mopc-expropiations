import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField, SelectInput } from '@/components/forms/form-fields'
import { Department, DepartmentUser } from '@/types/client'
import { CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'

interface AssignmentSectionProps {
  formData: CreateCaseInput | UpdateCaseInput
  onInputChange: (field: keyof (CreateCaseInput | UpdateCaseInput), value: any) => void
  departments: Department[]
  users: DepartmentUser[]
  hasFieldError?: (field: string) => boolean
}

export function AssignmentSection({
  formData,
  onInputChange,
  departments,
  users,
  hasFieldError
}: AssignmentSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asignación del Caso</CardTitle>
        <CardDescription>
          Asigne el caso al departamento y personal responsable
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          id="departmentId"
          label="Departamento"
          required
          error={hasFieldError?.('departmentId') || false}
        >
          <SelectInput
            id="departmentId"
            value={formData.departmentId}
            onChange={(value) => onInputChange('departmentId', value)}
            placeholder="Seleccionar departamento"
            error={hasFieldError?.('departmentId') || false}
            required
            options={departments.map(dept => ({
              value: dept.id,
              label: `${dept.name} (${dept.code})`
            }))}
          />
        </FormField>

        {users.length > 0 && (
          <>
            <FormField
              id="assignedToId"
              label="Asignado a"
            >
              <SelectInput
                id="assignedToId"
                value={formData.assignedToId || 'UNASSIGNED'}
                onChange={(value) => onInputChange('assignedToId', value)}
                placeholder="Seleccionar analista"
                options={[
                  { value: 'UNASSIGNED', label: 'Sin asignar' },
                  ...users
                    .filter(user => ['ANALYST', 'SUPERVISOR', 'DEPARTMENT_ADMIN'].includes(user.role.name))
                    .map(user => ({
                      value: user.id,
                      label: `${user.firstName} ${user.lastName} - ${user.role.name}`
                    }))
                ]}
              />
            </FormField>

            <FormField
              id="supervisedById"
              label="Supervisor"
            >
              <SelectInput
                id="supervisedById"
                value={formData.supervisedById || 'UNASSIGNED'}
                onChange={(value) => onInputChange('supervisedById', value)}
                placeholder="Seleccionar supervisor"
                options={[
                  { value: 'UNASSIGNED', label: 'Sin supervisor' },
                  ...users
                    .filter(user => ['SUPERVISOR', 'DEPARTMENT_ADMIN'].includes(user.role.name))
                    .map(user => ({
                      value: user.id,
                      label: `${user.firstName} ${user.lastName} - ${user.role.name}`
                    }))
                ]}
              />
            </FormField>
          </>
        )}
      </CardContent>
    </Card>
  )
}