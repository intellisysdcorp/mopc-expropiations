import { useState } from 'react'
import { CREATE_STEPS, EDIT_STEPS } from '@/constants/case-constants'
import { validateCurrentStep, validateFullForm, findStepWithMissingFields } from '@/utils/case-validation'
import { CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'

interface NavigationState {
  currentStep: number
  fieldErrors: Set<string>
  showValidationAlert: boolean
  assignmentStepAttempted: boolean
  explicitSubmitAttempt: boolean
}

export function useCaseFormNavigation(
  mode: 'create' | 'edit',
  formData: CreateCaseInput | UpdateCaseInput
) {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentStep: 0,
    fieldErrors: new Set(),
    showValidationAlert: false,
    assignmentStepAttempted: false,
    explicitSubmitAttempt: false,
  })

  const steps = mode === 'create' ? CREATE_STEPS : EDIT_STEPS

  const updateNavigationState = (updates: Partial<NavigationState>) => {
    setNavigationState(prev => ({ ...prev, ...updates }))
  }

  const validateStep = (context: 'navigation' | 'submission' = 'navigation') => {
    if (mode === 'edit') {
      return true
    }

    const validation = validateCurrentStep(formData, navigationState.currentStep, context)

    if (!validation.isValid) {
      setNavigationState(prev => ({
        ...prev,
        fieldErrors: new Set(validation.missingFields),
        showValidationAlert: context === 'submission' || (prev.currentStep !== 4)
      }))
      return false
    }

    setNavigationState(prev => ({
      ...prev,
      fieldErrors: new Set(),
      showValidationAlert: false
    }))
    return true
  }

  const handleNext = () => {
    if (validateStep('navigation')) {
      const nextStep = navigationState.currentStep + 1
      if (nextStep < steps.length) {
        setNavigationState(prev => ({
          ...prev,
          currentStep: nextStep,
          fieldErrors: new Set()
        }))

        // Reset assignment step flags when entering assignment step
        if (nextStep === 4) {
          setNavigationState(prev => ({
            ...prev,
            assignmentStepAttempted: false,
            explicitSubmitAttempt: false,
            showValidationAlert: false
          }))
        }
      }
    }
  }

  const handlePrevious = () => {
    if (navigationState.currentStep > 0) {
      const prevStep = navigationState.currentStep - 1
      setNavigationState(prev => ({
        ...prev,
        currentStep: prevStep,
        showValidationAlert: false,
        fieldErrors: new Set()
      }))

      // Reset assignment step flags if leaving assignment step
      if (prevStep === 4) {
        setNavigationState(prev => ({
          ...prev,
          assignmentStepAttempted: false,
          explicitSubmitAttempt: false
        }))
      }
    }
  }

  const handleTabChange = (value: string) => {
    const stepIndex = steps.findIndex(step => step.id === value)
    if (stepIndex !== -1) {
      if (mode === 'create') {
        // Only allow navigation to completed steps or current step
        if (stepIndex <= navigationState.currentStep) {
          setNavigationState(prev => ({
            ...prev,
            currentStep: stepIndex,
            showValidationAlert: false
          }))

          // Reset assignment step flags if leaving assignment step
          if (navigationState.currentStep === 4 && stepIndex !== 4) {
            setNavigationState(prev => ({
              ...prev,
              assignmentStepAttempted: false,
              explicitSubmitAttempt: false
            }))
          }
        }
      } else {
        // In edit mode, allow navigation to any tab
        setNavigationState(prev => ({ ...prev, currentStep: stepIndex }))
      }
    }
  }

  const handleFieldChange = (field: string) => {
    // Clear field error when user changes value
    if (navigationState.fieldErrors.has(field)) {
      setNavigationState(prev => {
        const newErrors = new Set(prev.fieldErrors)
        newErrors.delete(field)
        return {
          ...prev,
          fieldErrors: newErrors,
          showValidationAlert: false
        }
      })
    }
  }

  const handleExplicitSubmit = () => {
    setNavigationState(prev => ({
      ...prev,
      explicitSubmitAttempt: true,
      assignmentStepAttempted: true
    }))
  }

  const validateFullSubmission = () => {
    const validation = validateFullForm(formData)

    if (!validation.isValid) {
      setNavigationState(prev => ({
        ...prev,
        fieldErrors: new Set(validation.missingFields),
        showValidationAlert: true
      }))

      // Switch to the first step with missing fields in create mode
      if (mode === 'create') {
        const firstMissingStep = findStepWithMissingFields(validation.missingFields)
        if (firstMissingStep !== -1 && firstMissingStep !== navigationState.currentStep) {
          setNavigationState(prev => ({ ...prev, currentStep: firstMissingStep }))
        }
      }

      return {
        isValid: false,
        missingFields: validation.missingFields
      }
    }

    return {
      isValid: true,
      missingFields: []
    }
  }

  const resetSubmissionFlags = () => {
    setNavigationState(prev => ({
      ...prev,
      explicitSubmitAttempt: false
    }))
  }

  return {
    // State
    navigationState,
    currentStep: navigationState.currentStep,
    fieldErrors: navigationState.fieldErrors,
    showValidationAlert: navigationState.showValidationAlert,
    steps,

    // Actions
    updateNavigationState,
    handleNext,
    handlePrevious,
    handleTabChange,
    handleFieldChange,
    handleExplicitSubmit,
    validateFullSubmission,
    resetSubmissionFlags,
    validateStep
  }
}