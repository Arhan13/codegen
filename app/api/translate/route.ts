import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";

// Schema for translation response
const TranslationSchema = z.object({
  translations: z.object({
    en: z.string().describe("English translation"),
    es: z.string().describe("Spanish translation"),
    fr: z.string().describe("French translation"),
    de: z.string().describe("German translation"),
    ja: z.string().describe("Japanese translation"),
    zh: z.string().describe("Chinese translation"),
  }),
  context: z
    .string()
    .describe(
      "Brief context about the text type (e.g., button, label, message)"
    ),
});

const TRANSLATION_PROMPT = `You are a professional translator specializing in UI/UX localization for web applications.

Your task is to translate English text into 6 languages with perfect accuracy and cultural appropriateness:

🇺🇸 **English** (en) - Keep original
🇪🇸 **Español** (es) - Spanish
🇫🇷 **Français** (fr) - French
🇩🇪 **Deutsch** (de) - German
🇯🇵 **日本語** (ja) - Japanese
🇨🇳 **中文** (zh) - Chinese (Simplified)

## Translation Guidelines:
1. **UI Context Aware**: Consider this is for web application interfaces
2. **Culturally Appropriate**: Use natural, native-speaker phrasing
3. **Consistent Tone**: Maintain professional, user-friendly tone
4. **Concise**: Keep translations concise for UI space constraints
5. **Action-Oriented**: For buttons/actions, use imperative form when appropriate

## Examples:
- "Save Document" → "Guardar Documento" (es), "Enregistrer le Document" (fr)
- "Contact Us" → "Contáctanos" (es), "Contactez-nous" (fr), "Kontaktieren Sie uns" (de)
- "Enter your email" → "Ingresa tu correo" (es), "Entrez votre e-mail" (fr)

## Quality Standards:
- Use formal/informal tone appropriate to each language's conventions
- Consider gender-neutral forms where applicable
- Ensure translations work well in UI contexts (buttons, forms, messages)

Provide high-quality, professional translations that native speakers would naturally use.`;

export async function POST(req: Request) {
  let text: string = "";
  let context: string = "";

  try {
    const requestData = await req.json();
    text = requestData.text;
    context = requestData.context;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required and must be a string" },
        { status: 400 }
      );
    }

    console.log(
      `🌍 Generating translations for: "${text}" (context: ${
        context || "general"
      })`
    );

    const result = await generateObject({
      model: openai("gpt-4.1"),
      temperature: 0,
      prompt: `Translate this UI text into all 6 languages: "${text}"
      
      Context: ${context || "General UI text"}
      
      Provide natural, native-speaker translations appropriate for web application interfaces.`,
      schema: TranslationSchema,
      system: TRANSLATION_PROMPT,
    });

    console.log("✅ Generated translations:", result.object.translations);

    return NextResponse.json({
      success: true,
      translations: result.object.translations,
      context: result.object.context,
      originalText: text,
    });
  } catch (error) {
    console.error("❌ Translation error:", error);

    // Fallback to English for all languages in case of API failure
    const fallbackTranslations = {
      en: text || "Translation failed",
      es: text || "Translation failed",
      fr: text || "Translation failed",
      de: text || "Translation failed",
      ja: text || "Translation failed",
      zh: text || "Translation failed",
    };

    return NextResponse.json({
      success: false,
      translations: fallbackTranslations,
      context: "fallback",
      originalText: text || "Unknown text",
      error: "Translation service unavailable - using fallback",
    });
  }
}
