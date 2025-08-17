import initSqlJs, { Database } from "sql.js";

let db: Database | null = null;

export interface LocalizationEntry {
  id: string;
  key: string;
  en: string;
  es: string;
  fr: string;
  de: string;
  ja: string;
  zh: string;
  created_at?: string;
  updated_at?: string;
}

export interface ComponentEntry {
  id: string;
  name: string;
  description: string;
  code: string;
  user_prompt: string;
  extracted_keys: string[]; // JSON array of localization keys used in this component
  demo_props?: string; // JSON string of component-specific demo props
  created_at?: string;
  updated_at?: string;
}

// Simple database class for CRUD operations
export class LocalizationDB {
  private static instance: LocalizationDB;

  static getInstance(): LocalizationDB {
    if (!LocalizationDB.instance) {
      LocalizationDB.instance = new LocalizationDB();
    }
    return LocalizationDB.instance;
  }

  async init(): Promise<void> {
    if (db) return;
    await initializeDatabase();
  }

  async getAll(): Promise<LocalizationEntry[]> {
    await this.init();
    return getAllLocalizations();
  }

  async update(id: string, field: string, value: string): Promise<void> {
    await this.init();
    return updateLocalization(id, field, value);
  }

  async create(
    entry: Omit<LocalizationEntry, "created_at" | "updated_at">
  ): Promise<void> {
    await this.init();
    return createLocalization(entry);
  }

  async delete(id: string): Promise<void> {
    await this.init();
    return deleteLocalization(id);
  }

  async getTranslations(locale: string): Promise<Record<string, string>> {
    await this.init();
    return getTranslations(locale);
  }

  // Component management methods
  async getAllComponents(): Promise<ComponentEntry[]> {
    await this.init();
    return getAllComponents();
  }

  async createComponent(
    entry: Omit<ComponentEntry, "created_at" | "updated_at">
  ): Promise<void> {
    await this.init();
    return createComponent(entry);
  }

  async updateComponent(
    id: string,
    updates: Partial<Omit<ComponentEntry, "id" | "created_at" | "updated_at">>
  ): Promise<void> {
    await this.init();
    return updateComponent(id, updates);
  }

  async deleteComponent(id: string): Promise<void> {
    await this.init();
    return deleteComponent(id);
  }

  async getComponent(id: string): Promise<ComponentEntry | null> {
    await this.init();
    return getComponent(id);
  }
}

export async function initializeDatabase(): Promise<void> {
  if (db) return; // Already initialized

  try {
    // Initialize SQL.js
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });

    // Try to load existing database from localStorage
    const savedDb = localStorage.getItem("localizations_db");
    let needsComponentsTable = false;

    if (savedDb) {
      const uint8Array = new Uint8Array(savedDb.split(",").map(Number));
      db = new SQL.Database(uint8Array);
      console.log("Loaded existing database from localStorage");

      // Check if components table exists
      try {
        db.exec("SELECT 1 FROM components LIMIT 1");

        // Check if demo_props column exists in existing table
        try {
          db.exec("SELECT demo_props FROM components LIMIT 1");
          console.log("Components table exists with demo_props column");
        } catch (columnError) {
          console.log(
            "Components table exists but missing demo_props column, adding it"
          );
          db.run(
            "ALTER TABLE components ADD COLUMN demo_props TEXT DEFAULT '{}'"
          );
          // Save database after migration
          saveDatabaseToLocalStorage();
        }
      } catch (error) {
        console.log("Components table missing, will create it");
        needsComponentsTable = true;
      }
    } else {
      needsComponentsTable = true;
    }

    if (!db || needsComponentsTable) {
      if (!db) {
        // Create new database
        db = new SQL.Database();

        // Create the localization table
        db.run(`
          CREATE TABLE localizations (
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            en TEXT DEFAULT '',
            es TEXT DEFAULT '',
            fr TEXT DEFAULT '',
            de TEXT DEFAULT '',
            ja TEXT DEFAULT '',
            zh TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )
        `);

        // Insert initial data
        await seedInitialData();
        console.log("Created new database with initial localization data");
      }

      if (needsComponentsTable) {
        // Create the components table (for both new and existing databases)
        db.run(`
          CREATE TABLE IF NOT EXISTS components (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            code TEXT NOT NULL,
            user_prompt TEXT NOT NULL,
            extracted_keys TEXT DEFAULT '[]',
            demo_props TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )
        `);
        console.log("Created components table");
      }
    }

    // Save database to localStorage
    saveDatabaseToLocalStorage();
  } catch (error) {
    console.error("Failed to initialize SQLite database:", error);
    throw error;
  }
}

