'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Challenge {
  id: string;
  title: string;
  category: string;
  points: number;
  solved: boolean;
}

export default function DashboardPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const res = await fetch('/api/challenges');
        const data = await res.json();
        setChallenges(data.challenges || []);
      } catch (err) {
        console.error('Failed to fetch challenges:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 p-6 rounded-lg">
            <p className="text-sm text-gray-500">Total Challenges</p>
            <p className="text-3xl font-bold text-blue-600">{challenges.length}</p>
          </div>
          <div className="bg-green-50 p-6 rounded-lg">
            <p className="text-sm text-gray-500">Solved</p>
            <p className="text-3xl font-bold text-green-600">
              {challenges.filter(c => c.solved).length}
            </p>
          </div>
          <div className="bg-purple-50 p-6 rounded-lg">
            <p className="text-sm text-gray-500">Total Points</p>
            <p className="text-3xl font-bold text-purple-600">
              {challenges.filter(c => c.solved).reduce((sum, c) => sum + c.points, 0)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading challenges...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {challenges.map((challenge) => (
              <div
                key={challenge.id}
                className={`p-4 border rounded-lg ${
                  challenge.solved ? 'border-green-300 bg-green-50' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{challenge.title}</h3>
                  <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {challenge.points} pts
                  </span>
                </div>
                <p className="text-sm text-gray-500">{challenge.category}</p>
                {challenge.solved && (
                  <span className="text-xs text-green-600 mt-2 inline-block">✓ Solved</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
