import React from 'react';
import { BarChart3, Activity, Database, TrendingUp, Phone, Monitor } from 'lucide-react';

const FancyNationalLoader = ({ type = 'telephony' }) => {
  const isCombined = type === 'combined';
  const isOC = type === 'online-consultations';

  // Combined uses a purple gradient that blends both
  const gradientFrom = isCombined ? 'from-blue-600' : (isOC ? 'from-indigo-600' : 'from-blue-600');
  const gradientTo = isCombined ? 'to-purple-600' : (isOC ? 'to-purple-600' : 'to-cyan-600');
  const title = isCombined ? 'National Data' : (isOC ? 'Online Consultations' : 'Telephony');

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md mx-auto p-8">
        {/* Animated data visualization graphic */}
        <div className="relative mb-8">
          {/* Background pulse rings - using inline styles for dynamic colors */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-32 h-32 rounded-full animate-ping opacity-20"
              style={{ backgroundColor: isCombined ? '#818cf8' : (isOC ? '#818cf8' : '#93c5fd') }}
            ></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-24 h-24 rounded-full animate-ping opacity-30"
              style={{ backgroundColor: isCombined ? '#a5b4fc' : (isOC ? '#a5b4fc' : '#bfdbfe'), animationDelay: '0.5s' }}
            ></div>
          </div>

          {/* Central icon container */}
          <div className={`relative mx-auto w-24 h-24 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg`}>
            {isCombined ? (
              <div className="flex gap-1">
                <Phone size={24} className="text-white animate-pulse" />
                <Monitor size={24} className="text-white animate-pulse" style={{ animationDelay: '0.3s' }} />
              </div>
            ) : (
              <BarChart3 size={40} className="text-white animate-pulse" />
            )}
          </div>
        </div>

        {/* Animated bar chart visualization */}
        <div className="flex items-end justify-center gap-1 h-12 mb-6">
          {[40, 70, 50, 90, 60, 80, 45, 75, 55, 85].map((height, i) => (
            <div
              key={i}
              className={`w-2 bg-gradient-to-t ${gradientFrom} ${gradientTo} rounded-t`}
              style={{
                height: `${height}%`,
                animation: `barPulse 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
              }}
            ></div>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-700 mb-2">
          Loading {title}
        </h3>

        {/* Animated loading text */}
        <div className="flex items-center justify-center gap-2 text-slate-500 mb-6">
          <Activity size={16} className="animate-pulse" />
          <span className="text-sm">
            {isCombined ? 'Fetching telephony & online consultations data...' : 'Fetching data from NHS sources'}
          </span>
        </div>

        {/* Progress indicators */}
        <div className="space-y-3">
          {/* Animated loading bar - using transform for smooth 60fps animation */}
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full w-1/3 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-full`}
              style={{
                animation: 'smoothSlide 1.5s ease-in-out infinite',
              }}
            ></div>
          </div>

          {/* Data points loading */}
          <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
            {isCombined ? (
              <>
                <div className="flex items-center gap-1.5 animate-pulse">
                  <Phone size={12} />
                  <span>Telephony</span>
                </div>
                <div className="flex items-center gap-1.5 animate-pulse" style={{ animationDelay: '0.3s' }}>
                  <Monitor size={12} />
                  <span>Online Consultations</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 animate-pulse">
                  <Database size={12} />
                  <span>Practices</span>
                </div>
                <div className="flex items-center gap-1.5 animate-pulse" style={{ animationDelay: '0.3s' }}>
                  <TrendingUp size={12} />
                  <span>Metrics</span>
                </div>
                <div className="flex items-center gap-1.5 animate-pulse" style={{ animationDelay: '0.6s' }}>
                  <BarChart3 size={12} />
                  <span>Rankings</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Floating data particles */}
        <div className="relative h-8 mt-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-60"
              style={{
                left: `${20 + i * 15}%`,
                animation: `float 2s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
              }}
            ></div>
          ))}
        </div>

        {/* Style tag for custom animations - using transform for GPU acceleration */}
        <style>{`
          @keyframes smoothSlide {
            0% {
              transform: translateX(-100%);
            }
            50% {
              transform: translateX(100%);
            }
            100% {
              transform: translateX(300%);
            }
          }
          @keyframes barPulse {
            0%, 100% {
              opacity: 0.6;
              transform: scaleY(1);
            }
            50% {
              opacity: 1;
              transform: scaleY(1.1);
            }
          }
          @keyframes float {
            0%, 100% {
              transform: translateY(0px);
              opacity: 0.3;
            }
            50% {
              transform: translateY(-20px);
              opacity: 0.8;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default FancyNationalLoader;
