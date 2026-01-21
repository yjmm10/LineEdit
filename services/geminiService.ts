
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, ModificationLevel } from "../types";

// --- Configuration Helper ---
const getEnvVar = (key: string): string | undefined => {
  // 1. Try import.meta.env (Vite standard)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // Check for VITE_ prefixed version first (standard convention)
    // @ts-ignore
    const viteKey = `VITE_${key}`;
    // @ts-ignore
    if (import.meta.env[viteKey]) return import.meta.env[viteKey];
    
    // CRITICAL FIX: 'BASE_URL' is reserved by Vite (defaults to '/'). 
    // We strictly ignore it here so we can retrieve the actual API URL from process.env below.
    if (key !== 'BASE_URL') {
      // @ts-ignore
      if (import.meta.env[key]) return import.meta.env[key];
    }
  }

  // 2. Check process.env (Polyfilled by Vite define or Node)
  try {
    // CRITICAL FIX: Vite replaces 'process.env.KEY' with the literal string value at build time.
    // We MUST NOT check 'typeof process' here, because 'process' does not exist in the browser.
    // We just access the key directly, trusting that Vite has replaced it with a string or undefined.
    
    if (key === 'GEMINI_API_KEY') {
        // @ts-ignore
        return process.env.GEMINI_API_KEY;
    }
    
    if (key === 'BASE_URL') {
       // Check the alias first which is safer
       // @ts-ignore
       if (process.env.OPENAI_BASE_URL) return process.env.OPENAI_BASE_URL;
       // @ts-ignore
       if (process.env.BASE_URL) return process.env.BASE_URL;
    }

    if (key === 'API_KEY') {
        // @ts-ignore
        return process.env.API_KEY;
    }

    if (key === 'MODEL_NAME') {
        // @ts-ignore
        return process.env.MODEL_NAME;
    }

    // Fallback dynamic access (Only works if process is actually defined, e.g. Node.js)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {
    // Ignore reference errors
  }
  return undefined;
};

// --- Configuration ---
// Priority 1: Specific Gemini Key
const GEMINI_API_KEY = getEnvVar('GEMINI_API_KEY');

// Priority 2: OpenAI Compatible
const OPENAI_BASE_URL = getEnvVar('BASE_URL');
const OPENAI_API_KEY = getEnvVar('API_KEY');
const OPENAI_MODEL_NAME = getEnvVar('MODEL_NAME') || "gpt-3.5-turbo";

// Priority 3: Fallback generic API_KEY (assume it's Gemini if no Base URL)
const GENERIC_API_KEY = OPENAI_API_KEY;

const PROMPT_STRATEGIES: Record<ModificationLevel, string> = {
  preserve: `
    **STRATEGY: CONSERVATIVE / PRESERVE**
    - **Goal**: Fix only objective errors (grammar, spelling, punctuation, factual inconsistencies).
    - **Constraint**: Strict adherence to the original text. Do NOT change style, tone, or word choice unless it is grammatically incorrect.
    - **Threshold**: Only output a suggestion if the sentence is objectively wrong. If it's valid, skip it.
  `,
  refine: `
    **STRATEGY: BALANCED / REFINE**
    - **Goal**: Improve clarity, flow, and readability while correcting errors.
    - **Constraint**: Maintain the author's original voice and intent. You may smooth out awkward phrasing or resolve ambiguities.
    - **Threshold**: Output a suggestion if the sentence is confusing, wordy, or contains errors. If it's clear and correct, keep it.
  `,
  elevate: `
    **STRATEGY: AGGRESSIVE / ELEVATE**
    - **Goal**: Rewrite for maximum impact, professional polish, and elegance.
    - **Constraint**: You have creative freedom to change sentence structure and vocabulary to achieve a superior standard of writing.
    - **Threshold**: Almost every sentence should be evaluated for improvement. Even if grammatically correct, if it can be written better/more beautifully, provide a suggestion.
  `
};

