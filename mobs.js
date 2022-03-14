const { chunks, players, emit } = require("./bullet");
const { util } = require("../fov");

const mobs = [];
const unused = [];
const mobTypes = {};

let turn = 0;
const CHECK_UNLOADED_MOB_INTERVAL = 500;

class Mob
{
  constructor(id, type, x, y)
  {
    this.id = id;
    this.type = type;
    this.move_sp = mobTypes[type].move_sp;
    this.public = {
      state: "int",
      username: mobTypes[type].name,
      x,
      y,
      skills: {
        hp: mobTypes[type].hp,
        max_hp: mobTypes[type].hp,

        sp: mobTypes[type].sp,
        max_sp: mobTypes[type].sp,
        dmg: mobTypes[type].dmg,
        level: 0,
      },
    };
    this.state = "travel";
    this.memory = {
      chasing: null
    };
    this.cache = {}
    this.temp = {}
    this.private = {}
  }

  // For battles
  addPropToQueue() {}

  tick()
  {
    switch (this.state)
    {
      case 'travel':
        this.move();
        break;
      default:
    }

  }

  static ALLOWED_BATTLE_OPS = ['h', 'ar', 'al', 'dl', 'dr', 'b'];
  attack(battle)
  {
    battle.onEndChat({message:mobTypes[this.type].voice_lines[Math.floor(Math.random() * 2)]}, this);
    battle.onBattleOpt({option:'h'}, this);
  }

  move()
  {
    if (turn % Math.round(1 / this.move_sp) !== 0)
    {
      return;
    }
    this.findPlayer();
    if (this.memory.chasing)
    {
      let dir = {
        x: this.memory.chasing.public.x - this.public.x,
        y: this.memory.chasing.public.y - this.public.y
      }

      if (dir.x !== 0 && dir.y !== 0)
      {
        if (Math.abs(dir.x) > Math.abs(dir.y))
        {
          this.public.x += Math.sign(dir.x);
        }
        else if (Math.abs(dir.x) === Math.abs(dir.y))
        {
          if (Math.random() > 0.5)
          {
            this.public.x += Math.sign(dir.x);
          }
          else
          {
            this.public.y += Math.sign(dir.y);
          }
        }
        else
        {
          this.public.y += Math.sign(dir.y);
        }
      }
      else
      {
        this.public.x += Math.sign(dir.x);
        this.public.y += Math.sign(dir.y);
      }

      if (this.public.x === this.memory.chasing.public.x && this.public.y === this.memory.chasing.public.y)
      {
        // TODO: cant get emit action pvp-attack
        this.memory.chasing.public.state = 'int';
        if(players.isPlayerOnline(this.memory.chasing.public.username)) {
          this.memory.chasing.addPropToQueue('state');
        }
        require("../the-travelers-plus/src/pvp").attack({ option: this.memory.chasing.public.username }, this);
        this.cache.battleStats = {
          ready: true,
          weapon: "hands"
        };
        this.state = 'int';
      }
    }
  }

  findPlayer()
  {
    const chunkCoords = chunks.toChunkCoords(this.public.x, this.public.y);

    let closestPlayerDist = Infinity;
    let closestPlayer = null;
    for (let x = chunkCoords.x - 1; x < chunkCoords.x + 2; ++x)
    {
      for (let y = chunkCoords.y - 1; y < chunkCoords.y + 2; ++y)
      {
        if (!chunks.isChunkCoordsLoaded(x, y))
          break;
        
        const chunk = chunks.getChunkFromChunkCoords(x, y);
        if (chunk && chunk.meta && chunk.meta.players)
        {
          chunk.meta.players.forEach((name) => {
            const player = players.getPlayerByUsername(name);
            if (player.public.state !== 'travel') return
            const dist = Math.pow(player.public.x - this.public.x, 2) + Math.pow(player.public.y - this.public.y, 2);
            if (dist < 10 * 10 && dist < closestPlayerDist && util.canSee(this.public, player.public))
            {
              closestPlayerDist = dist;
              closestPlayer = player;
            }
          });
        }
      }
    }
    this.memory.chasing = closestPlayer;
  }
}

module.exports.load = (mob) => {
  if (Array.isArray(mob)) {
    mob.forEach((m) => {
      mobTypes[m.type] = m;
      emit('tileDescriptors', 'addTileDescription', m.char, m.desc);
    });
  } else {
    mobTypes[mob.type] = mob;
    emit('tileDescriptors', 'addTileDescription', mob.char, mob.desc);
  }
};

module.exports.spawn = (x, y, mobType) => {  
  if (!mobTypes[mobType]) return console.error(mobType + " is not a valid mob type");
  const chunkCoords = chunks.toChunkCoords(x, y);
  if (!chunks.isChunkCoordsLoaded(chunkCoords.x, chunkCoords.y))
  {
    chunks.loadChunk(chunkCoords.x, chunkCoords.y)
  }
  
  const mobId = mobs.length;
  mobs.push(new Mob(mobId, mobType, x, y));
  const chunk = chunks.getChunkFromChunkCoords(chunkCoords.x, chunkCoords.y);
  if (!chunk.meta.mobs) chunk.meta.mobs = [];
  chunk.meta.mobs.push(mobId);
};

