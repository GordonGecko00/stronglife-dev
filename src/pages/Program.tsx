import { useState } from "react";
import { useAppData } from "../store/store";
import {
  addExercise,
  addTemplate,
  deleteTemplate,
  duplicateTemplate,
  moveExercise,
  patchExercise,
  patchRecoveryRule,
  patchTemplate,
  removeExercise,
  renameTemplate,
  setEveningDay,
  setScheduleDay,
} from "../store/actions";
import { planForDate } from "../store/planning";
import { addDays, DAY_NAMES_SHORT, startOfDay } from "../lib/misc";
import { formatWeight } from "../lib/units";
import type { Exercise, SessionKind, TrackingMode } from "../types";

const KINDS: { value: SessionKind; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "conditioning", label: "Cardio" },
  { value: "recovery", label: "Recovery" },
  { value: "sport", label: "Sport" },
];

export default function Program() {
  const data = useAppData();
  const [editing, setEditing] = useState<string | null>(null);

  if (editing && data.templates.some((t) => t.id === editing)) {
    return <TemplateEditor templateId={editing} onBack={() => setEditing(null)} />;
  }

  const monday = startOfDay(new Date());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  return (
    <div className="page">
      <header className="page-head">
        <h1>Program</h1>
        <p className="muted">Mornings, evenings, and what happens after a late skate.</p>
      </header>

      <div className="card">
        <div className="card-head">
          <h2>Weekly schedule</h2>
        </div>
        <div className="schedule-grid">
          <span className="schedule-head" />
          <span className="schedule-head">Morning</span>
          <span className="schedule-head">Evening</span>
          {DAY_NAMES_SHORT.map((_, index) => {
            // Column order is Mon-first to match how the week reads.
            const day = (index + 1) % 7;
            const plan = planForDate(data, addDays(monday, index));
            return (
              <Row
                key={day}
                label={DAY_NAMES_SHORT[day]}
                day={day}
                adjusted={plan.status === "adjusted" || plan.status === "skipped"}
              />
            );
          })}
        </div>
      </div>

      <RecoveryCard />

      <div className="card">
        <div className="card-head">
          <h2>Sessions</h2>
        </div>
        {data.templates.map((template) => (
          <button key={template.id} className="row-button" onClick={() => setEditing(template.id)}>
            <span>
              {template.name}
              <span className={`kind-tag kind-${template.kind}`}>{template.kind}</span>
            </span>
            <span className="muted">{template.exercises.length} items ›</span>
          </button>
        ))}
        <button className="btn btn-ghost" onClick={() => setEditing(addTemplate())}>
          + New session
        </button>
      </div>
    </div>
  );
}

