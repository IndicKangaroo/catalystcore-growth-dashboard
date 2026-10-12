import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-fg-muted">There is nothing at this address.</p>
      <p className="mt-4">
        <Link to="/" className="text-accent underline">
          Back to home
        </Link>
      </p>
    </section>
  );
}
