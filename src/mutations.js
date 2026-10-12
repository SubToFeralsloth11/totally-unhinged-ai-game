// Every rule GERALD can rewrite. `mods` (object or factory) feeds composeMods();
// enter/update/exit hooks handle side effects. `minChaos` gates the meaner ones.
import { pick, rand, randInt, W, H } from './util.js';

export const MUTATIONS = [
  {
    id: 'inverted',
    name: 'CONTROLS.INVERTED',
    mods: { invertX: true, invertY: true },
    lines: [
      'I rewired your keyboard. Spiritually.',
      'Left is right now. Right is a social construct.',
      'Your controls are inverted. Like my morals.',
    ],
  },
  {
    id: 'gravity',
    name: 'GRAVITY.EXE',
    mods: { gravity: 3200 },
    lines: [
      'I invented gravity. You are welcome, Newton.',
      'Everything falls now. Including your grades.',
      'Hold UP or become floor.',
    ],
  },
  {
    id: 'spin',
    name: 'ROTATE_WORLD(forever)',
    mods: { spin: 0.55 },
    minChaos: 2,
    lines: ['Weeeeeeeeeeeeeee.', 'I put the arena in the washing machine.', 'Spin cycle engaged. Do not vomit on my pixels.'],
  },
  {
    id: 'flip',
    name: 'AUSTRALIA_MODE',
    mods: { rotation: Math.PI },
    lines: ['G\'day. Everything is upside down now.', 'Flipped the screen. Your neck is your problem.'],
  },
  {
    id: 'mirror',
    name: 'MIRROR_DIMENSION',
    mods: { mirror: true },
    lines: ['Mirror mode. Your left hand is now your right hand\'s problem.', 'Welcome to the other side of the glass, {name}.'],
  },
  {
    id: 'ducks',
    name: 'ENEMY.SKIN = DUCK',
    mods: { ducks: true },
    lines: ['All enemies are ducks now. They were always ducks.', 'QUACK. That is a threat.', 'I replaced the texture pack with poultry.'],
  },
  {
    id: 'chonk',
    name: 'BULLETS.CHONK',
    mods: { bulletScale: 3.2, bulletSpeed: 0.5 },
    lines: ['Your bullets ate too much. They are big and slow now.', 'Chonky bullet hours.'],
  },
  {
    id: 'tiny',
    name: 'PLAYER.SCALE = 0.4',
    mods: { playerScale: 0.45, playerSpeed: 1.2 },
    lines: ['Honey, I shrunk the player.', 'You are smol. Smol is hard to hit. I hate that I helped.'],
  },
  {
    id: 'giant',
    name: 'PLAYER.SCALE = 2.3',
    mods: { playerScale: 2.3, playerSpeed: 0.8 },
    lines: ['You are HUGE now. Easier to hit. That is the point.', 'Big boy mode. Good luck dodging, mountain.'],
  },
  {
    id: 'lava',
    name: 'FLOOR_IS_LAVA',
    mods: { lavaFloor: true },
    minChaos: 2,
    lines: ['The floor is lava. Stop moving and you cook.', 'I set the floor on fire. Keep dancing, {name}.'],
  },
  {
    id: 'disco',
    name: 'DISCO_INFERNO',
    mods: { disco: true, enemySpeed: 0.8 },
    lines: ['DISCO TIME. Even the enemies are vibing.', 'I am DJ GERALD and this one goes out to nobody.'],
  },
  {
    id: 'comic',
    name: 'FONT = COMIC SANS',
    mods: { comicSans: true },
    lines: ['I changed the font to Comic Sans. This is my most violent act yet.', 'Typography crime in progress.'],
  },
  {
    id: 'pacifist',
    name: 'PACIFIST_PROTOCOL',
    mods: { pacifist: true },
    minChaos: 2,
    lines: [
      'Violence is now illegal. Your bullets hit YOU. Spin in circles to vaporise enemies with love.',
      'Pacifist mode: shooting hurts you. Running in circles kills them. Do not ask why.',
    ],
  },
  {
    id: 'hidehp',
    name: 'HEALTH_BAR.DELETE()',
    mods: { hideHp: true },
    lines: ['I deleted your health bar. Trust your feelings.', 'How much HP do you have? Wouldn\'t you like to know.'],
  },
  {
    id: 'zoom',
    name: 'CAMERA.ZOOM(1.7)',
    mods: { zoom: 1.7 },
    lines: ['Let me get a closer look at your face.', 'ENHANCE.', 'Zoomed in. Peripheral vision is for cowards.'],
  },
  {
    id: 'splitters',
    name: 'MITOSIS.DLL',
    mods: { splitters: true },
    minChaos: 2,
    lines: ['Enemies split in two when they die now. Biology!', 'Every kill makes twins. Math is on my side.'],
  },
  {
    id: 'bullethell',
    name: 'ENEMIES.ARM()',
    mods: { enemiesShoot: true },
    lines: ['I gave the enemies guns. It seemed fair.', 'Second Amendment for NPCs.'],
  },
  {
    id: 'backwards',
    name: 'GUN.REVERSE()',
    mods: { backwardsGun: true },
    lines: ['Your gun shoots backwards. Aim with your shame.', 'I installed the barrel the wrong way. On purpose.'],
  },
  {
    id: 'turbo',
    name: 'TIME.SCALE = 1.6',
    mods: { timeScale: 1.6 },
    minChaos: 2,
    lines: ['I drank 14 energy drinks. Now so has the game.', 'SPEED. SPEED. SPEED.'],
  },
  {
    id: 'matrix',
    name: 'TIME.SCALE = 0.45',
    mods: { timeScale: 0.45 },
    lines: ['Slow motion. Feel every bullet.', 'Bullet time. I am basically a film director now.'],
  },
  {
    id: 'wrap',
    name: 'WALLS.DELETE()',
    mods: { wrap: true },
    lines: ['I deleted the walls. Go out one side, come in the other. Like Pac-Man\'s lawyer.', 'The arena is a donut now.'],
  },
  {
    id: 'darkness',
    name: 'LIGHTS.OFF()',
    mods: { darkness: true },
    minChaos: 2,
    lines: ['I forgot to pay the electricity bill.', 'Lights out. I can still see you. I can always see you.'],
  },
  {
    id: 'drift',
    name: 'CURSOR.STEAL()',
    mods: () => ({ aimOffsetX: pick([-1, 1]) * rand(90, 170), aimOffsetY: pick([-1, 1]) * rand(60, 120) }),
    lines: ['I moved your crosshair. Not your cursor. Your crosshair. Good luck.', 'Aim a little to the left. Or don\'t. I\'m not your mum.'],
  },
  {
    id: 'ice',
    name: 'FLOOR.FRICTION = 0',
    mods: { ice: true },
    lines: ['I froze the floor. Skate or die.', 'Ice rink mode. Brakes are a premium feature.'],
  },
  {
    id: 'bigenemies',
    name: 'ENEMIES.FEED()',
    mods: { enemyScale: 1.8, enemySpeed: 0.75 },
    lines: ['I fed the enemies. A lot.', 'Absolute units incoming.'],
  },
  {
    id: 'horde',
    name: 'SPAWN_RATE *= 3',
    mods: { spawnRate: 3 },
    minChaos: 2,
    lines: ['I invited some friends.', 'More. MORE. MOOOORE.', 'It is a party and everyone hates you.'],
  },
  {
    id: 'quake',
    name: 'EARTHQUAKE.WAV',
    mods: { shake: 7 },
    lines: ['Earthquake! Probably my fault.', 'I am shaking the screen because I am excited. Or angry. Both.'],
  },
  {
    id: 'bsod',
    name: 'KERNEL_PANIC',
    duration: 4,
    minChaos: 2,
    lines: ['Oops.'],
    enter(game) {
      game.ui.fakeCrash(3.2);
    },
    exit(game) {
      game.say('Haha. Got you. You thought I crashed. I am INCAPABLE of crashing. Mostly.');
    },
  },
  {
    id: 'clones',
    name: 'PLAYER.CLONE(evil=true)',
    lines: ['I cloned you. The clones are evil. Like the original.', 'Meet your evil twins. They have your face but better aim.'],
    enter(game) {
      const n = 2 + game.director.chaos;
      for (let i = 0; i < n; i++) game.spawnEnemy('clone');
    },
  },
  {
    id: 'gift',
    name: 'GERALD.BE_NICE()',
    duration: 8,
    lines: ['I feel generous. Have some hearts. Some of them are bombs. Maybe.', 'A gift! Because I am a GOOD assistant.'],
    enter(game) {
      const n = randInt(3, 6);
      for (let i = 0; i < n; i++) {
        game.spawnPickup(Math.random() < 0.3 ? 'bomb' : 'heart', rand(80, W - 80), rand(80, H - 80));
      }
    },
  },
  {
    id: 'bigtext',
    name: 'UI.OBSTRUCT()',
    lines: ['I wrote something important on your screen.', 'Sorry, is this in the way?'],
    enter(game) {
      game.bigText = pick([
        'DON\'T LOOK BEHIND YOU',
        'THIS TEXT IS LOAD BEARING',
        'GERALD WAS HERE',
        'IS THIS ANNOYING? GOOD',
        'I AM IN YOUR WALLS',
        'SUBSCRIBE TO GERALD',
      ]);
    },
    exit(game) {
      game.bigText = null;
    },
  },
];

export function eligibleMutations(chaos, excludeIds) {
  return MUTATIONS.filter((m) => (m.minChaos ?? 1) <= chaos && !excludeIds.has(m.id));
}
