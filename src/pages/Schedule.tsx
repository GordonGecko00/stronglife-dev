import { useState } from "react";
import { useAppData, update } from "../store";
import type { Exercise } from "../types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Schedule() {
  const data = useAppData();
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const editingTemplate = data.templates.find((t) => t.id === editingTemplateId) ?? null;

  if (editingTemplate) {
    return <TemplateEditor templateId={editingTemplate.id} onBack={() => setEditingTemplateId(null)} />;
  }

  return (
    <div className="page">
      <h1>Weekly plan</h1>

      <div className="card">
        <h2>Days</h2>
        {DAY_NAMES.map((name, idx) => (
          <div className="day-row" key={idx}>
            <span className="day-row-name">{name}</span>
            <select
              value={data.schedule[idx] ?? ""}
              onChange={(e) => {
                const value = e.target.value || null;
                update((d) => {
                  d.schedule[idx] = value;
                });
              }}
            >
              <option value="">Rest</option>
              {data.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Workouts</h2>
        {data.templates.map((t) => (
          <button key={t.id} className="template-row" onClick={() => setEditingTemplateId(t.id)}>
            <span>{t.name}</span>
            <span className="muted">{t.exercises.length} exercises</span>
          </button>
        ))}
        <button
          className="btn btn-ghost"
          onClick={() => {
            update((d) => {
              const id = crypto.randomUUID();
              d.templates.push({ id, name: `Workout ${d.templates.length + 1}`, exercises: [] });
            });
          }}
        >
          + Add workout
        </button>
      </div>
    </div>
  );
}

function TemplateEditor({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const data = useAppData();
  const template = data.templates.find((t) => t.id === templateId);
  if (!template) {
    onBack();
    return null;
  }

  return (
    <div className="page">
      <button className="btn-link" onClick={onBack}>
        ← Back to plan
      </button>
      <input
        className="template-name-input"
        value={template.name}
        onChange={(e) => {
          const name = e.target.value;
          update((d) => {
            const t = d.templates.find((t) => t.id === templateId);
            if (t) t.name = name;
          });
        }}
      />

      {template.exercises.map((ex) => (
        <ExerciseEditor key={ex.id} templateId={templateId} exercise={ex} />
      ))}

      <button
        className="btn btn-ghost"
        onClick={() => {
          update((d) => {
            const t = d.templates.find((t) => t.id === templateId);
            if (!t) return;
            const newEx: Exercise = {
              id: crypto.randomUUID(),
              name: "New Exercise",
              sets: 5,
              targetReps: 5,
              weight: 45,
              increment: 5,
              unit: "lb",
              consecutiveFails: 0,
            };
            t.exercises.push(newEx);
          });
        }}
      >
        + Add exercise
      </button>

      <button
        className="btn btn-ghost danger"
        onClick={() => {
          if (!confirm(`Delete ${template.name}?`)) return;
          update((d) => {
            d.templates = d.templates.filter((t) => t.id !== templateId);
            for (const day of Object.keys(d.schedule)) {
              if (d.schedule[Number(day)] === templateId) d.schedule[Number(day)] = null;
            }
          });
          onBack();
        }}
      >
        Delete workout
      </button>
    </div>
  );
}

function ExerciseEditor({ templateId, exercise }: { templateId: string; exercise: Exercise }) {
  const patch = (fields: Partial<Exercise>) => {
    update((d) => {
      const t = d.templates.find((t) => t.id === templateId);
      const e = t?.exercises.find((e) => e.id === exercise.id);
      if (e) Object.assign(e, fields);
    });
  };

  return (
    <div className="card exercise-editor">
      <input
        className="exercise-name-input"
        value={exercise.name}
        onChange={(e) => patch({ name: e.target.value })}
      />
      <div className="field-grid">
        <label>
          Sets
          <input
            type="number"
            min={1}
            value={exercise.sets}
            onChange={(e) => patch({ sets: Number(e.target.value) || 1 })}
          />
        </label>
        <label>
          Reps
          <input
            type="number"
            min={1}
            value={exercise.targetReps}
            onChange={(e) => patch({ targetReps: Number(e.target.value) || 1 })}
          />
        </label>
        <label>
          Weight
          <input
            type="number"
            min={0}
            value={exercise.weight}
            onChange={(e) => patch({ weight: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          +/session
          <input
            type="number"
            min={0}
            value={exercise.increment}
            onChange={(e) => patch({ increment: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          Unit
          <select value={exercise.unit} onChange={(e) => patch({ unit: e.target.value as Exercise["unit"] })}>
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </label>
      </div>
      <button
        className="btn-link danger"
        onClick={() => {
          update((d) => {
            const t = d.templates.find((t) => t.id === templateId);
            if (t) t.exercises = t.exercises.filter((e) => e.id !== exercise.id);
          });
        }}
      >
        Remove exercise
      </button>
    </div>
  );
}
