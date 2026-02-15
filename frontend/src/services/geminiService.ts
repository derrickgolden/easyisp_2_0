
import { GoogleGenAI } from "@google/genai";

export const getSystemInsight = async (data: any) => {
  // Always use the mandatory initialization pattern for GoogleGenAI with the environment variable
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `As an ISP network manager assistant, analyze this system data and provide a concise summary of status and any potential risks or suggestions: ${JSON.stringify(data)}. Keep it professional and under 100 words.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    // The text content is accessed via the .text property on the GenerateContentResponse object.
    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI insights currently unavailable.";
  }
};
