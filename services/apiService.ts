
import { GoogleGenAI, Type } from "@google/genai";
import { N8N_WEBHOOKS, CATEGORIES } from '../constants';
import { VoiceAnalysisResult, ImageAnalysisResult, InventoryItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function processVoiceWithGemini(text: string): Promise<VoiceAnalysisResult> {
  if (!text) {
    throw new Error("Input text cannot be empty.");
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following user's spoken description of a food item and provide structured data. The user might speak informally. Description: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itemName: {
              type: Type.STRING,
              description: "A concise and clear name for the item, e.g., 'Campbell's Chicken Noodle Soup, 10.75 oz'."
            },
            category: {
              type: Type.STRING,
              description: `The best matching category from this list: ${CATEGORIES.join(', ')}.`
            },
            estimatedWeightLbs: {
              type: Type.NUMBER,
              description: "An estimated weight in pounds (lbs). If a weight is mentioned (e.g., '10 oz can'), convert it to pounds. If not, make a reasonable guess. Return 0 if no estimate can be made."
            }
          },
          required: ["itemName", "category", "estimatedWeightLbs"]
        },
      },
    });

    const jsonString = response.text;
    return JSON.parse(jsonString) as VoiceAnalysisResult;

  } catch (error) {
    console.error("Error processing voice with Gemini:", error);
    throw new Error("Failed to analyze voice description. Please try again.");
  }
}

export async function processImageWithN8n(base64Image: string): Promise<ImageAnalysisResult> {
  try {
    const response = await fetch(N8N_WEBHOOKS.PHOTO_RECEIVED, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: base64Image })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('N8N Image Webhook Error:', response.status, errorBody);
        throw new Error(`Image processing failed with status: ${response.status}. Please try again or enter details manually.`);
    }

    const result = await response.json();
    return result as ImageAnalysisResult;

  } catch (error) {
    console.error("Error sending image to n8n:", error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error("CORS Error: The request was blocked. Please check your n8n webhook's CORS configuration to allow requests from this website.");
    }
    if (error instanceof Error) {
        throw error;
    }
    throw new Error("Failed to send image for analysis. Check your connection.");
  }
}


export async function submitInventoryToN8n(items: InventoryItem[], summary: { totalItems: number; totalWeightLbs: number; }, formId: string) {
  const payload = {
    formId,
    submissionDate: new Date().toISOString(),
    summary,
    items: items.map(item => ({
        ...item,
        donorName: item.donorName === 'custom' ? item.customDonorText : item.donorName,
    }))
  };

  try {
    const response = await fetch(N8N_WEBHOOKS.INFO_RECEIVED, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Submission failed: ${response.status} - ${errorBody}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error submitting inventory to n8n:", error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error("CORS Error: The request was blocked. Please check your n8n webhook's CORS configuration to allow requests from this website.");
    }
    if(error instanceof Error){
      throw new Error(`Submission failed: ${error.message}. Please check your connection and try again.`);
    }
    throw new Error("An unknown error occurred during submission.");
  }
}
