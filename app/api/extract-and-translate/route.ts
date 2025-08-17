import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";

// Schema for key-based translation response
const TranslationSchema = z.object({
  translations: z.record(
    z.string(),
    z.object({
      en: z.string().describe("English translation"),
      es: z.string().describe("Spanish translation"),
      fr: z.string().describe("French translation"),
      de: z.string().describe("German translation"),
      ja: z.string().describe("Japanese translation"),
      zh: z.string().describe("Chinese (Simplified) translation"),
    })
  ),
});

const TRANSLATION_PROMPT = `You are a professional UI/UX translator and localization expert.

Your task is to translate semantic keys into natural, user-friendly text in 6 languages.

## Translation Guidelines:
**English** - Clear, natural UI language
**Spanish** - Professional, culturally appropriate  
**French** - Formal when appropriate, natural phrasing
**German** - Proper capitalization, formal/informal as needed
**Japanese** - Polite form, appropriate for UI context
**Chinese** - Simplified characters, concise for UI

## Key to Translation Examples:
- \`welcome_back\` → "Welcome Back" / "Bienvenido de nuevo" / "Bon retour"
- \`submit_button\` → "Submit" / "Enviar" / "Soumettre"  
- \`enter_email\` → "Enter your email" / "Ingresa tu email" / "Entrez votre e-mail"
- \`contact_us\` → "Contact Us" / "Contáctanos" / "Contactez-nous"

## Context-Aware Translation:
- **button**: Action-oriented (Submit, Cancel, Save)
- **heading**: Title case, formal (Welcome Back, Contact Information)
- **placeholder**: Instructional (Enter your email, Type a message)
- **label**: Clear, descriptive (Email Address, Full Name)
- **content**: Natural, conversational

Generate professional, native-speaker quality translations that work perfectly in UI contexts.`;

export async function POST(req: Request) {
  try {
    const { keys } = await req.json();

    if (!keys || !Array.isArray(keys)) {
      return NextResponse.json(
        { error: "Keys array is required" },
        { status: 400 }
      );
    }

    console.log(
      `🌍 Translating ${keys.length} keys:`,
      keys.map((k) => k.key)
    );

    // Build prompt with keys and contexts
    const keysList = keys
      .map((k) => `- "${k.key}" (context: ${k.context})`)
      .join("\n");

    const result = await generateObject({
      model: openai("gpt-4.1"),
      prompt: `Translate these semantic keys into natural UI text in all 6 languages:

${keysList}

IMPORTANT: Return a nested structure where each key has its own translations object. For example:
{
  "translations": {
    "welcome_back": {
      "en": "Welcome Back",
      "es": "Bienvenido de nuevo",
      "fr": "Bon retour",
      "de": "Willkommen zurück",
      "ja": "お帰りなさい",
      "zh": "欢迎回来"
    },
    "click_me": {
      "en": "Click me",
      "es": "Haz clic aquí",
      "fr": "Cliquez ici",
      "de": "Klicken Sie hier",
      "ja": "クリックしてください",
      "zh": "点击这里"
    }
  }
}`,
      schema: TranslationSchema,
      system: TRANSLATION_PROMPT,
    });

    const translations = result.object.translations;

    console.log(
      `✅ Generated translations for ${Object.keys(translations).length} keys`
    );

    return NextResponse.json({
      success: true,
      translations,
      totalKeys: Object.keys(translations).length,
    });
  } catch (error) {
    console.error("❌ Key translation error:", error);

    return NextResponse.json({
      success: false,
      translations: {},
      totalKeys: 0,
      error: "Failed to translate keys - please try again",
    });
  }
}
