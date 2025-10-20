import './HotspotSkeleton.css';

export const HotspotSkeleton = () => {
  return (
    <div className="hotspot-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-title"></div>
        <div className="skeleton-badge"></div>
      </div>
      <div className="skeleton-location"></div>
      <div className="skeleton-footer">
        <div className="skeleton-prize"></div>
        <div className="skeleton-actions">
          <div className="skeleton-icon"></div>
          <div className="skeleton-icon"></div>
        </div>
      </div>
    </div>
  );
};

export const HotspotSkeletonList = ({ count = 3 }: { count?: number }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <HotspotSkeleton key={i} />
      ))}
    </>
  );
};

