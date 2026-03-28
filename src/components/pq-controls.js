export function pqControls({
  state = { year: 2026, questionType: "all" },
  onChange = () => {},
} = {}) {
  const container = document.createElement("div");
  container.className = "pq-controls";

  const selectedYear = Number(state.year ?? 2026);
  const selectedQuestionType = String(state.questionType ?? "all");

  container.innerHTML = `
    <div class="control">
      <label>Year</label>
      <select>
        <option value="2026" ${selectedYear === 2026 ? "selected" : ""}>2026</option>
        <option value="2025" ${selectedYear === 2025 ? "selected" : ""}>2025</option>
      </select>
    </div>

    <div class="control">
      <label>Question type</label>
      <div class="radio-group">
        <label>
          <input type="radio" name="qtype" value="all" ${selectedQuestionType === "all" ? "checked" : ""}>
          All questions
        </label>
        <label>
          <input type="radio" name="qtype" value="oral" ${selectedQuestionType === "oral" ? "checked" : ""}>
          Oral questions only
        </label>
      </div>
    </div>
  `;

  const select = container.querySelector("select");
  const radios = container.querySelectorAll('input[type="radio"]');

  function emitChange() {
    state.year = Number(select.value);
    state.questionType = container.querySelector(
      'input[name="qtype"]:checked',
    ).value;
    onChange(state);
  }

  select.addEventListener("change", emitChange);
  radios.forEach((r) => r.addEventListener("change", emitChange));

  return container;
}
