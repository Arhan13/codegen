import { useState, useEffect } from "react";
import { LocalizationDB } from "./database";

export function useTranslations(locale: string = "en") {
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const db = LocalizationDB.getInstance();
        const t = await db.getTranslations(locale);
        setTranslations(t);
      } catch (error) {
        console.error("Error loading translations:", error);
      }
    };

    loadTranslations();
  }, [locale]);

  const t = (key: string): string => {
    return translations[key] || key;
  };

  return t;
}
