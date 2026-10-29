import Link from 'next/link';

export function NotFound({ back }: { back: string }) {
  return (
    <div className="panel empty"><h2>Application not found</h2><p style={{ marginTop: 8 }}>It may have been deleted, or the link is wrong.</p>
      <p style={{ marginTop: 14 }}><Link className="btn" href={back}>Back to the list</Link></p></div>
  );
}
