'use client';

import { useEffect, useState } from 'react';
import { raceResultsApi, RaceDistance } from '@/lib/api';

interface RaceDistanceTabsProps {
  selectedDistance: string | null;
  onDistanceChange: (courseId: string) => void;
}

export default function RaceDistanceTabs({ selectedDistance, onDistanceChange }: RaceDistanceTabsProps) {
  const [distances, setDistances] = useState<RaceDistance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDistances = async () => {
      try {
        const data = await raceResultsApi.getDistances();
        setDistances(data);
        // Auto-select first distance if none selected
        if (!selectedDistance && data.length > 0) {
          onDistanceChange(data[0].course_id);
        }
      } catch (error) {
        console.error('Failed to fetch distances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDistances();
  }, []);

  if (loading) {
    return (
      <div className="flex gap-2 justify-center animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 w-20 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {distances.map((distance) => {
        const isSelected = selectedDistance === distance.course_id;
        return (
          <button
            key={distance.course_id}
            onClick={() => onDistanceChange(distance.course_id)}
            className={`px-4 py-3 font-black text-sm uppercase tracking-wider rounded-lg transition-all duration-300 transform hover:scale-105 ${
              isSelected
                ? 'bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white shadow-lg'
                : 'bg-white text-[#2563EB] border-2 border-[#2563EB] hover:bg-[#2563EB] hover:text-white'
            }`}
          >
            {distance.distance}
          </button>
        );
      })}
    </div>
  );
}
