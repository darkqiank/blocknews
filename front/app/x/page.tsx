import { XDataDemo } from '@/components/x-data-demo';

export default function XPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <XDataDemo />
    </div>
  );
}

export const metadata = {
  title: 'X (Twitter) Data - BlockNews',
  description: 'View and manage X (Twitter) data and users',
};
