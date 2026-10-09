import React from 'react';
import { Check, Globe } from 'lucide-react';

export interface LanguageOption {
  code: string;
  nativeName: string;
  englishName: string;
  greeting?: string;
}

const DEFAULT_LANGUAGES: LanguageOption[] = [
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    greeting: 'नमस्ते',
  },
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    greeting: 'Welcome',
  },
  {
    code: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    greeting: 'নমস্কার',
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    greeting: 'வணக்கம்',
  },
  {
    code: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    greeting: 'నమస్కారం',
  },
  {
    code: 'mr',
    nativeName: 'मराठी',
    englishName: 'Marathi',
    greeting: 'नमस्कार',
  },
  {
    code: 'gu',
    nativeName: 'ગુજરાતી',
    englishName: 'Gujarati',
    greeting: 'નમસ્તે',
  },
  {
    code: 'kn',
    nativeName: 'ಕನ್ನಡ',
    englishName: 'Kannada',
    greeting: 'ನಮಸ್ಕಾರ',
  },
];

export interface LanguageSelectorProps {
  /** Currently selected language BCP-47 / language code (e.g. 'hi', 'en') */
  selectedLanguage?: string;
  /** Callback triggered when user selects a language */
  onSelectLanguage: (languageCode: string) => void;
  /** Custom list of languages to display. Defaults to DEFAULT_LANGUAGES */
  languages?: LanguageOption[];
  /** Optional flag for elderly accessibility mode (larger touch targets >= 72px) */
  isLargeMode?: boolean;
  /** Section title heading text */
  title?: string;
  /** Section subtitle / instruction text */
  subtitle?: string;
  /** Additional container CSS class names */
  className?: string;
}

/**
 * LanguageSelector
 *
 * Patient-facing language selection component for the MediKiosk intake shell.
 * Renders large high-contrast touch targets in native Indian scripts, satisfying
 * WCAG 2.1 AA / AAA standards with full keyboard and screen reader accessibility.
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onSelectLanguage,
  languages = DEFAULT_LANGUAGES,
  isLargeMode = false,
  title = 'Select Your Language / अपनी भाषा चुनें',
  subtitle = 'Please choose the language you are most comfortable speaking and reading',
  className = '',
}) => {
  return (
    <section
      aria-label="Language Selection"
      className={`w-full max-w-4xl mx-auto px-4 py-6 ${className}`}
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-hospital-blue-50 dark:bg-hospital-blue-950/60 text-hospital-blue-700 dark:text-hospital-blue-300 rounded-2xl mb-4">
          <Globe className="w-8 h-8" aria-hidden="true" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-clinical-dark dark:text-slate-50 tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Available Languages"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5"
      >
        {languages.map((lang) => {
          const isSelected = selectedLanguage === lang.code;

          return (
            <button
              key={lang.code}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${lang.englishName} (${lang.nativeName})`}
              onClick={() => onSelectLanguage(lang.code)}
              className={`relative flex flex-col items-center justify-center rounded-2xl transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-hospital-blue-400 active:scale-95 shadow-sm border-2 ${
                isLargeMode
                  ? 'min-h-[96px] min-w-[96px] p-6'
                  : 'min-h-[72px] sm:min-h-[80px] p-4 sm:p-5'
              } ${
                isSelected
                  ? 'border-hospital-blue-700 bg-hospital-blue-700 text-white shadow-md ring-2 ring-hospital-blue-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-clinical-dark dark:text-slate-100 hover:border-hospital-blue-300 hover:bg-hospital-blue-50/50 dark:hover:bg-slate-700/60'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 p-1 bg-white text-hospital-blue-700 rounded-full shadow-sm">
                  <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                </div>
              )}

              {lang.greeting && (
                <span
                  className={`text-xs font-medium uppercase tracking-wider mb-1 ${
                    isSelected
                      ? 'text-hospital-blue-100'
                      : 'text-hospital-blue-600 dark:text-hospital-blue-400'
                  }`}
                >
                  {lang.greeting}
                </span>
              )}

              <span
                className={`font-bold tracking-normal leading-tight ${
                  isLargeMode ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
                }`}
              >
                {lang.nativeName}
              </span>

              <span
                className={`text-xs md:text-sm font-medium mt-1 ${
                  isSelected ? 'text-hospital-blue-100' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {lang.englishName}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default LanguageSelector;
