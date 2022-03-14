const { makePlugin } = require("./bullet");
const mobs = require("./mobs");

const plugin = makePlugin("mobs");

plugin.on("mobs::load", mobs.load, 0);
plugin.on("mobs::spawn", mobs.spawn, 0);
plugin.on("mobs::kill", mobs.kill, 0);

plugin.on("loadChunk", mobs.loadChunk, -10);
plugin.on("saveChunk", mobs.saveChunk, 0);
plugin.on("playerTick", mobs.playerTick, -10);
plugin.on("playerTick", mobs.objectify, -1000);
plugin.on("gameTickPre", mobs.tick, 0);

plugin.on("travelers::isChallenge", (player, _opponent, challenge) => {
  if (player.type !== undefined)
  {
    challenge.set(false);
  }
}, -1000);
plugin.on("travelers::killPlayer", mobs.killPlayer);
plugin.on('travelers::battles::newRound', mobs.newRound);
plugin.on('travelers::battles::fightStart', mobs.newRound);