export default function Mensaje({ error, ok }) {
  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (ok) {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
        {ok}
      </div>
    );
  }
  return null;
}
