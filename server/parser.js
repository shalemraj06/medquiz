/**
 * AI Parser - Extracts MCQs from raw text, HTML, or code input.
 * Upgraded parsing engine capable of handling 50+ MCQs simultaneously.
 * Supports: JS-embedded arrays (via vm), structured HTML, numbered text, and more.
 * Uses Fisher-Yates shuffle to randomize options.
 */
const { parse } = require('node-html-parser');
const vm = require('vm');

// Fisher-Yates shuffle
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Strip HTML and preserve structural newlines using node-html-parser
function sanitizeAndFormatHtml(html) {
    if (!html || !/<\/?[a-z][\s\S]*>/i.test(html)) return html.trim();

    const root = parse(html);
    root.querySelectorAll('script, style, head, nav, footer, meta, link').forEach(n => n.remove());

    function extractText(node) {
        if (node.nodeType === 3) return node.text;

        let text = '';
        const tagName = node.rawTagName?.toLowerCase();
        const blockTags = new Set(['p', 'div', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'article', 'section', 'ul', 'ol', 'table']);
        const isBlock = blockTags.has(tagName) || tagName === 'li';

        for (const child of node.childNodes) {
            text += extractText(child);
        }

        if (tagName === 'li') {
            const parent = node.parentNode;
            if (parent && parent.rawTagName?.toLowerCase() === 'ol') {
                const lis = parent.childNodes.filter(n => n.rawTagName?.toLowerCase() === 'li');
                const index = lis.indexOf(node);
                const type = parent.getAttribute('type') || '1';
                let prefix = '';
                if (type === 'A' || type === 'a') {
                    prefix = String.fromCharCode((type === 'A' ? 65 : 97) + Math.max(0, index)) + ') ';
                } else if (type === '1') {
                    prefix = (Math.max(0, index) + 1) + '. ';
                } else {
                    prefix = '- ';
                }
                text = prefix + text.trim();
            } else {
                text = '- ' + text.trim();
            }
        }

        if (isBlock) text = '\n' + text + '\n';
        return text;
    }

    let rawText = extractText(root);
    rawText = rawText
        .replace(/&nbsp;/ig, ' ').replace(/&amp;/ig, '&').replace(/&lt;/ig, '<')
        .replace(/&gt;/ig, '>').replace(/&quot;/ig, '"').replace(/&#39;/ig, "'")
        .replace(/&[a-z]+;/gi, ' ');
    rawText = rawText.replace(/[ \t]+/g, ' ').replace(/\n[ \t]+\n/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim();
    return rawText;
}

// ═══════════════════════════════════════════════════════════════
// Main parse function
// ═══════════════════════════════════════════════════════════════
// Main parse function
// ═══════════════════════════════════════════════════════════════
function parseQuestions(rawInput) {
    if (!rawInput) return [];

    let cleanInput = rawInput
        // Remove markdown bold/italic tags
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        // Remove code block markers but keep content
        .replace(/```[a-z]*\n([\s\S]*?)```/gi, '$1');

    // Strategy 0: JS-embedded arrays (highest fidelity — quiz-app HTML files)
    let questions = tryJavaScriptEmbeddedFormat(cleanInput);
    if (questions.length > 0) {
        return questions.map(q => {
            if (!q.options || q.options.length === 0) return q;
            const correctAnswer = q.options[q.correct_index];
            const shuffled = shuffleArray(q.options);
            const newCorrectIndex = Math.max(0, shuffled.indexOf(correctAnswer));
            return { ...q, options: shuffled, correct_index: newCorrectIndex };
        });
    }

    // Convert HTML to clean text
    const cleanText = sanitizeAndFormatHtml(cleanInput);

    // Strategy 1-3: Text-based parsing
    questions = tryRobustNumberedFormat(cleanText);
    if (questions.length === 0) questions = tryDoubleNewlineFormat(cleanText);
    if (questions.length === 0) questions = tryLineByLineFormat(cleanText);

    // Shuffle options
    questions = questions.map(q => {
        if (!q.options || q.options.length === 0) return q;
        const correctAnswer = q.options[q.correct_index];
        const shuffled = shuffleArray(q.options);
        const newCorrectIndex = Math.max(0, shuffled.indexOf(correctAnswer));
        return { ...q, options: shuffled, correct_index: newCorrectIndex };
    });

    return questions;
}

// ═══════════════════════════════════════════════════════════════
// Strategy 0: JavaScript Embedded Format (uses Node vm for safety)
// Handles quiz-app HTML files like ENT_Block1_MCQ.html where
// questions are stored as `const questions = [{ stem, ask, options, correct, explanation }]`
// ═══════════════════════════════════════════════════════════════
function tryJavaScriptEmbeddedFormat(rawInput) {
    // Extract all <script> tag contents
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptContent = '';
    let scriptMatch;
    while ((scriptMatch = scriptRegex.exec(rawInput)) !== null) {
        scriptContent += scriptMatch[1] + '\n';
    }

    // If no script tags, check if the raw input itself is JS
    if (!scriptContent) {
        if (/(?:const|let|var)\s+(?:questions|questionsData|questionBank|quizData|mcqs|items)\s*=\s*\[/i.test(rawInput)) {
            scriptContent = rawInput;
        } else {
            return [];
        }
    }

    // Find the variable name used for questions
    const varNameMatch = scriptContent.match(/(?:const|let|var)\s+(questions|questionsData|questionBank|quizData|mcqs|items)\s*=\s*\[/i);
    if (!varNameMatch) return [];
    const varName = varNameMatch[1];

    // Extract the code from the assignment onward
    const assignStart = scriptContent.indexOf(varNameMatch[0]);
    if (assignStart === -1) return [];

    // Strip ES module keywords that break vm evaluation (import/export from JSX/React formats)
    const codeFromAssign = scriptContent.substring(assignStart)
        .replace(/export\s+default\s+function[\s\S]*$/i, '')
        .replace(/export\s+default[\s\S]*$/i, '')
        .replace(/export\s+const[\s\S]*$/i, '')
        .replace(/import\s+.*?(?:from\s+)?['"][^'"]+['"];?/gi, '');


    try {
        // Use Node vm to safely evaluate the JS array in a sandbox
        const sandbox = {};
        const wrappedCode = `
            try {
                ${codeFromAssign}
                _result = ${varName};
            } catch(e) {
                _result = typeof ${varName} !== 'undefined' ? ${varName} : [];
            }
        `;

        vm.runInNewContext(wrappedCode, sandbox, { timeout: 10000 });

        const rawQuestions = sandbox._result;
        if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return [];

        function stripHtmlSimple(html) {
            if (!html) return '';
            return String(html)
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/(?:p|div|li|tr)>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
                .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
        }

        const questions = [];
        for (const q of rawQuestions) {
            try {
                // Support multiple property naming conventions
                const stem = q.stem || q.question_text || q.question || q.text || '';
                const ask = q.ask || '';
                const opts = q.options || [];
                const correct = typeof q.correct === 'number' ? q.correct :
                    (typeof q.correct_index === 'number' ? q.correct_index :
                        (typeof q.answer === 'number' ? q.answer : 0));
                const explanation = q.explanation || q.rationale || q.reason || '';

                let fullQuestion = '';
                if (stem && ask) {
                    fullQuestion = stripHtmlSimple(stem) + '\n' + stripHtmlSimple(ask);
                } else if (stem) {
                    fullQuestion = stripHtmlSimple(stem);
                } else if (ask) {
                    fullQuestion = stripHtmlSimple(ask);
                }

                if (!fullQuestion || opts.length < 2) continue;

                questions.push({
                    question_text: fullQuestion.trim(),
                    options: opts.map(o => stripHtmlSimple(o)),
                    correct_index: Math.min(correct, opts.length - 1),
                    explanation: stripHtmlSimple(explanation)
                });
            } catch (err) {
                continue;
            }
        }

        return questions;
    } catch (err) {
        // vm evaluation failed — fall through to text-based strategies
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// Strategy 1: Robust Numbered Format (1. ..., 2. ...)
// ═══════════════════════════════════════════════════════════════
function tryRobustNumberedFormat(text) {
    const lines = text.split('\n');
    const blocks = [];
    let currentBlock = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const isNewQ = /^\s*(?:Q(?:uestion)?\s*)?(?:[0-9]+)\s*[.):\-]\s*/i.test(trimmed);
        if (isNewQ) {
            if (currentBlock.length > 0) { blocks.push(currentBlock.join('\n')); currentBlock = []; }
        }
        currentBlock.push(trimmed);
    }
    if (currentBlock.length > 0) blocks.push(currentBlock.join('\n'));

    if (blocks.length <= 1 && !/^\s*(?:Q(?:uestion)?\s*)?(?:[0-9]+)\s*[.):\-]\s*/i.test(blocks[0] || '')) return [];

    const questions = [];
    for (const block of blocks) {
        const q = extractQuestionFromBlock(block);
        if (q) questions.push(q);
    }
    return questions;
}

// ═══════════════════════════════════════════════════════════════
// Strategy 2: Double Newline split
// ═══════════════════════════════════════════════════════════════
function tryDoubleNewlineFormat(text) {
    const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
    const questions = [];
    for (const block of blocks) {
        const q = extractQuestionFromBlock(block);
        if (q) questions.push(q);
    }
    return questions;
}

// ═══════════════════════════════════════════════════════════════
// Core Block Extraction
// ═══════════════════════════════════════════════════════════════
function extractQuestionFromBlock(block) {
    const lines = block.split('\n');
    let questionText = [];
    const options = [];
    let correctIdx = -1;
    let explanation = [];
    let state = 'QUESTION';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const optMatch = trimmed.match(/^\s*([A-Za-z])\s*[.):\-]\s*(.+)/);
        const ansMatch = trimmed.match(/^\s*(?:Answer|Correct|Key|Ans)\s*[:=]?\s*([A-Za-z])\b/i);
        const expMatch = trimmed.match(/^\s*(?:Explanation|Rationale|Reason|Note)\s*[:=]?\s*(.*)/i);
        const bulletMatch = trimmed.match(/^\s*[-*•]\s*(.+)/);

        if (ansMatch) {
            correctIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
            state = 'EXPLANATION';
        } else if (expMatch) {
            if (expMatch[1]) explanation.push(expMatch[1]);
            state = 'EXPLANATION';
        } else if (optMatch && state !== 'EXPLANATION' && options.length < 10) {
            let optLetterCode = optMatch[1].toUpperCase().charCodeAt(0) - 65;
            if (optLetterCode <= 10) { options.push(optMatch[2]); state = 'OPTIONS'; }
            else if (state === 'QUESTION') questionText.push(trimmed);
        } else if (bulletMatch && state !== 'EXPLANATION') {
            options.push(bulletMatch[1]);
            state = 'OPTIONS';
        } else {
            if (state === 'QUESTION') {
                questionText.push(trimmed);
            } else if (state === 'OPTIONS') {
                if (options.length > 0 && trimmed.length < 200 && !trimmed.toLowerCase().startsWith('answer')) {
                    options[options.length - 1] += ' ' + trimmed;
                } else if (trimmed.toLowerCase().startsWith('answer')) {
                    const inlineAns = trimmed.match(/answer\s*(?:is)?\s*([A-Za-z])/i);
                    if (inlineAns) correctIdx = inlineAns[1].toUpperCase().charCodeAt(0) - 65;
                    explanation.push(trimmed);
                    state = 'EXPLANATION';
                } else {
                    explanation.push(trimmed);
                    state = 'EXPLANATION';
                }
            } else if (state === 'EXPLANATION') {
                explanation.push(trimmed);
            }
        }
    }

    // Check for inline answer marking
    if (correctIdx === -1) {
        for (let i = 0; i < options.length; i++) {
            if (options[i].match(/\((?:correct|true|answer)\)/i) || options[i].includes('✓') || options[i].match(/\*$/) || options[i].match(/^\*/)) {
                correctIdx = i;
                options[i] = options[i].replace(/\((?:correct|true|answer)\)/ig, '').replace('✓', '').replace(/\*$/, '').replace(/^\*/, '').trim();
                break;
            }
        }
    }

    const qText = questionText.join('\n')
        .replace(/^\s*(?:Q(?:uestion)?\s*)?([0-9]+)\s*[.):\-]\s*/i, '')
        .trim();

    if (qText && options.length >= 2) {
        if (correctIdx === -1 || correctIdx >= options.length || isNaN(correctIdx)) correctIdx = 0;
        return {
            question_text: qText,
            options: options.map(o => o.trim()),
            correct_index: correctIdx,
            explanation: explanation.join('\n').trim()
        };
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════
// Strategy 3: Line by line stream (fallback)
// ═══════════════════════════════════════════════════════════════
function tryLineByLineFormat(text) {
    const questions = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    let currentQText = [];
    let currentOptions = [];
    let correctIdx = -1;
    let explanation = [];
    let inOptions = false;

    function saveCurrent() {
        if (currentQText.length > 0 && currentOptions.length >= 2) {
            if (correctIdx === -1) correctIdx = 0;
            questions.push({
                question_text: currentQText.join('\n').replace(/^\s*(?:Q(?:uestion)?\s*)?([0-9]+)\s*[.):\-]\s*/i, '').trim(),
                options: [...currentOptions],
                correct_index: Math.min(correctIdx, currentOptions.length - 1),
                explanation: explanation.join('\n').trim()
            });
        }
        currentQText = []; currentOptions = []; correctIdx = -1; explanation = []; inOptions = false;
    }

    for (const line of lines) {
        const optMatch = line.match(/^\s*([A-Za-z])\s*[.):\-]\s*(.+)/);
        const ansMatch = line.match(/^\s*(?:Answer|Correct|Key)\s*[:=]?\s*([A-Za-z])/i);
        const explMatch = line.match(/^\s*(?:Explanation|Rationale|Reason)\s*[:=]?\s*(.*)/i);
        const numStart = line.match(/^\s*(?:Q(?:uestion)?\s*)?(?:[0-9]+)\s*[.):\-]\s*/i);

        if (numStart && currentOptions.length >= 2) {
            saveCurrent(); currentQText.push(line);
        } else if (ansMatch) {
            correctIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65; inOptions = false;
        } else if (explMatch) {
            if (explMatch[1]) explanation.push(explMatch[1]); inOptions = false;
        } else if (optMatch && optMatch[1].toUpperCase().charCodeAt(0) - 65 <= 10) {
            currentOptions.push(optMatch[2].trim()); inOptions = true;
        } else {
            if (inOptions) {
                if (currentOptions.length > 0) currentOptions[currentOptions.length - 1] += ' ' + line;
            } else if (currentOptions.length === 0) {
                currentQText.push(line);
            } else {
                explanation.push(line);
            }
        }
    }
    saveCurrent();
    return questions;
}

