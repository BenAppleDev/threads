import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Threads Modern Nymspace',
  description: 'Firebase-backed anonymous rooms with cloak mode',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            <h1 style={{ margin: 0 }}>Threads Nymspace</h1>
            <span className="chip">Cloak: ON</span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
