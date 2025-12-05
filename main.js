
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';
import { Shield, Zap, Crosshair, Hexagon, Activity, Play, Wifi, WifiOff, Terminal, AlertTriangle } from 'lucide-react';

// --- CONFIGURATION ---
const GRID_SIZE = 40;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const MODEL_NAME = 'gemini-2.5-flash';

// --- TYPES & CONSTANTS ---
const PATH_WAYPOINTS = [
    { x: 0, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 8 }, { x: 12, y: 8 },
    { x: 12, y: 3 }, { x: 17, y: 3 }, { x: 17, y: 11 }, { x: 8, y: 11 },
    { x: 8, y: 13 }, { x: 20, y: 13 }
].map(p => ({ x: p.x * GRID_SIZE + GRID_SIZE/2, y: p.y * GRID_SIZE + GRID_SIZE/2 }));

const TOWER_TYPES = {
    BLASTER: { name: 'PULSE', range: 120, damage: 15, cooldown: 20, cost: 60, color: '#38bdf8', icon: Zap },
    SNIPER: { name: 'RAILGUN', range: 300, damage: 120, cooldown: 90, cost: 150, color: '#84cc16', icon: Crosshair },
    CANNON: { name: 'MORTAR', range: 150, damage: 40, cooldown: 70, cost: 200, color: '#f97316', icon: Hexagon },
    SLOW: { name: 'STASIS', range: 100, damage: 2, cooldown: 10, cost: 100, color: '#6366f1', icon: Activity },
};

const ENEMY_TYPES = {
    SCOUT: { speed: 3.0, hp: 20, reward: 5, color: '#facc15', radius: 8 },
    GRUNT: { speed: 1.5, hp: 60, reward: 10, color: '#ef4444', radius: 12 },
    TANK: { speed: 0.8, hp: 250, reward: 30, color: '#a855f7', radius: 16 },
    BOSS: { speed: 0.4, hp: 1500, reward: 200, color: '#dc2626', radius: 24 },
};

// --- GEMINI SERVICE ---
const getClient = () => {
    try {
        // Safe check for API Key
        const key = window.process?.env?.API_KEY;
        if (!key || key.length < 5) return null;
        return new GoogleGenAI({ apiKey: key });
    } catch (e) {
        return null;
    }
};

const generateFallbackWave = (wave) => {
    const diff = 1 + (wave * 0.2);
    const enemies = [];
    
    // Procedural Logic
    enemies.push({ type: 'GRUNT', count: Math.floor(5 * diff), interval: 40 });
    if (wave > 2) enemies.push({ type: 'SCOUT', count: Math.floor(3 * diff), interval: 30 });
    if (wave > 4 && wave % 2 === 0) enemies.push({ type: 'TANK', count: Math.floor(wave/2), interval: 80 });
    if (wave % 10 === 0) enemies.push({ type: 'BOSS', count: 1, interval: 200 });

    return {
        briefing: `[OFFLINE PROTOCOL] Generating Wave ${wave} simulation.`,
        enemies
    };
};

const fetchWaveData = async (waveNumber) => {
    const ai = getClient();
    if (!ai) return generateFallbackWave(waveNumber);

    try {
        const prompt = `
            Generate Wave ${waveNumber} for a sci-fi tower defense.
            Enemies: SCOUT (Fast/Weak), GRUNT (Avg), TANK (Slow/Strong), BOSS (Epic).
            Return JSON: { briefing: "string", enemies: [{type: "ENUM", count: number, interval: number}] }
        `;
        
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        return JSON.parse(response.text);
    } catch (e) {
        console.error("AI Error", e);
        return generateFallbackWave(waveNumber);
    }
};

