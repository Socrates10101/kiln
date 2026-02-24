import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReviewStatus, VariantReview } from '../../stores/review-store.js';

interface ReviewBarProps {
  component: string;
  variantId: string;
  currentReview?: VariantReview;
  onReviewUpdated: () => void;
}

const statusButtons: { value: ReviewStatus; label: string; color: string }[] = [
  { value: 'adopt', label: 'adopt', color: '#22c55e' },
  { value: 'iterate', label: 'iterate', color: '#eab308' },
  { value: 'keep', label: 'keep', color: '#737373' },
  { value: 'drop', label: 'drop', color: '#ef4444' },
];

export function ReviewBar({ component, variantId, currentReview, onReviewUpdated }: ReviewBarProps) {
  const [status, setStatus] = useState<ReviewStatus | null>(currentReview?.status ?? null);
  const [feedback, setFeedback] = useState(currentReview?.feedback ?? '');
  const [iterateMode, setIterateMode] = useState<'structural' | 'component' | 'auto'>(
    currentReview?.iterateMode ?? 'auto',
  );
  const [targetPart, setTargetPart] = useState(currentReview?.targetPart ?? '');
  const [showAdvanced, setShowAdvanced] = useState(
    currentReview?.iterateMode != null && currentReview.iterateMode !== 'auto',
  );
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from props when target changes
  useEffect(() => {
    setStatus(currentReview?.status ?? null);
    setFeedback(currentReview?.feedback ?? '');
    setIterateMode(currentReview?.iterateMode ?? 'auto');
    setTargetPart(currentReview?.targetPart ?? '');
    setShowAdvanced(currentReview?.iterateMode != null && currentReview.iterateMode !== 'auto');
  }, [component, variantId, currentReview]);

  const saveReview = useCallback(async (updates: Record<string, unknown>) => {
    await fetch(`/api/review/${component}/${variantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    onReviewUpdated();
  }, [component, variantId, onReviewUpdated]);

  const handleStatusClick = (s: ReviewStatus) => {
    const next = status === s ? null : s;
    setStatus(next);
    saveReview({ status: next });
  };

  const handleFeedbackChange = (value: string) => {
    setFeedback(value);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      saveReview({ feedback: value });
    }, 300);
  };

  const handleIterateModeChange = (mode: 'structural' | 'component' | 'auto') => {
    setIterateMode(mode);
    saveReview({ iterateMode: mode });
  };

  const handleTargetPartChange = (value: string) => {
    setTargetPart(value);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      saveReview({ targetPart: value });
    }, 300);
  };

  return (
    <div style={{
      padding: '8px 16px',
      borderBottom: '1px solid #262626',
      background: '#1a1a1a',
      flexShrink: 0,
    }}>
      {/* Status buttons */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {statusButtons.map((btn) => {
          const active = status === btn.value;
          return (
            <button
              key={btn.value}
              onClick={() => handleStatusClick(btn.value)}
              style={{
                padding: '3px 12px',
                fontSize: '11px',
                fontWeight: 500,
                fontFamily: 'monospace',
                border: `1px solid ${active ? btn.color : '#333'}`,
                borderRadius: '3px',
                background: active ? btn.color + '20' : 'transparent',
                color: active ? btn.color : '#737373',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.borderColor = btn.color + '80';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.borderColor = '#333';
              }}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Iterate options */}
      {status === 'iterate' && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Feedback textarea */}
          <textarea
            value={feedback}
            onChange={(e) => handleFeedbackChange(e.target.value)}
            placeholder="Feedback for iteration..."
            style={{
              width: '100%',
              minHeight: '48px',
              padding: '6px 8px',
              fontSize: '11px',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              background: '#141414',
              border: '1px solid #333',
              borderRadius: '3px',
              color: '#e5e5e5',
              resize: 'vertical',
              outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#eab308'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#333'; }}
          />

          {/* Advanced toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                fontSize: '10px',
                color: '#525252',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              {showAdvanced ? 'hide advanced' : 'advanced'}
            </button>

            {showAdvanced && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {(['auto', 'structural', 'component'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleIterateModeChange(mode)}
                    style={{
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      padding: '1px 6px',
                      border: `1px solid ${iterateMode === mode ? '#eab308' : '#333'}`,
                      borderRadius: '2px',
                      background: iterateMode === mode ? '#eab30820' : 'transparent',
                      color: iterateMode === mode ? '#eab308' : '#525252',
                      cursor: 'pointer',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target part input (component mode only) */}
          {showAdvanced && iterateMode === 'component' && (
            <input
              type="text"
              value={targetPart}
              onChange={(e) => handleTargetPartChange(e.target.value)}
              placeholder="Target part (e.g. CTA button, hero image)"
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: '11px',
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                background: '#141414',
                border: '1px solid #333',
                borderRadius: '3px',
                color: '#e5e5e5',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#eab308'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#333'; }}
            />
          )}
        </div>
      )}
    </div>
  );
}
