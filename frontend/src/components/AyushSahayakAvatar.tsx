// @ts-nocheck


export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'alert';

interface AyushSahayakAvatarProps {
  state: AvatarState;
  message?: string;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  onReadOutToggle?: () => void;
  isMuted?: boolean;
}

export function AyushSahayakAvatar({
  state,
  message,
  suggestions = ['Tell about pain', 'Scan prescription', 'Check PM-JAY'],
  onSuggestionClick,
  onReadOutToggle,
  isMuted = false,
}: AyushSahayakAvatarProps) {
  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-2xl shadow-lg w-full max-w-md mx-auto">
      <div className="relative w-32 h-32 mb-6">
        <div className={`w-full h-full rounded-full border-4 flex items-center justify-center text-4xl transition-all duration-300
          ${state === 'idle' ? 'border-gray-300 bg-gray-100' : ''}
          ${state === 'listening' ? 'border-blue-500 bg-blue-100 animate-pulse' : ''}
          ${state === 'thinking' ? 'border-yellow-500 bg-yellow-100 animate-pulse' : ''}
          ${state === 'speaking' ? 'border-green-500 bg-green-100 animate-bounce' : ''}
          ${state === 'alert' ? 'border-red-500 bg-red-100 animate-ping' : ''}
        `}>
          🤖
        </div>
        <button 
          onClick={onReadOutToggle}
          className="absolute bottom-0 right-0 p-3 bg-white rounded-full shadow hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-blue-300 min-w-[48px] min-h-[48px]"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {message && (
        <div className="relative bg-blue-50 text-blue-900 p-4 rounded-xl mb-6 text-center text-lg w-full">
          <p>{message}</p>
          <div className="absolute top-[-8px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-50 rotate-45"></div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 w-full">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick?.(suggestion)}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-medium transition-colors min-h-[48px] focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