// ═══════════════════════════════════════════════════════════════
// Subject Suggestion
// ═══════════════════════════════════════════════════════════════
function suggestSubject(questions, existingSubjects) {
    const medicalKeywords = {
        'Anatomy': ['anatomy', 'bone', 'muscle', 'nerve', 'artery', 'vein', 'organ', 'joint', 'ligament', 'tendon', 'fascia', 'vertebra', 'skull', 'pelvis', 'thorax', 'abdomen'],
        'Physiology': ['physiology', 'homeostasis', 'membrane', 'potential', 'cardiac output', 'blood pressure', 'respiration', 'filtration', 'renal', 'hormone', 'receptor', 'action potential', 'metabolism'],
        'Biochemistry': ['biochemistry', 'enzyme', 'protein', 'amino acid', 'dna', 'rna', 'lipid', 'carbohydrate', 'glycolysis', 'krebs', 'oxidative', 'atp', 'coenzyme', 'substrate', 'kinase'],
        'Pathology': ['pathology', 'inflammation', 'necrosis', 'apoptosis', 'tumor', 'cancer', 'malignant', 'benign', 'metastasis', 'neoplasm', 'granuloma', 'fibrosis', 'edema', 'thrombosis', 'embolism'],
        'Pharmacology': ['pharmacology', 'drug', 'receptor', 'agonist', 'antagonist', 'inhibitor', 'dose', 'side effect', 'contraindication', 'mechanism of action', 'bioavailability', 'half-life', 'clearance'],
        'Microbiology': ['microbiology', 'bacteria', 'virus', 'fungus', 'parasite', 'infection', 'antibiotic', 'gram positive', 'gram negative', 'culture', 'stain', 'pathogen', 'toxin', 'vaccine'],
        'Medicine': ['diabetes', 'hypertension', 'heart failure', 'asthma', 'copd', 'pneumonia', 'hepatitis', 'cirrhosis', 'anemia', 'leukemia', 'thyroid', 'lupus', 'arthritis'],
        'Surgery': ['surgery', 'incision', 'suture', 'wound', 'hernia', 'appendicitis', 'cholecystectomy', 'fracture', 'dislocation', 'amputation', 'laparoscopy', 'postoperative'],
        'Pediatrics': ['pediatrics', 'child', 'infant', 'neonate', 'vaccination', 'growth', 'development', 'milestone', 'congenital', 'birth defect', 'breastfeeding'],
        'Obstetrics & Gynecology': ['obstetrics', 'gynecology', 'pregnancy', 'delivery', 'cesarean', 'placenta', 'fetus', 'menstrual', 'ovarian', 'uterine', 'cervical', 'contraception'],
        'ENT': ['ent', 'otitis', 'sinusitis', 'tonsil', 'pharyngitis', 'larynx', 'epiglottitis', 'croup', 'epistaxis', 'hearing', 'vertigo', 'tympanic', 'cochlea', 'mastoid', 'stridor', 'tracheitis', 'adenoid'],
    };

    const allText = questions.map(q => `${q.question_text} ${q.options.join(' ')} ${q.explanation}`).join(' ').toLowerCase();

    const scores = {};
    for (const [subject, keywords] of Object.entries(medicalKeywords)) {
        scores[subject] = 0;
        for (const kw of keywords) {
            const regex = new RegExp('\\b' + kw + '\\b', 'gi');
            const matches = allText.match(regex);
            if (matches) scores[subject] += matches.length;
        }
    }

    for (const subj of existingSubjects) {
        const name = subj.name.toLowerCase();
        const regex = new RegExp('\\b' + name + '\\b', 'gi');
        const matches = allText.match(regex);
        if (matches) scores[subj.name] = (scores[subj.name] || 0) + matches.length * 3;
    }

    const sorted = Object.entries(scores).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5).map(([name, score]) => ({ name, score }));
}

module.exports = { parseQuestions, sanitizeAndFormatHtml, suggestSubject, shuffleArray };
