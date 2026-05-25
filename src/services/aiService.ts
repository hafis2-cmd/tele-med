import { supabase } from "../supabase";
import API_BASE_URL from "../config";

const AI_BOT_EMAIL = "ai-bot@healthline.com";

export const aiBotParticipant = {
  email: AI_BOT_EMAIL,
  name: "Health AI Bot",
  role: "AI",
  isAiBot: true
};

export async function getAiResponse(userMessage: string, history: { role: 'user' | 'model', content: string }[]) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${API_BASE_URL}/api/gemini/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ userMessage, history })
    });

    if (!response.ok) {
      throw new Error(`Server returned error status: ${response.status}`);
    }

    const data = await response.json();
    return data.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Error fetching AI response:", error);
    return "I am experiencing some temporary connectivity issues securing my AI pipeline, but your health and safety remain my highest priority. Please monitor any symptoms very closely and write down active triggers to share with your designated professional family physician.";
  }
}
