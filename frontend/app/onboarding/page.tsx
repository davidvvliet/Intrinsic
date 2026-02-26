"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const steps = [
  {
    question: 'How much time do you spend on investment research per week?',
    options: [
      'Less than 1 hour',
      '1–5 hours',
      '5–15 hours',
      '15+ hours',
    ],
  },
  {
    question: 'How do you currently make investment decisions?',
    options: [
      'Gut feeling or tips from others',
      'I read earnings reports and filings',
      'I use screeners and basic ratios',
      'I build my own financial models',
    ],
  },
  {
    question: 'What are you most interested in?',
    options: [
      'Valuing individual stocks',
      'Comparing companies side by side',
      'Tracking a portfolio of investments',
      'Learning how financial models work',
    ],
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(Array(steps.length).fill(null));

  const step = steps[currentStep];
  const selected = answers[currentStep];

  const selectOption = (option: string) => {
    const next = [...answers];
    next[currentStep] = option;
    setAnswers(next);
  };

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      const data = JSON.stringify({
        researchTime: answers[0],
        decisionMethod: answers[1],
        interest: answers[2],
      });
      document.cookie = `onboarding_data=${encodeURIComponent(data)}; max-age=600; path=/`;
      window.location.href = '/signup';
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.push('/');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.slide}>
        <h1 className={styles.question}>{step.question}</h1>
        <div className={styles.options}>
          {step.options.map((option) => (
            <button
              key={option}
              className={`${styles.option} ${selected === option ? styles.optionSelected : ''}`}
              onClick={() => selectOption(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className={styles.nav}>
          <button className={styles.backButton} onClick={goBack}>
            Back
          </button>
          <button
            className={styles.nextButton}
            onClick={goNext}
            disabled={!selected}
          >
            {currentStep < steps.length - 1 ? 'Next' : 'Get started'}
          </button>
        </div>
      </div>
      <div className={styles.stepIndicator}>
        {steps.map((_, i) => (
          <div key={i} className={`${styles.dot} ${i === currentStep ? styles.dotActive : ''}`} />
        ))}
      </div>
    </div>
  );
}
