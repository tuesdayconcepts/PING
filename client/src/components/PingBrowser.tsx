import { useState, useMemo } from 'react';
import { Radio, Waves, ChevronDown, ChevronUp } from 'lucide-react';
import { Hotspot } from '../types';
import { calculateDistance, formatDistance } from '../utils/distance';
import './PingBrowser.css';

interface PingBrowserProps {
  hotspots: Hotspot[];
  userLocation: { lat: number; lng: number } | null;
  onSelectPing: (hotspot: Hotspot) => void;
  onRequestLocation: () => void;
}

// Sort options for the browser
type SortOption = 'prize' | 'distance';

/**
 * Compact card component for displaying a single ping
 */
const PingCard = ({
  hotspot,
  distance,
  onClick,
}: {
  hotspot: Hotspot;
  distance: number | null;
  onClick: () => void;
}) => {
  const isNFC = hotspot.claimType === 'nfc' || !hotspot.claimType;
  
  return (
    <button className="ping-card" onClick={onClick}>
      <div className="ping-card-row">
        <span className="ping-card-icon">
          {isNFC ? <Radio size={16} /> : <Waves size={16} />}
        </span>
        <span className="ping-card-prize">
          {hotspot.prize !== null ? `${hotspot.prize} SOL` : 'TBD'}
        </span>
      </div>
      {/* Distance row always takes space to prevent layout shift */}
      <div className="ping-card-distance">
        {distance !== null ? formatDistance(distance) : '\u00A0'}
      </div>
    </button>
  );
};

/**
 * Collapsible browser component for browsing active pings
 */
export const PingBrowser = ({
  hotspots,
  userLocation,
  onSelectPing,
  onRequestLocation,
}: PingBrowserProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('prize');

  // Calculate distances for all hotspots (null if no user location)
  const hotspotsWithDistance = useMemo(() => {
    return hotspots.map((hotspot) => ({
      hotspot,
      distance: userLocation
        ? calculateDistance(
            userLocation.lat,
            userLocation.lng,
            hotspot.lat,
            hotspot.lng
          )
        : null,
    }));
  }, [hotspots, userLocation]);

  // Sort hotspots based on selected option
  const sortedHotspots = useMemo(() => {
    const sorted = [...hotspotsWithDistance];
    
    if (sortBy === 'prize') {
      // Sort by prize (highest first), nulls last
      sorted.sort((a, b) => {
        const prizeA = a.hotspot.prize ?? -1;
        const prizeB = b.hotspot.prize ?? -1;
        return prizeB - prizeA;
      });
    } else if (sortBy === 'distance' && userLocation) {
      // Sort by distance (closest first)
      sorted.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }
    
    return sorted;
  }, [hotspotsWithDistance, sortBy, userLocation]);

  // Handle sort option change
  const handleSortChange = (option: SortOption) => {
    if (option === 'distance' && !userLocation) {
      // Request location permission when user tries to sort by distance
      onRequestLocation();
    }
    setSortBy(option);
  };

  // Handle card click
  const handleCardClick = (hotspot: Hotspot) => {
    onSelectPing(hotspot);
  };

  // Don't render if no active hotspots
  if (hotspots.length === 0) {
    return null;
  }

  return (
    <div className={`ping-browser ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Collapsed state: just a button */}
      {!isExpanded && (
        <button
          className="ping-browser-toggle"
          onClick={() => setIsExpanded(true)}
        >
          <span>ACTIVE PINGS</span>
          <span className="ping-count">{hotspots.length}</span>
          <ChevronUp size={18} />
        </button>
      )}

      {/* Expanded state: carousel with sort options */}
      {isExpanded && (
        <div className="ping-browser-content">
          {/* Header with sort options and close button */}
          <div className="ping-browser-header">
            <div className="ping-browser-sort">
              <button
                className={`sort-btn ${sortBy === 'prize' ? 'active' : ''}`}
                onClick={() => handleSortChange('prize')}
              >
                Prize
              </button>
              <button
                className={`sort-btn ${sortBy === 'distance' ? 'active' : ''}`}
                onClick={() => handleSortChange('distance')}
              >
                Distance
              </button>
            </div>
            <button
              className="ping-browser-close"
              onClick={() => setIsExpanded(false)}
            >
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Horizontally scrollable card carousel */}
          <div className="ping-browser-carousel">
            {sortedHotspots.map(({ hotspot, distance }) => (
              <PingCard
                key={hotspot.id}
                hotspot={hotspot}
                distance={sortBy === 'distance' ? distance : null}
                onClick={() => handleCardClick(hotspot)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

