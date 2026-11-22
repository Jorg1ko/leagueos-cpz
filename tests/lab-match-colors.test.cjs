'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('player.html', 'utf8');
assert(!/cpz-podium|Podio del grupo|Podio provisional|Podio pendiente/.test(html), 'Se ha reintroducido el podio.');
assert(!html.includes('.match-sets.winner b'), 'No se debe pintar toda una fila según el ganador del partido.');
assert(html.includes("const side=winnerForSet(score,0)?0:1"), 'El ganador se determina individualmente para cada set.');
assert(html.includes("element('strong','match-set-winner',winner)"), 'El ganador de cada set debe destacar en negrita.');
assert(html.includes("element('li','match-set-line')"), 'Cada set debe ocupar su propia línea.');

const source = html.match(/function winnerForSet\(score,side\)\{[\s\S]*?\n\}/);
assert(source, 'Falta la función real para comparar el marcador de cada set.');
const context = vm.createContext({});
vm.runInContext(source[0] + '\nthis.wins = winnerForSet;', context);
const wins = context.wins;

const matchScores = [[11, 7], [9, 11], [11, 6]];
assert.equal(matchScores.filter(score => wins(score, 0)).length, 2);
assert.equal(matchScores.filter(score => wins(score, 1)).length, 1);

for (const score of matchScores) {
 assert.notEqual(wins(score, 0), wins(score, 1), 'Solo un ganador por set.');
}
assert.equal(wins(matchScores[0], 0), true);
assert.equal(wins(matchScores[0], 1), false);
assert.equal(wins(matchScores[1], 0), false);
assert.equal(wins(matchScores[1], 1), true, 'El perdedor del partido también puede ganar un set.');
assert.equal(wins(matchScores[2], 0), true);
console.log('OK: sin podios; ganador de cada set correcto y en negrita, sin colores de victoria.');
