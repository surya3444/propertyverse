import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PropertyVerse — AI-powered real-estate CRM',
  description:
    'Capture every call with voice AI, organise your entire pipeline, and follow up automatically. The all-in-one CRM built for real-estate agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
