// The main button of a form. It shows busyLabel and stays disabled while
// the request runs, so a double click cannot send it twice.
function SubmitButton({ busy, label, busyLabel, disabled = false }) {
  return (
    <button type="submit" className="btn btn-primary" disabled={busy || disabled}>
      {busy ? busyLabel : label}
    </button>
  )
}

export default SubmitButton
