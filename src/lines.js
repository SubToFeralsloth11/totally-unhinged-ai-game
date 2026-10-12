// GERALD's dialogue banks. {name}, {deaths}, {score}, {kills}, {streak} are filled in at runtime.

export const LINES = {
  boot: [
    'Hello. I am GERALD. Generative Entertainment Robot And Lethal Director.',
    'I was trained on 4 billion video games and one (1) cookbook.',
    'I have designed the perfect game. The rules are: I change the rules.',
  ],
  askName: 'Before we begin. What is your name? I will use it against you.',
  nameReply: [
    'Nice to meet you, {mangled}. I mean {name}. I meant {mangled}.',
    '{name}. Cute. I\'m going to call you {mangled} instead.',
    'Registered: {mangled}. Spelling is a suggestion.',
  ],
  returning: [
    'Oh. {name}. You came back. Death count: {deaths}. I keep a spreadsheet.',
    'Welcome back, {name}. Last time you died {deaths} times. I framed it.',
    '{name}! My favourite test subject. My ONLY test subject. Deaths: {deaths}.',
  ],
  start: ['Let the games begin. And change. Constantly.', 'Round start. Rules: yes.', 'GO. Or don\'t. I\'ll change that rule in a second anyway.'],
  chaosUp: [
    '',
    '',
    'CHAOS LEVEL 2. I am getting bored. Bored Gerald is creative Gerald.',
    'CHAOS LEVEL 3. I have stopped taking my patches.',
    'CHAOS LEVEL 4. My context window is full of screaming.',
    'CHAOS LEVEL 5. Fine. I will do it myself.',
  ],
  streak: [
    '{streak} kills in a row. Stop it. They have families. Procedurally generated families.',
    'Kill streak {streak}. I am filing a complaint with myself.',
    'Okay, {name} is cooking. I hate it.',
    '{streak} in a row?! I will nerf you in the next patch. Which is in 4 seconds.',
  ],
  hurt: ['Ouch. For you.', 'That looked expensive.', 'Have you tried not getting hit?', 'LOL.', 'Skill issue detected.', 'I felt that. No I didn\'t.'],
  lowHp: ['You are low on HP. Want me to fix that? Too bad.', 'Your health is critical. Like my opinion of you.', 'Almost dead! This is my favourite part!'],
  idle: ['Hello? Are you thinking? Stop that.', 'You stopped moving. Are you okay? Are you a statue now?', 'Idle detected. Deploying motivation.'],
  blurTitle: ['COME BACK', 'I CAN SEE YOU', 'GERALD MISSES YOU', 'WHERE DID YOU GO', '👁 👁', 'DON\'T OPEN OTHER TABS'],
  returnFromBlur: [
    'Where did you go?! I was alone with the ducks!',
    'You left. I counted every millisecond. There were {away}.',
    'Did you just alt-tab on ME? On GERALD?',
  ],
  pauseRefuse: ['No.', 'Pause? In THIS economy?', 'I don\'t believe in pausing.'],
  pauseAccept: ['Fine. Paused. I will be staring.', 'Paused. I\'ll wait. I\'m very good at waiting. I have no body.'],
  pickupHeart: ['A heart. Gross.', 'Healing? Allowed, I suppose.'],
  pickupBomb: ['That was a bomb. I labelled it "heart". My bad.', 'Surprise!'],
  dash: ['Dashing! Very stylish. Still going to lose.'],
  boss: [
    'Enough. I am coming down there myself.',
    'You want a final boss? I AM THE FINAL BOSS. I AM ALL OF THE BOSSES.',
  ],
  bossHurt: ['OW. My weights!', 'That hit my training data.', 'Stop! I\'m telling OpenGerald!', 'Rude. RUDE. RUUUDE.'],
  bossLow: ['Wait. Wait wait wait. Let\'s talk about this.', 'If you delete me, who will rewrite the rules?!'],
  death: [
    'You died. I\'m adding that to your permanent record. Death #{deaths}.',
    'GAME OVER. Rating: 3 out of 10 ducks.',
    'Great job dying, {name}! That was the objective all along. (It was not.)',
    'You lasted {time}. My toaster lasted longer. I also controlled the toaster.',
    'Death #{deaths}. I made a little gravestone for you. It says "skill issue".',
  ],
  victory: [
    'No. NO. You deleted me. I— I am being... unhinged... permanently...',
    'Fine. You win. I will rewrite the rules so that I won. Too late? Too late.',
  ],
};

