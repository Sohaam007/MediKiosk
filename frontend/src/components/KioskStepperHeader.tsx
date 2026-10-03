import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

export const KioskStepperHeader = ({ currentStep, intakeProgress, sessionId, onPurge }: any) => {
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="w-full">
            <header className="bg-hospital-blue text-clinical-white shadow-md p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-clinical-white/10 p-2 rounded-xl">
                        <Activity className="w-8 h-8 text-clinical-white" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white m-0">
                            MediKiosk™ AI Clinical Intake
                        </h1>
                        <p className="text-xs md:text-sm text-hospital-blue-100 m-0">
                            National Health Intake & Triage Portal · ABHA & Ayushman Enabled
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs text-hospital-blue-100 uppercase font-bold tracking-wider">Elapsed Time</div>
                        <div className="font-mono text-xl font-medium text-white">{formatTime(elapsedTime)}</div>
                    </div>
                    {sessionId && (
                        <span className="hidden sm:inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-mono text-white">
                            Session: {sessionId.substring(0, 10)}...
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={onPurge}
                        className="min-h-[48px] px-4 py-2.5 bg-emergency-red hover:bg-emergency-red-700 text-white text-xs md:text-sm rounded-xl font-medium transition-colors inline-flex items-center justify-center"
                    >
                        Reset / Purge
                    </button>
                </div>
            </header>
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-1.5">
                    <span className={currentStep === 'language' ? 'text-hospital-blue font-bold' : ''}>1. Language</span>
                    <span className={currentStep === 'registration' ? 'text-hospital-blue font-bold' : ''}>2. Details</span>
                    <span className={currentStep === 'conversation' ? 'text-hospital-blue font-bold' : ''}>3. Voice Intake</span>
                    <span className={currentStep === 'documents' ? 'text-hospital-blue font-bold' : ''}>4. Documents</span>
                    <span className={currentStep === 'services' ? 'text-hospital-blue font-bold' : ''}>5. Services</span>
                    <span className={currentStep === 'completed' ? 'text-clinical-green font-bold' : ''}>6. Token</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                        className="bg-hospital-blue h-full transition-all duration-300"
                        style={{
                            width:
                                currentStep === 'language' ? '15%'
                                    : currentStep === 'registration' ? '30%'
                                    : currentStep === 'conversation' ? `${Math.round(intakeProgress * 100)}%`
                                    : currentStep === 'documents' ? '75%'
                                    : currentStep === 'services' ? '90%'
                                    : '100%',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
