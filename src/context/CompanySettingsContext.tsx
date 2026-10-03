"use client";

import React, { createContext, useContext, useMemo } from "react";
import { CompanySettingsData, DEFAULT_SETTINGS, FeatureFlagKey } from "@/lib/featureFlags";

interface CompanySettingsContextType {
  settings: CompanySettingsData;
  businessType: string;
  isFeatureEnabled: (feature: FeatureFlagKey) => boolean;
}

const CompanySettingsContext = createContext<CompanySettingsContextType>({
  settings: DEFAULT_SETTINGS,
  businessType: "Retail",
  isFeatureEnabled: (feature) => Boolean(DEFAULT_SETTINGS[feature]),
});

export function CompanySettingsProvider({
  children,
  settings,
  businessType = "Retail",
}: {
  children: React.ReactNode;
  settings?: Partial<CompanySettingsData> | null;
  businessType?: string | null;
}) {
  const mergedSettings = useMemo(() => {
    return {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
    };
  }, [settings]);

  const value = useMemo(() => {
    return {
      settings: mergedSettings,
      businessType: businessType || "Retail",
      isFeatureEnabled: (feature: FeatureFlagKey) => Boolean(mergedSettings[feature]),
    };
  }, [mergedSettings, businessType]);

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export function useCompanySettings() {
  return useContext(CompanySettingsContext);
}
