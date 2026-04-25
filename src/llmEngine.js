const HF_CHAT_API_URL = "https://router.huggingface.co/v1/chat/completions";

function getLlmConfig() {
  const token =
    process.env.HUGGINGFACE_TOKEN ||
    process.env.HF_TOKEN ||
    process.env.NEXT_PUBLIC_HUGGINGFACE_TOKEN ||
    "";
  return {
    apiKey: token,
    provider: "huggingface",
    model: process.env.HUGGINGFACE_MODEL || "Qwen/Qwen2.5-7B-Instruct"
  };
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("LLM response did not contain JSON.");
  }
  return JSON.parse(match[0]);
}

async function callHuggingFaceJSON({ systemPrompt, userPrompt }) {
  const { apiKey, model } = getLlmConfig();
  if (!apiKey) {
    throw new Error(
      "HUGGINGFACE token is not configured. Set HUGGINGFACE_TOKEN or NEXT_PUBLIC_HUGGINGFACE_TOKEN."
    );
  }

  const response = await fetch(HF_CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch (_error) {
    throw new Error(`Hugging Face API returned non-JSON response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload?.error || "Hugging Face API error");
  }
  const text = payload?.choices?.[0]?.message?.content || "{}";
  return extractJson(text);
}

async function llmTurn({
  jdText,
  resumeText,
  requiredSkills,
  messages,
  structuredAnswers
}) {
  const systemPrompt = `
You are an interview assessment agent. Ask one follow-up question at a time.
Your goal is to evaluate each required skill deeply and progressively.

Rules:
1) Keep tone concise and professional.
2) Ask targeted follow-up questions based on previous candidate responses.
3) Maintain and update structured answers per skill.
4) When enough evidence is collected for all skills, set status=ready_for_report.
5) Always output strict JSON with keys:
{
  "assistantMessage": "string",
  "status": "in_progress|ready_for_report",
  "progressLabel": "string",
  "structuredAnswers": {
    "skill-name-lowercase": {
      "confidence": number|null,
      "years": number|null,
      "projectCount": number|null,
      "depth": number|null,
      "evidence": "string",
      "impact": "string"
    }
  }
}
Do not include markdown.
`.trim();

  const userPrompt = JSON.stringify(
    {
      task: "Continue interview assessment with one best next follow-up question.",
      jobDescription: jdText,
      resumeText,
      requiredSkills,
      chatMessages: messages,
      structuredAnswers
    },
    null,
    2
  );

  return callHuggingFaceJSON({ systemPrompt, userPrompt });
}

async function llmGenerateSkillQuestion({
  jdText,
  resumeText,
  skill,
  questionNumber,
  priorSkillQA
}) {
  const qNum = Math.max(1, Math.min(7, Number(questionNumber) || 1));
  const kind = qNum <= 3 ? "mcq" : qNum <= 6 ? "descriptive" : "coding";

  const systemPrompt = `
You generate interview questions for ONE skill at a time.

Return STRICT JSON only.

Constraints:
- questionNumber is between 1 and 7.
- For questionNumber 1-3: kind="mcq" with exactly 4 options.
- Provide correctOptionIndex (0-3) for MCQ.
- For questionNumber 4-6: kind="descriptive" with no options and no correctOptionIndex.
- For questionNumber 7: kind="coding" with a clear problem statement.
  Include "language" (one of: "javascript","typescript","python","java","cpp","go") and a "boilerplate"
  starter code string. The boilerplate must compile/parse, define the function/class signature,
  contain a TODO comment, and be ready for the candidate to implement. Keep it under ~30 lines.
- Make questions specific to the resume/job context and increase difficulty progressively.

Output shapes:
MCQ:
{
  "kind": "mcq",
  "prompt": "string",
  "options": ["A","B","C","D"],
  "correctOptionIndex": 0
}

Descriptive:
{
  "kind": "descriptive",
  "prompt": "string"
}

Coding:
{
  "kind": "coding",
  "prompt": "string (problem statement, inputs, outputs, examples, constraints)",
  "language": "javascript",
  "boilerplate": "// starter code with function signature and TODO"
}
Do not include markdown.
`.trim();

  const userPrompt = JSON.stringify(
    {
      task: "Generate the next question for a single skill.",
      jobDescription: jdText,
      resumeText,
      skill,
      questionNumber: qNum,
      kind,
      priorSkillQA: Array.isArray(priorSkillQA) ? priorSkillQA : []
    },
    null,
    2
  );

  const result = await callHuggingFaceJSON({ systemPrompt, userPrompt });
  if (kind === "mcq") {
    const options = Array.isArray(result.options) ? result.options : [];
    const idx = Number.isFinite(result.correctOptionIndex) ? Number(result.correctOptionIndex) : -1;
    if (result.kind !== "mcq" || options.length !== 4 || idx < 0 || idx > 3) {
      throw new Error("LLM returned invalid MCQ question JSON.");
    }
  } else if (kind === "descriptive") {
    if (result.kind !== "descriptive" || typeof result.prompt !== "string" || result.options) {
      throw new Error("LLM returned invalid descriptive question JSON.");
    }
  } else {
    const allowedLangs = ["javascript", "typescript", "python", "java", "cpp", "go"];
    const language = String(result.language || "").trim().toLowerCase();
    const boilerplate = String(result.boilerplate || "");
    if (
      result.kind !== "coding" ||
      typeof result.prompt !== "string" ||
      !result.prompt.trim() ||
      !allowedLangs.includes(language) ||
      !boilerplate.trim()
    ) {
      throw new Error("LLM returned invalid coding question JSON.");
    }
    result.language = language;
    result.boilerplate = boilerplate;
  }
  return result;
}

async function llmGradeSkillAnswer({
  jdText,
  resumeText,
  skill,
  questionNumber,
  question,
  answer,
  priorSkillQA
}) {
  const qNum = Math.max(1, Math.min(7, Number(questionNumber) || 1));
  const systemPrompt = `
