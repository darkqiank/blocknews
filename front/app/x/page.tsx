import { XDataDemo } from '@/components/x-data-demo';

export default function XPage() {
  return (
    <div className="min-h-screen bg-background pt-14">
      <XDataDemo />
    </div>
  );
}

export const metadata = {
  title: '见解 Insights - BeNotify',
  description: 'View and manage X (Twitter) data and users',
};
