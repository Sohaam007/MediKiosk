import React from 'react';
import { AlertOctagon, PhoneCall, ShieldAlert, CheckCircle2, UserCheck } from 'lucide-react';

export type AlertPriority = 'critical' | 'urgent' | 'normal';

export interface EmergencyAlertModalProps {
  /** Controls visibility of the modal */
  isOpen: boolean;
  /** Clinical triage priority level */
  priority?: AlertPriority;
  /** Name of the triggered clinical rule (e.g. FAST_STROKE_SIGNS) */
  ruleName?: string;
  /** Brief summary of the trigger reason (PHI-safe) */
  triggerSummary?: string;
  /** Recommended clinical action for staff or patient */
  recommendedAction?: string;
  /** Callback when patient or staff acknowledges the alert */
  onAcknowledge?: () => void;
  /** Callback when hospital staff enters override/clear action */
  onStaffOverride?: () => void;
  /** Hospital emergency helpline or extension */
  hospitalPhone?: string;
  /** Additional custom container classes */
  className?: string;
}

/**
 * EmergencyAlertModal
 *
 * Prominent, WCAG AAA compliant modal displayed when deterministic
 * clinical triage detects critical red flags (stroke, severe chest pain, etc.).
 * Designed for kiosk environments with high-contrast alert styling, large touch targets,
 * bilingual guidance (English + Hindi), and staff notification indicators.
 */
export const EmergencyAlertModal: React.FC<EmergencyAlertModalProps> = ({
  isOpen,
  priority = 'critical',
  ruleName,
  triggerSummary,
  recommendedAction,
  onAcknowledge,
  onStaffOverride,
  hospitalPhone = '108 / Ext: 2222',
  className = '',
}) => {
  if (!isOpen) return null;

  const isCritical = priority === 'critical';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-alert-title"
      aria-describedby="emergency-alert-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-2xl bg-white dark:bg-slate-900 border-4 ${
          isCritical ? 'border-emergency-red' : 'border-clinical-amber'
        } rounded-3xl shadow-2xl overflow-hidden flex flex-col focus:outline-none ${className}`}
      >
        {/* Urgent Header Banner */}
        <div
          className={`px-6 py-5 ${
            isCritical ? 'bg-emergency-red text-white' : 'bg-clinical-amber text-white'
          } flex items-center justify-between gap-4`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-2xl animate-pulse">
              {isCritical ? (
                <AlertOctagon className="w-8 h-8 text-white" aria-hidden="true" />
              ) : (
                <ShieldAlert className="w-8 h-8 text-white" aria-hidden="true" />
              )}
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 text-xs font-black tracking-widest uppercase bg-white/20 rounded-md mb-1">
                TRIAGE {priority}
              </span>
              <h2
                id="emergency-alert-title"
                className="text-2xl font-bold tracking-tight text-white m-0"
              >
                Emergency Alert / आपातकालीन चेतावनी
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6 text-clinical-dark dark:text-slate-100">
          {/* Prominent Instruction Box */}
          <div
            id="emergency-alert-description"
            className="p-5 bg-emergency-red-50 dark:bg-emergency-red-950/40 border border-emergency-red-200 dark:border-emergency-red-900 rounded-2xl"
          >
            <div className="text-xl md:text-2xl font-bold text-emergency-red-900 dark:text-emergency-red-200 mb-2">
              Please stay at the kiosk. Medical staff have been alerted.
            </div>
            <div className="text-lg md:text-xl text-emergency-red-800 dark:text-emergency-red-300 font-medium">
              कृपया कियोस्क पर ही रहें। चिकित्सा कर्मचारियों को सूचित कर दिया गया है।
            </div>
            <p className="mt-3 text-sm md:text-base text-emergency-red-700 dark:text-emergency-red-300">
              A clinical team member is responding to this station. If you feel dizzy or faint,
              please sit down immediately.
            </p>
          </div>

          {/* Rule and Clinical Recommendation info */}
          {(ruleName || triggerSummary || recommendedAction) && (
            <div className="space-y-3 bg-clinical-surface dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              {ruleName && (
                <div className="flex items-center justify-between text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span>Trigger Condition:</span>
                  <span className="font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">
                    {ruleName}
                  </span>
                </div>
              )}
              {triggerSummary && (
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Note: </span>
                  {triggerSummary}
                </div>
              )}
              {recommendedAction && (
                <div className="text-sm font-medium text-hospital-blue-800 dark:text-hospital-blue-300 bg-hospital-blue-50 dark:bg-hospital-blue-950/50 p-2.5 rounded-lg border border-hospital-blue-200 dark:border-hospital-blue-800">
                  <strong>Clinical Action: </strong>
                  {recommendedAction}
                </div>
              )}
            </div>
          )}

          {/* Contact Helpline */}
          <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200">
            <PhoneCall
              className="w-5 h-5 text-hospital-blue-600 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="text-sm">
              <span className="font-semibold">Station Intercom / Helpline: </span>
              <span className="font-mono font-bold text-hospital-blue-700 dark:text-hospital-blue-400">
                {hospitalPhone}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
          {onStaffOverride && (
            <button
              type="button"
              onClick={onStaffOverride}
              className="w-full sm:w-auto min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-base hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 focus:ring-4 focus:ring-slate-400/40"
            >
              <UserCheck className="w-5 h-5" aria-hidden="true" />
              <span>Staff Override / Bypass</span>
            </button>
          )}

          {onAcknowledge && (
            <button
              type="button"
              onClick={onAcknowledge}
              className={`w-full sm:w-auto min-h-[48px] min-w-[48px] px-6 py-2.5 rounded-xl font-bold text-base text-white ${
                isCritical
                  ? 'bg-emergency-red hover:bg-emergency-red-800 active:bg-emergency-red-900'
                  : 'bg-clinical-amber hover:bg-clinical-amber-800 active:bg-clinical-amber-900'
              } shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 focus:ring-4 ${
                isCritical ? 'focus:ring-emergency-red/40' : 'focus:ring-clinical-amber/40'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              <span>I Understand / समझ गया</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlertModal;