async function seedInitialData(): Promise<void> {
  if (!db) throw new Error("Database not initialized");

  const initialData = [
    {
      id: "1",
      key: "welcome.title",
      en: "Welcome to our app",
      es: "Bienvenido a nuestra aplicación",
      fr: "Bienvenue dans notre application",
      de: "Willkommen in unserer App",
      ja: "私たちのアプリへようこそ",
      zh: "欢迎使用我们的应用",
    },
    {
      id: "2",
      key: "button.submit",
      en: "Submit",
      es: "Enviar",
      fr: "Soumettre",
      de: "Absenden",
      ja: "送信",
      zh: "提交",
    },
    {
      id: "3",
      key: "error.validation",
      en: "Please check your input",
      es: "Por favor verifica tu entrada",
      fr: "Veuillez vérifier votre saisie",
      de: "Bitte überprüfen Sie Ihre Eingabe",
      ja: "入力内容を確認してください",
      zh: "请检查您的输入",
    },
    {
      id: "4",
      key: "navigation.home",
      en: "Home",
      es: "Inicio",
      fr: "Accueil",
      de: "Startseite",
      ja: "ホーム",
      zh: "首页",
    },
    {
      id: "5",
      key: "form.email",
      en: "Email Address",
      es: "Dirección de correo",
      fr: "Adresse e-mail",
      de: "E-Mail-Adresse",
      ja: "メールアドレス",
      zh: "电子邮件地址",
    },
    {
      id: "6",
      key: "click_me",
      en: "Click me",
      es: "Haz clic aquí",
      fr: "Cliquez-moi",
      de: "Klick mich",
      ja: "クリックしてください",
      zh: "点击我",
    },
    {
      id: "7",
      key: "demo_title",
      en: "Demo Title",
      es: "Título de demostración",
      fr: "Titre de démo",
      de: "Demo-Titel",
      ja: "デモタイトル",
      zh: "演示标题",
    },
    {
      id: "8",
      key: "demo_description",
      en: "This is a demo description.",
      es: "Esta es una descripción de demostración.",
      fr: "Ceci est une description de démo.",
      de: "Dies ist eine Demo-Beschreibung.",
      ja: "これはデモの説明です。",
      zh: "这是一个演示描述。",
    },
    {
      id: "9",
      key: "enter_text_here",
      en: "Enter text here...",
      es: "Ingrese texto aquí...",
      fr: "Entrez le texte ici...",
      de: "Text hier eingeben...",
      ja: "ここにテキストを入力...",
      zh: "在此输入文本...",
    },
    {
      id: "10",
      key: "demo_text",
      en: "Demo text",
      es: "Texto de demostración",
      fr: "Texte de démo",
      de: "Demo-Text",
      ja: "デモテキスト",
      zh: "演示文本",
    },
    {
      id: "11",
      key: "demo_name",
      en: "Demo Name",
      es: "Nombre de Demostración",
      fr: "Nom de Démo",
      de: "Demo-Name",
      ja: "デモ名",
      zh: "演示名称",
    },
    {
      id: "12",
      key: "demo_value",
      en: "Demo Value",
      es: "Valor de Demostración",
      fr: "Valeur de Démo",
      de: "Demo-Wert",
      ja: "デモ値",
      zh: "演示值",
    },
    {
      id: "13",
      key: "save_document",
      en: "Save Document",
      es: "Guardar Documento",
      fr: "Enregistrer le Document",
      de: "Dokument Speichern",
      ja: "ドキュメントを保存",
      zh: "保存文档",
    },
  ];

  for (const entry of initialData) {
    db.run(
      `
      INSERT INTO localizations (id, key, en, es, fr, de, ja, zh)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        entry.id,
        entry.key,
        entry.en,
        entry.es,
        entry.fr,
        entry.de,
        entry.ja,
        entry.zh,
      ]
    );
  }
}

function saveDatabaseToLocalStorage(): void {
  if (!db) return;

  try {
    const data = db.export();
    const array = Array.from(data);
    localStorage.setItem("localizations_db", array.toString());
  } catch (error) {
    console.error("Failed to save database to localStorage:", error);
  }
}

export async function getAllLocalizations(): Promise<LocalizationEntry[]> {
  if (!db) {
    await initializeDatabase();
  }

  const result = db!.exec("SELECT * FROM localizations ORDER BY key");
  if (result.length === 0) return [];

  return result[0].values.map((row) => ({
    id: row[0] as string,
    key: row[1] as string,
    en: row[2] as string,
    es: row[3] as string,
    fr: row[4] as string,
    de: row[5] as string,
    ja: row[6] as string,
    zh: row[7] as string,
    created_at: row[8] as string,
    updated_at: row[9] as string,
  }));
}

export async function updateLocalization(
  id: string,
  field: string,
  value: string
): Promise<void> {
  if (!db) {
    await initializeDatabase();
  }

  // Validate field to prevent SQL injection
  const validFields = ["key", "en", "es", "fr", "de", "ja", "zh"];
  if (!validFields.includes(field)) {
    throw new Error(`Invalid field: ${field}`);
  }

  db!.run(
    `
    UPDATE localizations 
    SET ${field} = ?, updated_at = datetime('now')
    WHERE id = ?
  `,
    [value, id]
  );

  saveDatabaseToLocalStorage();
}

export async function createLocalization(
  entry: Omit<LocalizationEntry, "created_at" | "updated_at">
): Promise<void> {
  if (!db) {
    await initializeDatabase();
  }

  db!.run(
    `
    INSERT INTO localizations (id, key, en, es, fr, de, ja, zh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      entry.id,
      entry.key,
      entry.en,
      entry.es,
      entry.fr,
      entry.de,
      entry.ja,
      entry.zh,
    ]
  );

  saveDatabaseToLocalStorage();
}

export async function deleteLocalization(id: string): Promise<void> {
  if (!db) {
    await initializeDatabase();
  }

  db!.run("DELETE FROM localizations WHERE id = ?", [id]);
  saveDatabaseToLocalStorage();
}

export async function getTranslations(
  locale: string
): Promise<Record<string, string>> {
  if (!db) {
    await initializeDatabase();
  }

  // Validate locale to prevent SQL injection
  const validLocales = ["en", "es", "fr", "de", "ja", "zh"];
  if (!validLocales.includes(locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }

  const result = db!.exec(
    `SELECT key, ${locale} as translation FROM localizations`
  );
  if (result.length === 0) return {};

  return result[0].values.reduce((acc, row) => {
    acc[row[0] as string] = (row[1] as string) || "";
    return acc;
  }, {} as Record<string, string>);
}

// Component CRUD operations
export async function getAllComponents(): Promise<ComponentEntry[]> {
  if (!db) {
    await initializeDatabase();
  }

  const result = db!.exec("SELECT * FROM components ORDER BY created_at DESC");
  if (result.length === 0) return [];

  return result[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    description: row[2] as string,
    code: row[3] as string,
    user_prompt: row[4] as string,
    extracted_keys: JSON.parse(row[5] as string),
    demo_props: row[6] as string,
    created_at: row[7] as string,
    updated_at: row[8] as string,
  }));
}

