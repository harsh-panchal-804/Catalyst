const LEVELS = {
  0: "Not demonstrated",
  1: "Beginner",
  2: "Foundational",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert"
};
const DECCAN_AI_COMPETITORS = [
  "tiger analytics",
  "fractal",
  "mu sigma",
  "latenview analytics",
  "course5 intelligence",
  "genpact analytics",
  "affine",
  "tredence"
];
const COMPETITOR_COMPANY_BOOST = 8;

function normalizeSkill(rawSkill) {
  return (rawSkill || "").trim().toLowerCase();
}

function parseResumeSkills(resumeText) {
  const text = (resumeText || "").toLowerCase();
  const separators = /[\n,|/;-]+/;
  const chunks = text.split(separators).map((part) => part.trim()).filter(Boolean);
  const skillSet = new Set(chunks);
  return skillSet;
}

function extractCompanySignals(resumeText) {
  const text = (resumeText || "").toLowerCase();
  const matchedCompetitor = DECCAN_AI_COMPETITORS.find((company) =>
    text.includes(company)
  );
  const hasCompetitorExperience = Boolean(matchedCompetitor);

  return {
    hasCompetitorExperience,
    matchedCompetitor: matchedCompetitor || "",
    companyBoost: hasCompetitorExperience ? COMPETITOR_COMPANY_BOOST : 0
  };
}

function scoreSingleSkill(skill, jdWeight, answer) {
  const confidence = Math.max(1, Math.min(5, Number(answer.confidence) || 1));
  const years = Math.max(0, Number(answer.years) || 0);
  const projectCount = Math.max(0, Number(answer.projectCount) || 0);
  const depth = Math.max(1, Math.min(5, Number(answer.depth) || 1));
  const explanationLength = (answer.evidence || "").trim().split(/\s+/).filter(Boolean).length;

  let rawScore = 0;
  rawScore += confidence * 10;
  rawScore += Math.min(5, years) * 8;
  rawScore += Math.min(6, projectCount) * 6;
  rawScore += depth * 10;
  rawScore += Math.min(12, Math.floor(explanationLength / 12)) * 3;

  const proficiencyScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const weightedScore = Math.round(proficiencyScore * jdWeight);
  const level = Math.max(0, Math.min(5, Math.round(proficiencyScore / 20)));
  const gap = 100 - proficiencyScore;

  return {
    skill,
    jdWeight,
    confidence,
    years,
    projectCount,
    depth,
    proficiencyScore,
    weightedScore,
    gap,
    level,
    levelLabel: LEVELS[level]
  };
}

function inferAdjacentSkills(skill) {
  const map = {
    react: ["TypeScript", "Next.js", "React Testing Library"],
    javascript: ["TypeScript", "Node.js", "Jest"],
    typescript: ["Zod", "tRPC", "Advanced Type Inference"],
    node: ["Express", "NestJS", "System Design"],
    "node.js": ["Express", "NestJS", "System Design"],
    python: ["FastAPI", "Pydantic", "Async Python"],
    sql: ["Query Optimization", "Indexing", "Data Modeling"],
    aws: ["Docker", "Kubernetes", "Terraform"],
    docker: ["Kubernetes", "CI/CD Pipelines", "Container Security"],
    ml: ["MLOps", "Feature Engineering", "Model Evaluation"],
    "machine learning": ["MLOps", "Feature Engineering", "Model Evaluation"]
  };

  const key = normalizeSkill(skill);
  return map[key] || ["Problem Solving", "System Design Basics", "Technical Communication"];
}

function recommendResources(skill, level) {
  const base = [
    {
      title: `${skill} official docs`,
      type: "Documentation",
      link: "https://developer.mozilla.org/"
    },
    {
      title: `${skill} hands-on project tutorial`,
      type: "Project-based",
      link: "https://www.freecodecamp.org/news/"
    },
    {
      title: `${skill} interview preparation set`,
      type: "Practice",
      link: "https://leetcode.com/"
    }
  ];

  if (level <= 2) {
    base.unshift({
      title: `${skill} beginner crash course`,
      type: "Video Course",
      link: "https://www.youtube.com/"
    });
  }

  return base;
}

