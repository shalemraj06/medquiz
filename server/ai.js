/**
 * AI Integration - Claude and Gemini API support for smarter features.
 * Falls back to local parsing when no API keys are configured.
 */

const https = require('https');

/**
 * Call Claude API for intelligent MCQ parsing
 */
async function callClaude(apiKey, prompt, systemPrompt = '') {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt || 'You are a medical education assistant. Extract MCQ questions from the given input and return them as a JSON array.',
            messages: [{ role: 'user', content: prompt }]
        });

        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.content && parsed.content[0]) {
                        resolve(parsed.content[0].text);
                    } else if (parsed.error) {
                        reject(new Error(parsed.error.message));
                    } else {
                        resolve(data);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/**
 * Call Gemini API for intelligent MCQ parsing
 */
async function callGemini(apiKey, prompt, systemPrompt = '') {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            contents: [{ parts: [{ text: (systemPrompt ? systemPrompt + '\n\n' : '') + prompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.candidates && parsed.candidates[0]?.content?.parts?.[0]?.text) {
                        resolve(parsed.candidates[0].content.parts[0].text);
                    } else if (parsed.error) {
                        reject(new Error(parsed.error.message));
                    } else {
                        resolve(data);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/**
 * Parse questions using AI (Claude or Gemini)
 */
async function aiParseQuestions(rawInput, apiKey, provider = 'claude') {
    const systemPrompt = `You are a medical education MCQ parser. Extract all multiple-choice questions from the input text.
Return ONLY a valid JSON array with this format:
[{
  "question_text": "The question text",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "correct_index": 0,
  "explanation": "Explanation text if available"
}]
Rules:
- correct_index is 0-based (0=first option, 1=second, etc.)
- Extract ALL questions found in the input
- If the correct answer is not specified, set correct_index to 0
- Clean up any HTML tags or formatting artifacts
- Return ONLY the JSON array, no other text`;

    const prompt = `Parse the following into MCQ format:\n\n${rawInput}`;

    try {
        let response;
        if (provider === 'claude') {
            response = await callClaude(apiKey, prompt, systemPrompt);
        } else {
            response = await callGemini(apiKey, prompt, systemPrompt);
        }

        // Extract JSON from response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const questions = JSON.parse(jsonMatch[0]);
            return questions.map(q => ({
                question_text: q.question_text || '',
                options: Array.isArray(q.options) ? q.options : [],
                correct_index: typeof q.correct_index === 'number' ? q.correct_index : 0,
                explanation: q.explanation || ''
            }));
        }
        return null; // Fallback to local parser
    } catch (err) {
        console.error('AI parsing error:', err.message);
        return null; // Fallback to local parser
    }
}

/**
 * Generate an explanation for a question using AI
 */
async function aiExplainAnswer(question, options, correctIndex, apiKey, provider = 'claude') {
    const prompt = `Explain why the correct answer to this medical MCQ is "${options[correctIndex]}":

Question: ${question}
Options:
${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}
Correct Answer: ${String.fromCharCode(65 + correctIndex)}) ${options[correctIndex]}

Provide a concise but thorough medical explanation (2-3 paragraphs).`;

    const systemPrompt = 'You are a medical education expert. Provide clear, accurate explanations for medical MCQ answers.';

    try {
        if (provider === 'claude') {
            return await callClaude(apiKey, prompt, systemPrompt);
        } else {
            return await callGemini(apiKey, prompt, systemPrompt);
        }
    } catch (err) {
        console.error('AI explain error:', err.message);
        return null;
    }
}

module.exports = { aiParseQuestions, aiExplainAnswer, callClaude, callGemini };
