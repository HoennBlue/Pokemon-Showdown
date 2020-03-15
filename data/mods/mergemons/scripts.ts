'use strict';

/**@type {ModdedBattleScriptsData} */
exports.BattleScripts = {
	inherit: 'gen7',
	init() {
		let learnsets = Object.assign({}, this.data.Learnsets);
		let dex = [];
		for (let i in this.data.Pokedex) {
			if (this.data.Pokedex[i].num <= 0) continue;
			if (this.data.Pokedex[i].evos) continue;
			if (this.data.Pokedex[i].forme === 'Totem') continue;
			if (!learnsets[i] || !learnsets[i].learnset) continue;
			if (this.data.FormatsData[i].isUnreleased) continue;
			if (this.data.FormatsData[i].tier === 'Illegal') continue;
			dex.push(i);
		}
		dex.push(dex[0], dex[1]);
		for (let i = 2; i < dex.length; i++) {
			for (let target = dex[i - 1]; target; target = this.data.Pokedex[target].prevo) {
				let learnset = this.modData('Learnsets', target).learnset;
				for (let j = i - 2; j <= i; j++) {
					for (let source = dex[j]; source; source = this.data.Pokedex[source].prevo) {
						for (let move in learnsets[source].learnset) {
							if (move === 'shellsmash') continue;
							if (move !== 'sketch') learnset[move] = [this.gen + 'T'];
							else if (!learnset[move]) learnset[move] = ['5E'];
						}
					}
				}
			}
		}
	},
};
