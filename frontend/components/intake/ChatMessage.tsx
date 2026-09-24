"use client";

import React from "react";

export type MessageSender = "ai" | "patient";

export interface ChatMessageProps {
  sender: MessageSender;
  text: string;
  timestamp?: string | Date;
  isLatestAi?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  sender,
  text,
  timestamp,
  isLatestAi = false,
}) => {
  const isAi = sender === "ai";

  const formattedTime = React.useMemo(() => {
    if (!timestamp) {
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (typeof timestamp === "string") {
      try {
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      } catch {
        return timestamp;
      }
      return timestamp;
    }
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [timestamp]);

  return (
    <div
      className={`flex w-full my-3 md:my-4 transition-all duration-300 ${
        isAi ? "justify-start" : "justify-end"
      }`}
    >
      <div
        className={`flex flex-col max-w-[90%] sm:max-w-[75%] ${
          isAi ? "items-start" : "items-end"
        }`}
      >
        {/* Sender identification badge */}
        <div className="flex items-center gap-2 mb-1.5 px-2">
          {isAi ? (
            <>
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5"
                >
                  <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
                  <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
                  <circle cx="20" cy="10" r="2" />
                </svg>
              </div>
              <span className="text-sm md:text-base font-bold text-blue-900 tracking-wide">
                AI Doctor / चिकित्सक
              </span>
            </>
          ) : (
            <>
              <span className="text-sm md:text-base font-semibold text-slate-600">
                You / आप
              </span>
              <div className="w-6 h-6 rounded-full bg-slate-500 text-white flex items-center justify-center text-xs font-semibold shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </>
          )}
          <span className="text-xs md:text-sm text-slate-400 select-none">
            {formattedTime}
          </span>
        </div>

        {/* Message bubble */}
        <div
          className={`relative rounded-3xl p-5 md:p-6 shadow-sm border ${
            isAi
              ? "bg-blue-50/90 border-blue-200 text-blue-950 rounded-tl-sm ring-1 ring-blue-100"
              : "bg-slate-100 border-slate-300 text-slate-900 rounded-tr-sm"
          }`}
        >
          {/* Main message text: 24px+ for AI questions, 18px+ for patient body */}
          <div
            className={`whitespace-pre-wrap leading-relaxed tracking-normal select-text ${
              isAi
                ? "text-xl sm:text-2xl md:text-[26px] font-medium text-blue-950"
                : "text-lg sm:text-xl md:text-2xl font-normal text-slate-800"
            }`}
          >
            {text}
          </div>

          {/* Indicator for latest question */}
          {isAi && isLatestAi && (
            <div className="mt-3 flex items-center gap-2 text-xs md:text-sm font-semibold text-blue-700 select-none">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>Current Question / वर्तमान प्रश्न</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
