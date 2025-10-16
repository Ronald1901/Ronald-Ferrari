
import { GoogleGenAI, Modality } from "@google/genai";
import { pcmToWav, base64ToArrayBuffer } from '../utils/audioUtils';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // A friendly alert for developers, as process.env.API_KEY is an injection point.
  // This will not show to end-users if the key is properly configured.
  console.warn("API_KEY environment variable not set. TTS service will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const audioCache = new Map<number, string>();

async function generateAudio(textToSpeak: string, voiceName: string): Promise<string> {
    if (!API_KEY) {
        throw new Error("API key is not configured.");
    }
    // FIX: The model should not be pre-defined. The `generateContent` method was updated to pass the model name directly, adhering to current SDK best practices.
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Invalid audio response from API.");
    }
    return base64Audio;
}

export const generateAndCacheAudio = async (text: string, voice: string, index: number): Promise<string> => {
    if (audioCache.has(index)) {
        return audioCache.get(index)!;
    }
    if (!text || !text.trim()) {
        throw new Error("Cannot generate audio for empty text.");
    }

    const base64Audio = await generateAudio(text, voice);
    const pcm16 = new Int16Array(base64ToArrayBuffer(base64Audio));
    const wavBlob = pcmToWav(pcm16, 1, 24000); // Gemini TTS default sample rate is 24000
    const audioUrl = URL.createObjectURL(wavBlob);
    
    audioCache.set(index, audioUrl);
    return audioUrl;
};

export const clearAudioCache = () => {
    audioCache.forEach(url => URL.revokeObjectURL(url));
    audioCache.clear();
};