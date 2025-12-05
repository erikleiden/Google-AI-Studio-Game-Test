import React, { useRef, useEffect, useState } from 'react';
import { 
    CANVAS_WIDTH, CANVAS_HEIGHT, GRID_SIZE, PATH_WAYPOINTS, 
    ENEMY_STATS, TOWER_STATS, FPS 
} from '../constants';
import { 
    GameState, EnemyEntity, TowerEntity, ProjectileEntity, 
    Particle, TowerType, WaveComposition 
} from '../types';

interface GameCanvasProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    selectedTower: TowerType | null;
    waveComposition: WaveComposition | null;
    onWaveComplete: () => void;
    onGameOver: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
    gameState,
    setGameState,
    selectedTower,
    waveComposition,
    onWaveComplete,
    onGameOver
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();
    
    // Mutable Game State (Refs for performance)
    const enemiesRef = useRef<EnemyEntity[]>([]);
    const towersRef = useRef<TowerEntity[]>([]);
    const projectilesRef = useRef<ProjectileEntity[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const frameCountRef = useRef<number>(0);
    const spawnIndexRef = useRef<number>(0);
    const spawnTimerRef = useRef<number>(0);
    const enemiesToSpawnRef = useRef<WaveComposition['enemies']>([]);

    // Helper: Distance
    const dist = (x1: number, y1: number, x2: number, y2: number) => Math.sqrt((x2-x1)**2 + (y2-y1)**2);

    // Initial Setup
    useEffect(() => {
        if (waveComposition) {
            enemiesToSpawnRef.current = JSON.parse(JSON.stringify(waveComposition.enemies)); // Deep copy
            spawnIndexRef.current = 0;
            spawnTimerRef.current = 0;
            // Clear board only if needed, but usually we keep towers.
            // Enemies and projectiles are transient.
        }
    }, [waveComposition]);

    // Main Game Loop
    const update = () => {
        if (gameState.isGameOver || !gameState.isPlaying) return;

        // 1. Spawning Logic
        if (enemiesToSpawnRef.current.length > 0) {
            spawnTimerRef.current++;
            const currentGroup = enemiesToSpawnRef.current[0];
            
            if (spawnTimerRef.current >= currentGroup.interval) {
                spawnTimerRef.current = 0;
                
                // Spawn Enemy
                const stats = ENEMY_STATS[currentGroup.type];
                const startNode = PATH_WAYPOINTS[0];
                const newEnemy: EnemyEntity = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: currentGroup.type,
                    x: startNode.x,
                    y: startNode.y,
                    hp: stats.hp * currentGroup.hpMultiplier,
                    maxHp: stats.hp * currentGroup.hpMultiplier,
                    speed: stats.speed,
                    pathIndex: 0,
                    frozen: 0,
                    distanceTraveled: 0
                };
                enemiesRef.current.push(newEnemy);

                // Decrement count
                currentGroup.count--;
                if (currentGroup.count <= 0) {
                    enemiesToSpawnRef.current.shift(); // Next group
                }
            }
        } else if (enemiesRef.current.length === 0 && waveComposition) {
            // Wave Complete
             onWaveComplete();
        }

        // 2. Update Enemies
        enemiesRef.current.forEach(enemy => {
            if (enemy.frozen > 0) enemy.frozen--;
            
            const currentSpeed = enemy.frozen > 0 ? enemy.speed * 0.5 : enemy.speed;
            const targetNode = PATH_WAYPOINTS[enemy.pathIndex + 1];
            
            if (targetNode) {
                const dx = targetNode.x - enemy.x;
                const dy = targetNode.y - enemy.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance < currentSpeed) {
                    // Reached waypoint
                    enemy.x = targetNode.x;
                    enemy.y = targetNode.y;
                    enemy.pathIndex++;
                } else {
                    // Move towards waypoint
                    enemy.x += (dx / distance) * currentSpeed;
                    enemy.y += (dy / distance) * currentSpeed;
                }
                enemy.distanceTraveled += currentSpeed;
            } else {
                // Reached end of path (Base)
                enemy.hp = 0; // Kill entity
                setGameState(prev => {
                    const newLives = prev.lives - 1;
                    if (newLives <= 0) onGameOver();
                    return { ...prev, lives: newLives };
                });
            }
        });
        
        // Remove dead/finished enemies
        enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);

        // 3. Towers Fire
        towersRef.current.forEach(tower => {
            if (tower.cooldownTimer > 0) tower.cooldownTimer--;

            if (tower.cooldownTimer <= 0) {
                // Find Target
                let target: EnemyEntity | null = null;
                let maxDist = -1;

                // Simple targeting: First/Furthest along path in range
                for (const enemy of enemiesRef.current) {
                    const d = dist(tower.x, tower.y, enemy.x, enemy.y);
                    if (d <= tower.range) {
                        if (enemy.distanceTraveled > maxDist) {
                            maxDist = enemy.distanceTraveled;
                            target = enemy;
                        }
                    }
                }

                if (target) {
                    const stats = TOWER_STATS[tower.type];
                    tower.cooldownTimer = stats.cooldown;
                    
                    // Create Projectile
                    projectilesRef.current.push({
                        id: Math.random().toString(),
                        x: tower.x,
                        y: tower.y,
                        targetId: target.id,
                        damage: tower.damage,
                        speed: 10, // Projectile speed
                        color: stats.color,
                        isAoE: tower.type === TowerType.CANNON,
                        slowEffect: tower.type === TowerType.SLOW ? 60 : 0
                    });
                }
            }
        });

        // 4. Update Projectiles
        for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
            const p = projectilesRef.current[i];
            const target = enemiesRef.current.find(e => e.id === p.targetId);

            if (!target) {
                // Target dead, remove projectile
                projectilesRef.current.splice(i, 1);
                continue;
            }

            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance < p.speed) {
                // Hit!
                if (p.isAoE) {
                    // Splash damage
                    enemiesRef.current.forEach(e => {
                        if (dist(target.x, target.y, e.x, e.y) < 60) {
                            damageEnemy(e, p.damage);
                        }
                    });
                     // Explosion Particles
                    createParticles(target.x, target.y, p.color, 8);
                } else {
                    damageEnemy(target, p.damage);
                    if (p.slowEffect && p.slowEffect > 0) {
                        target.frozen = p.slowEffect;
                    }
                     // Hit Particles
                    createParticles(target.x, target.y, p.color, 3);
                }
                projectilesRef.current.splice(i, 1);
            } else {
                // Move
                p.x += (dx / distance) * p.speed;
                p.y += (dy / distance) * p.speed;
            }
        }

        // 5. Update Particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) particlesRef.current.splice(i, 1);
        }

        frameCountRef.current++;
    };

    const damageEnemy = (enemy: EnemyEntity, dmg: number) => {
        enemy.hp -= dmg;
        if (enemy.hp <= 0) {
            setGameState(prev => ({ ...prev, money: prev.money + ENEMY_STATS[enemy.type].bounty }));
            createParticles(enemy.x, enemy.y, ENEMY_STATS[enemy.type].color, 10);
        }
    };

    const createParticles = (x: number, y: number, color: string, count: number) => {
        for(let i=0; i<count; i++) {
            particlesRef.current.push({
                id: Math.random().toString(),
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 20 + Math.random() * 20,
                maxLife: 40,
                color,
                size: 2 + Math.random() * 3
            });
        }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        // Clear Background
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Grid (Subtle)
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CANVAS_HEIGHT);
        }
        for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
            ctx.moveTo(0, y);
            ctx.lineTo(CANVAS_WIDTH, y);
        }
        ctx.stroke();

        // Draw Path
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = GRID_SIZE / 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);
        for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
            ctx.lineTo(PATH_WAYPOINTS[i].x, PATH_WAYPOINTS[i].y);
        }
        ctx.stroke();

        // Path Center Line (Neon)
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0ea5e9';
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

        // Draw Towers
        towersRef.current.forEach(t => {
            const stats = TOWER_STATS[t.type];
            ctx.fillStyle = stats.color;
            ctx.shadowBlur = 15;
            ctx.shadowColor = stats.color;
            
            // Tower Base
            ctx.beginPath();
            ctx.arc(t.x, t.y, 14, 0, Math.PI * 2);
            ctx.fill();
            
            // Turret indication
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
            ctx.fill();

            // Range indicator if mouse over (handled simply by drawing all for now if needed, skipped for perf)
            ctx.shadowBlur = 0;
        });

        // Draw Enemies
        enemiesRef.current.forEach(e => {
            const stats = ENEMY_STATS[e.type];
            ctx.fillStyle = stats.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = stats.color;
            
            ctx.beginPath();
            if (e.type === 'TANK') {
                ctx.fillRect(e.x - stats.radius, e.y - stats.radius, stats.radius*2, stats.radius*2);
            } else {
                ctx.arc(e.x, e.y, stats.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Health Bar
            const hpPct = e.hp / e.maxHp;
            ctx.fillStyle = 'red';
            ctx.fillRect(e.x - 10, e.y - stats.radius - 8, 20, 4);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(e.x - 10, e.y - stats.radius - 8, 20 * hpPct, 4);

            ctx.shadowBlur = 0;
        });

        // Draw Projectiles
        projectilesRef.current.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Particles
        particlesRef.current.forEach(p => {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });
    };

    // Render Loop
    useEffect(() => {
        const loop = () => {
            update();
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) draw(ctx);
            }
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    });

    // Handle Clicks (Placement)
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!selectedTower || gameState.isGameOver) return;
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Snap to grid
        const gridX = Math.floor(mouseX / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
        const gridY = Math.floor(mouseY / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;

        // Validation 1: Enough Money?
        const stats = TOWER_STATS[selectedTower];
        if (gameState.money < stats.cost) return; // TODO: Visual feedback

        // Validation 2: Is Occupied?
        const isOccupied = towersRef.current.some(t => t.x === gridX && t.y === gridY);
        if (isOccupied) return;

        // Validation 3: Is on Path?
        // Note: We use a simple distance check to path waypoints segments for a quick check,
        // but since path is fixed lines, we can check line distance.
        // For this demo, we'll check if it's strictly on a grid cell that the path uses.
        // Or simpler: Just calculate distance to all path segments.
        let onPath = false;
        for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
            const p1 = PATH_WAYPOINTS[i];
            const p2 = PATH_WAYPOINTS[i+1];
            // Check if point is on segment
            // Since path is orthogonal, simple check
            const minX = Math.min(p1.x, p2.x) - GRID_SIZE/2;
            const maxX = Math.max(p1.x, p2.x) + GRID_SIZE/2;
            const minY = Math.min(p1.y, p2.y) - GRID_SIZE/2;
            const maxY = Math.max(p1.y, p2.y) + GRID_SIZE/2;
            
            if (gridX >= minX && gridX <= maxX && gridY >= minY && gridY <= maxY) {
                onPath = true;
                break;
            }
        }
        if (onPath) return;

        // Place Tower
        const newTower: TowerEntity = {
            id: Math.random().toString(),
            type: selectedTower,
            x: gridX,
            y: gridY,
            cooldownTimer: 0,
            level: 1,
            range: stats.range,
            damage: stats.damage,
            fireRate: stats.cooldown
        };

        towersRef.current.push(newTower);
        setGameState(prev => ({ ...prev, money: prev.money - stats.cost }));
        
        // Add placement particle
        createParticles(gridX, gridY, '#fff', 10);
    };

    return (
        <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            className="cursor-crosshair border border-slate-700 bg-black/50 shadow-2xl shadow-blue-900/20"
            style={{
                boxShadow: "0 0 50px -12px rgba(14, 165, 233, 0.25)"
            }}
        />
    );
};
