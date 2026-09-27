import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TechVault Portal',
  description: 'Cloud security training platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
