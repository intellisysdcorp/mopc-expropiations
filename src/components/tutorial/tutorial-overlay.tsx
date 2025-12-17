'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useTutorial } from '@/components/tutorial/tutorial-provider';
import { X, ArrowLeft, ArrowRight, SkipForward } from 'lucide-react';

export function TutorialOverlay() {
  const {
    activeTutorial,
    currentStep,
    isActive,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
  } = useTutorial();

  const [targetElement, setTargetElement] = useState<Element | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isActive || !activeTutorial) return;

    const step = activeTutorial.steps[currentStep];
    if (!step) return;

    let cleanupFn: (() => void) | undefined;

    if (step.target) {
      const element = document.querySelector(step.target);

      if (element) {
        const rect = element.getBoundingClientRect();
        const scrollX = window.pageXOffset;
        const scrollY = window.pageYOffset;

        // Calculate position based on step.position
        let top = rect.top + scrollY;
        let left = rect.left + scrollX;

        switch (step.position) {
          case 'bottom':
            top += rect.height + 10;
            left += rect.width / 2 - 150; // Center the tooltip (300px width)
            break;
          case 'top':
            top -= 250; // Approximate height of tooltip
            left += rect.width / 2 - 150;
            break;
          case 'left':
            top += rect.height / 2 - 100;
            left -= 320;
            break;
          case 'right':
            top += rect.height / 2 - 100;
            left += rect.width + 10;
            break;
          case 'center':
            top = window.innerHeight / 2 - 150;
            left = window.innerWidth / 2 - 200;
            break;
        }

        const newPosition = { top, left };

        // Defer setState calls to avoid synchronous updates within effect
        setTimeout(() => {
          setTargetElement(element);
          setPosition(newPosition);
        }, 0);

        // Highlight target element
        if (element && step.position !== 'center') {
          element.setAttribute('data-tutorial-highlight', 'true');
          cleanupFn = () => {
            element.removeAttribute('data-tutorial-highlight');
          };
        }
      } else {
        // Defer setState calls to avoid synchronous updates within effect
        setTimeout(() => {
          setTargetElement(null);
          setPosition({
            top: window.innerHeight / 2 - 150,
            left: window.innerWidth / 2 - 200,
          });
        }, 0);
      }
    } else {
      // Defer setState calls to avoid synchronous updates within effect
      setTimeout(() => {
        setTargetElement(null);
        setPosition({
          top: window.innerHeight / 2 - 150,
          left: window.innerWidth / 2 - 200,
        });
      }, 0);
    }

    // Execute action when step is shown
    step.action?.();

    return cleanupFn;
  }, [isActive, activeTutorial, currentStep]);

  if (!isActive || !activeTutorial) return null;

  const step = activeTutorial.steps[currentStep];
  if (!step) return null;

  const progress = ((currentStep + 1) / activeTutorial.steps.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" />

      {/* Highlight for target element */}
      {targetElement && (
        <style>{`
          [data-tutorial-highlight="true"] {
            position: relative;
            z-index: 51;
            box-shadow: 0 0 0 4px #3b82f6, 0 0 0 8px #1e40af;
            border-radius: 4px;
          }
        `}</style>
      )}

      {/* Tutorial Card */}
      <div
        className="fixed z-[52] w-80 transition-all duration-300 ease-in-out"
        style={{
          top: `${Math.max(10, position.top)}px`,
          left: `${Math.max(10, Math.min(position.left, window.innerWidth - 330))}px`,
        }}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{step.title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={completeTutorial}
                className="h-8 w-8 p-0"
                aria-label="Cerrar tutorial"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {step.showProgress && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Paso {currentStep + 1} de {activeTutorial.steps.length}
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm mb-4">
              {step.content}
            </CardDescription>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {currentStep > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={previousStep}
                    className="h-8"
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Anterior
                  </Button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {step.canSkip !== false && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipTutorial}
                    className="h-8"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    Saltar
                  </Button>
                )}
                <Button size="sm" onClick={nextStep} className="h-8">
                  {currentStep === activeTutorial.steps.length - 1 ? 'Finalizar' : 'Siguiente'}
                  {currentStep < activeTutorial.steps.length - 1 && (
                    <ArrowRight className="h-3 w-3 ml-1" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}