function Row({ label, day, adjusted }: { label: string; day: number; adjusted: boolean }) {
  const data = useAppData();
  const morning = data.templates.filter((t) => t.slot === "am" || t.kind !== "sport");
  const evening = data.templates;

  return (
    <>
      <span className={`schedule-day ${adjusted ? "schedule-day-adjusted" : ""}`}>{label}</span>
      <select
        aria-label={`${label} morning`}
        value={data.schedule.days[day] ?? ""}
        onChange={(event) => setScheduleDay(day, event.target.value || null)}
      >
        <option value="">Rest</option>
        {morning.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} evening`}
        value={data.schedule.eveningDays[day] ?? ""}
        onChange={(event) => setEveningDay(day, event.target.value || null)}
      >
        <option value="">—</option>
        {evening.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </>
  );
}

function RecoveryCard() {
  const data = useAppData();
  const rule = data.settings.recovery;
  const recoveryOptions = data.templates.filter((t) => t.kind === "recovery");

  return (
    <div className="card">
      <div className="card-head">
        <h2>After a late night</h2>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(event) => patchRecoveryRule({ enabled: event.target.checked })}
        />
        Ease off the morning after a late session
      </label>

      {rule.enabled && (
        <>
          <label className="field">
            <span>Counts as late from</span>
            <select
              value={rule.lateHour}
              onChange={(event) => patchRecoveryRule({ lateHour: Number(event.target.value) })}
            >
              {[17, 18, 19, 20, 21, 22].map((hour) => (
                <option key={hour} value={hour}>
                  {hour > 12 ? `${hour - 12}pm` : `${hour}am`}
                </option>
              ))}
            </select>
          </label>

          <div className="segmented">
            <button
              className={rule.action === "recovery" ? "segment segment-on" : "segment"}
              onClick={() => patchRecoveryRule({ action: "recovery" })}
            >
              Swap to easy
            </button>
            <button
              className={rule.action === "skip" ? "segment segment-on" : "segment"}
              onClick={() => patchRecoveryRule({ action: "skip" })}
            >
              Skip it
            </button>
          </div>

          {rule.action === "recovery" && (
            <label className="field">
              <span>Swap in</span>
              <select
                value={rule.recoveryTemplateId ?? ""}
                onChange={(event) =>
                  patchRecoveryRule({ recoveryTemplateId: event.target.value || null })
                }
              >
                <option value="">Nothing (rest)</option>
                {recoveryOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="muted">
            Uses what you actually logged the night before; falls back to your scheduled evenings
            when nothing is logged yet.
          </p>
        </>
      )}
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
        ‹ Program
      </button>
      <input
        className="title-input"
        aria-label="Session name"
        value={template.name}
        onChange={(event) => renameTemplate(templateId, event.target.value)}
      />

      <div className="card">
        <label className="field">
          <span>Type</span>
          <select
            value={template.kind}
            onChange={(event) => patchTemplate(templateId, { kind: event.target.value as SessionKind })}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Usual slot</span>
          <select
            value={template.slot}
            onChange={(event) =>
              patchTemplate(templateId, { slot: event.target.value as "am" | "pm" })
            }
          >
            <option value="am">Morning</option>
            <option value="pm">Evening</option>
          </select>
        </label>
      </div>

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
        Duplicate session
      </button>
      <button
        className="btn btn-ghost danger"
        onClick={() => {
          if (!confirm(`Delete ${template.name}?`)) return;
          deleteTemplate(templateId);
          onBack();
        }}
      >
        Delete session
      </button>
    </div>
  );
}

const TRACKING: { value: TrackingMode; label: string }[] = [
  { value: "reps", label: "Sets & reps" },
  { value: "duration", label: "Time" },
  { value: "done", label: "Tick box" },
];

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

      <div className="segmented">
        {TRACKING.map((mode) => (
          <button
            key={mode.value}
            className={exercise.tracking === mode.value ? "segment segment-on" : "segment"}
            onClick={() => patch({ tracking: mode.value })}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {exercise.tracking === "reps" && (
        <>
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
              Reps from
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={exercise.targetReps}
                onChange={(event) => {
                  const min = Math.max(1, Number(event.target.value) || 1);
                  patch({ targetReps: min, targetRepsMax: Math.max(min, exercise.targetRepsMax) });
                }}
              />
            </label>
            <label>
              Reps to
              <input
                type="number"
                min={exercise.targetReps}
                inputMode="numeric"
                value={exercise.targetRepsMax}
                onChange={(event) =>
                  patch({
                    targetRepsMax: Math.max(exercise.targetReps, Number(event.target.value) || 1),
                  })
                }
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
                onChange={(event) =>
                  patch({ increment: Math.max(0, Number(event.target.value) || 0) })
                }
              />
            </label>
          </div>

          <p className="muted">
            Work up to {exercise.targetRepsMax} reps on every set, then the weight goes up
            {exercise.increment > 0 && ` to ${formatWeight(exercise.weight + exercise.increment)} ${data.settings.unit}`}.
          </p>

          <div className="toggle-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={exercise.usesBar}
                onChange={(event) => patch({ usesBar: event.target.checked })}
              />
              Barbell
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={exercise.useWarmup}
                disabled={!exercise.usesBar}
                onChange={(event) => patch({ useWarmup: event.target.checked })}
              />
              Warmups
            </label>
          </div>
        </>
      )}

      {exercise.tracking === "duration" && (
        <label className="field">
          <span>Target minutes</span>
          <input
            type="number"
            min={0}
            step={5}
            inputMode="numeric"
            value={exercise.targetMinutes}
            onChange={(event) =>
              patch({ targetMinutes: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </label>
      )}

      <label className="field">
        <span>Cue (optional)</span>
        <input
          value={exercise.hint}
          placeholder="e.g. treadmill intervals, 3 × 45s hold"
          onChange={(event) => patch({ hint: event.target.value })}
        />
      </label>

      {exercise.consecutiveFails > 0 && (
        <p className="muted">
          Missed {exercise.consecutiveFails} session{exercise.consecutiveFails > 1 ? "s" : ""} in a
          row — deloads after {data.settings.deloadAfterFails}.
        </p>
      )}

      <button className="btn-link danger" onClick={() => removeExercise(templateId, exercise.id)}>
        Remove
      </button>
    </div>
  );
}
