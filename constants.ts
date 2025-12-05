import { EnemyType, TowerType, EnemyConfig, TowerConfig, Vector2D } from './types';

export const GRID_SIZE = 40;
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const FPS = 60;

// Simple winding path for the enemies
export const PATH_WAYPOINTS: Vector2D[] = [
  { x: 0, y: 2 },
  { x: 5, y: 2 },
  { x: 5, y: 8 },
  { x: 12, y: 8 },
  { x: 12, y: 4 },
  { x: 18, y: 4 },
  { x: 18, y: 10 },
  { x: 8, y: 10 },
  { x: 8, y: 13 },
  { x: 20, y: 13 } // Exit
].map(p => ({ x: p.x * GRID_SIZE + GRID_SIZE / 2, y: p.y * GRID_SIZE + GRID_SIZE / 2 }));

export const ENEMY_STATS: Record<EnemyType, EnemyConfig> = {
  [EnemyType.SCOUT]: { speed: 2.5, hp: 30, bounty: 5, color: '#facc15', radius: 8 }, // Yellow
  [EnemyType.grunt]: { speed: 1.5, hp: 80, bounty: 10, color: '#f87171', radius: 12 }, // Red
  [EnemyType.TANK]: { speed: 0.8, hp: 300, bounty: 30, color: '#a855f7', radius: 16 }, // Purple
  [EnemyType.BOSS]: { speed: 0.4, hp: 2000, bounty: 200, color: '#ef4444', radius: 24 } // Deep Red
};

export const TOWER_STATS: Record<TowerType, TowerConfig> = {
  [TowerType.BLASTER]: {
    name: 'Pulse Turret',
    range: 120,
    damage: 15,
    cooldown: 20,
    cost: 50,
    color: '#38bdf8', // Sky Blue
    description: 'Rapid fire, single target energy weapon.'
  },
  [TowerType.SNIPER]: {
    name: 'Railgun',
    range: 250,
    damage: 100,
    cooldown: 90,
    cost: 150,
    color: '#84cc16', // Lime
    description: 'Long range, high damage, slow reload.'
  },
  [TowerType.CANNON]: {
    name: 'Plasma Mortar',
    range: 150,
    damage: 40,
    cooldown: 60,
    cost: 200,
    color: '#f97316', // Orange
    description: 'Deals splash damage to grouped enemies.'
  },
  [TowerType.SLOW]: {
    name: 'Stasis Field',
    range: 100,
    damage: 2,
    cooldown: 10,
    cost: 120,
    color: '#6366f1', // Indigo
    description: 'Slows down nearby enemies.'
  }
};

export const INITIAL_MONEY = 120;
export const INITIAL_LIVES = 20;
