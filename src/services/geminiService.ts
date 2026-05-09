import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeDietPDF(base64Data: string, fileName?: string) {
  const model = "gemini-2.0-flash";
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
    
    2. Provide a detailed summary of the eating plan, including specific meal-by-meal rules.
    3. Determine the intended MONTH and YEAR of this diet plan. 
       Look for dates within the PDF text or headers. 
       Filename provided for context: "${fileName || "unknown"}".
       IMPORTANT: If no specific year is found in the PDF, use the CURRENT YEAR (2026).
       Extract:
       - monthName: (e.g. "January")
       - monthIndex: (0-11)
       - year: (number, e.g. 2026)
    
    Return the response as a clear JSON object.
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
          summary: { type: Type.STRING },
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
          }
        },
        required: ["summary", "targets", "monthName", "monthIndex", "year"]
      }
    }
  });

  return JSON.parse(response.text);
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
    Estimate the nutritional values: protein, carbs, fat, and calories.
    Format as JSON.
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
        }
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
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });

  return response.text;
}
