import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";

export function downloadButton(
  data,
  filename = "pq_dataset.csv",
  options = {},
) {
  if (!Array.isArray(data)) {
    throw new Error("Array of data required as first argument");
  }

  const { label = null } = options;

  const normalised = data.map((d) => ({
    department: (d.department ?? "").trim(),
    heading: (d.heading ?? "").trim(),
    deputy: (d.deputy ?? d.memberName ?? "").trim(),
    type: (d.questionType ?? "").trim().toLowerCase(),
    question: (d.question ?? "").replace(/\s+/g, " ").trim(),
    url: d.url ?? "",
    date: d.date_iso ?? "",
  }));

  let blob;

  if (filename.toLowerCase().endsWith(".csv")) {
    const csvContent = "\uFEFF" + d3.csvFormat(normalised);
    blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
  } else {
    blob = new Blob([JSON.stringify(normalised, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
  }

  const sizeBytes = blob.size;
  let sizeLabel;

  if (sizeBytes < 1024 * 1024) {
    sizeLabel = `${(sizeBytes / 1024).toFixed(0)} KB`;
  } else {
    sizeLabel = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const button = document.createElement("button");
  button.className = "pq-download";
  button.type = "button";

  const state = window.pqDeputiesState ?? window.pqState;

  const uniqueDeputies = [
    ...new Set(normalised.map((d) => d.deputy).filter(Boolean)),
  ];
  const name = uniqueDeputies.length === 1 ? uniqueDeputies[0] : null;

  const defaultLabel = name
    ? `Download dataset for ${name} (${state.year})`
    : `Download parliamentary question dataset ${state.year}`;

  button.textContent = `${label ?? defaultLabel} (~${sizeLabel})`;

  button.addEventListener("click", () => {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  });

  return button;
}
