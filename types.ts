export type Vector2D = { x: number; y: number };

export enum EnemyType {
  SCOUT = 'SCOUT',
  grunt = 'GRUNT',
  TANK = 'TANK',
  BOSS = 'BOSS'
}

export enum TowerType {
  BLASTER = 'BLASTER', // Fast, low dmg
  CANNON = 'CANNON',   // Slow, AOE
  SNIPER = 'SNIPER',   // Long range, high dmg
  SLOW = 'SLOW'        // Low dmg, slows enemies
}

export interface EnemyConfig {
  speed: number;
  hp: number;
  bounty: number;
  color: string;
  radius: number;
}

export interface TowerConfig {
  name: string;
  range: number;
  damage: number;
  cooldown: number; // Frames between shots
  cost: number;
  color: string;
  description: string;
}

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  pathIndex: number;
  frozen: number; // Frames remaining frozen/slowed
  distanceTraveled: number; // For sorting targeting
}

export interface TowerEntity {
  id: string;
  type: TowerType;
  x: number;
  y: number; // Grid coordinates
  cooldownTimer: number;
  level: number;
  range: number;
  damage: number;
  fireRate: number; // Derived from cooldown
}

export interface ProjectileEntity {
  id: string;
  x: number;
  y: number;
  targetId: string;
  damage: number;
  speed: number;
  color: string;
  isAoE: boolean;
  slowEffect?: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface WaveComposition {
  enemies: {
    type: EnemyType;
    count: number;
    interval: number; // Frames between spawns
    hpMultiplier: number;
  }[];
  briefing: string; // Gemini generated text
}

export interface GameState {
  money: number;
  lives: number;
  wave: number;
  isPlaying: boolean;
  isGameOver: boolean;
  gameSpeed: number;
}
