import React, { useState } from 'react';
import { Mail, Bell } from 'lucide-react';
import SubscribeModal from '../modals/SubscribeModal';

/**
 * Reusable subscribe trigger. Renders a button and owns the modal state.
 *
 * Props:
 *   scope         — 'practice' | 'news' | 'all-data' | 'general' (default: 'general')
 *   odsCode       — required when scope === 'practice'
 *   practiceName  — optional label for the practice chip inside the modal
 *   signupSource  — analytics tag for where the subscribe was triggered
 *   variant       — 'button' | 'icon' | 'link' (default: 'button')
 *   label         — override visible label on 'button' variant
 *   className     — extra classes passed to the trigger
 */
const SubscribeButton = ({
  scope = 'general',
  odsCode = null,
  practiceName = null,
  signupSource = 'unknown',
  variant = 'button',
  label,
  className = '',
}) => {
  const [open, setOpen] = useState(false);

  const defaultLabel = scope === 'practice' ? 'Subscribe to updates'
    : scope === 'news' ? 'Subscribe to news'
    : scope === 'all-data' ? 'Subscribe to data releases'
    : 'Subscribe by email';
  const visibleLabel = label || defaultLabel;

  let triggerNode;
  if (variant === 'icon') {
    triggerNode = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={visibleLabel}
        aria-label={visibleLabel}
        className={`p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors ${className}`}
      >
        <Bell size={18} />
      </button>
    );
  } else if (variant === 'link') {
    triggerNode = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 ${className}`}
      >
        <Mail size={13} />
        {visibleLabel}
      </button>
    );
  } else {
    triggerNode = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors ${className}`}
      >
        <Mail size={16} />
        {visibleLabel}
      </button>
    );
  }

  return (
    <>
      {triggerNode}
      <SubscribeModal
        isOpen={open}
        onClose={() => setOpen(false)}
        scope={scope}
        odsCode={odsCode}
        practiceName={practiceName}
        signupSource={signupSource}
      />
    </>
  );
};

export default SubscribeButton;