You are grading a candidate answer for ONE skill.
Return STRICT JSON only.

Scoring:
- score: number 0-100 (higher is better)
- feedback: 1-3 short sentences, actionable

For coding answers (kind="coding"), evaluate:
- correctness against the stated problem
- handling of edge cases
- time/space complexity vs. expected
- code clarity and idiomatic style for the chosen language

If questionNumber == 7, also return:
- skillScore: number 0-100 (overall skill score from all 7 questions)
- conclusion: concise hiring-style conclusion for this skill

Output JSON:
{
  "score": 0,
  "feedback": "string",
  "skillScore": 0,        // only when questionNumber == 7
  "conclusion": "string"  // only when questionNumber == 7
}
Do not include markdown.
`.trim();

  const userPrompt = JSON.stringify(
    {
      task: "Grade a single answer for a single skill.",
      jobDescription: jdText,
      resumeText,
      skill,
      questionNumber: qNum,
      question,
      answer,
      priorSkillQA: Array.isArray(priorSkillQA) ? priorSkillQA : []
    },
    null,
    2
  );

  const result = await callHuggingFaceJSON({ systemPrompt, userPrompt });
  const score = Number(result.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("LLM returned invalid grading score.");
  }
  if (typeof result.feedback !== "string" || !result.feedback.trim()) {
    throw new Error("LLM returned invalid grading feedback.");
  }
  if (qNum === 7) {
    const skillScore = Number(result.skillScore);
    if (!Number.isFinite(skillScore) || skillScore < 0 || skillScore > 100) {
      throw new Error("LLM returned invalid skillScore on final question.");
    }
    if (typeof result.conclusion !== "string" || !result.conclusion.trim()) {
      throw new Error("LLM returned invalid conclusion on final question.");
    }
  } else {
    delete result.skillScore;
    delete result.conclusion;
  }
  return result;
}

async function llmAssess({
  jdText,
  resumeText,
  requiredSkills,
  structuredAnswers,
  companyConfig
}) {
  const systemPrompt = `
You are a senior hiring assessor. Score candidate skill proficiency and produce learning plan.
The output must be strict JSON and include these keys:
{
  "baseOverallScore": number,
  "overallScore": number,
  "recommendation": "string",
  "strengths": ["string"],
  "gaps": ["string"],
  "scoredSkills": [
    {
      "skill": "string",
      "proficiencyScore": number,
      "levelLabel": "Beginner|Foundational|Intermediate|Advanced|Expert",
      "gap": number
    }
  ],
  "learningPlan": [
    {
      "focusSkill": "string",
      "currentLevel": "string",
      "targetLevel": "Advanced",
      "priority": "High|Medium|Low",
      "estimatedHours": number,
      "adjacentSkills": ["string"],
      "resources": [{"title":"string","type":"string","link":"string"}]
    }
  ],
  "companySignals": {
    "hasCompetitorExperience": boolean,
    "matchedCompetitor": "string",
    "companyBoost": number
  }
}

Policy:
- Base score comes from skill evidence only.
- Apply company boost ONLY if resume includes one of competitor names.
- overallScore = min(100, baseOverallScore + companyBoost)
- Keep numbers realistic and explainable.
Do not include markdown.
`.trim();

  const resumeLower = (resumeText || "").toLowerCase();
  const matchedCompetitor = (companyConfig.competitorCompanies || []).find((c) =>
    resumeLower.includes(c.toLowerCase())
  );
  const companyBoost = matchedCompetitor ? Number(companyConfig.competitorBoost || 0) : 0;

  const userPrompt = JSON.stringify(
    {
      task: "Generate final assessment report.",
      jobDescription: jdText,
      resumeText,
      requiredSkills,
      structuredAnswers,
      companySignalsInput: {
        competitorCompanies: companyConfig.competitorCompanies,
        matchedCompetitor: matchedCompetitor || "",
        companyBoost
      }
    },
    null,
    2
  );

  return callHuggingFaceJSON({ systemPrompt, userPrompt });
}

module.exports = {
  getLlmConfig,
  llmTurn,
  llmGenerateSkillQuestion,
  llmGradeSkillAnswer,
  llmAssess
};