function timeEstimateHours(level, gap) {
  if (level <= 1) return 45 + Math.round(gap * 0.3);
  if (level === 2) return 30 + Math.round(gap * 0.25);
  if (level === 3) return 18 + Math.round(gap * 0.2);
  return 10 + Math.round(gap * 0.12);
}

function buildLearningPlan(scoredSkills) {
  const weakSkills = scoredSkills
    .filter((item) => item.proficiencyScore < 70)
    .sort((a, b) => b.gap - a.gap);

  return weakSkills.map((item) => {
    const adjacentSkills = inferAdjacentSkills(item.skill);
    const estimatedHours = timeEstimateHours(item.level, item.gap);

    return {
      focusSkill: item.skill,
      currentLevel: item.levelLabel,
      targetLevel: "Advanced",
      priority: item.gap >= 50 ? "High" : item.gap >= 30 ? "Medium" : "Low",
      estimatedHours,
      adjacentSkills,
      resources: recommendResources(item.skill, item.level)
    };
  });
}

function assessCandidate({ jd, resumeText, answers }) {
  const requiredSkills = (jd.requiredSkills || []).map((s) => ({
    skill: s.skill.trim(),
    weight: Number(s.weight) || 1
  }));

  const resumeSkills = parseResumeSkills(resumeText);
  const scoredSkills = requiredSkills.map((skillDef) => {
    const skillKey = normalizeSkill(skillDef.skill);
    const answer = answers[skillKey] || {};
    const baselineBonus = resumeSkills.has(skillKey) ? 8 : 0;
    const score = scoreSingleSkill(skillDef.skill, skillDef.weight, answer);
    score.proficiencyScore = Math.min(100, score.proficiencyScore + baselineBonus);
    score.weightedScore = Math.round(score.proficiencyScore * score.jdWeight);
    score.gap = 100 - score.proficiencyScore;
    score.level = Math.max(0, Math.min(5, Math.round(score.proficiencyScore / 20)));
    score.levelLabel = LEVELS[score.level];
    return score;
  });

  const totalWeight = requiredSkills.reduce((acc, s) => acc + s.weight, 0) || 1;
  const weightedTotal = scoredSkills.reduce((acc, s) => acc + s.weightedScore, 0);
  const baseOverallScore = Math.round(weightedTotal / totalWeight);
  const companySignals = extractCompanySignals(resumeText);
  const overallScore = Math.min(100, baseOverallScore + companySignals.companyBoost);

  const strengths = scoredSkills
    .filter((s) => s.proficiencyScore >= 75)
    .map((s) => s.skill);
  const gaps = scoredSkills
    .filter((s) => s.proficiencyScore < 70)
    .map((s) => s.skill);

  const recommendation =
    overallScore >= 80
      ? "Strong match"
      : overallScore >= 65
      ? "Potential match with focused upskilling"
      : "Needs significant upskilling before target role";

  return {
    baseOverallScore,
    overallScore,
    companySignals,
    recommendation,
    strengths,
    gaps,
    scoredSkills,
    learningPlan: buildLearningPlan(scoredSkills)
  };
}

function extractRequiredSkillsFromJD(jdText) {
  const text = (jdText || "").toLowerCase();
  const catalog = [
    "React",
    "JavaScript",
    "TypeScript",
    "Node.js",
    "Python",
    "SQL",
    "AWS",
    "Docker",
    "Machine Learning",
    "System Design"
  ];

  const picked = catalog.filter((skill) => text.includes(skill.toLowerCase()));
  if (picked.length === 0) {
    return [
      { skill: "JavaScript", weight: 1 },
      { skill: "Problem Solving", weight: 1 },
      { skill: "Communication", weight: 1 }
    ];
  }

  return picked.map((skill) => ({
    skill,
    weight: text.includes(`must have ${skill.toLowerCase()}`) ? 1.4 : 1
  }));
}

function getCompanyConfig() {
  return {
    baseCompany: "Deccan AI",
    competitorCompanies: DECCAN_AI_COMPETITORS,
    competitorBoost: COMPETITOR_COMPANY_BOOST
  };
}

module.exports = {
  assessCandidate,
  extractRequiredSkillsFromJD,
  normalizeSkill,
  getCompanyConfig
};
