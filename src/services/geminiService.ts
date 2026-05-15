import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeDietPDF(base64Data: string, fileName?: string) {
  const model = "gemini-2.0-flash";
  // WARNING: DO NOT MODIFY THE FOLLOWING PROMPT. 
  // It has been optimized for high-fidelity literal transcription of clinical diet PDFs.
  // Changes to these instructions may result in loss of detail or incorrect table formatting.
  const prompt = `
    Analyze this nutrition diet PDF comprehensively. 
    1. Extract or ESTIMATE the primary daily nutritional targets:
       - Protein (total grams per day)
       - Carbohydrates (total grams per day)
       - Fat (total grams per day)
       - Total Calories (kcal per day)
    
    IMPORTANT: If the PDF does not explicitly state the total macros (e.g. "150g protein"), 
    you MUST calculate the approximate totals based on the specific foods and portions 
    listed in the meal plan (e.g. sum up the protein in the eggs, chicken, and yogurt mentioned). 
    NEVER return 0 for these values unless the diet is a total fast.
    
    2. Provide a FULL, LITERAL TRANSCRIPTION of the eating plan. 
       - DO NOT SUMMARIZE, DO NOT SHORTEN, DO NOT TRUNCATE. 
       - Capture 100% of the meals, ALL options (Option 1, Option 2, etc.), ALL ingredients, and ALL quantities/portions.
       - If there are notes, general rules, or dietary guidelines, include them verbatim.
       - Use Markdown TABLES for every meal schedule. 
       - Use columns like "Meal/Time" and "Food, Description & Quantities".
       - Keep the portion/quantity in the same cell as the food item.
       - The goal is for the user to see EVERYTHING that was in the PDF, but in a clean digital table format.
       - If a section cannot be easily put into a table, transcribe it as formatted Markdown text.
    
    3. Identify and Extract SELECTABLE MEAL OPTIONS:
       - Go through the meal plan and identify every distinct, loggable meal choice.
       - Create a list of "selectableOptions".
       - For each option, provide:
          - category: (e.g. "Breakfast", "Snack", "Lunch", "Dinner")
          - foodName: (A short, concise name for the meal, e.g. "Greek Yogurt with Berries")
          - description: (A literal transcription of the full meal description and quantity)
          - nutrients: (ESTIMATE the protein, carbs, fat, and calories for THIS SPECIFIC MEAL OPTION)
    
    4. Determine the intended MONTH and YEAR of this diet plan. 
       Look for dates within the PDF text or headers. 
       Filename provided for context: "${fileName || "unknown"}".
       IMPORTANT: If no specific year is found in the PDF, use the CURRENT YEAR (2026).
       Extract:
       - monthName: (e.g. "January" or "Enero" depending on source language)
       - monthIndex: (0-11)
       - year: (number, e.g. 2026)
      
    IMPORTANT FOR TARGETS:
    - Use these EXACT keys in English for the targets object: "protein", "carbs", "fat", "calories".
    - Return targets as WHOLE NUMBERS (integers). No decimals.
    - If a target is missing, ESTIMATE it based on the plan. NEVER return 0.
    
    Return the response as a JSON object following the schema. Text content (fullPlanMarkdown, monthName) must match the source PDF language.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Data, mimeType: "application/pdf" } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullPlanMarkdown: { type: Type.STRING },
          monthName: { type: Type.STRING },
          monthIndex: { type: Type.NUMBER },
          year: { type: Type.NUMBER },
          targets: {
            type: Type.OBJECT,
            properties: {
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fat: { type: Type.NUMBER },
              calories: { type: Type.NUMBER }
            }
          },
          selectableOptions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                category: { type: Type.STRING },
                foodName: { type: Type.STRING },
                description: { type: Type.STRING },
                nutrients: {
                  type: Type.OBJECT,
                  properties: {
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                    calories: { type: Type.NUMBER }
                  }
                }
              },
              required: ["category", "foodName", "description", "nutrients"]
            }
          }
        },
        required: ["fullPlanMarkdown", "targets", "monthName", "monthIndex", "year"]
      }
    }
  });

  const text = response.text;
  const parsed = JSON.parse(text);
  
  // Add IDs to selectable options if missing
  const selectableOptions = (parsed.selectableOptions || []).map((opt: any, index: number) => ({
    ...opt,
    id: opt.id || `opt-${Date.now()}-${index}`
  }));

  return {
    summary: parsed.fullPlanMarkdown,
    ...parsed,
    selectableOptions
  };
}

export async function analyzeInBodyPDF(base64Data: string) {
  const model = "gemini-2.0-flash";
  const prompt = `
    Analyze this InBody body composition report PDF.
    Extract the following metrics:
    - Date of the test (if not found, use current date: 2026-05-09)
    - Weight (kg)
    - Skeletal Muscle Mass (SMM) (kg)
    - Percentage Body Fat (PBF) (%)
    - Body Mass Index (BMI)
    - Visceral Fat Area (VFA) (cm2, optional)
    
    Return the response as a clear JSON object with the format:
    {
      "date": "YYYY-MM-DD",
      "weight": number,
      "smm": number,
      "pbf": number,
      "bmi": number,
      "vfa": number | null
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Data, mimeType: "application/pdf" } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          weight: { type: Type.NUMBER },
          smm: { type: Type.NUMBER },
          pbf: { type: Type.NUMBER },
          bmi: { type: Type.NUMBER },
          vfa: { type: Type.NUMBER }
        },
        required: ["date", "weight", "smm", "pbf", "bmi"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function analyzeFood(foodDescription: string) {
  const model = "gemini-2.0-flash";
  const prompt = `
    Analyze this food description: "${foodDescription}". 
    Estimate the nutritional values in grams: protein, carbs, and fat.
    Calculate the total calories (kcal) using these estimates (approx 4 kcal/g for protein and carbs, 9 kcal/g for fat).
    
    IMPORTANT: NEVER return 0 for calories if there is any protein, carbs, or fat.
    Return a foodName and the nutrients as a clear JSON object.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          foodName: { type: Type.STRING },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
          calories: { type: Type.NUMBER }
        },
        required: ["foodName", "protein", "carbs", "fat", "calories"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function getNutritionAdvice(
  currentIntake: any,
  targetIntake: any,
  dietSummary: string,
  userQuestion: string
) {
  const model = "gemini-2.0-flash";
  const prompt = `
    Current Intake Today: ${JSON.stringify(currentIntake)}
    Target Intake: ${JSON.stringify(targetIntake)}
    Diet Plan Context: ${dietSummary}
    
    User Question/Modification: ${userQuestion}
    
    Based on the diet plan and today's intake, suggest a healthy adaptation or food to fulfill the missing nutrients.
    If the user modified the diet, let them know if it's a good adaptation or how to balance it.
    
    IMPORTANT: Respond in the SAME LANGUAGE as the Diet Plan Context (e.g., if the plan is in Spanish, respond in Spanish; if it's in English, respond in English). Use a helpful, encouraging tone.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });

  return response.text;
}