const fetchAdvice = async (wave, money, lives) => {
    const ai = getClient();
    if (!ai) return "Tactical uplink offline. Proceed with caution.";

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Commander, wave ${wave} incoming. Money: ${money}, Lives: ${lives}. Give 1 sentence of dark sci-fi advice.`,
        });
        return response.text;
    } catch (e) {
        return "Comms static...";
    }
};

// --- GAME COMPONENTS ---

const Game = () => {
    // State
    const [gameState, setGameState] = useState({
        money: 150,
        lives: 20,
        wave: 0,
        isPlaying: false,
        isGameOver: false
    });
    const [selectedTower, setSelectedTower] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isOnline, setIsOnline] = useState(false);
    
    // Refs for Game Loop (Mutable state for performance)
    const canvasRef = useRef(null);
    const entities = useRef({
        towers: [],
        enemies: [],
        projectiles: [],
        particles: [],
        spawnQueue: []
    });
    const loopRef = useRef();

    // Init
    useEffect(() => {
        setIsOnline(!!getClient());
        setMessages([{ id: 0, text: "SYSTEM INITIALIZED. WELCOME, COMMANDER.", source: 'SYSTEM' }]);
    }, []);

    // Helper: Add Message
    const addMessage = (text, source = 'SYSTEM') => {
        setMessages(prev => [...prev.slice(-4), { id: Date.now(), text, source }]);
    };

    // Wave Management
    const startWave = async () => {
        if (gameState.isPlaying) return;
        
        addMessage("ESTABLISHING UPLINK...", "SYSTEM");
        const nextWave = gameState.wave + 1;
        
        const data = await fetchWaveData(nextWave);
        addMessage(data.briefing, "INTEL");
        
        // Load Queue
        entities.current.spawnQueue = [];
        data.enemies.forEach(group => {
            for(let i=0; i<group.count; i++) {
                entities.current.spawnQueue.push({
                    type: group.type,
                    delay: i * group.interval
                });
            }
        });

        // Get Advice (Non-blocking)
        fetchAdvice(nextWave, gameState.money, gameState.lives).then(txt => addMessage(txt, "CMD"));

        setGameState(prev => ({ ...prev, wave: nextWave, isPlaying: true }));
    };

    // Canvas & Game Loop
    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        let frame = 0;

        const update = () => {
            if (gameState.isGameOver) return;
            frame++;

            // 1. Spawning
            if (gameState.isPlaying && entities.current.spawnQueue.length > 0) {
                // Check if ready to spawn next
                // Simple logic: Decrement delay of first item
                if (entities.current.spawnQueue[0].delay > 0) {
                    entities.current.spawnQueue[0].delay--;
                } else {
                    const next = entities.current.spawnQueue.shift();
                    const stats = ENEMY_TYPES[next.type];
                    entities.current.enemies.push({
                        ...stats,
                        id: Math.random(),
                        x: PATH_WAYPOINTS[0].x,
                        y: PATH_WAYPOINTS[0].y,
                        pathIdx: 0,
                        maxHp: stats.hp,
                        frozen: 0
                    });
                }
            } else if (gameState.isPlaying && entities.current.spawnQueue.length === 0 && entities.current.enemies.length === 0) {
                // Wave Complete
                setGameState(prev => ({ ...prev, isPlaying: false }));
                addMessage(`WAVE ${gameState.wave} COMPLETE.`, "SYSTEM");
            }

            // 2. Update Enemies
            entities.current.enemies.forEach(e => {
                const target = PATH_WAYPOINTS[e.pathIdx + 1];
                if (!target) {
                    e.reachedBase = true;
                    return;
                }
                
                const speed = e.frozen > 0 ? e.speed * 0.5 : e.speed;
                if (e.frozen > 0) e.frozen--;

                const dx = target.x - e.x;
                const dy = target.y - e.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < speed) {
                    e.x = target.x;
                    e.y = target.y;
                    e.pathIdx++;
                } else {
                    e.x += (dx/dist) * speed;
                    e.y += (dy/dist) * speed;
                }
            });

            // Handle Base Hits
            const leakers = entities.current.enemies.filter(e => e.reachedBase);
            if (leakers.length > 0) {
                setGameState(prev => {
                    const newLives = prev.lives - leakers.length;
                    if (newLives <= 0) return { ...prev, lives: 0, isGameOver: true, isPlaying: false };
                    return { ...prev, lives: newLives };
                });
                entities.current.enemies = entities.current.enemies.filter(e => !e.reachedBase);
            }

            // 3. Towers Fire
            entities.current.towers.forEach(t => {
                if (t.cd > 0) t.cd--;
                else {
                    // Find Target
                    const target = entities.current.enemies.find(e => {
                        const d = Math.sqrt((e.x - t.x)**2 + (e.y - t.y)**2);
                        return d <= t.range;
                    });

                    if (target) {
                        t.cd = t.maxCd;
                        entities.current.projectiles.push({
                            x: t.x, y: t.y,
                            targetId: target.id,
                            damage: t.damage,
                            color: t.color,
                            isSlow: t.name === 'STASIS',
                            isAoe: t.name === 'MORTAR'
                        });
                    }
                }
            });

            // 4. Update Projectiles
            entities.current.projectiles = entities.current.projectiles.filter(p => {
                const target = entities.current.enemies.find(e => e.id === p.targetId);
                if (!target) return false;

                const dx = target.x - p.x;
                const dy = target.y - p.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const speed = 12;

                if (dist < speed) {
                    // Hit
                    target.hp -= p.damage;
                    if (p.isSlow) target.frozen = 60;
                    
                    // Particles
                    for(let i=0; i<5; i++) {
                        entities.current.particles.push({
                            x: target.x, y: target.y,
                            vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4,
                            life: 20, color: p.color
                        });
                    }

                    if (target.hp <= 0) {
                        setGameState(prev => ({ ...prev, money: prev.money + target.reward }));
                    }
                    return false;
                }
                
                p.x += (dx/dist) * speed;
                p.y += (dy/dist) * speed;
                return true;
            });

            // Cleanup Dead Enemies
            entities.current.enemies = entities.current.enemies.filter(e => e.hp > 0);

            // 5. Update Particles
            entities.current.particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.life--;
            });
            entities.current.particles = entities.current.particles.filter(p => p.life > 0);
        };

        const draw = () => {
            // Clear
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Grid
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(let i=0; i<=CANVAS_WIDTH; i+=GRID_SIZE) { ctx.moveTo(i,0); ctx.lineTo(i,CANVAS_HEIGHT); }
            for(let i=0; i<=CANVAS_HEIGHT; i+=GRID_SIZE) { ctx.moveTo(0,i); ctx.lineTo(CANVAS_WIDTH,i); }
            ctx.stroke();

            // Path
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = GRID_SIZE;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);
            PATH_WAYPOINTS.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();

            // Path Line
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#0ea5e9';
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Towers
            entities.current.towers.forEach(t => {
                ctx.fillStyle = t.color;
                ctx.beginPath();
                ctx.arc(t.x, t.y, 15, 0, Math.PI*2);
                ctx.fill();
            });

            // Enemies
            entities.current.enemies.forEach(e => {
                ctx.fillStyle = e.color;
                ctx.beginPath();
                if (e.type === 'TANK') ctx.rect(e.x-e.radius, e.y-e.radius, e.radius*2, e.radius*2);
                else ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2);
                ctx.fill();

                // HP Bar
                ctx.fillStyle = 'red';
                ctx.fillRect(e.x-10, e.y-20, 20, 4);
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(e.x-10, e.y-20, 20 * (e.hp/e.maxHp), 4);
            });

            // Projectiles
            entities.current.projectiles.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
                ctx.fill();
            });

            // Particles
            entities.current.particles.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life / 20;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
            });
        };

        const loop = () => {
            update();
            draw();
            loopRef.current = requestAnimationFrame(loop);
        };
        loopRef.current = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(loopRef.current);
    }, [gameState.isPlaying, gameState.isGameOver]);

    // Input Handling
    const handleCanvasClick = (e) => {
        if (!selectedTower || gameState.isGameOver) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const gx = Math.floor(x/GRID_SIZE) * GRID_SIZE + GRID_SIZE/2;
        const gy = Math.floor(y/GRID_SIZE) * GRID_SIZE + GRID_SIZE/2;

        const type = TOWER_TYPES[selectedTower];
        if (gameState.money < type.cost) return;
        
        // Simple overlap check
        if (entities.current.towers.some(t => t.x === gx && t.y === gy)) return;

        // Path check (Simple: check against path segments)
        // ... (Skipped for brevity in zero-build logic, relying on visual)

        entities.current.towers.push({
            x: gx, y: gy,
            ...type,
            maxCd: type.cooldown,
            cd: 0
        });
        
        setGameState(prev => ({ ...prev, money: prev.money - type.cost }));
        setSelectedTower(null);
    };

    // --- UI RENDER ---
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="flex border border-slate-800 rounded-xl overflow-hidden shadow-2xl bg-slate-900/90 max-w-6xl w-full">
                
                {/* GAME VIEW */}
                <div className="relative">
                    <canvas 
                        ref={canvasRef} 
                        width={CANVAS_WIDTH} 
                        height={CANVAS_HEIGHT}
                        onClick={handleCanvasClick}
                        className="cursor-crosshair block"
                    />
                    
                    {gameState.isGameOver && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col">
                            <h1 className="text-6xl text-red-500 font-orbitron font-bold mb-4 animate-pulse">CRITICAL FAILURE</h1>
                            <button 
                                onClick={() => window.location.reload()}
                                className="px-8 py-3 bg-red-600 text-white font-bold hover:bg-red-500 font-orbitron"
                            >
                                SYSTEM REBOOT
                            </button>
                        </div>
                    )}
                </div>

                {/* SIDEBAR UI */}
                <div className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col p-4 font-orbitron">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                        <div className="text-cyan-400 font-bold text-xl tracking-wider">NEON // DEFENSE</div>
                        <div className={`flex items-center text-xs px-2 py-1 rounded border ${isOnline ? 'border-green-900 text-green-400' : 'border-amber-900 text-amber-500'}`}>
                            {isOnline ? <Wifi className="w-3 h-3 mr-1"/> : <WifiOff className="w-3 h-3 mr-1"/>}
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-6">
                        <div className="bg-slate-900 p-2 rounded border border-slate-800 flex items-center text-green-400">
                            <Hexagon className="w-5 h-5 mr-2" /> <span>{Math.floor(gameState.money)}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800 flex items-center text-red-400">
                            <Shield className="w-5 h-5 mr-2" /> <span>{gameState.lives}</span>
                        </div>
                    </div>

                    {/* Towers */}
                    <div className="flex-1 space-y-2 mb-4">
                        <h3 className="text-xs text-slate-500 mb-2">FABRICATION</h3>
                        {Object.entries(TOWER_TYPES).map(([key, tower]) => {
                            const canAfford = gameState.money >= tower.cost;
                            const Icon = tower.icon;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedTower(key)}
                                    disabled={!canAfford}
                                    className={`w-full flex items-center p-3 rounded border transition-all ${
                                        selectedTower === key 
                                            ? 'bg-slate-800 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                                            : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                                    } ${!canAfford ? 'opacity-40 grayscale' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3" style={{background: tower.color}}>
                                        <Icon className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-slate-200">{tower.name}</div>
                                        <div className="text-xs text-slate-500">${tower.cost}</div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Logs */}
                    <div className="h-40 bg-black/50 rounded border border-slate-800 p-3 mb-4 overflow-y-auto font-mono text-xs">
                        {messages.map(m => (
                            <div key={m.id} className="mb-2">
                                <span className={`font-bold ${m.source === 'SYSTEM' ? 'text-slate-500' : m.source === 'INTEL' ? 'text-cyan-500' : 'text-yellow-500'}`}>
                                    [{m.source}]
                                </span> <span className="text-slate-300">{m.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Start Button */}
                    <button
                        onClick={startWave}
                        disabled={gameState.isPlaying || gameState.isGameOver}
                        className={`w-full py-4 font-bold uppercase tracking-widest flex items-center justify-center rounded transition-all ${
                            gameState.isPlaying 
                            ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
                            : 'bg-cyan-900/40 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-black shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        }`}
                    >
                        {gameState.isPlaying ? 'WAVE IN PROGRESS' : <><Play className="w-4 h-4 mr-2" /> INITIATE WAVE</>}
                    </button>

                </div>
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(<Game />);
