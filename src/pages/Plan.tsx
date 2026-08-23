import { useState } from "react";
import { useAppData } from "../store/store";
import {
  addExercise,
  addTemplate,
  deleteTemplate,
  duplicateTemplate,
  moveExercise,
  patchExercise,
  removeExercise,
  renameTemplate,
  setRotation,
  setRotationIndex,
  setScheduleDay,
  setScheduleMode,
  toggleTrainingDay,
} from "../store/actions";
import { templateForDay } from "../store/selectors";
import { DAY_NAMES_SHORT } from "../lib/misc";
import { formatWeight } from "../lib/units";
import type { Exercise } from "../types";

export default function Plan() {
  const data = useAppData();
  const [editing, setEditing] = useState<string | null>(null);

  if (editing && data.templates.some((t) => t.id === editing)) {
    return <TemplateEditor templateId={editing} onBack={() => setEditing(null)} />;
  }

  const { schedule } = data;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Plan</h1>
      </header>

      <div className="card">
        <div className="card-head">
          <h2>Weekly schedule</h2>
        </div>
        <div className="segmented" role="tablist" aria-label="Schedule mode">
          <button
            role="tab"
            aria-selected={schedule.mode === "rotating"}
            className={schedule.mode === "rotating" ? "segment segment-on" : "segment"}
            onClick={() => setScheduleMode("rotating")}
          >
            Alternating
          </button>
          <button
            role="tab"
            aria-selected={schedule.mode === "fixed"}
            className={schedule.mode === "fixed" ? "segment segment-on" : "segment"}
            onClick={() => setScheduleMode("fixed")}
          >
            Fixed days
          </button>
        </div>

        {schedule.mode === "rotating" ? (
          <>
            <p className="muted">
              Train on the days you pick and cycle through your workouts in order — the classic
              A / B / A, B / A / B pattern.
            </p>
            <div className="day-toggles">
              {DAY_NAMES_SHORT.map((name, day) => (
                <button
                  key={day}
                  className={`day-toggle ${schedule.trainingDays[day] ? "day-toggle-on" : ""}`}
                  aria-pressed={Boolean(schedule.trainingDays[day])}
                  onClick={() => toggleTrainingDay(day)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="field">
              <span>Rotation</span>
              <div className="rotation-list">
                {data.templates.map((template) => {
                  const position = schedule.rotation.indexOf(template.id);
                  return (
                    <button
                      key={template.id}
                      className={`rotation-chip ${position >= 0 ? "rotation-chip-on" : ""}`}
                      onClick={() =>
                        setRotation(
                          position >= 0
                            ? schedule.rotation.filter((id) => id !== template.id)
                            : [...schedule.rotation, template.id]
                        )
                      }
                    >
                      {position >= 0 && <span className="rotation-index">{position + 1}</span>}
                      {template.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="field">
              <span>Up next</span>
              <select
                value={schedule.rotationIndex}
                onChange={(event) => setRotationIndex(Number(event.target.value))}
              >
                {schedule.rotation.map((id, index) => (
                  <option key={id} value={index}>
                    {data.templates.find((t) => t.id === id)?.name ?? "Workout"}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="day-rows">
            {DAY_NAMES_SHORT.map((name, day) => (
              <div className="day-row" key={day}>
                <span className="day-row-name">{name}</span>
                <select
                  aria-label={`Workout for ${name}`}
                  value={schedule.days[day] ?? ""}
                  onChange={(event) => setScheduleDay(day, event.target.value || null)}
                >
                  <option value="">Rest</option>
                  {data.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="week-preview">
          {DAY_NAMES_SHORT.map((name, day) => {
            const template = templateForDay(data, day);
            return (
              <div className="week-cell" key={day}>
                <span className="week-day">{name}</span>
                <span className={`week-mark ${template ? "week-mark-on" : ""}`}>
                  {template ? template.name.replace(/^Workout\s*/i, "") || "•" : "–"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Workouts</h2>
        </div>
        {data.templates.map((template) => (
          <button key={template.id} className="row-button" onClick={() => setEditing(template.id)}>
            <span>{template.name}</span>
            <span className="muted">{template.exercises.length} exercises ›</span>
          </button>
        ))}
        <button className="btn btn-ghost" onClick={() => setEditing(addTemplate())}>
          + New workout
        </button>
      </div>
    </div>
  );
}

function TemplateEditor({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const data = useAppData();
  const template = data.templates.find((t) => t.id === templateId);
  if (!template) return null;

  return (
    <div className="page">
      <button className="btn-link" onClick={onBack}>
        ‹ Plan
      </button>
      <input
        className="title-input"
        aria-label="Workout name"
        value={template.name}
        onChange={(event) => renameTemplate(templateId, event.target.value)}
      />

      {template.exercises.map((exercise, index) => (
        <ExerciseEditor
          key={exercise.id}
          templateId={templateId}
          exercise={exercise}
          isFirst={index === 0}
          isLast={index === template.exercises.length - 1}
        />
      ))}

      <button className="btn btn-ghost" onClick={() => addExercise(templateId)}>
        + Add exercise
      </button>
      <button className="btn btn-ghost" onClick={() => duplicateTemplate(templateId)}>
        Duplicate workout
      </button>
      <button
        className="btn btn-ghost danger"
        onClick={() => {
          if (!confirm(`Delete ${template.name}?`)) return;
          deleteTemplate(templateId);
          onBack();
        }}
      >
        Delete workout
      </button>
    </div>
  );
}

function ExerciseEditor({
  templateId,
  exercise,
  isFirst,
  isLast,
}: {
  templateId: string;
  exercise: Exercise;
  isFirst: boolean;
  isLast: boolean;
}) {
  const data = useAppData();
  const patch = (fields: Partial<Exercise>) => patchExercise(templateId, exercise.id, fields);

  return (
    <div className="card">
      <div className="card-head">
        <input
          className="subtitle-input"
          aria-label="Exercise name"
          value={exercise.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
        <div className="reorder">
          <button
            className="icon-btn"
            disabled={isFirst}
            aria-label="Move up"
            onClick={() => moveExercise(templateId, exercise.id, -1)}
          >
            ↑
          </button>
          <button
            className="icon-btn"
            disabled={isLast}
            aria-label="Move down"
            onClick={() => moveExercise(templateId, exercise.id, 1)}
          >
            ↓
          </button>
        </div>
      </div>

      <div className="field-grid">
        <label>
          Sets
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={exercise.sets}
            onChange={(event) => patch({ sets: Math.max(1, Number(event.target.value) || 1) })}
          />
        </label>
        <label>
          Reps
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={exercise.targetReps}
            onChange={(event) => patch({ targetReps: Math.max(1, Number(event.target.value) || 1) })}
          />
        </label>
        <label>
          Weight ({data.settings.unit})
          <input
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            value={exercise.weight}
            onChange={(event) => patch({ weight: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
        <label>
          Add per win
          <input
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            value={exercise.increment}
            onChange={(event) => patch({ increment: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
      </div>

      <div className="toggle-row">
        <label className="toggle">
          <input
            type="checkbox"
            checked={exercise.usesBar}
            onChange={(event) => patch({ usesBar: event.target.checked })}
          />
          Barbell lift
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={exercise.useWarmup}
            disabled={!exercise.usesBar}
            onChange={(event) => patch({ useWarmup: event.target.checked })}
          />
          Warmup sets
        </label>
      </div>

      {exercise.consecutiveFails > 0 && (
        <p className="muted">
          Missed {exercise.consecutiveFails} session{exercise.consecutiveFails > 1 ? "s" : ""} in a
          row — deloads to {formatWeight(exercise.weight * (1 - data.settings.deloadPercent / 100))}{" "}
          {data.settings.unit} after {data.settings.deloadAfterFails}.
        </p>
      )}

      <button className="btn-link danger" onClick={() => removeExercise(templateId, exercise.id)}>
        Remove exercise
      </button>
    </div>
  );
}
