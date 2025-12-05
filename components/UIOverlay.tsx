import React from 'react';
import { GameState, TowerType } from '../types';
import { TOWER_STATS } from '../constants';
import { Shield, Zap, Crosshair, Hexagon, Activity, Play, BrainCircuit, Wifi, WifiOff } from 'lucide-react';

interface UIOverlayProps {
    gameState: GameState;
    selectedTower: TowerType | null;
    setSelectedTower: (t: TowerType | null) => void;
    startNextWave: () => void;
    isWaveGenerating: boolean;
    waveBriefing: string;
    aiAdvice: string;
    isOnline: boolean;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({
    gameState,
    selectedTower,
    setSelectedTower,
    startNextWave,
    isWaveGenerating,
    waveBriefing,
    aiAdvice,
    isOnline
}) => {
    return (
        <div className="flex flex-col h-[600px] w-[300px] bg-slate-900/90 border-l border-slate-700 p-4 text-slate-100 font-sci-fi relative overflow-hidden">
            {/* Header / Stats */}
            <div className="mb-6 space-y-2 border-b border-slate-700 pb-4">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl text-cyan-400 font-bold uppercase tracking-widest">
                        Neon Defense
                    </h1>
                    <div className={`flex items-center text-xs px-2 py-1 rounded border ${isOnline ? 'border-green-800 bg-green-900/30 text-green-400' : 'border-red-800 bg-red-900/30 text-red-400'}`}>
                        {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                        {isOnline ? "ONLINE" : "OFFLINE"}
                    </div>
                </div>
                
                <div className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700">
                    <div className="flex items-center text-green-400">
                        <Hexagon className="w-5 h-5 mr-2" />
                        <span className="text-xl">{gameState.money}</span>
                    </div>
                    <div className="flex items-center text-red-400">
                        <Shield className="w-5 h-5 mr-2" />
                        <span className="text-xl">{gameState.lives}</span>
                    </div>
                    <div className="flex items-center text-yellow-400">
                        <Activity className="w-5 h-5 mr-2" />
                        <span className="text-xl">W-{gameState.wave}</span>
                    </div>
                </div>
            </div>

            {/* Build Menu */}
            <div className="flex-1 overflow-y-auto mb-4">
                <h3 className="text-sm text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">
                    Fabrication
                </h3>
                <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(TOWER_STATS) as TowerType[]).map((type) => {
                        const stats = TOWER_STATS[type];
                        const isSelected = selectedTower === type;
                        const canAfford = gameState.money >= stats.cost;
                        
                        return (
                            <button
                                key={type}
                                onClick={() => setSelectedTower(type)}
                                disabled={!canAfford}
                                className={`
                                    relative flex items-center p-3 rounded-lg border transition-all duration-200 text-left group
                                    ${isSelected ? 'bg-slate-800 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}
                                    ${!canAfford ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
                                `}
                            >
                                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0" style={{ backgroundColor: stats.color }}>
                                    {type === TowerType.BLASTER && <Zap className="text-white w-6 h-6" />}
                                    {type === TowerType.SNIPER && <Crosshair className="text-white w-6 h-6" />}
                                    {type === TowerType.CANNON && <Hexagon className="text-white w-6 h-6" />}
                                    {type === TowerType.SLOW && <Activity className="text-white w-6 h-6" />}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">{stats.name}</div>
                                    <div className="text-xs text-slate-400">Cost: <span className={canAfford ? "text-green-400" : "text-red-400"}>{stats.cost}</span></div>
                                </div>
                                {isSelected && (
                                    <div className="absolute right-2 top-2 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* AI Log */}
            <div className="mb-4 bg-black/40 p-3 rounded border border-slate-800 text-xs font-mono h-40 overflow-y-auto">
                 <h3 className="text-xs text-slate-500 uppercase mb-2 flex items-center">
                    <BrainCircuit className="w-3 h-3 mr-1" /> Tactical Uplink
                </h3>
                {waveBriefing && (
                    <div className="mb-2 text-cyan-200">
                        <span className="text-cyan-500 font-bold">>>> WAVE INTEL:</span> {waveBriefing}
                    </div>
                )}
                {aiAdvice && (
                    <div className="text-yellow-200">
                        <span className="text-yellow-500 font-bold">>>> COMMANDER:</span> {aiAdvice}
                    </div>
                )}
                {isWaveGenerating && (
                    <div className="text-green-400 animate-pulse">
                        >>> DECRYPTING ENEMY SIGNALS...
                    </div>
                )}
            </div>

            {/* Game Controls */}
            <div className="mt-auto">
                <button
                    onClick={startNextWave}
                    disabled={gameState.isPlaying || isWaveGenerating || gameState.isGameOver}
                    className={`
                        w-full py-4 text-lg font-bold uppercase tracking-widest flex items-center justify-center
                        rounded border-2 transition-all duration-300
                        ${gameState.isPlaying 
                            ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-wait' 
                            : 'bg-cyan-900/50 border-cyan-500 text-cyan-100 hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_20px_rgba(6,182,212,0.6)]'}
                    `}
                >
                   {isWaveGenerating ? (
                       <span className="animate-pulse">SCANNING...</span>
                   ) : gameState.isPlaying ? (
                       <span>WAVE IN PROGRESS</span>
                   ) : (
                       <>
                           <Play className="w-5 h-5 mr-2 fill-current" /> Initialize Wave
                       </>
                   )}
                </button>
            </div>
            
            {gameState.isGameOver && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center flex-col text-center p-6 backdrop-blur-sm">
                    <h2 className="text-4xl text-red-500 font-black mb-2 animate-pulse">CRITICAL FAILURE</h2>
                    <p className="text-slate-300 mb-6">Colony defenses breached at Wave {gameState.wave}.</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded uppercase tracking-wider"
                    >
                        Reboot System
                    </button>
                </div>
            )}
        </div>
    );
};