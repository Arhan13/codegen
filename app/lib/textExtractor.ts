import { LocalizationDB, LocalizationEntry } from "./database";

/**
 * Simplified LLM-based text extraction for React component localization
 */

export interface ExtractedText {
  key: string;
  text: string;
  context?: string;
  translations?: {
    en: string;
    es: string;
    fr: string;
    de: string;
    ja: string;
    zh: string;
  };
}

/**
 * Simple regex-based extraction of t() calls from React component code
 * Much more reliable and faster than LLM analysis
 */
export async function extractLocalizationKeys(
  componentCode: string
): Promise<ExtractedText[]> {
  try {
    console.log("🔍 Extracting t() calls from component code...");

    // Find all t() calls with various quote styles
    const tCallRegex = /t\(['"`]([^'"`]+)['"`]\)/g;
    const extractedTexts: ExtractedText[] = [];
    const usedKeys = new Set<string>();
    let match;

    while ((match = tCallRegex.exec(componentCode)) !== null) {
      const key = match[1];

      if (!usedKeys.has(key)) {
        extractedTexts.push({
          key,
          text: key, // Use key as fallback text initially
          context: determineContext(componentCode, match.index),
        });
        usedKeys.add(key);
      }
    }

    console.log(
      `✅ Found ${extractedTexts.length} t() calls:`,
      extractedTexts.map((e) => ({ key: e.key, context: e.context }))
    );

    // Now translate the extracted keys using LLM
    if (extractedTexts.length > 0) {
      const translations = await translateKeys(extractedTexts);
      return translations;
    }

    return extractedTexts;
  } catch (error) {
    console.error("❌ t() extraction error:", error);
    return [];
  }
}

/**
 * Determine context of a t() call based on surrounding code
 */
function determineContext(code: string, matchIndex: number): string {
  // Get surrounding context (50 chars before and after)
  const start = Math.max(0, matchIndex - 50);
  const end = Math.min(code.length, matchIndex + 50);
  const context = code.substring(start, end).toLowerCase();

  // Simple heuristics for context detection
  if (context.includes("<button") || context.includes("onclick")) {
    return "button";
  }
  if (context.includes("placeholder")) {
    return "placeholder";
  }
  if (
    context.includes("<h1") ||
    context.includes("<h2") ||
    context.includes("<h3")
  ) {
    return "heading";
  }
  if (context.includes("<label")) {
    return "label";
  }
  if (context.includes("<p>") || context.includes("<span")) {
    return "content";
  }

  return "general";
}

/**
 * Translate extracted keys using LLM
 */
async function translateKeys(
  extractedTexts: ExtractedText[]
): Promise<ExtractedText[]> {
  try {
    const response = await fetch("/api/extract-and-translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keys: extractedTexts.map((e) => ({
          key: e.key,
          context: e.context,
        })),
      }),
    });

    if (!response.ok) {
      console.warn("⚠️ Translation API failed, using keys as fallback");
      return extractedTexts;
    }

    const data = await response.json();

    if (data.success && data.translations) {
      return extractedTexts.map((extracted) => ({
        ...extracted,
        translations: data.translations[extracted.key],
      }));
    }

    return extractedTexts;
  } catch (error) {
    console.error("❌ Translation error:", error);
    return extractedTexts;
  }
}

/**
 * Process and save extracted texts (with translations) to the database
 * Since LLM now provides translations directly, this is much simpler
 */
export async function processAndSaveExtractedTexts(
  extractedTexts: ExtractedText[],
  componentId: string
): Promise<string[]> {
  const db = LocalizationDB.getInstance();
  const savedKeys: string[] = [];

  for (const extracted of extractedTexts) {
    try {
      // Check if key already exists
      const existingTranslations = await db.getAll();
      const existing = existingTranslations.find(
        (t) => t.key === extracted.key
      );

      if (!existing) {
        // Use translations provided by LLM
        const translations = extracted.translations;

        if (!translations) {
          console.warn(`⚠️ No translations provided for key: ${extracted.key}`);
          continue;
        }

        // Create new localization entry with LLM-provided translations
        const newEntry: Omit<LocalizationEntry, "created_at" | "updated_at"> = {
          id: `${componentId}_${extracted.key}_${Date.now()}`,
          key: extracted.key,
          en: translations.en,
          es: translations.es,
          fr: translations.fr,
          de: translations.de,
          ja: translations.ja,
          zh: translations.zh,
        };

        await db.create(newEntry);
        savedKeys.push(extracted.key);
        console.log(
          `💾 Saved translations for "${extracted.key}":`,
          `EN: "${translations.en}" | ES: "${translations.es}" | FR: "${translations.fr}"`
        );
      } else {
        // Key exists, just add to saved keys
        savedKeys.push(extracted.key);
        console.log(`🔄 Key "${extracted.key}" already exists in database`);
      }
    } catch (error) {
      console.error(
        `❌ Error saving localization key ${extracted.key}:`,
        error
      );
    }
  }

  return savedKeys;
}

/**
 * Simple component validation - ensures t() function is properly typed
 * Since components are now generated with t() calls, minimal transformation needed
 */
export function transformComponentCode(
  componentCode: string,
  extractedTexts: ExtractedText[]
): string {
  let transformedCode = componentCode;

  // Ensure component has proper TypeScript interface with t prop
  const hasInterface = transformedCode.includes("interface");
  const hasTProps = transformedCode.includes("t: (key: string) => string");

  if (!hasInterface || !hasTProps) {
    console.log(
      "⚠️ Component missing proper t() prop typing - this should be rare with new system prompt"
    );

    // Add minimal interface if completely missing
    if (!hasInterface) {
      const functionMatch = transformedCode.match(
        /export default function (\w+)/
      );
      if (functionMatch) {
        const componentName = functionMatch[1];
        const interfaceDef = `
interface ${componentName}Props {
  t: (key: string) => string;
}

`;
        transformedCode = transformedCode.replace(
          `export default function ${componentName}`,
          interfaceDef + `export default function ${componentName}`
        );
      }
    }
  }

  console.log(
    `✅ Component validated - found ${extractedTexts.length} t() calls`
  );

  // DEBUG: Show key information
  console.log(
    "🔍 EXTRACTED KEYS:",
    extractedTexts.map((e) => e.key)
  );

  return transformedCode;
}

/**
 * Generate contextual demo props for a component based on its code and extracted keys
 */
async function generateDemoProps(componentCode: string): Promise<string> {
  // Analyze component to generate appropriate demo props
  const componentType = determineComponentType(componentCode);

  const demoProps: Record<string, unknown> = { t: "t" };

  // Generate component-specific props based on type
  if (componentType === "button") {
    demoProps.onClick = "() => console.log('Button clicked!')";
  } else if (componentType === "form") {
    demoProps.onSubmit = "() => console.log('Form submitted!')";
  } else if (componentType === "navigation") {
    // Navigation components need their navigation item keys to be translated
    console.log("🧭 Navigation component detected - ensuring nav keys exist");
    await ensureNavigationTranslations();
  }

  console.log(`🎭 Generated ${componentType} demo props:`, demoProps);
  return JSON.stringify(demoProps);
}

/**
 * Ensure common navigation translation keys exist
 */
async function ensureNavigationTranslations(): Promise<void> {
  const commonNavKeys = [
    { key: "nav_home", context: "navigation" },
    { key: "nav_about", context: "navigation" },
    { key: "nav_services", context: "navigation" },
    { key: "nav_contact", context: "navigation" },
  ];

  try {
    const response = await fetch("/api/extract-and-translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keys: commonNavKeys,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.translations) {
        // Save navigation translations to database
        const db = LocalizationDB.getInstance();

        for (const navKey of commonNavKeys) {
          const translations = data.translations[navKey.key];
          if (translations) {
            try {
              const newEntry = {
                id: `nav_${navKey.key}_${Date.now()}`,
                key: navKey.key,
                en: translations.en,
                es: translations.es,
                fr: translations.fr,
                de: translations.de,
                ja: translations.ja,
                zh: translations.zh,
              };
              await db.create(newEntry);
              console.log(
                `🧭 Added navigation translation: ${navKey.key} → ${translations.en}`
              );
            } catch {
              // Key might already exist, that's okay
              console.log(`🧭 Navigation key ${navKey.key} already exists`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to ensure navigation translations:", error);
  }
}

/**
 * Determine component type based on code analysis
 */
function determineComponentType(componentCode: string): string {
  const code = componentCode.toLowerCase();

  // Check more specific components first
  if (
    code.includes("<nav") ||
    code.includes("navigation") ||
    code.includes("navbar") ||
    code.includes("menu")
  )
    return "navigation";
  if (
    code.includes("<form") ||
    code.includes("<input") ||
    code.includes("onsubmit")
  )
    return "form";
  if (code.includes("<card") || code.includes("card")) return "card";
  if (code.includes("<modal") || code.includes("modal")) return "modal";
  // Check button last since many components contain buttons
  if (code.includes("<button") || code.includes("button")) return "button";

  return "component";
}

/**
 * MAIN FUNCTION: Process component code with simplified LLM-based architecture
 * 1. Use LLM to extract texts and generate translations in one step
 * 2. Save translations to database
 * 3. Generate component-specific demo props
 * 4. Transform component to use t() calls
 * 5. Return transformed component that's self-contained
 */
export async function processComponentWithTranslations(
  originalComponentCode: string,
  componentId: string
): Promise<{
  transformedCode: string;
  extractedTexts: ExtractedText[];
  savedKeys: string[];
  demoProps: string;
}> {
  console.log(
    "🚀 Processing component with simplified LLM-based architecture..."
  );

  // Step 1: Use LLM to extract all translatable texts AND generate translations
  const extractedTexts = await extractLocalizationKeys(originalComponentCode);
  console.log(
    `📝 LLM extracted ${extractedTexts.length} translatable texts with translations`
  );

  // Step 2: Save translations to database (translations already provided by LLM)
  const savedKeys = await processAndSaveExtractedTexts(
    extractedTexts,
    componentId
  );
  console.log(`💾 Saved ${savedKeys.length} translation keys to database`);

  // Step 3: Generate component-specific demo props
  const demoProps = await generateDemoProps(originalComponentCode);
  console.log("🎭 Generated contextual demo props");

  // Step 4: Transform the original component to use t() calls
  const transformedCode = transformComponentCode(
    originalComponentCode,
    extractedTexts
  );
  console.log("🔄 Component code transformed to use t() calls");

  console.log("✅ Component processing complete with LLM-based approach!");

  return {
    transformedCode,
    extractedTexts,
    savedKeys,
    demoProps,
  };
}
