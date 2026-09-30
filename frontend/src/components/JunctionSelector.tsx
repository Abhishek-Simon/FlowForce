import React, { useState, useMemo } from 'react';
import { Search, MapPin, X, ChevronDown } from 'lucide-react';
import { NagpurJunction } from '../data/nagpurJunctions';

interface JunctionSelectorProps {
  junctions: NagpurJunction[];
  selectedJunction: NagpurJunction;
  onSelectJunction: (junction: NagpurJunction) => void;
}

export default function JunctionSelector({
  junctions,
  selectedJunction,
  onSelectJunction,
}: JunctionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Case-insensitive, partial-match filtering
  const filteredJunctions = useMemo(() => {
    if (!searchTerm.trim()) return junctions;
    const term = searchTerm.toLowerCase().trim();
    return junctions.filter(
      (j) =>
        j.name.toLowerCase().includes(term) ||
        j.area.toLowerCase().includes(term) ||
        j.id.toLowerCase().includes(term)
    );
  }, [junctions, searchTerm]);

  // Group filtered junctions by area
  const groupedJunctions = useMemo(() => {
    const map: Record<string, NagpurJunction[]> = {};
    filteredJunctions.forEach((j) => {
      if (!map[j.area]) map[j.area] = [];
      map[j.area].push(j);
    });
    return map;
  }, [filteredJunctions]);

  const handleSelect = (j: NagpurJunction) => {
    onSelectJunction(j);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1c273e] p-3 rounded-lg shadow-xs space-y-2.5 font-mono">
      {/* Top Title & Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-[#1c273e] pb-2">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-blue-500" />
          <span className="text-xs font-bold uppercase text-slate-900 dark:text-white">
            4-Lane Traffic Matrix · Junction CCTV Selector
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 text-[10px]">SELECTED:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
            {selectedJunction.name} ({selectedJunction.area})
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              selectedJunction.status === 'online'
                ? selectedJunction.streamType === 'demo'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
            }`}
          >
            {selectedJunction.status === 'online'
              ? selectedJunction.streamType === 'demo'
                ? '🟡 DEMO CCTV FEED'
                : '🔴 LIVE'
              : '⚫ OFFLINE'}
          </span>
        </div>
      </div>

      {/* Selector Controls Bar: Search Input + Search Button + Dropdown + Clear */}
      <div className="flex flex-wrap items-center gap-2 relative">
        {/* Search Input Box */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search Chowraha... (e.g. sita, medical, sadar, var)"
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-[#121a2d] text-slate-900 dark:text-white border border-slate-200 dark:border-[#223048] rounded focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Dropdown Select Menu */}
        <div className="relative min-w-[220px]">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#121a2d] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#223048] rounded hover:border-blue-500 transition-colors cursor-pointer"
          >
            <span className="truncate">{selectedJunction.name}</span>
            <ChevronDown size={13} className="text-slate-400 ml-1 shrink-0" />
          </button>
        </div>

        {/* Clear / Reset Filter Button */}
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setIsOpen(false);
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-200 dark:bg-[#1c273e] hover:bg-slate-300 dark:hover:bg-[#253554] text-slate-700 dark:text-slate-300 rounded cursor-pointer transition-colors"
          >
            Reset
          </button>
        )}

        {/* Search Results / Dropdown Flyout */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1e293b] rounded-lg shadow-xl z-50 p-1.5 space-y-1.5">
            {Object.keys(groupedJunctions).length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No matching chowraha found for "{searchTerm}"
              </div>
            ) : (
              Object.entries(groupedJunctions).map(([area, jList]) => (
                <div key={area} className="space-y-0.5">
                  <div className="px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400 bg-slate-100 dark:bg-[#151f33] rounded">
                    {area}
                  </div>
                  {jList.map((j) => (
                    <div
                      key={j.id}
                      onClick={() => handleSelect(j)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                        selectedJunction.id === j.id
                          ? 'bg-blue-600 text-white font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-[#141f35] text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className={selectedJunction.id === j.id ? 'text-white' : 'text-blue-500'} />
                        <span>{j.name}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          j.status === 'online'
                            ? j.streamType === 'demo'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {j.status === 'online' ? (j.streamType === 'demo' ? 'DEMO' : 'LIVE') : 'OFFLINE'}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
