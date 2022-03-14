# Mobs Plugin

Create and spawn mobs.

<img src="misc/recording.gif">

## Note

There is not much customisable behaviour yet.

## Example usage

`zombies.json`

```js
[
  "type": "zombie_1",
  "name": "Zombie",
  "char": "Z",
  "desc": "a slow moving figure moves in the distance.",
  "voice_lines": ["uuuurgghhhhhh", "brainssss", "...hrkkkkk"],
  "move_sp": 0.5,
  "hp": 20,
  "sp": 10,
  "dmg": 5
  }
]
```

`index.js`

```js
const { emit, makePlugin } = global.plugins;

const plugin = makePlugin("example");

// If you are spawining stuff on server start (which you shouldn't)
// put it in 'ready'
plugin.on('ready', () => {
  mobs.load(require('./zombies.json'));
  mobs.spawn(1, 1, "zombie_1");
  mobs.spawn(-10, -10, "zombie_1");
});
```