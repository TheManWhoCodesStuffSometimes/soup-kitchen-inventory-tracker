import { N8N_WEBHOOKS } from '../constants';
import { VoiceAnalysisResult, ImageAnalysisResult, InventoryItem } from "../types";

export async function processVoiceWithN8n(text: string): Promise<VoiceAnalysisResult> {
  if (!text) {
    throw new Error("Input text cannot be empty.");
  }
  
  try {
    const response = await fetch(N8N_WEBHOOKS.VOICE_ANALYZE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('N8N Voice Webhook Error:', response.status, errorBody);
      throw new Error(`Voice processing failed with status: ${response.status}. Please try again or enter details manually.`);
    }

    const result = await response.json();
    return result as VoiceAnalysisResult;

  } catch (error) {
    console.error("Error processing voice with n8n:", error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error("CORS Error: The request was blocked. Please check your n8n webhook's CORS configuration to allow requests from this website.");
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to analyze voice description. Please try again.");
  }
}

export async function processImageWithN8n(imageBlob: Blob): Promise<ImageAnalysisResult> {
  try {
    // Create FormData to send binary image
    const formData = new FormData();
    formData.append('image', imageBlob, 'image.png');
    
    console.log('Sending binary image:', {
      size: imageBlob.size,
      type: imageBlob.type
    });

    const response = await fetch(N8N_WEBHOOKS.IMAGE_ANALYZE, {
      method: 'POST',
      body: formData // Send as multipart/form-data
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

// ENHANCED DEBUG VERSION
export async function fetchDashboardData() {
  console.log('🔍 Starting dashboard data fetch...');
  console.log('📡 Webhook URL:', N8N_WEBHOOKS.RETRIEVE_DASHBOARD_DATA);
  
  try {
    const response = await fetch(N8N_WEBHOOKS.RETRIEVE_DASHBOARD_DATA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ N8N Dashboard Webhook Error:', response.status, errorBody);
      throw new Error(`Failed to fetch dashboard data: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    console.log('✅ Raw response from n8n:', result);
    console.log('📋 Response type:', typeof result);
    console.log('📋 Is array?', Array.isArray(result));
    
    if (result && typeof result === 'object') {
      console.log('🔑 Response keys:', Object.keys(result));
    }

    // The webhook should return an array of items, but let's handle different response formats
    if (Array.isArray(result)) {
      console.log('✅ Direct array format detected, length:', result.length);
      console.log('📄 First item sample:', result[0]);
      return result;
    } else if (result.data && Array.isArray(result.data)) {
      console.log('✅ Data wrapper format detected, length:', result.data.length);
      console.log('📄 First item sample:', result.data[0]);
      return result.data;
    } else if (result.items && Array.isArray(result.items)) {
      console.log('✅ Items wrapper format detected, length:', result.items.length);
      console.log('📄 First item sample:', result.items[0]);
      return result.items;
    } else {
      console.error('❌ Unexpected response format:', result);
      throw new Error('Unexpected response format from dashboard webhook');
    }

  } catch (error) {
    console.error("💥 Error fetching dashboard data:", error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error("CORS Error: The request was blocked. Please check your n8n webhook's CORS configuration to allow requests from this website.");
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch dashboard data. Please check your connection.");
  }
}
