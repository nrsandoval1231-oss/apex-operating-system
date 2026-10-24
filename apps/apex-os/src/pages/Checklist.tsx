import Checklist from '../components/Checklist';
export default function ChecklistPage() {
  return (
    <>
      <header className="title-block checklist-title">
        <h1>Checklist</h1>
        <p>Personal and project work, with a permanent completion history.</p>
      </header>
      <Checklist />
    </>
  );
}