module.exports.kill = (mobId) => {
  if (!mobs[mobId])
    return;
  
  const mob = mobs[mobId];

  const chunkCoords = chunks.toChunkCoords(mob.public.x, mob.public.y);
  if (!chunks.isChunkCoordsLoaded(chunkCoords.x, chunkCoords.y))
  {
    chunks.loadChunk(chunkCoords.x, chunkCoords.y);
  }
  const chunk = chunks.getChunkFromChunkCoords(chunkCoords.x, chunkCoords.y);
  const mobIndex = chunk.meta.mobs.findIndex((mobInChunk) => mobInChunk === mobId);
  if (mobIndex !== -1)
  {
    chunk.meta.mobs.splice(mobIndex, 1);
  }
  
  mobs[mobId] = null;
  unused.push(mobId);
};

module.exports.loadChunk = (chunk) => {
  chunk.meta.mobs = [];
};

module.exports.saveChunk = (chunk) => {
  if (chunk.meta.mobs) chunk.meta.mobs = undefined;
};

module.exports.playerTick = (player) => {
  const {x: chunkX, y: chunkY} = chunks.toChunkCoords(player.public.x, player.public.y);
  const seen = [];
  for(let x = chunkX - 1; x <= chunkX + 1; x++)
	{
		for(let y = chunkY - 1; y <= chunkY + 1; y++)
		{
			if(!chunks.isChunkCoordsLoaded(x, y))
			{
				break;
			}

			// player chunk lists
			const chunk = chunks.getChunkFromChunkCoords(x, y);
			if (chunk.meta.mobs)
      {
        for(const mobId of chunk.meta.mobs)
        {
          const mob = mobs[mobId];
          if(mob &&
            (mob.public.x > player.public.x - 16 && mob.public.x < player.public.x + 16) &&// x values
            (mob.public.y > player.public.y - 16 && mob.public.y < player.public.y + 16)// y values
          ){
            seen.push({x: mob.public.x, y: mob.public.y, char: mobTypes[mob.type].char, m:1});
          }
        }
			}
    }
  }

  if (seen.length > 0)
  {
    player.temp.mobs = seen;
  }
}

module.exports.objectify = (player) => {
  if (player.temp.mobs)
  {
    player.temp.proximity.objs = player.temp.proximity.objs.concat(player.temp.mobs);
    player.addPropToQueue("proximity");
    player.temp.mobs = undefined;
  }
}

module.exports.killPlayer = (mob) => {
  if (mob.type !== undefined) {
    this.kill(mob.id);
  }
}

module.exports.newRound = (battle) =>
 {
  if (battle.player1.type !== undefined) {
    battle.player1.attack(battle);
  }
}

module.exports.tick = () => {
  ++turn;
  // if (turn % CHECK_UNLOADED_MOB_INTERVAL === 0)
  // {
  //   mobs.forEach((mob, mobId) => {
  //     if (!chunks.isChunkLoaded(mob.public.x, mob.public.y))
  //     {
  //       this.kill(mobId);
  //     }
  //   });
  // }

  mobs.forEach((mob) => {
    if (!mob) return;
    mob.tick();

    // Update chunk meta
    const {x: chunkX, y: chunkY} = chunks.toChunkCoords(mob.public.x, mob.public.y);
    if(!chunks.isChunkCoordsLoaded(chunkX, chunkY))
    {
      chunks.loadChunk(chunkX, chunkY);
    }
    const chunk = chunks.getChunkFromChunkCoords(chunkX, chunkY);
    if (!chunk.meta.mobs) chunk.meta.mobs = [];
    if (!chunk.meta.mobs.includes(mob.id)) {
      try {
        chunk.meta.mobs.push(mob.id);
        for(let x = chunkX - 1; x <= chunkX + 1; x++)
        {
          for(let y = chunkY - 1; y <= chunkY + 1; y++)
          {
            if (x === chunkX && y === chunkY) continue;
            if(!chunks.isChunkCoordsLoaded(x, y))
            {
              chunks.loadChunk(x, y);
            }
            const chunkNeighbor = chunks.getChunkFromChunkCoords(x, y);
            if (chunkNeighbor && chunkNeighbor.meta && chunkNeighbor.meta.mobs)
            {
              if (chunkNeighbor.meta.mobs.includes(mob.id)) {
                const mobIndex = chunkNeighbor.meta.mobs.indexOf(mob.id);
                chunkNeighbor.meta.mobs.splice(mobIndex, 1);
              }
            }
          }
        }
      } catch (e) {
        console.log(e)
      }
    }
  });
};