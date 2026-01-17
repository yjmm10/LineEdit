
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, ModificationLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

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

export const refineDocument = async (content: string, instruction: string, level: ModificationLevel): Promise<AIResponse> => {
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
  try {
    const text = response.text || "{}";
    return JSON.parse(text) as AIResponse;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return { summary: "Error processing document revisions.", suggestions: [] };
  }
};