// --- Gemini Implementation ---
const callGemini = async (apiKey: string, content: string, instruction: string, level: ModificationLevel): Promise<AIResponse> => {
  const ai = new GoogleGenAI({ apiKey });
  const strategyPrompt = PROMPT_STRATEGIES[level];

  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert editor.

User Content:
"""
${content}
"""

User Instruction: "${instruction}"

${strategyPrompt}

Task:
Analyze the document sentence by sentence based on the STRATEGY above.

Output Logic:
- If a sentence needs modification according to the active STRATEGY, output a JSON object with:
  - "originalText": The exact sentence from the source.
  - "reason": The analysis of why it needs changing and how (The "Modification Suggestion").
  - "modifiedText": The revised sentence.
- If a sentence does NOT need modification based on the STRATEGY, do not include it in the output.

Response Format:
Return a JSON object containing a 'summary' and a 'suggestions' array.
`
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalText: { type: Type.STRING },
                modifiedText: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["originalText", "modifiedText", "reason"]
            }
          }
        },
        required: ["summary", "suggestions"]
      }
    }
  });

  const response = await model;
  const text = response.text || "{}";
  return JSON.parse(text) as AIResponse;
};

// --- OpenAI Compatible Implementation ---
const callOpenAICompatible = async (content: string, instruction: string, level: ModificationLevel): Promise<AIResponse> => {
  if (!OPENAI_BASE_URL || !OPENAI_API_KEY) throw new Error("MISSING_OPENAI_CONFIG");

  const strategyPrompt = PROMPT_STRATEGIES[level];

  const systemPrompt = `You are an expert editor JSON API.
  
${strategyPrompt}

Output Format:
You must respond with a valid JSON object strictly adhering to this schema:
{
  "summary": "string (A brief overview of changes made)",
  "suggestions": [
    {
      "originalText": "string (The exact original sentence from the text)",
      "modifiedText": "string (The improved sentence)",
      "reason": "string (Why this change was made)"
    }
  ]
}

Instructions:
1. Analyze the provided text based on the User Instruction and Strategy.
2. Only include items in the 'suggestions' array if they require modification based on the strategy.
3. Ensure the JSON is valid and parseable.
`;

  const userPrompt = `
User Content:
"""
${content}
"""

User Instruction: "${instruction}"
`;

  let url = OPENAI_BASE_URL.replace(/\/+$/, '');
  
  // Heuristic to ensure URL is correct
  if (!url.endsWith('/chat/completions')) {
      // Check for presence of version like v1, v1beta, v2 in the path
      const hasVersion = /\/v\d+(?:[a-z0-9]+)?(?:$|\/)/i.test(url);
      
      if (hasVersion) {
         // Version present, just append endpoint
         url = `${url}/chat/completions`;
      } else {
         // No version present, standard assumption is /v1/chat/completions
         url = `${url}/v1/chat/completions`;
      }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`OpenAI API Error (${url}):`, response.status, errText);
        throw new Error(`API_ERROR: ${response.status} - ${errText} (Target: ${url})`);
    }

    const data = await response.json();
    const jsonString = data.choices?.[0]?.message?.content || "{}";
    
    // Attempt to parse strictly
    try {
        return JSON.parse(jsonString) as AIResponse;
    } catch (parseError) {
        // Fallback for messy markdown code blocks often returned by weaker models
        const cleanJson = jsonString.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanJson) as AIResponse;
    }

  } catch (error) {
    console.error("OpenAI Compatible Call Failed:", error);
    throw error;
  }
};

// --- Main Export ---

export const refineDocument = async (content: string, instruction: string, level: ModificationLevel): Promise<AIResponse> => {
  // Scenario 1: User explicitly set GEMINI_API_KEY
  if (GEMINI_API_KEY) {
    console.log("Using Gemini Provider (GEMINI_API_KEY)");
    return await callGemini(GEMINI_API_KEY, content, instruction, level);
  } 
  // Scenario 2: User set BASE_URL and API_KEY -> OpenAI Compatible
  else if (OPENAI_BASE_URL && OPENAI_API_KEY) {
    console.log("Using OpenAI Compatible Provider:", OPENAI_MODEL_NAME);
    return await callOpenAICompatible(content, instruction, level);
  } 
  // Scenario 3: User only set API_KEY (and no Base URL) -> Assume Gemini fallback
  else if (GENERIC_API_KEY && !OPENAI_BASE_URL) {
    console.log("Using Gemini Provider (Fallback to API_KEY)");
    return await callGemini(GENERIC_API_KEY, content, instruction, level);
  }
  else {
    // Explicitly throw so the UI can catch it
    throw new Error("NO_PROVIDER_CONFIGURED");
  }
};
