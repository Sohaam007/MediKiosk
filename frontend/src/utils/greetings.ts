import type { SupportedLocale } from '../hooks/useVoiceInput';

export const greetings: Record<SupportedLocale, string> = {
  'hi-IN': 'नमस्ते',
  'en-IN': 'Hello',
  'bn-IN': 'নমস্কার',
  'ta-IN': 'வணக்கம்',
  'te-IN': 'నమస్కారం',
  'mr-IN': 'नमस्कार',
  'gu-IN': 'નમસ્તે',
  'kn-IN': 'ನಮಸ್ಕಾರ'
};

export function getGreeting(locale: SupportedLocale): string {
  return greetings[locale] || greetings['hi-IN'];
}


