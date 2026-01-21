
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, ModificationLevel } from "../types";

// --- Configuration ---
// Priority 1: Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Priority 2: OpenAI Compatible
const OPENAI_BASE_URL = process.env.BASE_URL;
const OPENAI_API_KEY = process.env.API_KEY;
const OPENAI_MODEL_NAME = process.env.MODEL_NAME || "gpt-3.5-turbo";

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
const callGemini = async (content: string, instruction: string, level: ModificationLevel): Promise<AIResponse> => {
  if (!GEMINI_API_KEY) throw new Error("MISSING_GEMINI_KEY");
  
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
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

  try {
    // Determine endpoint - handle cases where BASE_URL might already include /v1 or /chat/completions
    let url = OPENAI_BASE_URL;
    if (!url.endsWith('/chat/completions')) {
        // If it ends with /v1, just add /chat/completions, otherwise add /v1/chat/completions
        // This is a simple heuristic, might need adjustment based on specific provider quirks
        if (url.endsWith('/v1')) {
            url = `${url}/chat/completions`;
        } else if (url.endsWith('/')) {
             url = `${url}chat/completions`; // Assume full path provided or simplified base
        } else {
             url = `${url}/chat/completions`; // Default append
        }
    }

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
        console.error("OpenAI API Error:", response.status, errText);
        throw new Error(`API_ERROR: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const jsonString = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(jsonString) as AIResponse;

  } catch (error) {
    console.error("OpenAI Compatible Call Failed:", error);
    throw error;
  }
};

// --- Main Export ---

export const refineDocument = async (content: string, instruction: string, level: ModificationLevel): Promise<AIResponse> => {
  // Check keys before attempting anything
  if (GEMINI_API_KEY) {
    console.log("Using Gemini Provider");
    return await callGemini(content, instruction, level);
  } else if (OPENAI_BASE_URL && OPENAI_API_KEY) {
    console.log("Using OpenAI Compatible Provider:", OPENAI_MODEL_NAME);
    return await callOpenAICompatible(content, instruction, level);
  } else {
    // Explicitly throw so the UI can catch it
    throw new Error("NO_PROVIDER_CONFIGURED");
  }
};
