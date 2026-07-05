import { BiddingDashboard } from '@/components/bidding-dashboard';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <BiddingDashboard />
      </div>
    </div>
  );
}
