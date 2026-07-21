const API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
const IMPORT_API_KEY = import.meta.env.VITE_IMPORT_API_KEY || API_KEY || "";

/**
 * Scores a user's writing answer against the correct definition and synonyms using Groq AI.
 * Falls back to offline logic if API fails or takes > 5s.
 */
export async function scoreWritingAnswerAI(
    userInput: string,
    definition: string,
    synonyms: string[],
    throwOnError: boolean = false,
    modelId: string = "llama-3.3-70b-versatile"
): Promise<boolean | null> {
    if (!API_KEY) {
        if (throwOnError) console.warn("scoreWritingAnswerAI: No Groq API Key found.");
        return null;
    }
    if (!navigator.onLine) return null;

    const prompt = `Task: Score vocab answer.
Word Definition: "${definition}"
Valid Synonyms: ${synonyms.join(", ")}
Student Answer: "${userInput}"

Rules:
1. Respond ONLY "CORRECT" if the student answer matches the meaning or is a valid synonym.
2. Respond ONLY "INCORRECT" otherwise.
3. Ignore minor spelling/grammar.
4. ONE WORD RESPONSE ONLY.`;

    try {
        // 3 second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: "system", content: "You are a vocabulary scoring assistant. Respond with ONLY 'CORRECT' or 'INCORRECT'." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 5
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            console.error("[Groq API Error]", response.status, errBody);
            return null;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim().toUpperCase() || "";

        if (text.includes("CORRECT") && !text.includes("INCORRECT")) {
            console.log(`[Groq] Score SUCCESS: ${text}`);
            return true;
        }
        if (text.includes("INCORRECT") && !text.includes("CORRECT")) {
            console.log(`[Groq] Score SUCCESS: ${text}`);
            return false;
        }

        console.warn(`[Groq] Ambiguous response: "${text}"`);
        return null;
    } catch (err: any) {
        if (err.name === 'AbortError') {
            console.warn("[Groq] Request timed out (3s).");
        } else {
            console.error("[Groq Service Error]", err.message || err);
        }
        return null;
    }
}

/**
 * Expands a list of words with definitions, synonyms, and example sentences.
 */
export async function expandWordsAI(
    words: { name: string, definition?: string }[],
    modelId: string = "llama-3.3-70b-versatile"
): Promise<any[]> {
    if (!IMPORT_API_KEY || !navigator.onLine || words.length === 0) return [];

    const prompt = `Task: Vocabulary Enrichment.
For each word provided, generate a precise dictionary-style definition, 3-4 sophisticated synonyms, and a complex example sentence (min 15 words).

INPUT:
${JSON.stringify(words, null, 2)}

Respond ONLY with a valid JSON array in this exact format. Do NOT wrap the response in markdown code blocks.
[
  {
    "name": "word",
    "definition": "dictionary-style definition",
    "synonyms": "synonym1, synonym2, synonym3",
    "example": "example sentence here",
    "difficulty": "medium"
  }
]`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${IMPORT_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: "system", content: "You are an elite SAT/SSAT Verbal Tutor. You output ONLY raw JSON arrays. You NEVER output markdown." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 3000
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) return [];

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "[]";

        content = content.trim();
        if (content.startsWith("```")) {
            content = content.replace(/^```json/i, "").replace(/^```/g, "").replace(/```$/g, "").trim();
        }
        if (content.includes("[")) {
            const start = content.indexOf("[");
            const end = content.lastIndexOf("]") + 1;
            content = content.substring(start, end);
        }

        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
        console.error("[Groq expandWordsAI Error]", err);
        return [];
    }
}
/**
 * Takes raw, potentially messy text and extracts structured vocabulary objects.
 * This handles cases where words, definitions, and examples are mixed together.
 */
export async function smartExtractVocabAI(
    rawText: string,
    modelId: string = "llama-3.3-70b-versatile"
): Promise<any[]> {
    if (!IMPORT_API_KEY || !navigator.onLine || !rawText.trim()) return [];

    const prompt = `Task: Vocabulary Word Extraction.
Analyze the provided raw text and extract every genuine English vocabulary word. 

CRITICAL RULES:
1. IGNORE headers, titles, and instructions (e.g., "100 sat words to study", "Chapter 1").
2. IGNORE gibberish, random keystrokes, and non-words (e.g., "aslksjd", "qwerty").
3. IGNORE standalone numbers and bullet points.
4. If the text includes definitions next to the words, extract those too. If not, just extract the words and leave definition empty.

RAW TEXT TO PROCESS:
"""
${rawText.slice(0, 8000)} 
"""

Respond ONLY with a valid JSON array of objects in this exact format. Do NOT wrap in markdown or add explanations.
[
  {
    "name": "extracted word",
    "definition": "extracted definition (leave empty string if none provided in text)"
  }
]`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${IMPORT_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: "system", content: "You are a data extraction assistant. You output ONLY raw JSON arrays. You NEVER output markdown." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 4000
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "[]";

        content = content.trim();
        if (content.startsWith("```")) {
            content = content.replace(/^```json/i, "").replace(/^```/g, "").replace(/```$/g, "").trim();
        }
        if (content.includes("[")) {
            const start = content.indexOf("[");
            const end = content.lastIndexOf("]") + 1;
            content = content.substring(start, end);
        }

        try {
            const parsed = JSON.parse(content);
            if (!Array.isArray(parsed)) return [];

            // STRICT VALIDATION: Remove junk or incomplete entries
            return parsed.filter(w =>
                w.name &&
                w.name.trim().length > 1 && // Exclude single letters or empty strings
                w.name.split(' ').length <= 3 && // No full sentences as names
                !w.name.match(/^[0-9\.\-\_\s]+$/) && // Exclude just numbers/punctuation
                !/^(chapter|lesson|unit|page|sat words|vocabulary)/i.test(w.name.trim()) // Exclude common headers
            );
        } catch (e) {
            console.error("[Groq Parse Error] Raw content:", content);
            return [];
        }
    } catch (err: any) {
        console.error("[Groq smartExtractVocabAI Error]", err);
        if (err.name === 'AbortError') throw new Error("AI Timeout: This text is too complex to process accurately right now.");
        return [];
    }
}
