const jdText = document.getElementById("jdText");
const resumePdf = document.getElementById("resumePdf");
const resumeStatus = document.getElementById("resumeStatus");
const resumeTextPreview = document.getElementById("resumeTextPreview");
const competitorInfo = document.getElementById("competitorInfo");
const useSampleBtn = document.getElementById("useSampleBtn");
const startAssessmentBtn = document.getElementById("startAssessmentBtn");
const conversationSection = document.getElementById("conversationSection");
const questionCounter = document.getElementById("questionCounter");
const questionBox = document.getElementById("questionBox");
const prevSkillBtn = document.getElementById("prevSkillBtn");
const nextSkillBtn = document.getElementById("nextSkillBtn");
const submitAssessmentBtn = document.getElementById("submitAssessmentBtn");
const resultSection = document.getElementById("resultSection");
const resultContent = document.getElementById("resultContent");

let state = {
  jd: null,
  resumeText: "",
  questions: [],
  currentIndex: 0,
  answers: {}
};

const sample = {
  jdText: `We are hiring a Full Stack Engineer.
Must have React, JavaScript, Node.js, SQL, and AWS.
Strong communication and practical project experience preferred.`,
  resumeText: `Candidate has 2 years experience with JavaScript and React.
Built 2 full-stack projects using Node.js and PostgreSQL.
Worked on AWS basics (EC2, S3).`
};

