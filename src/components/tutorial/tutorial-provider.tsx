'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for the target element
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void; // Optional action to perform when step is shown
  canSkip?: boolean;
  showProgress?: boolean;
}

interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  autoStart?: boolean;
  required?: boolean;
}

interface TutorialContextType {
  tutorials: Tutorial[];
  activeTutorial: Tutorial | null;
  currentStep: number;
  isActive: boolean;
  startTutorial: (tutorialId: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: (tutorialId: string) => void;
  markTutorialAsCompleted: (tutorialId: string) => void;
  getCompletedTutorials: () => string[];
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [tutorials] = useState<Tutorial[]>([
    {
      id: 'dashboard-intro',
      name: 'Introducción al Panel',
      description: 'Aprende los conceptos básicos del panel principal',
      steps: [
        {
          id: 'welcome',
          title: '¡Bienvenido a la Plataforma MOPC!',
          content: 'Este es el sistema de gestión de casos de expropiación. Te guiaré a través de las funciones principales.',
          position: 'center',
          showProgress: true,
        },
        {
          id: 'navigation',
          title: 'Navegación Principal',
          content: 'Usa las tarjetas aquí para acceder rápidamente a las diferentes secciones de la plataforma.',
          target: '[data-tutorial="quick-actions"]',
          position: 'bottom',
          showProgress: true,
        },
        {
          id: 'tabs',
          title: 'Pestañas de Información',
          content: 'Las pestañas te permiten ver diferentes vistas de tus datos: Resumen, Análisis, Casos y Alertas.',
          target: '[data-tutorial="dashboard-tabs"]',
          position: 'bottom',
          showProgress: true,
        },
        {
          id: 'shortcuts',
          title: 'Atajos de Teclado',
          content: 'Puedes usar atajos de teclado para navegar más rápido. Presiona Ctrl+K para ver todos los atajos disponibles.',
          position: 'center',
          action: () => {
            // Open keyboard shortcuts
            const event = new CustomEvent('open-keyboard-shortcuts');
            window.dispatchEvent(event);
          },
          showProgress: true,
        },
      ],
      autoStart: true,
      required: false,
    },
    {
      id: 'case-management',
      name: 'Gestión de Casos',
      description: 'Aprende a crear y gestionar casos de expropiación',
      steps: [
        {
          id: 'create-case',
          title: 'Crear Nuevo Caso',
          content: 'Comienza haciendo clic en el botón "Nuevo Caso" para crear un expediente de expropiación.',
          target: '[data-tutorial="create-case-button"]',
          position: 'bottom',
          showProgress: true,
        },
        {
          id: 'case-form',
          title: 'Formulario de Caso',
          content: 'Completa toda la información requerida del caso. Los campos marcados con * son obligatorios.',
          target: '[data-tutorial="case-form"]',
          position: 'top',
          showProgress: true,
        },
        {
          id: 'save-case',
          title: 'Guardar Caso',
          content: 'Una vez completado el formulario, haz clic en "Guardar" para crear el caso.',
          target: '[data-tutorial="save-case-button"]',
          position: 'top',
          showProgress: true,
        },
      ],
      required: false,
    },
  ]);

  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('completed-tutorials');
    if (stored) {
      setCompletedTutorials(JSON.parse(stored));
    }
  }, []);

  const startTutorial = useCallback((tutorialId: string) => {
    const tutorial = tutorials.find(t => t.id === tutorialId);
    if (tutorial && !completedTutorials.includes(tutorialId)) {
      setActiveTutorial(tutorial);
      setCurrentStep(0);
      setIsActive(true);
    }
  }, [tutorials, completedTutorials]);

  const markTutorialAsCompleted = useCallback((tutorialId: string) => {
    const newCompleted = [...completedTutorials, tutorialId];
    setCompletedTutorials(newCompleted);
    localStorage.setItem('completed-tutorials', JSON.stringify(newCompleted));
  }, [completedTutorials]);

  const completeTutorial = useCallback(() => {
    if (activeTutorial) {
      markTutorialAsCompleted(activeTutorial.id);
      setActiveTutorial(null);
      setCurrentStep(0);
      setIsActive(false);
    }
  }, [activeTutorial, markTutorialAsCompleted]);

  const nextStep = useCallback(() => {
    if (activeTutorial && currentStep < activeTutorial.steps.length - 1) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);

      // Execute action if available
      const step = activeTutorial.steps[nextStepIndex];
      step?.action?.();
    } else {
      completeTutorial();
    }
  }, [activeTutorial, currentStep, completeTutorial]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    if (activeTutorial) {
      const canSkip = activeTutorial.steps[currentStep]?.canSkip !== false;
      if (canSkip) {
        completeTutorial();
      }
    }
  }, [activeTutorial, currentStep, completeTutorial]);

  const resetTutorial = useCallback((tutorialId: string) => {
    const newCompleted = completedTutorials.filter(id => id !== tutorialId);
    setCompletedTutorials(newCompleted);
    localStorage.setItem('completed-tutorials', JSON.stringify(newCompleted));
  }, [completedTutorials]);

  const getCompletedTutorials = useCallback(() => {
    return completedTutorials;
  }, [completedTutorials]);

  const value = {
    tutorials,
    activeTutorial,
    currentStep,
    isActive,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    resetTutorial,
    markTutorialAsCompleted,
    getCompletedTutorials,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};