export async function createComponent(
  entry: Omit<ComponentEntry, "created_at" | "updated_at">
): Promise<void> {
  if (!db) {
    await initializeDatabase();
  }

  db!.run(
    `
    INSERT INTO components (id, name, description, code, user_prompt, extracted_keys, demo_props)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [
      entry.id,
      entry.name,
      entry.description,
      entry.code,
      entry.user_prompt,
      JSON.stringify(entry.extracted_keys),
      entry.demo_props || "{}",
    ]
  );

  saveDatabaseToLocalStorage();
}

export async function updateComponent(
  id: string,
  updates: Partial<Omit<ComponentEntry, "id" | "created_at" | "updated_at">>
): Promise<void> {
  if (!db) {
    await initializeDatabase();
  }

  // Build dynamic update query
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.code !== undefined) {
    fields.push("code = ?");
    values.push(updates.code);
  }
  if (updates.user_prompt !== undefined) {
    fields.push("user_prompt = ?");
    values.push(updates.user_prompt);
  }
  if (updates.extracted_keys !== undefined) {
    fields.push("extracted_keys = ?");
    values.push(JSON.stringify(updates.extracted_keys));
  }

  if (fields.length === 0) return; // No updates to make

  fields.push('updated_at = datetime("now")');
  values.push(id);

  db!.run(
    `
    UPDATE components 
    SET ${fields.join(", ")}
    WHERE id = ?
  `,
    values
  );

  saveDatabaseToLocalStorage();
}

export async function deleteComponent(id: string): Promise<void> {
  if (!db) {
    await initializeDatabase();
  }

  db!.run("DELETE FROM components WHERE id = ?", [id]);
  saveDatabaseToLocalStorage();
}

export async function getComponent(id: string): Promise<ComponentEntry | null> {
  if (!db) {
    await initializeDatabase();
  }

  const result = db!.exec("SELECT * FROM components WHERE id = ?", [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    description: row[2] as string,
    code: row[3] as string,
    user_prompt: row[4] as string,
    extracted_keys: JSON.parse(row[5] as string),
    demo_props: row[6] as string,
    created_at: row[7] as string,
    updated_at: row[8] as string,
  };
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Helper function to reset database (useful for development/testing)
export function resetDatabase(): void {
  localStorage.removeItem("localizations_db");
  if (db) {
    db.close();
    db = null;
  }
  console.log("🗑️ Database reset - localStorage cleared");
}

// Helper function to clear only components table (keep translations)
export function clearComponents(): void {
  try {
    if (!db) {
      console.log("Database not initialized");
      return;
    }

    db.run("DELETE FROM components");
    saveDatabaseToLocalStorage();
    console.log("🧹 Cleared all components from database");
  } catch (error) {
    console.error("Error clearing components:", error);
  }
}

// Expose utility functions to window for debugging
if (typeof window !== "undefined") {
  (window as any).resetDB = resetDatabase;
  (window as any).clearComponents = clearComponents;
  (window as any).checkDB = async () => {
    if (!db) {
      await initializeDatabase();
    }
    const components = db!.exec("SELECT COUNT(*) as count FROM components");
    const localizations = db!.exec(
      "SELECT COUNT(*) as count FROM localizations"
    );
    console.log("📊 Database stats:", {
      components: components[0]?.values[0]?.[0] || 0,
      localizations: localizations[0]?.values[0]?.[0] || 0,
    });
  };
}
