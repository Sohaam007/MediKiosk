"use client";

import React from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { IntakeProvider } from "@/contexts/IntakeContext";

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <LanguageProvider>
      <IntakeProvider>{children}</IntakeProvider>
    </LanguageProvider>
  );
};

export default Providers;
