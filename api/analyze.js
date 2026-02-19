export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5-nano-2025-08-07';

  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured on server.' });
  }

  const { systemPrompt, userPrompt } = req.body;

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'systemPrompt and userPrompt are required.' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = response.status;

      if (status === 429) {
        return res.status(429).json({
          error: 'Rate limit reached. Please wait a moment before trying again.',
        });
      }

      return res.status(status).json({
        error: errorData.error?.message || `OpenAI API error (${status})`,
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      return res.status(500).json({ error: 'No response generated from AI.' });
    }

    // Return cache usage info if available
    const usage = data.usage || {};
    return res.status(200).json({
      text,
      cached: usage.prompt_tokens_details?.cached_tokens > 0,
    });
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    return res.status(500).json({ error: `Analysis failed: ${error.message}` });
  }
}