async function parseResumePdfFile(file) {
  const formData = new FormData();
  formData.append("resumePdf", file);

  const response = await fetch("/api/parse-resume-pdf", {
    method: "POST",
    body: formData
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Failed to parse PDF.");
  }

  return payload.resumeText || "";
}

async function loadCompanyConfig() {
  const response = await fetch("/api/company-config");
  const data = await response.json();
  const competitors = (data.competitorCompanies || [])
    .map((name) => `<li>${escapeHtml(name)}</li>`)
    .join("");

  competitorInfo.innerHTML = `
    <strong>Competitor Targeting Active</strong><br />
    Base company: ${escapeHtml(data.baseCompany || "Deccan AI")}<br />
    Resume boost for competitor match: +${Number(data.competitorBoost || 0)}<br />
    Competitor list:
    <ul>${competitors}</ul>
  `;
}

function getSkillAnswer(key) {
  if (!state.answers[key]) {
    state.answers[key] = {
      confidence: 3,
      years: 0,
      projectCount: 0,
      depth: 3,
      evidence: ""
    };
  }
  return state.answers[key];
}

function renderCurrentSkill() {
  const current = state.questions[state.currentIndex];
  if (!current) return;
  const answer = getSkillAnswer(current.key);

  questionCounter.textContent = `Skill ${state.currentIndex + 1} of ${state.questions.length}: ${current.skill}`;
  questionBox.innerHTML = `
    <div class="skill-card">
      <label>${current.prompts[0]}</label>
      <input type="number" min="1" max="5" id="confidenceInput" value="${answer.confidence}" />

      <label>${current.prompts[1]}</label>
      <input type="number" min="0" step="0.5" id="yearsInput" value="${answer.years}" />

      <label>${current.prompts[2]}</label>
      <input type="number" min="0" id="projectInput" value="${answer.projectCount}" />

      <label>${current.prompts[3]}</label>
      <input type="number" min="1" max="5" id="depthInput" value="${answer.depth}" />

      <label>${current.prompts[4]}</label>
      <textarea rows="4" id="evidenceInput" placeholder="Share a real project task/outcome...">${answer.evidence}</textarea>
    </div>
  `;

  prevSkillBtn.disabled = state.currentIndex === 0;
  nextSkillBtn.disabled = state.currentIndex >= state.questions.length - 1;
}

function persistCurrentSkillAnswer() {
  const current = state.questions[state.currentIndex];
  if (!current) return;
  state.answers[current.key] = {
    confidence: Number(document.getElementById("confidenceInput").value || 1),
    years: Number(document.getElementById("yearsInput").value || 0),
    projectCount: Number(document.getElementById("projectInput").value || 0),
    depth: Number(document.getElementById("depthInput").value || 1),
    evidence: document.getElementById("evidenceInput").value || ""
  };
}

function escapeHtml(input) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderResults(data) {
  const skillRows = data.scoredSkills
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.skill)}</td>
        <td>${item.proficiencyScore}</td>
        <td>${escapeHtml(item.levelLabel)}</td>
        <td>${item.gap}</td>
      </tr>
    `
    )
    .join("");

  const plan = data.learningPlan
    .map((p) => {
      const adjacent = p.adjacentSkills.map((s) => `<span class="pill">${escapeHtml(s)}</span>`).join("");
      const resources = p.resources
        .map((r) => `<li><a href="${r.link}" target="_blank" rel="noreferrer">${escapeHtml(r.title)}</a> (${escapeHtml(r.type)})</li>`)
        .join("");
      return `
        <article class="skill-card" style="margin-bottom:10px;">
          <h4>${escapeHtml(p.focusSkill)} - ${escapeHtml(p.priority)} Priority</h4>
          <p>Current: ${escapeHtml(p.currentLevel)} | Target: ${escapeHtml(p.targetLevel)} | Estimated effort: ${p.estimatedHours} hours</p>
          <div>${adjacent}</div>
          <ul class="resource-list">${resources}</ul>
        </article>
      `;
    })
    .join("");

  resultContent.innerHTML = `
    <p><strong>Base Score (without company signal):</strong> ${data.baseOverallScore}/100</p>
    <p><strong>Overall Score:</strong> ${data.overallScore}/100</p>
    <p><strong>Company Signal:</strong> ${
      data.companySignals?.hasCompetitorExperience
        ? `Matched Deccan AI competitor: ${escapeHtml(data.companySignals.matchedCompetitor)} (+${data.companySignals.companyBoost})`
        : "No Deccan AI competitor match"
    }</p>
    <p><strong>Recommendation:</strong> ${escapeHtml(data.recommendation)}</p>
    <p><strong>Strengths:</strong> ${escapeHtml(data.strengths.join(", ") || "None yet")}</p>
    <p><strong>Skill Gaps:</strong> ${escapeHtml(data.gaps.join(", ") || "None")}</p>

    <h3>Skill-wise Assessment</h3>
    <table class="skill-table">
      <thead>
        <tr>
          <th>Skill</th>
          <th>Score</th>
          <th>Level</th>
          <th>Gap</th>
        </tr>
      </thead>
      <tbody>${skillRows}</tbody>
    </table>

    <h3>Personalised Learning Plan</h3>
    ${plan || "<p>No major gaps found.</p>"}
  `;
}

useSampleBtn.addEventListener("click", () => {
  jdText.value = sample.jdText;
  state.resumeText = sample.resumeText;
  resumeStatus.textContent = "Using sample resume text (no PDF selected).";
  resumeTextPreview.value = sample.resumeText;
});

resumePdf.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    alert("Please upload a valid PDF file.");
    resumePdf.value = "";
    return;
  }

  try {
    resumeStatus.textContent = "Parsing PDF resume...";
    const extractedText = await parseResumePdfFile(file);
    state.resumeText = extractedText;
    resumeStatus.textContent = `Parsed resume: ${file.name}`;
    resumeTextPreview.value = extractedText.slice(0, 1500);
  } catch (error) {
    state.resumeText = "";
    resumeStatus.textContent = "Failed to parse PDF.";
    resumeTextPreview.value = "";
    alert(error.message);
  }
});

startAssessmentBtn.addEventListener("click", async () => {
  const jdValue = jdText.value.trim();
  const resumeValue = state.resumeText.trim();
  if (!jdValue || !resumeValue) {
    alert("Please add JD and upload a resume PDF (or use sample data).");
    return;
  }

  const jdRes = await fetch("/api/parse-jd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jdText: jdValue })
  });
  const jd = await jdRes.json();

  const questionsRes = await fetch("/api/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requiredSkills: jd.requiredSkills })
  });
  const questionPayload = await questionsRes.json();

  state = {
    jd,
    resumeText: resumeValue,
    questions: questionPayload.questions,
    currentIndex: 0,
    answers: {}
  };

  conversationSection.classList.remove("hidden");
  resultSection.classList.add("hidden");
  renderCurrentSkill();
});

prevSkillBtn.addEventListener("click", () => {
  persistCurrentSkillAnswer();
  state.currentIndex = Math.max(0, state.currentIndex - 1);
  renderCurrentSkill();
});

nextSkillBtn.addEventListener("click", () => {
  persistCurrentSkillAnswer();
  state.currentIndex = Math.min(state.questions.length - 1, state.currentIndex + 1);
  renderCurrentSkill();
});

submitAssessmentBtn.addEventListener("click", async () => {
  persistCurrentSkillAnswer();
  const payload = {
    jd: state.jd,
    resumeText: state.resumeText,
    answers: state.answers
  };

  const assessRes = await fetch("/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await assessRes.json();
  renderResults(data);
  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth" });
});

loadCompanyConfig().catch(() => {
  competitorInfo.innerHTML =
    "<strong>Competitor Targeting Info</strong><br />Could not load competitor configuration.";
});