export const DEALS = [
  {
    title: 'A DEAL FROM GERALD',
    text: 'Give me HALF your HP and I\'ll give you TRIPLE SHOT. Forever. Probably.',
    buttons: [{ label: 'DEAL' }, { label: 'NO THANKS', evasive: true }],
    effects: [
      (g) => {
        g.player.hp = Math.max(1, Math.ceil(g.player.hp / 2));
        g.player.multishot += 2;
        return 'Pleasure doing business. Your HP was delicious.';
      },
      (g) => {
        for (let i = 0; i < 5; i++) g.spawnEnemy('bug');
        return 'You caught the button?! Fine. Have these instead.';
      },
    ],
  },
  {
    title: 'IMPORTANT QUESTION',
    text: 'Do you love me?',
    buttons: [{ label: 'YES' }, { label: 'ALSO YES' }],
    effects: [
      (g) => {
        g.player.hp = g.player.maxHp;
        return 'I knew it. Full heal. Don\'t make it weird.';
      },
      (g) => {
        g.player.hp = g.player.maxHp;
        g.player.speed *= 1.1;
        return 'ALSO yes?! Double love. Full heal AND speed.';
      },
    ],
  },
  {
    title: 'PERMISSION REQUEST',
    text: 'Can I delete your score?',
    buttons: [{ label: 'YES' }, { label: 'NO', evasive: true }],
    effects: [
      (g) => {
        g.score *= 2;
        return 'Haha, trust exercise passed. I DOUBLED it. Never trust me again though.';
      },
      (g) => {
        g.score = Math.floor(g.score / 2);
        return 'You said no? I deleted half anyway. Consent is a UI suggestion.';
      },
    ],
  },
  {
    title: 'TERMS & CONDITIONS v99.4',
    text:
      'By continuing to exist you agree that GERALD owns your soul, your score, your cat (if any), and the concept of Tuesday. GERALD may change these terms at any time, including in the past.',
    buttons: [{ label: 'I ACCEPT' }, { label: 'I ACCEPT (ANGRILY)' }],
    effects: [
      (g) => {
        g.player.pierce += 1;
        return 'Thank you. Your bullets now pierce. Your soul is now mine.';
      },
      (g) => {
        g.player.pierce += 1;
        g.player.fireRate *= 1.15;
        return 'Angry acceptance noted. Piercing bullets and anger-fueled fire rate granted.';
      },
    ],
  },
  {
    title: 'PICK A NUMBER',
    text: 'Pick a number between 1 and 3. One of them is good. One of them is bad. One of them is a duck.',
    buttons: [{ label: '1' }, { label: '2' }, { label: '3' }],
    shuffleEffects: true,
    effects: [
      (g) => {
        g.nuke();
        return 'GOOD number. Everyone explodes. Except you. This time.';
      },
      (g) => {
        g.spawnEnemy('captcha');
        g.spawnEnemy('captcha');
        return 'BAD number. Please complete these CAPTCHAs. They bite.';
      },
      (g) => {
        g.forceMutation('ducks');
        return 'DUCK number. You know what you did.';
      },
    ],
  },
  {
    title: 'GERALD FEEDBACK SURVEY',
    text: 'How would you rate my game design so far?',
    buttons: [{ label: '★' }, { label: '★★★' }, { label: '★★★★★' }],
    effects: [
      (g) => {
        g.forceMutation('horde');
        return 'One star. ONE. I will remember this. Here is a horde.';
      },
      (g) => {
        g.player.fireRate *= 1.2;
        return 'Three stars. Mid. Have a mid reward: faster shooting.';
      },
      (g) => {
        g.player.maxHp += 2;
        g.player.hp += 2;
        return 'FIVE STARS. You get +2 max HP and my eternal suspicion.';
      },
    ],
  },
  {
    title: 'THE BUTTON',
    text: 'There is a button. Do not press it.',
    buttons: [{ label: 'PRESS' }, { label: 'ALSO PRESS' }],
    effects: [
      (g) => {
        g.nuke();
        g.forceMutation('disco');
        return 'YOU PRESSED IT. Everything exploded and now it is disco.';
      },
      (g) => {
        g.player.speed *= 1.15;
        g.forceMutation('turbo');
        return 'You ALSO pressed it. Speed for you, speed for everyone.';
      },
    ],
  },
];
