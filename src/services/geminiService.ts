import { supabase } from "../supabase";
import API_BASE_URL from "../config";

// Gemini Service - Proxying all AI logic safely through our secure Express server endpoints
// This eliminates exposure of any keys client-side and ensures correct standard full-stack model context.

export interface TriageHistoryItem {
  question: string;
  answer: string;
}

export async function getTriageNextQuestion(category: string, initialSymptom: string, history: TriageHistoryItem[]) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${API_BASE_URL}/api/gemini/triage/next-question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ category, initialSymptom, history })
    });

    if (!response.ok) {
      throw new Error(`Server returned error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in getTriageNextQuestion:", error);
    throw error;
  }
}

export async function analyzeSymptoms(
  symptoms: string, 
  imageBase64?: string, 
  category = "General", 
  testValuesString?: string, 
  triageHistory?: TriageHistoryItem[]
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${API_BASE_URL}/api/gemini/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        category,
        symptoms,
        image: imageBase64,
        testValuesString,
        triageHistory
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned error: ${response.statusText}`);
    }

    const data = await response.json();

    // Ensure feature_importance is structured correctly for visualization or rendering
    if (!Array.isArray(data.feature_importance) || data.feature_importance.length === 0) {
      data.feature_importance = [
        { feature: "Symptom Analysis", impact: 0.5 },
        { feature: "Clinical Context", impact: 0.3 }
      ];
    } else {
      data.feature_importance = data.feature_importance.map((item: any) => ({
        feature: String(item.feature || 'Unknown Factor'),
        impact: typeof item.impact === 'number' ? item.impact : 0
      }));
    }

    return data;
  } catch (error) {
    console.error("Diagnosis Error:", error);
    throw error;
  }
}

export async function parseMedicalReport(imageBase64: string, disease: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${API_BASE_URL}/api/gemini/ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ image: imageBase64, category: disease })
    });

    if (!response.ok) {
      throw new Error(`Server returned error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("OCR Error in parseMedicalReport:", error);
    return {};
  }
}

export async function findNearbyPharmacies(location: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${API_BASE_URL}/api/gemini/pharmacies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ location })
    });

    if (!response.ok) {
      throw new Error(`Server returned error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Pharmacy Search Error:", error);
    throw error;
  }
}
