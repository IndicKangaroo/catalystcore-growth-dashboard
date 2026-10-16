import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Page not found</h1>
      <p className="mt-1 text-sm text-fg-muted">There is nothing at this address.</p>
      <p className="mt-4">
        <Link to="/" className="text-sm font-medium text-accent hover:underline">
          Back to the overview
        </Link>
      </p>
    </section>
  );
}
