import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconKey, IconToken, IconSearch } from './icons';

interface OnboardingGuideProps {
  hasKeys: boolean;
  hasTokens: boolean;
  onGoToKeys: () => void;
  onGoToTokens: () => void;
  onDismiss: () => void;
}

export function OnboardingGuide({
  hasKeys,
  hasTokens,
  onGoToKeys,
  onGoToTokens,
  onDismiss
}: OnboardingGuideProps) {
  const { t } = useTranslation('overview');
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already dismissed or if setup is complete
  if (dismissed || (hasKeys && hasTokens)) {
    return null;
  }

  const steps = [
    {
      number: 1,
      title: t('onboarding.step1.title', 'Add API Keys'),
      description: t('onboarding.step1.description', 'Add your Tavily or Brave API keys to enable search functionality'),
      icon: <IconKey />,
      completed: hasKeys,
      action: onGoToKeys,
      actionLabel: t('onboarding.step1.action', 'Add Keys')
    },
    {
      number: 2,
      title: t('onboarding.step2.title', 'Create Client Token'),
      description: t('onboarding.step2.description', 'Generate a token for your MCP client to authenticate'),
      icon: <IconToken />,
      completed: hasTokens,
      action: onGoToTokens,
      actionLabel: t('onboarding.step2.action', 'Create Token')
    },
    {
      number: 3,
      title: t('onboarding.step3.title', 'Connect Your Client'),
      description: t('onboarding.step3.description', 'Configure your MCP client with the server URL and token'),
      icon: <IconSearch />,
      completed: hasKeys && hasTokens,
      action: undefined,
      actionLabel: t('onboarding.step3.action', 'View Docs')
    }
  ];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <div className="card" data-variant="info">
      <div className="cardHeader">
        <div className="row">
          <div>
            <div className="h2">{t('onboarding.title', 'Getting Started')}</div>
            <div className="help">{t('onboarding.subtitle', 'Complete these steps to start using MCP Nexus')}</div>
          </div>
          <button
            className="btn"
            data-variant="ghost"
            onClick={handleDismiss}
            aria-label={t('onboarding.dismiss', 'Dismiss')}
          >
            {t('onboarding.dismiss', 'Dismiss')}
          </button>
        </div>
      </div>
      <div className="cardBody">
        <div className="onboardingSteps">
          {steps.map((step) => (
            <div
              key={step.number}
              className="onboardingStep"
              data-completed={step.completed}
            >
              <div className="onboardingStepNumber" data-completed={step.completed}>
                {step.completed ? '✓' : step.number}
              </div>
              <div className="onboardingStepContent">
                <div className="onboardingStepTitle">{step.title}</div>
                <div className="onboardingStepDescription help">{step.description}</div>
                {!step.completed && step.action && (
                  <button
                    className="btn mt-2"
                    data-variant="primary"
                    data-size="sm"
                    onClick={step.action}
                  >
                    {step.actionLabel}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
