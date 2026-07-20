export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function seededShuffle<T>(array: T[], seed: number): T[] {
    // If seed is 0, return original order
    if (seed === 0) return [...array];

    // Map each element to an object with a random sort key derived from the seed and its original index/content
    // However, simple Math.random() with a seed isn't built-in to JS.
    // We can use a simple pseudo-random number generator (PRNG) for stability.

    const mulberry32 = (a: number) => {
        return () => {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
    }

    const rng = mulberry32(seed);

    // We want to shuffle the array. A standard Fisher-Yates with a seeded RNG is best.
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

// --- Typo Tolerance and Semantic Scoring Helpers ---

export function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export function isSimilar(word1: string, word2: string): boolean {
    const w1 = word1.toLowerCase().trim();
    const w2 = word2.toLowerCase().trim();
    if (w1 === w2) return true;
    if (w1.includes(w2) || w2.includes(w1)) return true;

    // For short words (3-4 chars), allow 1 typo
    // For longer words (5+ chars), allow 2 typos
    const maxDistance = Math.min(w1.length, w2.length) <= 4 ? 1 : 2;
    return levenshtein(w1, w2) <= maxDistance;
}

export function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        'a', 'an', 'the', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
        'or', 'and', 'but', 'if', 'then', 'else', 'when', 'where', 'how', 'what',
        'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
        'something', 'someone', 'very', 'much', 'more', 'most', 'other', 'such',
        'as', 'into', 'than', 'so', 'can', 'just', 'not', 'also', 'about', 'out'
    ]);

    return text
        .toLowerCase()
        .replace(/[^a-z\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
}


export function cleanDef(def: string): string {
    if (def.includes('(Ex:')) return def.split('(Ex:')[0].trim();
    if (def.includes('Synonym')) return def.split(/synonym/i)[0].trim();
    return def;
}

export function extractSynonyms(def: string): string[] {
    const synMatch = def.match(/Synonyms?:\s*([^.()]+)/i);
    if (!synMatch) {
        // Fallback: extract long words from the whole string if no explicit synonyms
        return def.toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3);
    }
    return synMatch[1]
        .split(/[,;]/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 2);
}

export function scoreAnswerOffline(userInput: string, definition: string, synonyms: string[]): boolean {
    const userAns = userInput.trim().toLowerCase();
    const cleanedActual = cleanDef(definition);
    const actual = cleanedActual.trim().toLowerCase();

    if (userAns.length < 3) return false;

    // 1. Check synonym match (single word match = correct)
    const userWords = userAns.split(/\s+/).filter(w => w.length > 2);
    for (const userWord of userWords) {
        for (const syn of synonyms) {
            if (isSimilar(userWord, syn)) return true;
        }
    }

    // 2. Keyword matching logic
    const actualKeywords = extractKeywords(actual);
    const userKeywords = extractKeywords(userAns);

    if (actualKeywords.length === 0) return userAns === actual;

    let matchedKeywords = 0;
    for (const userWord of userKeywords) {
        for (const actualWord of actualKeywords) {
            if (isSimilar(userWord, actualWord)) {
                matchedKeywords++;
                break;
            }
        }
    }

    const matchRatio = matchedKeywords / actualKeywords.length;
    return matchRatio >= 0.4 || matchedKeywords >= 2;
}
