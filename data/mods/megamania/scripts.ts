'use strict';

/**@type {ModdedBattleScriptsData} */
exports.BattleScripts = {
	inherit: 'gen6',
	canMegaEvo(pokemon) {
		if (pokemon.template.isMega || pokemon.template.isPrimal) return null;

		let item = pokemon.getItem();
		if (item.id === 'eviolite' && !pokemon.template.evos.length) {
			let newTemplate = this.dex.deepClone(pokemon.template);
			newTemplate.isMega = true;
			newTemplate.requiredItem = 'eviolite';
			let ability = pokemon.name;
			if (!this.dex.getAbility(ability).exists) ability = pokemon.ability;
			newTemplate.abilities = {0: ability};
			if (pokemon.set.shiny) {
				newTemplate.baseStats.atk += 10;
				newTemplate.baseStats.spa += 30;
			} else {
				newTemplate.baseStats.atk += 30;
				newTemplate.baseStats.spa += 10;
			}
			newTemplate.baseStats.def += 20;
			newTemplate.baseStats.spd += 20;
			newTemplate.baseStats.spe += 20;
			return newTemplate;
		}

		if (item.megaEvolves !== pokemon.baseTemplate.baseSpecies || item.megaStone === pokemon.species) return null;
		return item.megaStone;
	},
};
