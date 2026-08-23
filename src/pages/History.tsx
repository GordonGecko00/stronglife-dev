import { useAppData } from "../store";

export default function History() {
  const data = useAppData();
  const finished = data.sessions.filter((s) => s.finishedAt !== null);

  return (
    <div className="page">
      <h1>History</h1>
      {finished.length === 0 && <p className="muted">No completed workouts yet.</p>}
      {finished.map((s) => (
        <div className="card" key={s.id}>
          <div className="exercise-title-row">
            <h2>{s.templateName}</h2>
            <span className="muted">{new Date(s.dateISO).toLocaleDateString()}</span>
          </div>
          <ul className="exercise-preview">
            {s.exercises.map((ex) => (
              <li key={ex.exerciseId}>
                <span>{ex.name}</span>
                <span className="muted">
                  {ex.sets.map((set) => set.reps).join("/")} @ {ex.weight}
                  {ex.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
