import OpenAI from 'openai';

let openaiClient;

export const getOpenAI = () => {
  if (openaiClient) return openaiClient;
  
  // useRuntimeConfig is auto-imported by Nitro
  const config = useRuntimeConfig();
  openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  return openaiClient;
};

export async function askGPT(prompt, model = 'gpt-4o', options = {}) {
  const requestOptions = {
    model: model,
    messages: [{ role: 'user', content: prompt }],
    ...options,
  };

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create(requestOptions);
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content.trim();
    } else {
      throw new Error('No response from OpenAI API.');
    }
  } catch (error) {
    console.error('Error interacting with OpenAI API:', error);
    throw error;
  }
}