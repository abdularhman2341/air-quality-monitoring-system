// A labelled input. onChange receives the new text, not the event; any other
// prop goes to the input as it is. children appear under the input (a hint).
function Field({ label, onChange, children, ...input }) {
  return (
    <label className="field">
      {label}
      <input {...input} onChange={(e) => onChange(e.target.value)} />
      {children}
    </label>
  )
}

export default Field
