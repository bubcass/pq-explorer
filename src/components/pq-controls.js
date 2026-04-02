export function pqControls({
  state = { year: 2026, questionType: "all" },
  onChange = () => {},
} = {}) {
  const container = document.createElement("div");
  container.className = "pq-controls";

  const selectedYear = Number(state.year ?? 2026);
  const selectedQuestionType = String(state.questionType ?? "all");

  const uid = `pq-controls-${Math.random().toString(36).slice(2, 10)}`;
  const yearId = `${uid}-year`;
  const qtypeLabelId = `${uid}-qtype-label`;
  const qtypeName = `${uid}-qtype`;

  container.innerHTML = `
    <div class="control">
      <label for="${yearId}" class="control-label">Year</label>
      <select id="${yearId}" name="year" class="control-input">
        <option value="2026" ${selectedYear === 2026 ? "selected" : ""}>2026</option>
        <option value="2025" ${selectedYear === 2025 ? "selected" : ""}>2025</option>
      </select>
    </div>

    <div class="control">
      <div id="${qtypeLabelId}" class="control-label">Question type</div>
      <div class="radio-group" role="radiogroup" aria-labelledby="${qtypeLabelId}">
        <label>
          <input type="radio" name="${qtypeName}" value="all" ${selectedQuestionType === "all" ? "checked" : ""}>
          All questions
        </label>
        <label>
          <input type="radio" name="${qtypeName}" value="oral" ${selectedQuestionType === "oral" ? "checked" : ""}>
          Oral questions only
        </label>
      </div>
    </div>
  `;

  const select = container.querySelector("select");
  const radios = container.querySelectorAll(
    `input[type="radio"][name="${qtypeName}"]`,
  );

  function emitChange() {
    state.year = Number(select.value);
    state.questionType = container.querySelector(
      `input[name="${qtypeName}"]:checked`,
    ).value;
    onChange(state);
  }

  select.addEventListener("change", emitChange);
  radios.forEach((r) => r.addEventListener("change", emitChange));

  return container;
}
